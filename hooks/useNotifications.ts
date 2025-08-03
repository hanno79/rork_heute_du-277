import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

// Conditional import to avoid errors in Expo Go
let Notifications: any = null;
try {
  if (Platform.OS !== 'web') {
    Notifications = require('expo-notifications');
  }
} catch (error) {
  console.log('expo-notifications not available:', error);
}

export interface NotificationSettings {
  enabled: boolean;
  time: string; // HH:MM format
  days: number[]; // 0 = Sunday, 1 = Monday, etc.
}

interface NotificationCapabilities {
  canSchedule: boolean;
  canReceive: boolean;
  isExpoGo: boolean;
  reason?: string;
}

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const WEB_NOTIFICATION_INTERVALS_KEY = 'web_notification_intervals';

const defaultSettings: NotificationSettings = {
  enabled: false,
  time: '09:00',
  days: [1, 2, 3, 4, 5, 6, 0], // Every day
};

// Web notification helper functions
const setupWebNotificationHandler = () => {
  if (Platform.OS !== 'web' || !('Notification' in window)) {
    return;
  }
  
  // Handle notification clicks
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'notification-click') {
        window.focus();
      }
    });
  }
};

const scheduleWebNotifications = async (notificationSettings: NotificationSettings) => {
  if (Platform.OS !== 'web' || !('Notification' in window)) {
    return;
  }

  // Clear existing intervals
  await cancelWebNotifications();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    Alert.alert(
      'Berechtigung erforderlich',
      'Bitte erlauben Sie Benachrichtigungen in Ihrem Browser, um tägliche Sprüche zu erhalten.',
      [{ text: 'OK' }]
    );
    return;
  }

  const [hours, minutes] = notificationSettings.time.split(':').map(Number);
  const intervals: number[] = [];

  // Schedule notifications for each day
  notificationSettings.days.forEach((day) => {
    const scheduleForDay = () => {
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(hours, minutes, 0, 0);
      
      // If target time has passed today, schedule for next occurrence of this day
      if (targetTime <= now || targetTime.getDay() !== day) {
        const daysUntilTarget = (day - now.getDay() + 7) % 7;
        if (daysUntilTarget === 0 && targetTime <= now) {
          targetTime.setDate(targetTime.getDate() + 7);
        } else {
          targetTime.setDate(targetTime.getDate() + daysUntilTarget);
        }
      }

      const timeUntilNotification = targetTime.getTime() - now.getTime();
      
      if (timeUntilNotification > 0) {
        const timeoutId = window.setTimeout(() => {
          new Notification('Heute Du.', {
            body: 'Ihr täglicher Spruch ist bereit! 🌟',
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: 'daily-quote',
            requireInteraction: false,
          });
          
          // Schedule next week's notification
          scheduleForDay();
        }, timeUntilNotification);
        
        intervals.push(timeoutId);
      }
    };
    
    scheduleForDay();
  });

  // Store interval IDs for cleanup
  if (intervals.length > 0) {
    await AsyncStorage.setItem(WEB_NOTIFICATION_INTERVALS_KEY, JSON.stringify(intervals));
    
    Alert.alert(
      'Benachrichtigungen aktiviert',
      `Tägliche Sprüche werden um ${notificationSettings.time} an den ausgewählten Tagen gesendet.`,
      [{ text: 'OK' }]
    );
  }
};

const cancelWebNotifications = async () => {
  if (Platform.OS !== 'web') {
    return;
  }
  
  try {
    const stored = await AsyncStorage.getItem(WEB_NOTIFICATION_INTERVALS_KEY);
    if (stored) {
      const intervals: number[] = JSON.parse(stored);
      intervals.forEach(intervalId => {
        window.clearTimeout(intervalId);
      });
      await AsyncStorage.removeItem(WEB_NOTIFICATION_INTERVALS_KEY);
    }
  } catch (error) {
    console.warn('Failed to cancel web notifications:', error);
  }
};

export default function useNotifications() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [capabilities, setCapabilities] = useState<NotificationCapabilities>({
    canSchedule: false,
    canReceive: false,
    isExpoGo: false,
  });

  useEffect(() => {
    checkCapabilities();
    loadSettings();
    setupNotificationHandler();
  }, []);

  const checkCapabilities = async () => {
    const isExpoGo = Constants.appOwnership === 'expo';
    
    if (Platform.OS === 'web') {
      // Check for web notification support
      const webSupported = 'Notification' in window;
      setCapabilities({
        canSchedule: webSupported,
        canReceive: webSupported && Notification.permission === 'granted',
        isExpoGo: false,
        reason: webSupported ? 'Web notifications available' : 'Web notifications not supported in this browser'
      });
      return;
    }

    if (isExpoGo || !Notifications) {
      setCapabilities({
        canSchedule: false,
        canReceive: false,
        isExpoGo: true,
        reason: 'Push notifications require a development build in Expo SDK 53+'
      });
      return;
    }

    // For development builds, check actual permissions
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setCapabilities({
        canSchedule: true,
        canReceive: status === 'granted',
        isExpoGo: false,
      });
    } catch (error) {
      setCapabilities({
        canSchedule: false,
        canReceive: false,
        isExpoGo: false,
        reason: 'Failed to check notification permissions'
      });
    }
  };

  const setupNotificationHandler = () => {
    if (Platform.OS === 'web') {
      setupWebNotificationHandler();
      return;
    }
    
    if (capabilities.isExpoGo || !Notifications) {
      return;
    }
    
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch (error) {
      console.warn('Failed to setup notification handler:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      
      if (newSettings.enabled) {
        if (!capabilities.canSchedule) {
          // Show user-friendly message about limitations
          Alert.alert(
            'Benachrichtigungen nicht verfügbar',
            capabilities.reason || 'Benachrichtigungen sind in dieser Version nicht verfügbar. Verwenden Sie einen Development Build für vollständige Funktionalität.',
            [{ text: 'OK' }]
          );
          // Still save the settings for when they use a dev build
          return;
        }
        await scheduleNotifications(newSettings);
      } else {
        await cancelAllNotifications();
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        const granted = permission === 'granted';
        setCapabilities(prev => ({ ...prev, canReceive: granted }));
        return granted;
      }
      return false;
    }
    
    if (capabilities.isExpoGo || !Notifications) {
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      const granted = finalStatus === 'granted';
      
      // Update capabilities
      setCapabilities(prev => ({
        ...prev,
        canReceive: granted
      }));
      
      return granted;
    } catch (error) {
      console.warn('Failed to request notification permissions:', error);
      return false;
    }
  };

  const scheduleNotifications = async (notificationSettings: NotificationSettings) => {
    if (Platform.OS === 'web') {
      await scheduleWebNotifications(notificationSettings);
      return;
    }
    
    if (capabilities.isExpoGo || !capabilities.canSchedule || !Notifications) {
      console.log('Notifications not available:', capabilities.reason);
      return;
    }

    try {
      await cancelAllNotifications();
      
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Berechtigung erforderlich',
          'Bitte erlauben Sie Benachrichtigungen in den Einstellungen, um tägliche Sprüche zu erhalten.',
          [{ text: 'OK' }]
        );
        return;
      }

      const [hours, minutes] = notificationSettings.time.split(':').map(Number);
      
      for (const day of notificationSettings.days) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Heute Du.',
            body: 'Ihr täglicher Spruch ist bereit! 🌟',
            data: { type: 'daily_quote' },
          },
          trigger: {
            weekday: day === 0 ? 1 : day + 1, // Expo uses 1-7 (Sunday = 1)
            hour: hours,
            minute: minutes,
            repeats: true,
          } as Notifications.CalendarTriggerInput,
        });
      }
      
      console.log('Notifications scheduled for days:', notificationSettings.days, 'at', notificationSettings.time);
      
      Alert.alert(
        'Benachrichtigungen aktiviert',
        `Tägliche Sprüche werden um ${notificationSettings.time} an den ausgewählten Tagen gesendet.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.warn('Failed to schedule notifications:', error);
      Alert.alert(
        'Fehler',
        'Benachrichtigungen konnten nicht eingerichtet werden. Versuchen Sie es später erneut.',
        [{ text: 'OK' }]
      );
    }
  };

  const cancelAllNotifications = async () => {
    if (Platform.OS === 'web') {
      cancelWebNotifications();
      return;
    }
    
    if (capabilities.isExpoGo || !Notifications) {
      return;
    }
    
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.warn('Failed to cancel notifications:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    await saveSettings(updatedSettings);
  };

  const toggleEnabled = async () => {
    await updateSettings({ enabled: !settings.enabled });
  };

  const setTime = async (time: string) => {
    await updateSettings({ time });
  };

  const setDays = async (days: number[]) => {
    await updateSettings({ days });
  };

  const setQuickSchedule = async (schedule: 'everyday' | 'weekdays' | 'weekends') => {
    let days: number[];
    switch (schedule) {
      case 'everyday':
        days = [0, 1, 2, 3, 4, 5, 6];
        break;
      case 'weekdays':
        days = [1, 2, 3, 4, 5];
        break;
      case 'weekends':
        days = [0, 6];
        break;
      default:
        days = [0, 1, 2, 3, 4, 5, 6];
    }
    await setDays(days);
  };

  return {
    settings,
    isLoading,
    capabilities,
    updateSettings,
    toggleEnabled,
    setTime,
    setDays,
    setQuickSchedule,
    requestPermissions,
  };
}