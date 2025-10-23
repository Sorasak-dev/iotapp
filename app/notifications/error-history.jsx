import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useRoute, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ANOMALY_ENDPOINTS, getAuthHeaders } from "../utils/config/api"; 

const isIOS = Platform.OS === "ios";

const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token found. Please log in.");
    }
    return token;
  } catch (error) {
    console.error("Error retrieving token:", error);
    throw error;
  }
};

const AnomalyService = {
  getHistory: async (token, filters = {}) => {
    try {
      console.log('📡 Fetching anomaly history with filters:', filters);
      
      const queryParams = new URLSearchParams();
      if (filters.deviceId) queryParams.append('deviceId', filters.deviceId);
      if (filters.resolved !== undefined) queryParams.append('resolved', filters.resolved);
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.alertLevel) queryParams.append('alertLevel', filters.alertLevel);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const url = `${ANOMALY_ENDPOINTS.HISTORY}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('❌ Error fetching anomaly history:', error);
      return {
        success: true,
        data: {
          anomalies: [],
          pagination: { page: 1, limit: 20, total: 0 }
        }
      };
    }
  },

  getStats: async (token, days = 7) => {
    try {
      console.log(`📊 Fetching anomaly stats for ${days} days`);
      
      const url = `${ANOMALY_ENDPOINTS.STATS}?days=${days}`;
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('❌ Error fetching anomaly stats:', error);
      return {
        success: true,
        data: {
          total_anomalies: 0,
          resolved_count: 0,
          unresolved_count: 0,
          alertStats: []
        }
      };
    }
  },

  resolveAnomaly: async (token, anomalyId, notes = '') => {
    try {
      console.log(`✅ Resolving anomaly ${anomalyId}`);
      
      const response = await fetch(ANOMALY_ENDPOINTS.RESOLVE(anomalyId), {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ notes }),
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('❌ Error resolving anomaly:', error);
      throw error;
    }
  }
};

const generateUniqueKey = (item, index, prefix = 'item', existingKeys = new Set()) => {
  let baseKey = item?.id || item?._id;
  
  if (!baseKey) {
    const timestamp = item?.timestamp ? new Date(item.timestamp).getTime() : Date.now();
    const deviceId = item?.deviceId || 'unknown';
    const type = item?.anomalyType || item?.type || 'unknown';
    baseKey = `${prefix}-${timestamp}-${deviceId}-${type}-${index}`;
  }

  let uniqueKey = baseKey;
  let suffix = 0;
  while (existingKeys.has(uniqueKey)) {
    suffix++;
    uniqueKey = `${baseKey}-${suffix}`;
  }
  
  existingKeys.add(uniqueKey);
  return uniqueKey;
};

const deduplicateErrors = (errors) => {
  const seen = new Map();
  const unique = [];
  
  for (const error of errors) {
    const dedupKey = `${error.timestamp}-${error.type}-${error.deviceId}-${error.details}`;
    
    if (!seen.has(dedupKey)) {
      seen.set(dedupKey, true);
      unique.push(error);
    }
  }
  
  return unique;
};

export default function ErrorHistory() {
  const route = useRoute();
  const navigation = useNavigation();
  const { errorHistory } = route.params || {};
  
  const [currentErrors, setCurrentErrors] = useState([]);
  const [historicalErrors, setHistoricalErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (errorHistory) {
      try {
        const parsedErrors = JSON.parse(errorHistory);
        const existingKeys = new Set();
        
        const errorsWithUniqueIds = parsedErrors.map((error, index) => ({
          ...error,
          id: generateUniqueKey(error, index, 'current', existingKeys)
        }));
        
        setCurrentErrors(deduplicateErrors(errorsWithUniqueIds));
      } catch (error) {
        console.error("Error parsing error history:", error);
        setCurrentErrors([]);
      }
    }

    fetchData();
  }, [errorHistory]);

  const fetchData = async () => {
    await Promise.all([
      fetchHistoricalErrors(),
      fetchStats()
    ]);
  };

  const fetchHistoricalErrors = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();

      const data = await AnomalyService.getHistory(token, {
        limit: 50,
        page: 1
      });

      console.log('✅ Anomaly history response:', data);

      let anomaliesArray = [];
      
      if (data?.success && data?.data?.anomalies && Array.isArray(data.data.anomalies)) {
        anomaliesArray = data.data.anomalies;
      } else if (data?.data && Array.isArray(data.data)) {
        anomaliesArray = data.data;
      } else {
        console.warn('⚠️ Unexpected API response structure:', data);
        anomaliesArray = [];
      }

      const existingKeys = new Set();

      const formattedHistory = anomaliesArray.map((item, index) => ({
        id: generateUniqueKey(item, index, 'historical', existingKeys),
        type: formatAnomalyType(item?.anomalyType || item?.type || 'unknown'),
        timestamp: item?.timestamp || new Date().toISOString(),
        details: item?.message || 'No details available',
        alertLevel: item?.alertLevel || 'yellow', 
        detectionMethod: item?.detectionMethod || 'unknown',
        score: item?.mlResults?.confidence ? item.mlResults.confidence.toFixed(2) : undefined,
        isAnomalyDetection: item?.detectionMethod === 'ml_based' || item?.detectionMethod === 'hybrid',
        resolved: item?.resolved || false,
        notes: item?.notes || null,
        deviceId: item?.deviceId || 'Unknown',
        sensorData: item?.sensorData || null
      }));

      setHistoricalErrors(deduplicateErrors(formattedHistory));

    } catch (error) {
      console.error("❌ Error fetching historical errors:", error);
      setHistoricalErrors([]);
      
      if (error.message && error.message.includes('401')) {
        await AsyncStorage.removeItem("token");
        navigation.replace("/signin");
        return;
      }
      
      Alert.alert(
        'Error', 
        'Failed to fetch error history. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = await getAuthToken();
      const statsData = await AnomalyService.getStats(token, 7);
      setStats(statsData);
    } catch (error) {
      console.error("❌ Error fetching stats:", error);
    }
  };

  const formatAnomalyType = (type) => {
    const typeMap = {
      'sudden_drop': 'Sudden Value Drop',
      'sudden_spike': 'Sudden Value Spike', 
      'constant_value': 'Constant Values',
      'missing_data': 'Missing Data',
      'low_voltage': 'Low Voltage',
      'high_fluctuation': 'High Fluctuation',
      'vpd_too_low': 'VPD Too Low',
      'dew_point_close': 'Dew Point Alert',
      'battery_depleted': 'Battery Depleted',
      'ml_detected': 'AI Anomaly Detection (Gradient Boosting)' 
    };
    return typeMap[type] || type;
  };

  const handleResolveAnomaly = async (anomalyId) => {
    try {
      const token = await getAuthToken();
      
      Alert.prompt(
        'Resolve Anomaly',
        'Add a note about how this issue was resolved:',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Resolve', 
            onPress: async (notes) => {
              try {
                await AnomalyService.resolveAnomaly(token, anomalyId, notes || 'Resolved by user');
                
                setHistoricalErrors(prev => 
                  prev.map(error => 
                    error.id === anomalyId 
                      ? { ...error, resolved: true, notes: notes || 'Resolved by user' }
                      : error
                  )
                );
                
                Alert.alert('Success', 'Anomaly marked as resolved');
              } catch (error) {
                console.error('❌ Error resolving anomaly:', error);
                Alert.alert('Error', 'Failed to resolve anomaly');
              }
            }
          }
        ],
        'plain-text'
      );
    } catch (error) {
      console.error('❌ Error in resolve process:', error);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const allErrors = useMemo(() => {
    const combined = [...currentErrors, ...historicalErrors];
    const deduplicated = deduplicateErrors(combined);
    return deduplicated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [currentErrors, historicalErrors]);

  const filteredErrors = useMemo(() => {
    return allErrors.filter((error) => {
      if (filter === "all") return true;
      if (filter === "basic") return !error.isAnomalyDetection && !error.score;
      if (filter === "anomaly") return error.isAnomalyDetection || !!error.score;
      return true;
    });
  }, [allErrors, filter]);

  const errorsWithRenderKeys = useMemo(() => {
    const existingKeys = new Set();
    return filteredErrors.map((error, index) => ({
      ...error,
      renderKey: generateUniqueKey(error, index, 'render', existingKeys)
    }));
  }, [filteredErrors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <Text style={styles.header}>Anomaly History</Text>
          </View>

          {/* Stats Summary */}
          {stats?.data?.alertStats && Array.isArray(stats.data.alertStats) && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsTitle}>Last 7 Days Summary</Text>
              <View style={styles.statsGrid}>
                {stats.data.alertStats.map((stat, index) => {
                  const existingKeys = new Set();
                  return (
                    <View key={generateUniqueKey(stat, index, 'stat', existingKeys)} style={[
                      styles.statBox,
                      { backgroundColor: stat._id === 'red' ? '#FFEBEE' : stat._id === 'yellow' ? '#FFF8E1' : '#E8F5E8' }
                    ]}>
                      <Text style={styles.statNumber}>{stat.count}</Text>
                      <Text style={styles.statLabel}>{stat._id?.toUpperCase() || 'UNKNOWN'}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Filters */}
          <View style={styles.filtersContainer}>
            <TouchableOpacity
              onPress={() => setFilter("all")}
              style={[
                styles.filterButton,
                filter === "all" && styles.activeFilter,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === "all" && styles.activeFilterText,
                ]}
              >
                All ({allErrors.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter("basic")}
              style={[
                styles.filterButton,
                filter === "basic" && styles.activeFilter,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === "basic" && styles.activeFilterText,
                ]}
              >
                Basic Errors
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilter("anomaly")}
              style={[
                styles.filterButton,
                filter === "anomaly" && styles.activeFilter,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === "anomaly" && styles.activeFilterText,
                ]}
              >
                AI Detected
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Loading anomaly history...</Text>
            </View>
          ) : errorsWithRenderKeys.length > 0 ? (
            <>
              {errorsWithRenderKeys.map((error) => (
                <View
                  key={error.renderKey}
                  style={[
                    styles.errorItem,
                    error.resolved && styles.resolvedError,
                    error.isAnomalyDetection && styles.anomalyError,
                    error.alertLevel === 'red' && styles.criticalError
                  ]}
                >
                  <View style={styles.errorHeader}>
                    <View style={styles.errorTypeContainer}>
                      <Icon
                        name={
                          error.isAnomalyDetection || error.score
                            ? "analytics"
                            : error.alertLevel === 'red' ? "error" : "warning"
                        }
                        size={24}
                        color={
                          error.isAnomalyDetection || error.score
                            ? "#FF9800"
                            : error.alertLevel === 'red' ? "#D32F2F" : "#FFA000"
                        }
                      />
                      <View style={styles.errorTitleContainer}>
                        <Text style={styles.errorType}>{error.type}</Text>
                        {error.deviceId && (
                          <Text style={styles.deviceId}>Device: {error.deviceId}</Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.errorBadges}>
                      {error.alertLevel && (
                        <View style={[
                          styles.alertBadge,
                          { backgroundColor: error.alertLevel === 'red' ? '#FF5252' : '#FFA726' }
                        ]}>
                          <Text style={styles.alertText}>{error.alertLevel.toUpperCase()}</Text>
                        </View>
                      )}
                      {error.resolved && (
                        <View style={styles.resolvedBadge}>
                          <Text style={styles.resolvedText}>Resolved</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text style={styles.errorDetails}>{error.details}</Text>

                  {error.score && (
                    <Text style={styles.anomalyScore}>
                      AI Confidence: {error.score}
                    </Text>
                  )}

                  {error.notes && (
                    <Text style={styles.errorNotes}>
                      Resolution: {error.notes}
                    </Text>
                  )}

                  <Text style={styles.timestamp}>
                    {new Date(error.timestamp).toLocaleString()}
                  </Text>

                  {!error.resolved && error.id && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleResolveAnomaly(error.id)}
                    >
                      <Text style={styles.actionButtonText}>
                        Mark as Resolved
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          ) : (
            <View style={styles.noErrorsContainer}>
              <Icon name="check-circle" size={48} color="#4CAF50" />
              <Text style={styles.noErrorsText}>No anomalies found</Text>
              <Text style={styles.noErrorsSubtext}>
                There are no {filter !== "all" ? `${filter} ` : ""}anomalies in the
                history.
              </Text>
            </View>
          )}

          <View style={styles.infoContainer}>
            <Icon name="info" size={20} color="#1976D2" />
            <Text style={styles.infoText}>
              Basic Errors are detected by system rules. AI Detected anomalies use 
              Gradient Boosting machine learning (F1-score 94.7%) to identify unusual 
              patterns in sensor data.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: isIOS ? 0 : StatusBar.currentHeight,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 30,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  backButton: {
    padding: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    flex: 1,
    marginLeft: 10,
  },
  statsContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statBox: {
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    minWidth: 60,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  filtersContainer: {
    flexDirection: "row",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  activeFilter: {
    backgroundColor: "#1976D2",
  },
  filterText: {
    color: "#333",
  },
  activeFilterText: {
    color: "white",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  errorItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resolvedError: {
    opacity: 0.7,
    backgroundColor: "#f7f7f7",
  },
  anomalyError: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  criticalError: {
    borderLeftWidth: 4,
    borderLeftColor: "#D32F2F",
  },
  errorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  errorTypeContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  errorTitleContainer: {
    marginLeft: 8,
    flex: 1,
  },
  errorType: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  deviceId: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  errorBadges: {
    alignItems: "flex-end",
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  alertText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  resolvedBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resolvedText: {
    color: "white",
    fontSize: 12,
  },
  errorDetails: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
  },
  anomalyScore: {
    fontSize: 14,
    color: "#FF9800",
    fontWeight: "500",
    marginBottom: 8,
  },
  errorNotes: {
    fontSize: 14,
    color: "#4CAF50",
    fontStyle: "italic",
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: "#E3EAFD",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#1976D2",
    fontWeight: "500",
  },
  noErrorsContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "white",
    borderRadius: 12,
    marginVertical: 20,
  },
  noErrorsText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
    marginTop: 16,
  },
  noErrorsSubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  infoContainer: {
    flexDirection: "row",
    backgroundColor: "#E3EAFD",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: "flex-start",
  },
  infoText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 12,
    flex: 1,
  },
});