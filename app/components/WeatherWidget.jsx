import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import axios from "axios";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const { width } = Dimensions.get("window");

const WEATHER_API_KEY = "137ea86a7cc8fd70e39b16ad03c010a4";
const CITY_NAME = "Chiang Rai";
const COUNTRY_CODE = "TH";

const WeatherWidget = () => {
  const { t } = useTranslation();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [highLowTemp, setHighLowTemp] = useState({ high: 0, low: 0 });

  useEffect(() => {
    fetchWeather();
    updateCurrentTime();
    
    const interval = setInterval(updateCurrentTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      
      const currentResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${CITY_NAME},${COUNTRY_CODE}&appid=${WEATHER_API_KEY}&units=metric`
      );
      
      const forecastResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?q=${CITY_NAME},${COUNTRY_CODE}&appid=${WEATHER_API_KEY}&units=metric`
      );
      
      const today = new Date().toISOString().split('T')[0];
      const todayForecasts = forecastResponse.data.list.filter(item => 
        item.dt_txt.split(' ')[0] === today
      );
      
      let highTemp = -100;
      let lowTemp = 100;
      
      if (todayForecasts.length > 0) {
        todayForecasts.forEach(forecast => {
          if (forecast.main.temp_max > highTemp) highTemp = forecast.main.temp_max;
          if (forecast.main.temp_min < lowTemp) lowTemp = forecast.main.temp_min;
        });
      } else {
        highTemp = currentResponse.data.main.temp_max;
        lowTemp = currentResponse.data.main.temp_min;
      }
      
      setHighLowTemp({
        high: Math.round(highTemp),
        low: Math.round(lowTemp)
      });
      
      setWeather(currentResponse.data);
    } catch (error) {
      console.error("Error fetching weather:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const updateCurrentTime = () => {
    const now = new Date();
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[now.getDay()];
    
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    setCurrentTime(`${t(day.toLowerCase())} ${hours}.${minutes}`);
  };

  const getWeatherIcon = (condition) => {
    switch (condition) {
      case "Clear":
        return <Ionicons name="sunny" size={32} color="#FFA500" />;
      case "Rain":
        return <Ionicons name="rainy" size={32} color="#007AFF" />;
      case "Clouds":
        return <Ionicons name="cloud" size={32} color="#666" />;
      case "Mist":
      case "Fog":
      case "Haze":
        return <Ionicons name="cloud-outline" size={32} color="#A9A9A9" />;
      case "Thunderstorm":
        return <Ionicons name="thunderstorm" size={32} color="#FF4500" />;
      case "Snow":
        return <Ionicons name="snow" size={32} color="#00BFFF" />;
      case "Tornado":
        return <Ionicons name="warning" size={32} color="#8B0000" />;
      default:
        return <Ionicons name="partly-sunny" size={32} color="#FFA500" />;
    }
  };

  if (loading) {
    return (
      <View style={[styles.weatherWidget, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={[styles.weatherWidget, styles.errorContainer]}>
        <Text style={styles.errorText}>{t("Failed to load weather data")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.weatherWidget}>
      <View style={styles.leftContent}>
        <View style={styles.locationContainer}>
          <Feather name="map-pin" size={24} color="#555" />
          <Text style={styles.locationText}>{CITY_NAME}</Text>
        </View>
        <Text style={styles.timeText}>{currentTime}</Text>
        <View style={styles.tempRangeContainer}>
          <Text style={styles.tempRangeText}>
            H:{highLowTemp.high}° L:{highLowTemp.low}°
          </Text>
        </View>
      </View>
      <View style={styles.rightContent}>
        <Text style={styles.temperature}>{Math.round(weather.main.temp)}°C</Text>
        <View style={styles.conditionContainer}>
          {weather.weather[0] && getWeatherIcon(weather.weather[0].main)}
          <Text style={styles.conditionText}>
            {t(weather.weather[0]?.main.toLowerCase() || "unknown")}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  weatherWidget: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 140,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 140,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 16,
  },
  leftContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#444",
    marginLeft: 8,
  },
  timeText: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
    marginBottom: 8,
  },
  tempRangeContainer: {
    marginTop: 8,
  },
  tempRangeText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  rightContent: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  temperature: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
    textAlign: "right",
  },
  conditionContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  conditionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
    marginLeft: 8,
  },
});

export default WeatherWidget;