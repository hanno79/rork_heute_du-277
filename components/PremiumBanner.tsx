import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Lock } from 'lucide-react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';
import { useRouter } from 'expo-router';

export default function PremiumBanner() {
  const router = useRouter();
  const { t } = useLanguage();

  const handleUpgrade = () => {
    router.push('/premium');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Lock size={24} color={colors.premium} style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{t('unlockPremiumFeatures')}</Text>
          <Text style={styles.description}>
            {t('premiumBannerDescription')}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleUpgrade}>
        <Text style={styles.buttonText}>{t('upgrade')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: Platform.OS === 'android' ? 3 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 2 } : { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
    shadowRadius: Platform.OS === 'ios' ? 4 : 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.subtitle,
    color: colors.premium,
  },
  description: {
    ...typography.caption,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.premium,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});