import React, { useState, useEffect } from "react";
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
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useRoute, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const API_URL = "http://172.16.22.104:3000";
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
    const navigation = useNavigation();
    navigation.replace("/signin");
    throw error;
  }
};

export default function ErrorHistory() {
  const route = useRoute();
  const navigation = useNavigation();
  const { errorHistory } = route.params || {};
  const [currentErrors, setCurrentErrors] = useState([]);
  const [historicalErrors, setHistoricalErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (errorHistory) {
      try {
        const parsedErrors = JSON.parse(errorHistory);
        setCurrentErrors(parsedErrors);
      } catch (error) {
        console.error("Error parsing error history:", error);
      }
    }

    fetchHistoricalErrors();
  }, [errorHistory]);

  const fetchHistoricalErrors = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();

      const response = await fetch(`${API_URL}/api/anomaly/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        await AsyncStorage.removeItem("token");
        navigation.replace("/signin");
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error("Failed to fetch error history");
      }

      const data = await response.json();

      const formattedHistory = data.history.map((item) => ({
        type: item.anomaly_type || "ความผิดปกติไม่ทราบสาเหตุ",
        timestamp: item.timestamp,
        details: item.details || "ตรวจพบความผิดปกติในข้อมูลเซ็นเซอร์",
        score: item.anomaly_score ? item.anomaly_score.toFixed(2) : undefined,
        isAnomalyDetection: !!item.anomaly_score,
        resolved: item.resolved || false,
      }));

      setHistoricalErrors(formattedHistory);
    } catch (error) {
      console.error("Error fetching historical errors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const allErrors = [...currentErrors, ...historicalErrors].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const filteredErrors = allErrors.filter((error) => {
    if (filter === "all") return true;
    if (filter === "basic") return !error.isAnomalyDetection && !error.score;
    if (filter === "anomaly") return error.isAnomalyDetection || !!error.score;
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            <Text style={styles.header}>Error History</Text>
          </View>

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
                All
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
                Anomalies
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Loading error history...</Text>
            </View>
          ) : filteredErrors.length > 0 ? (
            <>
              {filteredErrors.map((error, index) => (
                <View
                  key={index}
                  style={[
                    styles.errorItem,
                    error.resolved && styles.resolvedError,
                    error.isAnomalyDetection && styles.anomalyError,
                  ]}
                >
                  <View style={styles.errorHeader}>
                    <View style={styles.errorTypeContainer}>
                      <Icon
                        name={
                          error.isAnomalyDetection || error.score
                            ? "warning"
                            : "error"
                        }
                        size={24}
                        color={
                          error.isAnomalyDetection || error.score
                            ? "#FF9800"
                            : "#D32F2F"
                        }
                      />
                      <Text style={styles.errorType}>{error.type}</Text>
                    </View>
                    {error.resolved && (
                      <View style={styles.resolvedBadge}>
                        <Text style={styles.resolvedText}>Resolved</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.errorDetails}>{error.details}</Text>

                  <Text style={styles.timestamp}>
                    {new Date(error.timestamp).toLocaleString()}
                  </Text>

                  {!error.resolved && (
                    <TouchableOpacity style={styles.actionButton}>
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
              <Text style={styles.noErrorsText}>No errors found</Text>
              <Text style={styles.noErrorsSubtext}>
                There are no {filter !== "all" ? `${filter} ` : ""}errors in the
                history.
              </Text>
            </View>
          )}

          <View style={styles.infoContainer}>
            <Icon name="info" size={20} color="#1976D2" />
            <Text style={styles.infoText}>
              Basic Errors are detected directly by the system. Anomalies are
              detected by our AI model based on unusual patterns in the sensor
              data.
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
  errorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  errorTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  errorType: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 8,
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
