import sys
import json
import traceback
import logging
from datetime import datetime
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from anomaly_api import AnomalyDetectionAPI
except ImportError as e:
    print(json.dumps({
        "error": f"Failed to import required modules: {str(e)}",
        "status": "error",
        "timestamp": datetime.now().isoformat()
    }))
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('integration_bridge.log'),
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)

class NodeJSPythonBridge:
    """Bridge class สำหรับเชื่อมต่อ Node.js กับ Python API v2.1"""
    
    def __init__(self):
        self.api = None
        self.simulator = None
        self.initialize_api()
    
    def initialize_api(self):
        """Initialize Anomaly Detection API"""
        try:
            self.api = AnomalyDetectionAPI(models_path="models/anomaly_detection")
            logger.info("Anomaly Detection API initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize API: {e}")
            self.api = None
    
    def validate_input(self, data):
        """Validate input data from Node.js"""
        required_fields = ['sensor_data']
        
        if not isinstance(data, dict):
            raise ValueError("Input must be a JSON object")
        
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")
        
        if not isinstance(data['sensor_data'], list):
            raise ValueError("sensor_data must be an array")
        
        if len(data['sensor_data']) == 0:
            raise ValueError("sensor_data array cannot be empty")
        
        for i, sensor_point in enumerate(data['sensor_data']):
            if not isinstance(sensor_point, dict):
                raise ValueError(f"sensor_data[{i}] must be an object")
            
            if 'timestamp' not in sensor_point:
                sensor_point['timestamp'] = datetime.now().isoformat()
    
    def process_request(self, input_data):
        """Process request from Node.js"""
        try:
            self.validate_input(input_data)
            
            sensor_data = input_data['sensor_data']
            options = input_data.get('options', {})
            
            method = options.get('method', 'hybrid')
            model = options.get('model', 'gradient_boosting')  
            use_cache = options.get('use_cache', True)
            include_history = options.get('include_history', False)
            health_check = input_data.get('health_check', False)
            
            logger.info(f"Processing request: method={method}, model={model}, data_points={len(sensor_data)}")
            
            if health_check:
                return self.generate_health_check_response()
            
            if method == 'hybrid':
                results = []
                for data_point in sensor_data:
                    result = self.api.detect_anomalies_hybrid(
                        data_point, 
                        data_history=None,
                        ml_model=model,
                        use_cache=use_cache
                    )
                    results.append(result)
                
                if len(results) == 1:
                    return results[0]
                else:
                    return self.combine_multiple_results(results)
                    
            elif method == 'rule_based':
                rule_results = []
                for data_point in sensor_data:
                    result = self.api.detect_anomalies_rules(data_point)
                    rule_results.append(result)
                
                return self.format_rule_based_response(rule_results, sensor_data)
                
            elif method == 'ml_based':
                if not self.api.health_status['models_loaded']:
                    return self.generate_ml_unavailable_response()
                
                X_data = []
                for data_point in sensor_data:
                    X = self.api.preprocess_sensor_data_fixed(data_point)
                    X_data.extend(X)
                
                ml_results = self.api.detect_anomalies_ml_batch(X_data, model)
                return self.format_ml_response(ml_results, sensor_data)
            
            else:
                raise ValueError(f"Unknown method: {method}")
                
        except Exception as e:
            logger.error(f"Error processing request: {e}")
            logger.error(traceback.format_exc())
            return self.generate_error_response(str(e))
    
    def generate_health_check_response(self):
        """Generate simple health check response"""
        health = self.api.get_health_status()
        
        return {
            "success": True,
            "health_check": True,
            "status": health['service_status'],
            "api_version": health['api_version'],
            "models_loaded": health['models_loaded'],
            "uptime_hours": health['uptime_hours'],
            "timestamp": datetime.now().isoformat()
        }
    
    def combine_multiple_results(self, results):
        """Combine multiple detection results"""
        try:
            combined_rule_detections = []
            combined_ml_detections = []
            
            total_anomalies = 0
            alert_levels = []
            health_scores = []
            
            for result in results:
                if 'rule_based_detection' in result:
                    combined_rule_detections.extend(result['rule_based_detection'])
                
                if 'ml_detection' in result:
                    combined_ml_detections.extend(result['ml_detection'])
                
                if 'summary' in result:
                    total_anomalies += result['summary'].get('total_anomalies', 0)
                    alert_levels.append(result['summary'].get('alert_level', 'green'))
                    health_scores.append(result['summary'].get('health_score', 100))
            
            overall_alert_level = 'green'
            if 'red' in alert_levels:
                overall_alert_level = 'red'
            elif 'yellow' in alert_levels:
                overall_alert_level = 'yellow'
            
            avg_health_score = sum(health_scores) / len(health_scores) if health_scores else 100
            
            return {
                "rule_based_detection": combined_rule_detections,
                "ml_detection": combined_ml_detections,
                "summary": {
                    "rule_anomalies_found": len(combined_rule_detections) > 0,
                    "ml_anomalies_found": len(combined_ml_detections) > 0,
                    "total_anomalies": total_anomalies,
                    "alert_level": overall_alert_level,
                    "health_score": round(avg_health_score, 2),
                    "data_points_processed": len(results)
                },
                "performance": {
                    "response_time": 0,
                    "data_points_processed": len(results),
                    "cache_used": False,
                    "models_available": self.api.health_status['models_loaded']
                },
                "metadata": {
                    "api_version": "2.1-fixed",
                    "processing_timestamp": datetime.now().isoformat(),
                    "expected_features": 49,
                    "batch_processing": True,
                    "model_used": "gradient_boosting"
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error combining results: {e}")
            return self.generate_error_response(f"Failed to combine results: {str(e)}")
    
    def format_rule_based_response(self, rule_results, sensor_data):
        """Format rule-based only response"""
        try:
            all_anomalies = []
            for result_list in rule_results:
                all_anomalies.extend(result_list)
            
            rule_detections = []
            total_anomalies = 0
            
            for i, anomaly in enumerate(all_anomalies):
                sensor_point = sensor_data[i] if i < len(sensor_data) else {}
                
                rule_detections.append({
                    "is_anomaly": True,
                    "anomaly_type": anomaly.get('type', 'unknown'),
                    "alert_level": anomaly.get('alert_level', 'yellow'),
                    "message": anomaly.get('message', 'Anomaly detected'),
                    "priority": anomaly.get('priority', 1),
                    "confidence": anomaly.get('confidence', 0.95),
                    "timestamp": anomaly.get('timestamp', datetime.now().isoformat()),
                    "data": sensor_point,
                    "sensor_data": sensor_point
                })
                total_anomalies += 1
            
            if total_anomalies == 0:
                sensor_point = sensor_data[0] if len(sensor_data) > 0 else {}
                rule_detections.append({
                    "is_anomaly": False,
                    "message": "No anomalies detected",
                    "confidence": 0.95,
                    "timestamp": datetime.now().isoformat(),
                    "data": sensor_point,
                    "sensor_data": sensor_point
                })
            
            alert_level = 'green'
            if any(r.get('alert_level') == 'red' for r in rule_detections):
                alert_level = 'red'
            elif any(r.get('alert_level') == 'yellow' for r in rule_detections):
                alert_level = 'yellow'
            
            return {
                "rule_based_detection": rule_detections,
                "ml_detection": [{"is_anomaly": False, "error": "ML detection not requested"}],
                "summary": {
                    "rule_anomalies_found": total_anomalies > 0,
                    "ml_anomalies_found": False,
                    "total_anomalies": total_anomalies,
                    "alert_level": alert_level,
                    "health_score": max(0, 100 - (total_anomalies * 10)),
                    "recommendations": []
                },
                "performance": {
                    "response_time": 0,
                    "data_points_processed": len(rule_results),
                    "cache_used": False,
                    "models_available": False
                },
                "metadata": {
                    "api_version": "2.1-fixed",
                    "processing_timestamp": datetime.now().isoformat(),
                    "method": "rule_based_only"
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error formatting rule-based response: {e}")
            return self.generate_error_response(f"Failed to format rule-based response: {str(e)}")
    
    def format_ml_response(self, ml_results, sensor_data):
        """Format ML-only response"""
        try:
            ml_detections = []
            
            for i, prediction in enumerate(ml_results):
                sensor_point = sensor_data[i] if i < len(sensor_data) else {}
                
                ml_detections.append({
                    "is_anomaly": bool(prediction),
                    "confidence": float(prediction) if isinstance(prediction, (int, float)) else 0.0,
                    "model_used": "gradient_boosting",
                    "timestamp": sensor_point.get('timestamp', datetime.now().isoformat()),
                    "batch_index": i,
                    "feature_count": 49,
                    "data": sensor_point,
                    "sensor_data": sensor_point
                })
            
            anomaly_count = sum(1 for d in ml_detections if d['is_anomaly'])
            
            return {
                "rule_based_detection": [{"is_anomaly": False, "message": "Rule-based detection not requested"}],
                "ml_detection": ml_detections,
                "summary": {
                    "rule_anomalies_found": False,
                    "ml_anomalies_found": anomaly_count > 0,
                    "total_anomalies": anomaly_count,
                    "alert_level": "yellow" if anomaly_count > 0 else "green",
                    "health_score": max(50, 100 - (anomaly_count * 15)),
                    "recommendations": []
                },
                "performance": {
                    "response_time": 0,
                    "data_points_processed": len(sensor_data),
                    "cache_used": False,
                    "models_available": True
                },
                "metadata": {
                    "api_version": "2.1-fixed",
                    "processing_timestamp": datetime.now().isoformat(),
                    "method": "ml_only",
                    "expected_features": 49,
                    "model_used": "gradient_boosting"
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error formatting ML response: {e}")
            return self.generate_error_response(f"Failed to format ML response: {str(e)}")
    
    def generate_ml_unavailable_response(self):
        """Generate response when ML models are not available"""
        return {
            "rule_based_detection": [{"is_anomaly": False, "message": "ML models not available, using fallback"}],
            "ml_detection": [{"is_anomaly": False, "error": "ML models not loaded"}],
            "summary": {
                "rule_anomalies_found": False,
                "ml_anomalies_found": False,
                "total_anomalies": 0,
                "alert_level": "green",
                "health_score": 100,
                "recommendations": []
            },
            "performance": {
                "response_time": 0,
                "data_points_processed": 1,
                "cache_used": False,
                "models_available": False
            },
            "metadata": {
                "api_version": "2.1-fixed",
                "processing_timestamp": datetime.now().isoformat(),
                "error": "ML models not available"
            },
            "timestamp": datetime.now().isoformat()
        }
    
    def generate_error_response(self, error_message):
        """Generate error response"""
        return {
            "error": error_message,
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "api_version": "2.1-fixed"
        }

def main():
    """Main function สำหรับรับข้อมูลจาก Node.js"""
    try:
        bridge = NodeJSPythonBridge()
        
        input_line = sys.stdin.read().strip()
        
        if not input_line:
            print(json.dumps({
                "error": "No input data received",
                "status": "error",
                "timestamp": datetime.now().isoformat()
            }))
            sys.exit(1)
        
        try:
            input_data = json.loads(input_line)
        except json.JSONDecodeError as e:
            print(json.dumps({
                "error": f"Invalid JSON input: {str(e)}",
                "status": "error",
                "timestamp": datetime.now().isoformat()
            }))
            sys.exit(1)
        
        result = bridge.process_request(input_data)
        
        print(json.dumps(result, indent=None, separators=(',', ':')))
        
    except Exception as e:
        logger.error(f"Critical error in main: {e}")
        logger.error(traceback.format_exc())
        
        error_response = {
            "error": f"Critical error: {str(e)}",
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "api_version": "2.1-fixed"
        }
        print(json.dumps(error_response))
        sys.exit(1)

if __name__ == "__main__":
    main()