import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Switch, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Crown, Settings, BookOpen, Share2, Globe, LogOut, User } from 'lucide-react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';
import useNotifications from '@/hooks/useNotifications';
import NotificationSettings from '@/components/NotificationSettings';
import { SupportedLanguage } from '@/constants/translations';
import { useAuth } from '@/providers/AuthProvider';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';

export default function ProfileScreen() {
  const { t, currentLanguage, setLanguage } = useLanguage();
  const { settings, capabilities, toggleEnabled } = useNotifications();
  const [showNotificationSettings, setShowNotificationSettings] = useState<boolean>(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { alertState, showAlert, AlertComponent } = useCustomAlert();

  // Query premium status from Convex - this is the source of truth
  const userProfile = useQuery(
    api.auth.getCurrentUser,
    user?.id ? { userId: user.id } : "skip"
  );
  const isPremium = userProfile?.isPremium === true;
  const subscriptionStatus = userProfile?.stripeSubscriptionStatus;
  const subscriptionCanceled = subscriptionStatus === 'canceled';
  const premiumExpiresAt = userProfile?.premiumExpiresAt;
  const subscriptionPlan = userProfile?.subscriptionPlan;

  // Format expiry date for display
  const formatExpiryDate = (timestamp: number | undefined) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Generate subscription status text
  const getSubscriptionStatusText = () => {
    if (!isPremium) return t('freeVersion');
    if (subscriptionCanceled) {
      return `Premium bis ${formatExpiryDate(premiumExpiresAt)}`;
    }
    return t('premiumActive');
  };

  // Generate subscription description
  const getSubscriptionDescription = () => {
    if (!isPremium) return t('freeVersionDescription');
    if (subscriptionCanceled) {
      return `Dein Abo wurde gekündigt. Du behältst Zugang bis zum ${formatExpiryDate(premiumExpiresAt)}.`;
    }
    const planText = subscriptionPlan === 'yearly' ? 'Jährlich' : 'Monatlich';
    return `${planText} - Nächste Zahlung: ${formatExpiryDate(premiumExpiresAt)}`;
  };

  const handlePremiumPress = () => {
    if (!isAuthenticated) {
      showAlert(
        'Anmeldung erforderlich',
        'Sie müssen sich anmelden, um Premium-Features zu nutzen.',
        [
          { text: 'Abbrechen', style: 'cancel', onPress: () => {} },
          { text: 'Anmelden', onPress: () => router.push('/auth/login') },
        ],
        '🔐'
      );
      return;
    }
    // Navigate to the Premium page for proper payment flow
    router.push('/premium');
  };

  const handleLogout = async () => {
    showAlert(
      'Abmelden',
      'Möchten Sie sich wirklich abmelden?',
      [
        { text: 'Abbrechen', style: 'cancel', onPress: () => {} },
        {
          text: 'Abmelden',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(tabs)');
          }
        },
      ],
      '👋'
    );
  };

  const handleLogin = () => {
    router.push('/auth/login');
  };

  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const showLanguageSelector = () => {
    setShowLanguageModal(true);
  };

  const handleLanguageSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setShowLanguageModal(false);
  };

  return (
    <View style={styles.container}>
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

            <Text style={[
              styles.subscriptionStatus,
              subscriptionCanceled && styles.subscriptionStatusCanceled
            ]}>
              {subscriptionCanceled ? '⏳ ' : isPremium ? '✅ ' : ''}
              {getSubscriptionStatusText()}
            </Text>

            <Text style={styles.subscriptionDescription}>
              {getSubscriptionDescription()}
            </Text>

            <TouchableOpacity
              style={[
                styles.subscriptionButton,
                isPremium && !subscriptionCanceled && styles.manageButton,
                subscriptionCanceled && styles.resubscribeButton
              ]}
              onPress={handlePremiumPress}
            >
              <Text style={[
                styles.buttonText,
                isPremium && !subscriptionCanceled && styles.manageButtonText
              ]}>
                {subscriptionCanceled
                  ? 'Erneut abonnieren'
                  : isPremium
                    ? t('managePremium')
                    : t('upgradeToPremium')}
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
          

          
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.push('/reading-history')}
            >
              <View style={styles.settingLeft}>
                <BookOpen size={20} color={colors.text} style={styles.settingIcon} />
                <Text style={styles.settingLabel}>{t('readingHistory')}</Text>
              </View>
            </TouchableOpacity>
          )}
          
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

      <AlertComponent />

      {/* Language Selection Modal */}
      <CustomAlert
        visible={showLanguageModal}
        title={t('language')}
        message={t('selectLanguage') || 'Wähle deine bevorzugte Sprache'}
        icon="🌐"
        buttons={[
          {
            text: `${t('german')} ${currentLanguage === 'de' ? '✓' : ''}`,
            onPress: () => handleLanguageSelect('de'),
          },
          {
            text: `${t('english')} ${currentLanguage === 'en' ? '✓' : ''}`,
            onPress: () => handleLanguageSelect('en'),
          },
        ]}
        onClose={() => setShowLanguageModal(false)}
      />
    </View>
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
  manageButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.premium,
  },
  manageButtonText: {
    color: colors.premium,
  },
  resubscribeButton: {
    backgroundColor: colors.primary,
  },
  subscriptionStatusCanceled: {
    color: '#FFA500',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.premium,
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