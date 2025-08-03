import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Crown, Settings, BookOpen, Share2, Globe, LogOut, User } from 'lucide-react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useSubscription from '@/hooks/useSubscription';
import useLanguage from '@/hooks/useLanguage';
import useNotifications from '@/hooks/useNotifications';
import NotificationSettings from '@/components/NotificationSettings';
import { SupportedLanguage } from '@/constants/translations';
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const { isPremium, setIsPremium } = useSubscription();
  const { t, currentLanguage, setLanguage } = useLanguage();
  const { settings, capabilities, toggleEnabled } = useNotifications();
  const [showNotificationSettings, setShowNotificationSettings] = useState<boolean>(false);
  const { user, isAuthenticated, logout } = useAuth();

  const togglePremium = () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Anmeldung erforderlich',
        'Sie müssen sich anmelden, um Premium-Features zu nutzen.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Anmelden', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }
    setIsPremium(!isPremium);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Abmelden',
      'Möchten Sie sich wirklich abmelden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Abmelden', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(tabs)');
          }
        },
      ]
    );
  };

  const handleLogin = () => {
    router.push('/auth/login');
  };

  const showLanguageSelector = () => {
    const languages = [
      { code: 'en' as SupportedLanguage, name: t('english') },
      { code: 'de' as SupportedLanguage, name: t('german') },
    ];

    const buttons = languages.map(lang => ({
      text: `${lang.name} ${currentLanguage === lang.code ? '✓' : ''}`,
      onPress: () => setLanguage(lang.code),
    }));

    buttons.push({
      text: 'Cancel',
      onPress: () => {},
    });

    Alert.alert(
      t('language'),
      t('selectLanguage') || 'Select your preferred language',
      buttons
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: t('profile'),
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }} 
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={typography.title}>{t('yourAccount')}</Text>
          {isAuthenticated && user && (
            <View style={styles.userInfo}>
              <User size={20} color={colors.text} />
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          )}
        </View>
        
        {!isAuthenticated ? (
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <User size={24} color={colors.primary} />
              <Text style={styles.subscriptionTitle}>Anmeldung</Text>
            </View>
            
            <Text style={styles.subscriptionStatus}>
              Nicht angemeldet
            </Text>
            
            <Text style={styles.subscriptionDescription}>
              Melden Sie sich an, um Ihre Favoriten zu synchronisieren und Premium-Features zu nutzen.
            </Text>
            
            <TouchableOpacity 
              style={styles.subscriptionButton} 
              onPress={handleLogin}
            >
              <Text style={styles.buttonText}>
                Anmelden
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <Crown size={24} color={colors.premium} />
              <Text style={styles.subscriptionTitle}>{t('premiumStatus')}</Text>
            </View>
            
            <Text style={styles.subscriptionStatus}>
              {isPremium ? t('premiumActive') : t('freeVersion')}
            </Text>
            
            <Text style={styles.subscriptionDescription}>
              {isPremium 
                ? t('premiumActiveDescription')
                : t('freeVersionDescription')}
            </Text>
            
            <TouchableOpacity 
              style={[styles.subscriptionButton, isPremium && styles.cancelButton]} 
              onPress={togglePremium}
            >
              <Text style={[styles.buttonText, isPremium && styles.cancelButtonText]}>
                {isPremium ? t('cancelPremium') : t('upgradeToPremium')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings')}</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Settings size={20} color={colors.text} style={styles.settingIcon} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>{t('dailyNotifications')}</Text>
                {settings.enabled && (
                  <TouchableOpacity onPress={() => setShowNotificationSettings(true)}>
                    <Text style={styles.settingSubtext}>
                      {settings.days.length === 7 ? t('everyday') : 
                       settings.days.length === 5 && settings.days.every(d => d >= 1 && d <= 5) ? t('weekdays') :
                       settings.days.length === 2 && settings.days.includes(0) && settings.days.includes(6) ? t('weekends') :
                       `${settings.days.length} days`} at {settings.time}
                    </Text>
                  </TouchableOpacity>
                )}
                {(!capabilities.canSchedule || capabilities.isExpoGo) && (
                  <Text style={[styles.settingSubtext, { color: '#FF6B6B' }]}>
                    Nur in Development Build verfügbar
                  </Text>
                )}
              </View>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
          
          {settings.enabled && (
            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={() => setShowNotificationSettings(true)}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { width: 20 }]} />
                <Text style={styles.settingLabel}>{t('notificationSettings')}</Text>
              </View>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.settingItem} onPress={showLanguageSelector}>
            <View style={styles.settingLeft}>
              <Globe size={20} color={colors.text} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>{t('language')}</Text>
            </View>
            <Text style={styles.settingValue}>
              {currentLanguage === 'en' ? t('english') : t('german')}
            </Text>
          </TouchableOpacity>
          

          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <BookOpen size={20} color={colors.text} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>{t('readingHistory')}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Share2 size={20} color={colors.text} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>{t('shareApp')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/disclaimer')}>
            <View style={styles.settingLeft}>
              <BookOpen size={20} color={colors.text} style={styles.settingIcon} />
              <Text style={styles.settingLabel}>{t('disclaimer')}</Text>
            </View>
          </TouchableOpacity>

          {isAuthenticated && (
            <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
              <View style={styles.settingLeft}>
                <LogOut size={20} color={colors.error} style={styles.settingIcon} />
                <Text style={[styles.settingLabel, { color: colors.premium }]}>Abmelden</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('appVersion')}</Text>
          <Text style={styles.footerText}>{t('copyright')}</Text>
        </View>
      </ScrollView>
      
      <NotificationSettings 
        visible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
  },
  userName: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  userEmail: {
    ...typography.caption,
    color: colors.lightText,
  },
  subscriptionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    elevation: Platform.OS === 'android' ? 3 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 2 } : { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
    shadowRadius: Platform.OS === 'ios' ? 4 : 0,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionTitle: {
    ...typography.subtitle,
    marginLeft: 8,
  },
  subscriptionStatus: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.premium,
    marginBottom: 8,
  },
  subscriptionDescription: {
    ...typography.body,
    marginBottom: 16,
  },
  subscriptionButton: {
    backgroundColor: colors.premium,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.premium,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButtonText: {
    color: colors.premium,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...typography.subtitle,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    ...typography.body,
  },
  settingSubtext: {
    ...typography.caption,
    color: colors.lightText,
    marginTop: 2,
  },
  settingValue: {
    ...typography.body,
    color: colors.lightText,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    color: colors.lightText,
    marginBottom: 4,
  },
});