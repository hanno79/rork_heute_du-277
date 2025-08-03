import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView, Alert, Platform } from 'react-native';
import { Clock, Calendar, X } from 'lucide-react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';
import useNotifications from '@/hooks/useNotifications';

interface NotificationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationSettings({ visible, onClose }: NotificationSettingsProps) {
  const { t } = useLanguage();
  const { settings, capabilities, setTime, setDays, setQuickSchedule } = useNotifications();
  const [selectedTime, setSelectedTime] = useState<string>(settings.time);
  const [selectedDays, setSelectedDays] = useState<number[]>(settings.days);

  const dayNames = [
    { key: 0, label: t('sunday') },
    { key: 1, label: t('monday') },
    { key: 2, label: t('tuesday') },
    { key: 3, label: t('wednesday') },
    { key: 4, label: t('thursday') },
    { key: 5, label: t('friday') },
    { key: 6, label: t('saturday') },
  ];

  const quickSchedules = [
    { key: 'everyday' as const, label: t('everyday') },
    { key: 'weekdays' as const, label: t('weekdays') },
    { key: 'weekends' as const, label: t('weekends') },
    { key: 'custom' as const, label: t('customSchedule') },
  ];

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    setTime(time);
  };

  const handleDayToggle = (day: number) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day];
    
    setSelectedDays(newDays);
    setDays(newDays);
  };

  const handleQuickSchedule = (schedule: 'everyday' | 'weekdays' | 'weekends') => {
    setQuickSchedule(schedule);
    let newDays: number[];
    switch (schedule) {
      case 'everyday':
        newDays = [0, 1, 2, 3, 4, 5, 6];
        break;
      case 'weekdays':
        newDays = [1, 2, 3, 4, 5];
        break;
      case 'weekends':
        newDays = [0, 6];
        break;
      default:
        newDays = selectedDays;
    }
    setSelectedDays(newDays);
  };

  const showTimePicker = () => {
    if (Platform.OS === 'web') {
      const timeInput = prompt('Enter time (HH:MM format):', selectedTime);
      if (timeInput && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeInput)) {
        handleTimeChange(timeInput);
      }
      return;
    }

    // For mobile, we'll use a simple alert for now
    // In a real app, you'd use a proper time picker
    Alert.prompt(
      t('selectTime'),
      'Enter time in HH:MM format',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: (time) => {
            if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
              handleTimeChange(time);
            }
          },
        },
      ],
      'plain-text',
      selectedTime
    );
  };

  const getCurrentQuickSchedule = () => {
    const sortedDays = [...selectedDays].sort();
    if (sortedDays.length === 7) return 'everyday';
    if (sortedDays.length === 5 && sortedDays.every(d => d >= 1 && d <= 5)) return 'weekdays';
    if (sortedDays.length === 2 && sortedDays.includes(0) && sortedDays.includes(6)) return 'weekends';
    return 'custom';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('notificationSettings')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Capability Warning */}
          {(!capabilities.canSchedule || capabilities.isExpoGo) && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningTitle}>📱 Benachrichtigungen in Expo Go</Text>
              <Text style={styles.warningText}>
                Push-Benachrichtigungen sind in Expo Go ab SDK 53 nicht mehr verfügbar.
              </Text>
              <Text style={styles.warningSubtext}>
                ✅ Ihre Einstellungen werden gespeichert{"\n"}
                ✅ Funktionieren automatisch in einem Development Build{"\n"}
                ✅ Oder wenn die App aus dem App Store installiert wird
              </Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>💡 Was ist ein Development Build?</Text>
                <Text style={styles.infoText}>
                  Ein Development Build ist eine Version der App mit allen nativen Funktionen. 
                  Diese wird für die finale App-Store-Version verwendet.
                </Text>
              </View>
            </View>
          )}

          {/* Time Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('selectTime')}</Text>
            <TouchableOpacity style={styles.timeButton} onPress={showTimePicker}>
              <Clock size={20} color={colors.primary} />
              <Text style={styles.timeText}>{selectedTime}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Schedule Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('selectDays')}</Text>
            <View style={styles.quickScheduleContainer}>
              {quickSchedules.map((schedule) => (
                <TouchableOpacity
                  key={schedule.key}
                  style={[
                    styles.quickScheduleButton,
                    getCurrentQuickSchedule() === schedule.key && styles.quickScheduleButtonActive,
                  ]}
                  onPress={() => {
                    if (schedule.key !== 'custom') {
                      handleQuickSchedule(schedule.key);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.quickScheduleText,
                      getCurrentQuickSchedule() === schedule.key && styles.quickScheduleTextActive,
                    ]}
                  >
                    {schedule.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Individual Day Selection */}
          <View style={styles.section}>
            <View style={styles.daysContainer}>
              {dayNames.map((day) => (
                <TouchableOpacity
                  key={day.key}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(day.key) && styles.dayButtonActive,
                  ]}
                  onPress={() => handleDayToggle(day.key)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selectedDays.includes(day.key) && styles.dayTextActive,
                    ]}
                  >
                    {day.label.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Summary */}
          <View style={styles.section}>
            <View style={styles.summaryContainer}>
              <Calendar size={20} color={colors.primary} />
              <Text style={styles.summaryText}>
                {selectedDays.length === 7
                  ? `${t('everyday')} at ${selectedTime}`
                  : selectedDays.length === 5 && selectedDays.every(d => d >= 1 && d <= 5)
                  ? `${t('weekdays')} at ${selectedTime}`
                  : selectedDays.length === 2 && selectedDays.includes(0) && selectedDays.includes(6)
                  ? `${t('weekends')} at ${selectedTime}`
                  : `${selectedDays.length} days at ${selectedTime}`}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.title,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: 16,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeText: {
    ...typography.body,
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  quickScheduleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickScheduleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickScheduleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickScheduleText: {
    ...typography.body,
    fontSize: 14,
  },
  quickScheduleTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    ...typography.body,
    fontSize: 12,
    fontWeight: '600',
  },
  dayTextActive: {
    color: 'white',
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryText: {
    ...typography.body,
    marginLeft: 12,
    flex: 1,
  },
  warningContainer: {
    backgroundColor: '#E3F2FD',
    borderColor: '#BBDEFB',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    ...typography.subtitle,
    color: '#1565C0',
    marginBottom: 8,
  },
  warningText: {
    ...typography.body,
    color: '#1976D2',
    marginBottom: 12,
    fontWeight: '500',
  },
  warningSubtext: {
    ...typography.body,
    color: '#1976D2',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: '#F3E5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  infoTitle: {
    ...typography.body,
    color: '#7B1FA2',
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    ...typography.body,
    color: '#8E24AA',
    fontSize: 12,
    lineHeight: 16,
  },
});