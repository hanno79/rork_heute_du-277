import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

// Notifications are not supported in Expo Go SDK 53+
// This hook provides web-only notifications and graceful fallbacks
const Notifications = null;

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
    // Web notification cancellation failed - non-critical
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

    // Native notifications are not supported in Expo Go SDK 53+
    setCapabilities({
      canSchedule: false,
      canReceive: false,
      isExpoGo: true,
      reason: 'Push notifications require a development build in Expo SDK 53+. Currently only web notifications are supported.'
    });
  };

  const setupNotificationHandler = () => {
    if (Platform.OS === 'web') {
      setupWebNotificationHandler();
      return;
    }
    
    // Native notifications not supported in Expo Go SDK 53+
  };

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      // Settings load failed - use defaults
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
      // Settings save failed - non-critical
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
    
    // Native notifications not supported in Expo Go SDK 53+
    return false;
  };

  const scheduleNotifications = async (notificationSettings: NotificationSettings) => {
    if (Platform.OS === 'web') {
      await scheduleWebNotifications(notificationSettings);
      return;
    }

    // Native notifications not supported in Expo Go SDK 53+
  };

  const cancelAllNotifications = async () => {
    if (Platform.OS === 'web') {
      cancelWebNotifications();
      return;
    }

    // Native notifications not supported in Expo Go SDK 53+
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