import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { Svg, Circle, Path } from "react-native-svg";
import { LineChart } from "react-native-chart-kit";
import ViewShot from "react-native-view-shot";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";  
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_ENDPOINTS, API_TIMEOUT, getAuthHeaders } from "../utils/config/api";

const isWeb = Platform.OS === "web";
const windowWidth = Dimensions.get("window").width;

const DATA_TYPES = [
  {
    key: "Temperature",
    title: "Temperature",
    subtitle: "Temperature readings",
    icon: (
      <Svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <Circle cx="19" cy="19" r="19" fill="#E3F3FF" />
        <Path d="M18.9998 24.4H19.0561M23.1998 24.4C23.1998 26.7196 21.3194 28.6 18.9998 28.6C16.6802 28.6 14.7998 26.7196 14.7998 24.4C14.7998 22.9727 15.5117 21.7118 16.5998 20.9528V11.7984C16.5998 10.4729 17.6743 9.39999 18.9998 9.39999C20.3253 9.39999 21.3998 10.4745 21.3998 11.8V20.9528C22.2591 21.7219 23.1998 23.1561 23.1998 24.4Z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    key: "Humidity",
    title: "Humidity",
    subtitle: "Humidity levels",
    icon: (
      <Svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <Circle cx="19" cy="19" r="19" fill="#FFE8BD" />
        <Path d="M22.5998 20.4C22.064 22.0764 20.7174 23.4168 18.9998 24M18.9999 27.6C15.0298 27.6 11.7998 24.5579 11.7998 20.8187C11.7998 15.6 18.9999 8.39999 18.9999 8.39999C18.9999 8.39999 26.1998 15.6 26.1998 20.8187C26.1998 24.558 22.9699 27.6 18.9999 27.6Z" stroke="#FBA505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    key: "Dew Point",
    title: "Dew Point",
    subtitle: "Dew point measurements",
    icon: (
      <Svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <Circle cx="19" cy="19" r="19" fill="#D2FAFF" />
        <Path d="M22.5998 20.4C22.064 22.0764 20.7174 23.4168 18.9998 24M18.9999 27.6C15.0298 27.6 11.7998 24.5579 11.7998 20.8187C11.7998 15.6 18.9999 8.40002 18.9999 8.40002C18.9999 8.40002 26.1998 15.6 26.1998 20.8187C26.1998 24.558 22.9699 27.6 18.9999 27.6Z" stroke="#0C93B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    key: "VPD",
    title: "VPD",
    subtitle: "VPD measurements",
    icon: (
      <Svg width="38" height="38" viewBox="0 0 38 38" fill="none">
        <Circle cx="19" cy="19" r="19" fill="#D2FAFF" />
        <Path d="M22.5998 20.4C22.064 22.0764 20.7174 23.4168 18.9998 24M18.9999 27.6C15.0298 27.6 11.7998 24.5579 11.7998 20.8187C11.7998 15.6 18.9999 8.40002 18.9999 8.40002C18.9999 8.40002 26.1998 15.6 26.1998 20.8187C26.1998 24.558 22.9699 27.6 18.9999 27.6Z" stroke="#0C93B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
];

const FILE_FORMATS = [
  { key: "CSV", title: "CSV", subtitle: "Comma-separated values for spreadsheets" },
  { key: "PDF", title: "PDF", subtitle: "Portable document format for reports" },
  { key: "Excel", title: "Excel", subtitle: "Microsoft Excel workbook (CSV)" },
];

const fmt = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function ExportDataScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const sensors = useMemo(() => {
    try { return params.sensors ? JSON.parse(params.sensors) : []; } catch { return []; }
  }, [params.sensors]);

  const zones = useMemo(() => {
    try { return params.zones ? JSON.parse(params.zones) : []; } catch { return []; }
  }, [params.zones]);

  const preMetrics = useMemo(() => {
    try { return params.metrics ? JSON.parse(params.metrics) : ["Temperature","Humidity"]; } catch { return ["Temperature","Humidity"]; }
  }, [params.metrics]);

  const [selectedData, setSelectedData] = useState(preMetrics);
  const [selectedFormat, setSelectedFormat] = useState("CSV");
  const [chartMode, setChartMode] = useState("separated"); // "separated" หรือ "combined"
  const [startDate, setStartDate] = useState(() => {
    const date = params.startDate ? new Date(params.startDate) : null;
    console.log("Initial startDate from params:", params.startDate, "=>", date);
    return date;
  });
  const [endDate, setEndDate] = useState(() => {
    const date = params.endDate ? new Date(params.endDate) : null;
    console.log("Initial endDate from params:", params.endDate, "=>", date);
    return date;
  });

  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState({});
  const [maxPoints, setMaxPoints] = useState(0);
  const [exporting, setExporting] = useState(false);

  const shotRef = useRef(null);
  const previewWidth = Math.min(windowWidth * 0.9, 380);
  const exportWidth = Math.max(900, maxPoints * 80);

  const canExport = selectedData.length && startDate && endDate && sensors.length;

  useEffect(() => {
    const run = async () => {
      if (!sensors.length || !startDate || !endDate) { 
        console.log("Missing required params:", { sensors: sensors.length, startDate, endDate });
        setLoading(false); 
        return; 
      }
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem("token");
        if (!token) throw new Error("Please log in again.");
        const headers = getAuthHeaders(token);
        const start = fmt(startDate), end = fmt(endDate);
        
        console.log("Fetching data:", { start, end, sensorsCount: sensors.length });

        const out = {};
        let max = 0;
        for (const s of sensors) {
          try {
            const url = `${API_ENDPOINTS.DEVICES}/${s.id}/data?startDate=${start}&endDate=${end}&limit=10000`;
            console.log("Fetching sensor:", s.id, url);
            const res = await axios.get(url, { headers, timeout: API_TIMEOUT });
            const rows = Array.isArray(res.data?.data) ? res.data.data : [];
            console.log(`Sensor ${s.id} got ${rows.length} rows`);
            rows.sort((a,b)=> new Date(a.timestamp)-new Date(b.timestamp));
            out[s.id] = { name: s.name, rows };
            if (rows.length > max) max = rows.length;
          } catch (e) {
            console.log("fetch sensor fail", s.id, e?.message);
            out[s.id] = { name: s.name, rows: [] };
          }
        }
        console.log("Final dataset:", Object.keys(out).length, "sensors, max points:", max);
        setDataset(out);
        setMaxPoints(max);
      } catch (e) {
        console.error("fetchSensorData error:", e);
        Alert.alert("Error", e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [sensors, startDate, endDate]);

  const buildChartDataByMetric = () => {
    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (!dataset || Object.keys(dataset).length === 0) {
      return { chartsByMetric: {}, points: 0 };
    }

    let ts = [];
    Object.values(dataset).forEach(({ rows }) => {
      if (rows && Array.isArray(rows)) {
        rows.forEach(r => ts.push(r.timestamp));
      }
    });
    
    ts = [...new Set(ts)].sort();

    // ถ้าไม่มี timestamp เลย
    if (ts.length === 0) {
      return { chartsByMetric: {}, points: 0 };
    }

    const days =
      startDate && endDate
        ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000*60*60*24)) + 1
        : 1;

    const labels = ts.map(t => {
      const d = new Date(t);
      return days <= 2
        ? d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
    });

    // สีสำหรับแต่ละ sensor
    const sensorColors = [
      "#E91E63", "#2196F3", "#00BCD4", "#4CAF50", "#FF9800",
      "#9C27B0", "#FF5722", "#009688", "#795548", "#F44336",
    ];

    // สร้างกราฟแยกตาม metric
    const chartsByMetric = {};
    const points = ts.length;

    selectedData.forEach((metric) => {
      const datasets = [];
      let dataKey = '';
      
      if (metric === "Temperature") {
        dataKey = 'temperature';
      } else if (metric === "Humidity") {
        dataKey = 'humidity';
      } else if (metric === "Dew Point") {
        dataKey = 'dew_point';
      } else if (metric === "VPD") {
        dataKey = 'vpd';
      }

      if (dataKey) {
        Object.values(dataset).forEach(({ name, rows }, sensorIndex) => {
          if (!rows || !Array.isArray(rows)) return;
          
          const map = rows.reduce((acc, r) => {
            if (r && r.timestamp) {
              acc[r.timestamp] = r;
            }
            return acc;
          }, {});
          
          const color = sensorColors[sensorIndex % sensorColors.length];
          
          // สร้างข้อมูลสำหรับกราฟ
          const chartValues = ts.map(t => {
            const value = map[t]?.[dataKey];
            // ตรวจสอบว่าเป็นตัวเลขที่ valid
            return (value !== undefined && value !== null && !isNaN(value)) ? Number(value) : 0;
          });
          
          datasets.push({
            data: chartValues,
            color: () => color,
            strokeWidth: 3,
            withDots: true,
            sensorName: name,
            metric: metric,
          });
        });

        chartsByMetric[metric] = {
          labels,
          datasets: datasets.length ? datasets : [{ data: [0, 0, 0], color: () => "transparent" }],
          points,
        };
      }
    });

    return { chartsByMetric, points };
  };

  const { chartsByMetric, points: totalPoints } = useMemo(() => {
    if (loading || !dataset || Object.keys(dataset).length === 0) {
      return { chartsByMetric: {}, points: 0 };
    }
    return buildChartDataByMetric();
  }, [dataset, selectedData, startDate, endDate, loading]);

  const buildCombinedChartData = () => {
    if (!dataset || Object.keys(dataset).length === 0) {
      return { labels: ["No Data"], datasets: [{ data: [0, 0, 0], color: () => "transparent" }] };
    }

    let ts = [];
    Object.values(dataset).forEach(({ rows }) => {
      if (rows && Array.isArray(rows)) {
        rows.forEach(r => ts.push(r.timestamp));
      }
    });
    
    ts = [...new Set(ts)].sort();

    if (ts.length === 0) {
      return { labels: ["No Data"], datasets: [{ data: [0, 0, 0], color: () => "transparent" }] };
    }

    const days =
      startDate && endDate
        ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000*60*60*24)) + 1
        : 1;

    const labels = ts.map(t => {
      const d = new Date(t);
      return days <= 2
        ? d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
    });

    const metricColors = {
      "Temperature": "#E91E63",
      "Humidity": "#2196F3",
      "Dew Point": "#00BCD4",
      "VPD": "#4CAF50"
    };

    const datasets = [];

    Object.entries(dataset).forEach(([_, sensorData], sensorIndex) => {
      if (!sensorData.rows || !Array.isArray(sensorData.rows)) return;
      
      const map = sensorData.rows.reduce((acc, r) => {
        if (r && r.timestamp) {
          acc[r.timestamp] = r;
        }
        return acc;
      }, {});

      selectedData.forEach((metric) => {
        let dataKey = '';
        if (metric === "Temperature") dataKey = 'temperature';
        else if (metric === "Humidity") dataKey = 'humidity';
        else if (metric === "Dew Point") dataKey = 'dew_point';
        else if (metric === "VPD") dataKey = 'vpd';

        if (dataKey) {
          const baseColor = metricColors[metric];
          
          const adjustColor = (hexColor, sensorIdx, totalSensors) => {
            if (totalSensors === 1) return hexColor;
            const hex = hexColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const factor = 1 - (sensorIdx * 0.2);
            return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
          };

          const color = adjustColor(baseColor, sensorIndex, Object.keys(dataset).length);
          
          const chartValues = ts.map(t => {
            const value = map[t]?.[dataKey];
            return (value !== undefined && value !== null && !isNaN(value)) ? Number(value) : 0;
          });
          
          datasets.push({
            data: chartValues,
            color: () => color,
            strokeWidth: 3,
            withDots: true,
            sensorName: sensorData.name,
            metric: metric,
          });
        }
      });
    });

    return {
      labels,
      datasets: datasets.length ? datasets : [{ data: [0, 0, 0], color: () => "transparent" }],
    };
  };

  const combinedChartData = useMemo(() => {
    if (loading || !dataset || Object.keys(dataset).length === 0) {
      return { labels: ["No Data"], datasets: [{ data: [0, 0, 0], color: () => "transparent" }] };
    }
    return buildCombinedChartData();
  }, [dataset, selectedData, startDate, endDate, loading]);

  const toggleDataType = (key) => {
    setSelectedData((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const downloadWebBase64 = (filename, mime, base64) => {
    const link = document.createElement("a");
    link.href = `data:${mime};base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareOrSaveNative = async (uri, mimeType) => {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: "Share export file" });
      return;
    }
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (perm.granted) {
      const asset = await MediaLibrary.createAssetAsync(uri);
      const album = await MediaLibrary.getAlbumAsync("Download");
      if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      else await MediaLibrary.createAlbumAsync("Download", asset, false);
      Alert.alert("Saved", "File saved to Downloads.");
    } else {
      Alert.alert("Saved", uri);
    }
  };

  const buildCSV = () => {
    const headers = ["Sensor","Timestamp"];
    if (selectedData.includes("Temperature")) headers.push("Temperature (°C)");
    if (selectedData.includes("Humidity")) headers.push("Humidity (%)");
    if (selectedData.includes("Dew Point")) headers.push("Dew Point (°C)");
    if (selectedData.includes("VPD")) headers.push("VPD");

    const lines = [headers.join(",")];
    Object.values(dataset).forEach(({ name, rows }) => {
      rows.forEach((r) => {
        const row = [
          JSON.stringify(name),
          JSON.stringify(new Date(r.timestamp).toISOString()),
        ];
        if (selectedData.includes("Temperature")) row.push(r.temperature ?? "");
        if (selectedData.includes("Humidity")) row.push(r.humidity ?? "");
        if (selectedData.includes("Dew Point")) row.push(r.dew_point ?? "");
        if (selectedData.includes("VPD")) row.push(r.vpd ?? "");
        lines.push(row.join(","));
      });
    });
    return lines.join("\n");
  };

  const exportCSVorExcel = async (asExcel = false) => {
    try {
      const csv = buildCSV();
      const baseName = `export_${fmt(startDate)}_${fmt(endDate)}`;
      
      if (isWeb) {
        const base64 = btoa(unescape(encodeURIComponent(csv)));
        downloadWebBase64(`${baseName}.csv`, "text/csv", base64);
        Alert.alert("Success", "File downloaded successfully!");
        return;
      }
      
      const fileUri = `${FileSystem.cacheDirectory}${baseName}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
      await shareOrSaveNative(fileUri, "text/csv");
      Alert.alert("Success", "File exported successfully!");
      
    } catch (error) {
      console.error("Export CSV error:", error);
      throw error;
    }
  };

  const exportPDFwithChart = async () => {
    try {
      if (!totalPoints) {
        Alert.alert("No data", "No chart data in the selected range.");
        return;
      }

      const shotOptions = isWeb
        ? { format: "png", quality: 1, result: "base64" }
        : { format: "png", quality: 1, result: "tmpfile" };

      const imageResult = await shotRef.current.capture(shotOptions);

      if (isWeb) {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "px", format: "a4" });
        const imgWidth = 500;
        const imgHeight = 500 * 0.6; 
        pdf.setFontSize(14);
        pdf.text("Sensor Charts", 24, 32);
        pdf.setFontSize(10);
        pdf.text(`Zones: ${zones.map(z => z.name).join(", ") || "-"}`, 24, 48);
        pdf.text(`Date Range: ${fmt(startDate)} - ${fmt(endDate)}`, 24, 60);
        pdf.text(`Selected: ${selectedData.join(", ")}`, 24, 72);
        pdf.addImage(`data:image/png;base64,${imageResult}`, "PNG", 24, 88, imgWidth, imgHeight);
        const pdfData = pdf.output("datauristring").split(",")[1]; 
        downloadWebBase64(`report_${fmt(startDate)}_${fmt(endDate)}.pdf`, "application/pdf", pdfData);
        Alert.alert("Success", "PDF downloaded successfully!");
      } else {
        const base64 = await FileSystem.readAsStringAsync(imageResult, { encoding: 'base64' });
        
        const html = `
          <html><head><meta charset="utf-8" />
            <style>
              body { margin: 0; padding: 16px; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; }
              h1 { font-size: 18px; margin: 0 0 10px; }
              .meta { color: #555; font-size: 12px; margin-bottom: 12px; }
              .wrap { display:flex; justify-content:center; }
              img { width: 100%; max-width: 1200px; height: auto; border-radius: 12px; }
            </style>
          </head>
          <body>
            <h1>Sensor Charts</h1>
            <div class="meta">
              Zones: ${zones.map(z=>z.name).join(", ") || "-"}<br/>
              Date Range: ${fmt(startDate)} - ${fmt(endDate)}<br/>
              Selected: ${selectedData.join(", ")}
            </div>
            <div class="wrap"><img src="data:image/png;base64,${base64}" /></div>
          </body></html>`;
        
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await shareOrSaveNative(uri, "application/pdf");
        Alert.alert("Success", "PDF exported successfully!");
      }
    } catch (error) {
      console.error("Export PDF error:", error);
      throw error;
    }
  };

  const handleExport = async () => {
    if (!canExport) {
      Alert.alert("Incomplete", "Please select data types and make sure date range & sensors are set.");
      return;
    }
    
    try {
      setExporting(true);
      
      if (selectedFormat === "CSV") {
        await exportCSVorExcel(false);
      } else if (selectedFormat === "Excel") {
        await exportCSVorExcel(true); 
      } else if (selectedFormat === "PDF") {
        await exportPDFwithChart();
      }
    } catch (e) {
      console.error("Export error:", e);
      Alert.alert("Export failed", e?.message ?? String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ paddingVertical: 16, flexDirection:"row", alignItems:"center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Export Data</Text>
        </View>
        <View style={styles.hr} />

        {/* SELECT DATA TYPE */}
        <Text style={styles.sectionLabel}>SELECT DATA TYPE</Text>
        {DATA_TYPES.map((it) => {
          const active = selectedData.includes(it.key);
          return (
            <TouchableOpacity
              key={it.key}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => toggleDataType(it.key)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ marginRight: 12 }}>{it.icon}</View>
                <View>
                  <Text style={styles.cardTitle}>{it.title}</Text>
                  <Text style={styles.cardSub}>{it.subtitle}</Text>
                </View>
              </View>
              <View style={[styles.checkbox, active && styles.checkboxSel]} />
            </TouchableOpacity>
          );
        })}

        {/* SELECT DATE RANGE */}
        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>SELECT DATE RANGE</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={styles.dateBtn}>
            <Text style={styles.dateText}>{startDate ? fmt(startDate) : "Start Date"}</Text>
          </View>
          <View style={styles.dateBtn}>
            <Text style={styles.dateText}>{endDate ? fmt(endDate) : "End Date"}</Text>
          </View>
        </View>
        {isWeb ? (
          <Text style={{ color:"#888", fontSize: 12, marginTop: 6 }}>
            Date change on web is disabled (passed from Statistics).
          </Text>
        ) : null}

        {/* SELECT FILE FORMAT */}
        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>SELECT FILE FORMAT</Text>
        {FILE_FORMATS.map((f) => {
          const active = selectedFormat === f.key;
          return (
            <TouchableOpacity key={f.key} style={styles.formatRow} onPress={() => setSelectedFormat(f.key)}>
              <View style={styles.radioOuter}>{active && <View style={styles.radioInner} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{f.title}</Text>
                <Text style={styles.cardSub}>{f.subtitle}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Chart Mode Toggle */}
        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>CHART VIEW MODE</Text>
        <View style={styles.chartModeContainer}>
          <TouchableOpacity
            style={[styles.modeButton, chartMode === "separated" && styles.modeButtonActive]}
            onPress={() => setChartMode("separated")}
          >
            <Text style={[styles.modeButtonText, chartMode === "separated" && styles.modeButtonTextActive]}>
              Separated
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, chartMode === "combined" && styles.modeButtonActive]}
            onPress={() => setChartMode("combined")}
          >
            <Text style={[styles.modeButtonText, chartMode === "combined" && styles.modeButtonTextActive]}>
              Combined
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preview */}
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>Export Preview</Text>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Selected Data</Text>
            <Text style={styles.previewVal}>
              {selectedData.length ? selectedData.join(", ") : "None selected"}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Date Range</Text>
            <Text style={styles.previewVal}>
              {startDate && endDate ? `${fmt(startDate)} - ${fmt(endDate)}` : "No date selected"}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>File Format</Text>
            <Text style={styles.previewVal}>{selectedFormat}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Sensors</Text>
            <Text style={styles.previewVal}>{sensors?.length ? sensors.map(s=>s.name).join(", ") : "-"}</Text>
          </View>

          {/* แสดงกราฟแยกตาม metric */}
          <View style={{ marginTop: 12 }}>
            {loading ? (
              <View style={{ alignItems:"center", paddingVertical:20, backgroundColor:"#fff", borderRadius:12, padding:10 }}>
                <ActivityIndicator />
                <Text style={{ color:"#666", marginTop:8 }}>Loading data…</Text>
              </View>
            ) : totalPoints === 0 || Object.keys(chartsByMetric).length === 0 ? (
              <View style={{ alignItems:"center", paddingVertical:20, backgroundColor:"#fff", borderRadius:12, padding:10 }}>
                <Text style={{ color:"#666", fontSize: 14 }}>No data available for selected date range</Text>
                <Text style={{ color:"#999", fontSize: 12, marginTop: 4 }}>Please select a different date range</Text>
              </View>
            ) : chartMode === "separated" ? (
              <>
                {selectedData.map((metric) => {
                  const chartData = chartsByMetric[metric];
                  if (!chartData || !chartData.datasets || chartData.datasets.length === 0) return null;

                  return (
                    <View key={metric} style={styles.chartContainer}>
                      <Text style={styles.chartTitle}>{metric}</Text>
                      <View style={styles.chartWrapper}>
                        <LineChart
                          data={chartData}
                          width={previewWidth - 20}
                          height={220}
                          chartConfig={{
                            backgroundColor: "#ffffff",
                            backgroundGradientFrom: "#ffffff",
                            backgroundGradientTo: "#ffffff",
                            decimalPlaces: 1,
                            color: (o = 1) => `rgba(0,0,0,${o})`,
                            labelColor: (o = 1) => `rgba(0,0,0,${o})`,
                            propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
                            propsForBackgroundLines: { strokeDasharray: "5, 5", strokeWidth: 1, stroke: "#e0e0e0" },
                            propsForLabels: { fontSize: 10, fontWeight: "bold" },
                          }}
                          bezier
                          withInnerLines
                          withOuterLines={false}
                          withVerticalLines
                          withHorizontalLines
                          withDots
                          withShadow={false}
                          segments={5}
                          style={{ borderRadius: 12 }}
                        />
                      </View>
                      
                      {/* Legend */}
                      <View style={styles.legendContainer}>
                        {chartData.datasets
                          .filter((d) => d.sensorName)
                          .map((d, i) => (
                            <View key={i} style={styles.legendItem}>
                              <View style={[styles.legendDot, { backgroundColor: d.color(1) }]} />
                              <Text style={styles.legendText}>{d.sensorName}</Text>
                            </View>
                          ))}
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={styles.chartContainer}>
                <View style={styles.chartWrapper}>
                  <LineChart
                    data={combinedChartData}
                    width={previewWidth - 20}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#ffffff",
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 1,
                      color: (o = 1) => `rgba(0,0,0,${o})`,
                      labelColor: (o = 1) => `rgba(0,0,0,${o})`,
                      propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
                      propsForBackgroundLines: { strokeDasharray: "5, 5", strokeWidth: 1, stroke: "#e0e0e0" },
                      propsForLabels: { fontSize: 10, fontWeight: "bold" },
                    }}
                    bezier
                    withInnerLines
                    withOuterLines={false}
                    withVerticalLines
                    withHorizontalLines
                    withDots
                    withShadow={false}
                    segments={5}
                    style={{ borderRadius: 12 }}
                  />
                </View>
                
                {/* Legend */}
                <View style={styles.legendContainer}>
                  {combinedChartData.datasets
                    .filter((d) => d.sensorName)
                    .map((d, i) => (
                      <View key={i} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: d.color(1) }]} />
                        <Text style={styles.legendText}>{d.sensorName} - {d.metric}</Text>
                      </View>
                    ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* actions */}
        <TouchableOpacity
          style={[styles.primaryBtn, (!canExport || loading || exporting) && { opacity: 0.5 }]}
          disabled={!canExport || loading || exporting}
          onPress={handleExport}
        >
          {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Export Data</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* hidden WIDE chart for high-res export - แยกตาม metric */}
      <View style={{ position: "absolute", left: -9999, top: -9999, width: exportWidth }}>
        {!loading && selectedData.map((metric) => {
          const chartData = chartsByMetric[metric];
          if (!chartData) return null;

          return (
            <ViewShot
              key={metric}
              ref={metric === selectedData[0] ? shotRef : null}
              style={{ backgroundColor: "#fff", padding: 12, borderRadius: 12, marginBottom: 12 }}
              options={isWeb ? { format: "png", quality: 1, result: "base64" } : { format: "png", quality: 1, result: "tmpfile" }}
            >
              <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8, textAlign: "center" }}>{metric}</Text>
              <LineChart
                data={chartData}
                width={exportWidth}
                height={420}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 1,
                  color: (o = 1) => `rgba(0,0,0,${o})`,
                  labelColor: (o = 1) => `rgba(0,0,0,${o})`,
                  propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
                  propsForBackgroundLines: { strokeDasharray: "5, 5", strokeWidth: 1, stroke: "#e0e0e0" },
                  propsForLabels: { fontSize: 10, fontWeight: "bold" },
                }}
                bezier
                withInnerLines
                withOuterLines={false}
                withVerticalLines
                withHorizontalLines
                withDots
                withShadow={false}
                segments={6}
                style={{ borderRadius: 12 }}
              />
            </ViewShot>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 20 },
  header: { fontSize: 24, fontWeight: "bold" },
  hr: { height: 1, backgroundColor: "#eee", marginTop: 12, marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "bold", color: "#666", marginTop: 12, marginBottom: 10 },
  card: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12, borderWidth: 1.5, borderColor: "#e5e5e5", borderRadius: 12, marginBottom: 10,
  },
  cardActive: { borderColor: "#3B82F6" },
  cardTitle: { fontWeight: "600" },
  cardSub: { color: "#666", fontSize: 12 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: "#e5e5e5", borderRadius: 4 },
  checkboxSel: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  dateBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8 },
  dateText: { color: "#111" },
  formatRow: {
    flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1, borderColor: "#e5e5e5",
    borderRadius: 12, marginBottom: 10,
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#3B82F6",
    marginRight: 12, alignItems: "center", justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#3B82F6" },
  previewBox: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, marginTop: 16 },
  previewTitle: { fontWeight: "700", marginBottom: 8 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  previewLabel: { color: "#666" },
  previewVal: { color: "#111", flex: 1, textAlign: "right", marginLeft: 12 },
  chartModeContainer: { flexDirection: "row", gap: 10, marginTop: 8 },
  modeButton: { 
    flex: 1, 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    backgroundColor: "#f0f0f0", 
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e5e5"
  },
  modeButtonActive: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  modeButtonText: { color: "#666", fontWeight: "600", fontSize: 13 },
  modeButtonTextActive: { color: "#fff" },
  chartContainer: { 
    backgroundColor:"#fff", 
    borderRadius:12, 
    padding:16, 
    marginBottom:12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  chartTitle: { fontSize: 16, fontWeight: "bold", color: "#333", marginBottom: 12, textAlign: "center" },
  legendContainer: { 
    flexDirection: "row", 
    justifyContent: "center", 
    marginTop: 12, 
    flexWrap: "wrap",
    paddingHorizontal: 8,
  },
  legendItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginHorizontal: 6, 
    marginBottom: 4 
  },
  legendDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    marginRight: 4 
  },
  legendText: { fontSize: 10, color: "#444" },
  primaryBtn: {
    backgroundColor: "#3B82F6", padding: 16, borderRadius: 12, alignItems: "center",
    marginTop: 18,
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  cancelBtn: { padding: 16, alignItems: "center", marginTop: 8, marginBottom: 24 },
  cancelText: { color: "#666" },
});