import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const SwipeableNotification = ({ 
  item, 
  onPress, 
  onDelete, 
  onResolve,
  getBackgroundColor,
  getIconBackground,
  getIcon,
  getSeverityColor,
  editMode 
}) => {
  const swipeableRef = useRef(null);

  // ✅ Swipe Actions - แสดงปุ่มลบ
  const renderRightActions = (progress, dragX) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.swipeActionsContainer,
          { transform: [{ translateX: trans }] }
        ]}
      >
        {item.canDelete ? (
          <TouchableOpacity
            style={[styles.swipeAction, styles.deleteAction]}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete(item);
            }}
          >
            <Ionicons name="trash" size={24} color="#FFFFFF" />
            <Text style={styles.swipeActionText}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.swipeAction, styles.resolveAction]}
            onPress={() => {
              swipeableRef.current?.close();
              onResolve(item.id, item.isPushNotification);
            }}
          >
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
            <Text style={styles.swipeActionText}>Resolve</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity 
        onPress={() => onPress(item)}
        style={[
          styles.notificationCard,
          { backgroundColor: getBackgroundColor(item.type, item.isRead) }
        ]}
      >
        {/* Icon ด้านซ้าย */}
        <View style={[
          styles.iconContainer,
          { backgroundColor: getIconBackground(item.type) }
        ]}>
          {getIcon(item.title, item.type)}
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.timeContainer}>
              <Text style={styles.cardTime}>{item.time}</Text>
              {!item.isRead && item.status !== 'resolved' && (
                <View style={styles.unreadDot} />
              )}
            </View>
          </View>

          {/* Message */}
          <Text style={styles.cardMessage} numberOfLines={2}>
            {item.message || item.body}
          </Text>

          {/* Sensor Data */}
          {item.anomaly_data && Object.keys(item.anomaly_data).some(key => 
            item.anomaly_data[key] !== null && item.anomaly_data[key] !== undefined
          ) && (
            <View style={styles.sensorRow}>
              {item.anomaly_data.temperature !== undefined && item.anomaly_data.temperature !== null && (
                <Text style={styles.sensorText}>
                  {item.anomaly_data.temperature.toFixed(1)}°C
                </Text>
              )}
              {item.anomaly_data.humidity !== undefined && item.anomaly_data.humidity !== null && (
                <Text style={styles.sensorText}>
                  {item.anomaly_data.humidity.toFixed(1)}%
                </Text>
              )}
              {item.anomaly_data.vpd !== undefined && item.anomaly_data.vpd !== null && (
                <Text style={styles.sensorText}>
                  {item.anomaly_data.vpd.toFixed(2)} kPa
                </Text>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.cardFooter}>
           <Text style={styles.deviceText} numberOfLines={1}>
              {item.location}
            </Text>
            {item.isML && (
              <View style={styles.mlBadge}>
                <Text style={styles.mlBadgeText}>AI</Text>
              </View>
            )}
          </View>
        </View>

        {/* Edit Mode Actions */}
        {editMode && (
          <View style={styles.editActions}>
            {(!item.isRead && item.status !== 'resolved') && (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => onResolve(item.id, item.isPushNotification)}
              >
                <Text style={styles.resolveButtonText}>Resolve</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                styles.editButton, 
                styles.deleteButton,
                !item.canDelete && styles.disabledButton
              ]}
              onPress={() => onDelete(item)}
            >
              <Text style={[
                styles.deleteButtonText,
                !item.canDelete && styles.disabledText
              ]}>
                {item.canDelete ? 'Delete' : 'N/A'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  notificationCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTime: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  cardMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  sensorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  sensorText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  deviceText: {
    fontSize: 12,
    color: '#9CA3AF',
    flex: 1,
  },
  mlBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  mlBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  
  // Swipe Actions
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
    borderRadius: 12,
    marginLeft: 8,
  },
  deleteAction: {
    backgroundColor: '#EF4444',
  },
  resolveAction: {
    backgroundColor: '#10B981',
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  
  // Edit Mode
  editActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 8,
    justifyContent: 'center',
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    alignItems: 'center',
    minWidth: 80,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  resolveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledText: {
    color: '#9CA3AF',
  },
});

export default SwipeableNotification;