import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  Platform
} from 'react-native';
import { Svg, Circle, Path } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';

const Index = () => {
  const [selectedFormat, setSelectedFormat] = useState('CSV');
  const [selectedData, setSelectedData] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateType, setDateType] = useState('start'); // 'start' or 'end'

  const Temperature = [
    {
      name: "Temperature",
      des: "Temperature readings",
      svg: (
        <Svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <Circle cx="19" cy="19" r="19" fill="#E3F3FF" />
          <Path d="M18.9998 24.4H19.0561M23.1998 24.4C23.1998 26.7196 21.3194 28.6 18.9998 28.6C16.6802 28.6 14.7998 26.7196 14.7998 24.4C14.7998 22.9727 15.5117 21.7118 16.5998 20.9528V11.7984C16.5998 10.4729 17.6743 9.39999 18.9998 9.39999C20.3253 9.39999 21.3998 10.4745 21.3998 11.8V20.9528C22.2591 21.7219 23.1998 23.1561 23.1998 24.4Z" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )
    },
    {
      name: "Humidity",
      des: "Humidity levels",
      svg: (
        <Svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <Circle cx="19" cy="19" r="19" fill="#FFE8BD" />
          <Path d="M22.5998 20.4C22.064 22.0764 20.7174 23.4168 18.9998 24M18.9999 27.6C15.0298 27.6 11.7998 24.5579 11.7998 20.8187C11.7998 15.6 18.9999 8.39999 18.9999 8.39999C18.9999 8.39999 26.1998 15.6 26.1998 20.8187C26.1998 24.558 22.9699 27.6 18.9999 27.6Z" stroke="#FBA505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )
    },
    {
      name: "Dew Point",
      des: "Dew point measurements",
      svg: (
        <Svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <Circle cx="19" cy="19" r="19" fill="#D2FAFF" />
          <Path d="M22.5998 20.4C22.064 22.0764 20.7174 23.4168 18.9998 24M18.9999 27.6C15.0298 27.6 11.7998 24.5579 11.7998 20.8187C11.7998 15.6 18.9999 8.40002 18.9999 8.40002C18.9999 8.40002 26.1998 15.6 26.1998 20.8187C26.1998 24.558 22.9699 27.6 18.9999 27.6Z" stroke="#0C93B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )
    },
    {
      name: "VPD",
      des: "VPD measurements",
      svg: (
        <Svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <Circle cx="19" cy="19" r="19" fill="#D2FAFF" />
          <Path d="M22.5998 20.4C22.064 22.0764 20.7174 23.4168 18.9998 24M18.9999 27.6C15.0298 27.6 11.7998 24.5579 11.7998 20.8187C11.7998 15.6 18.9999 8.40002 18.9999 8.40002C18.9999 8.40002 26.1998 15.6 26.1998 20.8187C26.1998 24.558 22.9699 27.6 18.9999 27.6Z" stroke="#0C93B0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )
    },
  ];

  const fileFormats = [
    {
      name: "CSV",
      description: "Comma-separated values for spreadsheets"
    },
    {
      name: "PDF",
      description: "Portable document format for reports"
    },
    {
      name: "Excel",
      description: "Microsoft Excel workbook"
    }
  ];

  const handleDataSelection = (name) => {
    if (selectedData.includes(name)) {
      setSelectedData(selectedData.filter(item => item !== name));
    } else {
      setSelectedData([...selectedData, name]);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateRange(prev => ({
        ...prev,
        [dateType]: selectedDate.toISOString().split('T')[0]
      }));
    }
  };

  const showDateSelector = (type) => {
    setDateType(type);
    setShowDatePicker(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Export Data</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT DATA TYPE</Text>
          {Temperature.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.dataTypeItem}
              onPress={() => handleDataSelection(item.name)}
            >
              <View style={styles.dataTypeContent}>
                <View style={styles.iconContainer}>{item.svg}</View>
                <View>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemDescription}>{item.des}</Text>
                </View>
              </View>
              <View style={[
                styles.checkbox,
                selectedData.includes(item.name) && styles.checkboxSelected
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT DATE RANGE</Text>
          <View style={styles.dateContainer}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => showDateSelector('startDate')}
            >
              <Text>{dateRange.startDate || 'Start Date'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => showDateSelector('endDate')}
            >
              <Text>{dateRange.endDate || 'End Date'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT FILE FORMAT</Text>
          {fileFormats.map((format, index) => (
            <TouchableOpacity
              key={index}
              style={styles.formatItem}
              onPress={() => setSelectedFormat(format.name)}
            >
              <View style={styles.radioButton}>
                {selectedFormat === format.name && <View style={styles.radioSelected} />}
              </View>
              <View style={styles.formatContent}>
                <Text style={styles.formatTitle}>{format.name}</Text>
                <Text style={styles.formatDescription}>{format.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Export Preview</Text>
          <View style={styles.previewContent}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Selected Data</Text>
              <Text>{selectedData.join(', ') || 'None selected'}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Date Range</Text>
              <Text>
                {dateRange.startDate && dateRange.endDate
                  ? `${dateRange.startDate} - ${dateRange.endDate}`
                  : 'No date selected'}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>File Format</Text>
              <Text>{selectedFormat}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Estimated Size</Text>
              <Text>1.2 MB</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.exportButton,
            (!selectedData.length || !dateRange.startDate || !dateRange.endDate) && styles.exportButtonDisabled
          ]}
          disabled={!selectedData.length || !dateRange.startDate || !dateRange.endDate}
        >
          <Text style={styles.exportButtonText}>Export Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  dataTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    marginBottom: 8,
  },
  dataTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    padding: 8,
  },
  itemTitle: {
    fontWeight: '500',
  },
  itemDescription: {
    color: '#666',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 4,
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
  },
  formatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    marginBottom: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3B82F6',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  formatContent: {
    flex: 1,
  },
  formatTitle: {
    fontWeight: '500',
  },
  formatDescription: {
    color: '#666',
    fontSize: 12,
  },
  previewSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  previewContent: {
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  previewLabel: {
    color: '#666',
  },
  exportButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  exportButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#666',
  },
});

export default Index;