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
import * as FileSystem from "expo-file-system";
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
  const [startDate, setStartDate] = useState(params.startDate ? new Date(params.startDate) : null);
  const [endDate, setEndDate] = useState(params.endDate ? new Date(params.endDate) : null);

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
      if (!sensors.length || !startDate || !endDate) { setLoading(false); return; }
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem("token");
        if (!token) throw new Error("Please log in again.");
        const headers = getAuthHeaders(token);
        const start = fmt(startDate), end = fmt(endDate);

        const out = {};
        let max = 0;
        for (const s of sensors) {
          try {
            const url = `${API_ENDPOINTS.DEVICES}/${s.id}/data?startDate=${start}&endDate=${end}&limit=10000`;
            const res = await axios.get(url, { headers, timeout: API_TIMEOUT });
            const rows = Array.isArray(res.data?.data) ? res.data.data : [];
            rows.sort((a,b)=> new Date(a.timestamp)-new Date(b.timestamp));
            out[s.id] = { name: s.name, rows };
            if (rows.length > max) max = rows.length;
          } catch (e) {
            console.log("fetch sensor fail", s.id, e?.message);
            out[s.id] = { name: s.name, rows: [] };
          }
        }
        setDataset(out);
        setMaxPoints(max);
      } catch (e) {
        console.error(e);
        Alert.alert("Error", e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [sensors, startDate, endDate]);

  const buildChartData = () => {
    let ts = [];
    Object.values(dataset).forEach(({ rows }) => rows.forEach(r => ts.push(r.timestamp)));
    ts = [...new Set(ts)].sort();

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

    const datasets = [];
    Object.values(dataset).forEach(({ name, rows }, idx) => {
      const map = rows.reduce((acc, r) => ((acc[r.timestamp] = r), acc), {});
      const color = (o=1, tone="base") => {
        const sets = {
          base: ["255,99,132","54,162,235","75,192,192","34,197,94","255,206,86","153,102,255","255,159,64","32,201,151","108,117,125","253,126,20"],
          dark: ["215,59,92","14,122,195","35,152,152","0,157,54","215,166,46","113,62,215","215,119,24","0,161,111","68,77,85","213,86,0"],
          light:["255,139,172","94,202,255","115,232,232","74,237,134","255,246,126","193,142,255","255,199,104","72,241,191","148,157,165","255,166,60"]
        }["base"];
        return `rgba(${sets[idx % sets.length]},${o})`;
      };

      if (selectedData.includes("Temperature"))
        datasets.push({ data: ts.map(t => map[t]?.temperature ?? 0), color: (o)=>color(o,"base"), strokeWidth: 2, withDots: true, sensorName: name, metric: "Temperature" });
      if (selectedData.includes("Humidity"))
        datasets.push({ data: ts.map(t => map[t]?.humidity ?? 0), color: (o)=>color(o,"dark"), strokeWidth: 2, withDots: true, dashArray:[5,5], sensorName: name, metric: "Humidity" });
      if (selectedData.includes("Dew Point"))
        datasets.push({ data: ts.map(t => map[t]?.dew_point ?? 0), color: (o)=>color(o,"light"), strokeWidth: 2, withDots: true, dashArray:[2,2], sensorName: name, metric: "Dew Point" });
      if (selectedData.includes("VPD"))
        datasets.push({ data: ts.map(t => map[t]?.vpd ?? 0), color: (o)=>color(o,"dark"), strokeWidth: 2, withDots: true, dashArray:[5,2,2,2], sensorName: name, metric: "VPD" });
    });

    return {
      labels: ts.length ? labels : ["No Data"],
      datasets: datasets.length ? datasets : [{ data: [0,0,0], color: ()=>"transparent" }],
      points: ts.length,
    };
  };

  const chartData = buildChartData();

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

  const exportCSVorExcel = async (asExcel=false) => {
    const csv = buildCSV();
    const baseName = `export_${fmt(startDate)}_${fmt(endDate)}`;
    if (isWeb) {
      const base64 = btoa(unescape(encodeURIComponent(csv)));
      downloadWebBase64(`${baseName}.${asExcel ? "csv" : "csv"}`, "text/csv", base64);
      return;
    }
    const fileUri = `${FileSystem.cacheDirectory}${baseName}.${asExcel ? "csv" : "csv"}`;
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await shareOrSaveNative(fileUri, "text/csv");
  };

  const exportPDFwithChart = async () => {
    if (!chartData.points) {
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
      pdf.text("Sensor Chart", 24, 32);
      pdf.setFontSize(10);
      pdf.text(`Zones: ${zones.map(z => z.name).join(", ") || "-"}`, 24, 48);
      pdf.text(`Date Range: ${fmt(startDate)} - ${fmt(endDate)}`, 24, 60);
      pdf.text(`Selected: ${selectedData.join(", ")}`, 24, 72);
      pdf.addImage(`data:image/png;base64,${imageResult}`, "PNG", 24, 88, imgWidth, imgHeight);
      const pdfData = pdf.output("datauristring").split(",")[1]; 
      downloadWebBase64(`report_${fmt(startDate)}_${fmt(endDate)}.pdf`, "application/pdf", pdfData);
    } else {
      const base64 =
        await FileSystem.readAsStringAsync(imageResult, { encoding: FileSystem.EncodingType.Base64 });
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
          <h1>Sensor Chart</h1>
          <div class="meta">
            Zones: ${zones.map(z=>z.name).join(", ") || "-"}<br/>
            Date Range: ${fmt(startDate)} - ${fmt(endDate)}<br/>
            Selected: ${selectedData.join(", ")}
          </div>
          <div class="wrap"><img src="data:image/png;base64,${base64}" /></div>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await shareOrSaveNative(uri, "application/pdf");
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
      console.error(e);
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

          {/* chart preview */}
          <View style={{ backgroundColor:"#fff", borderRadius:12, padding:10, marginTop:12 }}>
            {loading ? (
              <View style={{ alignItems:"center", paddingVertical:20 }}>
                <ActivityIndicator />
                <Text style={{ color:"#666", marginTop:8 }}>Loading data…</Text>
              </View>
            ) : (
              <LineChart
                data={chartData}
                width={previewWidth}
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

      {/* hidden WIDE chart for high-res export */}
      <ViewShot
        ref={shotRef}
        style={{ position: "absolute", left: -9999, top: -9999, width: exportWidth, backgroundColor: "#fff", padding: 12, borderRadius: 12 }}
        options={isWeb ? { format: "png", quality: 1, result: "base64" } : { format: "png", quality: 1, result: "tmpfile" }}
      >
        {!loading && (
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
        )}
      </ViewShot>
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
  primaryBtn: {
    backgroundColor: "#3B82F6", padding: 16, borderRadius: 12, alignItems: "center",
    marginTop: 18,
  },
  primaryText: { color: "#fff", fontWeight: "600" },
  cancelBtn: { padding: 16, alignItems: "center", marginTop: 8, marginBottom: 24 },
  cancelText: { color: "#666" },
});
