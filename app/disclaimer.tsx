import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';

export default function DisclaimerScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{
          title: t('disclaimer'),
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={typography.title}>{t('disclaimerTitle')}</Text>
          <Text style={[typography.body, styles.introText]}>
            {t('disclaimerIntro')}
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('purposeTitle')}</Text>
          <Text style={typography.body}>
            {t('purposeText')}
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('limitationsTitle')}</Text>
          <Text style={typography.body}>
            {t('limitationsText')}
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('whenToSeekHelpTitle')}</Text>
          <Text style={typography.body}>
            {t('whenToSeekHelpText')}
          </Text>
          
          <View style={styles.helpList}>
            <View style={styles.helpItem}>
              <Text style={styles.helpBullet}>•</Text>
              <Text style={[typography.body, styles.helpText]}>{t('helpItem1')}</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpBullet}>•</Text>
              <Text style={[typography.body, styles.helpText]}>{t('helpItem2')}</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpBullet}>•</Text>
              <Text style={[typography.body, styles.helpText]}>{t('helpItem3')}</Text>
            </View>
            <View style={styles.helpItem}>
              <Text style={styles.helpBullet}>•</Text>
              <Text style={[typography.body, styles.helpText]}>{t('helpItem4')}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('emergencyTitle')}</Text>
          <View style={styles.emergencyContainer}>
            <Text style={[typography.body, styles.emergencyText]}>
              {t('emergencyText')}
            </Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('responsibilityTitle')}</Text>
          <Text style={typography.body}>
            {t('responsibilityText')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  introText: {
    marginTop: 12,
    fontWeight: '500',
  },
  helpList: {
    marginTop: 12,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  helpBullet: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 8,
    marginTop: 2,
  },
  helpText: {
    flex: 1,
    lineHeight: 22,
  },
  emergencyContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  emergencyText: {
    color: '#d32f2f',
    fontWeight: '600',
    lineHeight: 22,
  },
});
