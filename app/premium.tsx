import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Crown, Check, X, ArrowLeft, Loader2 } from 'lucide-react-native';
import colors from '@/constants/colors';

import useSubscription from '@/hooks/useSubscription';
import useLanguage from '@/hooks/useLanguage';
import { useAuth } from '@/providers/AuthProvider';

// Conditional imports for Stripe
let useStripeService: any = null;
let SUBSCRIPTION_PLANS: any[] = [];
let formatPrice: any = null;

if (Platform.OS !== 'web') {
  try {
    // Use dynamic import to prevent bundler from including Stripe on web
    const stripeService = eval('require("@/services/stripeService")');
    useStripeService = stripeService.useStripeService;
    const stripeLib = eval('require("@/lib/stripe")');
    SUBSCRIPTION_PLANS = stripeLib.SUBSCRIPTION_PLANS;
    formatPrice = stripeLib.formatPrice;
  } catch (error) {
    console.warn('Stripe modules not available:', error);
    // Fallback values
    SUBSCRIPTION_PLANS = [
      { id: 'monthly', name: 'Monthly', price: 3.00, currency: 'EUR', interval: 'month', priceId: 'price_monthly' },
      { id: 'yearly', name: 'Yearly', price: 30.00, currency: 'EUR', interval: 'year', priceId: 'price_yearly', savings: '17%' },
    ];
    formatPrice = (price: number) => `€${price.toFixed(2)}`;
  }
} else {
  // Web fallback values
  SUBSCRIPTION_PLANS = [
    { id: 'monthly', name: 'Monthly', price: 3.00, currency: 'EUR', interval: 'month', priceId: 'price_monthly' },
    { id: 'yearly', name: 'Yearly', price: 30.00, currency: 'EUR', interval: 'year', priceId: 'price_yearly', savings: '17%' },
  ];
  formatPrice = (price: number) => `€${price.toFixed(2)}`;
}

export default function PremiumScreen() {
  const { isPremium, setIsPremium } = useSubscription();
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  // Initialize Stripe service conditionally
  let stripeService: any = null;
  if (Platform.OS !== 'web' && useStripeService) {
    // We need to create a separate component for this to avoid hook rule violations
    stripeService = { available: true };
  }

  const handleSubscribe = async () => {
    if (!isAuthenticated || !user) {
      Alert.alert(
        t('loginRequired'),
        t('loginRequiredMessage'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('login'), onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    // For now, just enable premium as fallback
    // In production, this would integrate with actual payment processing
    setIsPremium(true);
    Alert.alert(t('success'), t('subscriptionActivated'));
    router.back();
    return;

    // TODO: Implement actual Stripe integration when needed
    // This is commented out to avoid web compatibility issues
    /*
    if (!stripeService) {
      setIsPremium(true);
      Alert.alert(t('success'), t('subscriptionActivated'));
      router.back();
      return;
    }

    setIsLoading(true);

    try {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
      if (!plan) {
        throw new Error('Plan not found');
      }

      const result = await stripeService.handleSubscriptionWithPaymentSheet(
        plan.priceId,
        user.id
      );

      if (result.success) {
        setIsPremium(true);
        Alert.alert(
          t('success'),
          t('subscriptionActivated'),
          [{ text: t('ok'), onPress: () => router.back() }]
        );
      } else {
        Alert.alert(t('error'), result.error || t('paymentFailed'));
      }
    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert(t('error'), t('paymentFailed'));
    } finally {
      setIsLoading(false);
    }
    */
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: t('premiumSubscription'),
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
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Crown size={40} color={colors.premium} style={styles.icon} />
          <Text style={styles.title}>{t('upgradeTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('upgradeSubtitle')}
          </Text>
        </View>
        
        <View style={styles.pricingCard}>
          <Text style={styles.pricingTitle}>{t('premiumSubscription')}</Text>

          {/* Plan Selection */}
          <View style={styles.planSelector}>
            <TouchableOpacity
              style={[styles.planOption, selectedPlan === 'monthly' && styles.planOptionSelected]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <Text style={[styles.planOptionText, selectedPlan === 'monthly' && styles.planOptionTextSelected]}>
                {t('monthlyPlan')}
              </Text>
              <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>
                {formatPrice(3.00)}/{t('month')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planOption, selectedPlan === 'yearly' && styles.planOptionSelected]}
              onPress={() => setSelectedPlan('yearly')}
            >
              <Text style={[styles.planOptionText, selectedPlan === 'yearly' && styles.planOptionTextSelected]}>
                {t('yearlyPlan')}
              </Text>
              <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.planPriceSelected]}>
                {formatPrice(30.00)}/{t('year')}
              </Text>
              <Text style={styles.savingsText}>{t('save')} 17%</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, (isPremium || isLoading) && styles.subscribeButtonDisabled]}
            onPress={handleSubscribe}
            disabled={isPremium || isLoading}
          >
            {isLoading ? (
              <Loader2 size={20} color="white" style={styles.loadingIcon} />
            ) : (
              <Text style={styles.subscribeButtonText}>
                {isPremium ? t('alreadySubscribed') : t('subscribeNow')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>{t('premiumFeatures')}</Text>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Check size={20} color="white" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>{t('situationBasedSearch')}</Text>
              <Text style={styles.featureDescription}>
                {t('situationBasedSearchDesc')}
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Check size={20} color="white" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>{t('voiceInput')}</Text>
              <Text style={styles.featureDescription}>
                {t('voiceInputDesc')}
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Check size={20} color="white" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>{t('completeQuoteLibrary')}</Text>
              <Text style={styles.featureDescription}>
                {t('completeQuoteLibraryDesc')}
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Check size={20} color="white" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>{t('noAds')}</Text>
              <Text style={styles.featureDescription}>
                {t('noAdsDesc')}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.freeContainer}>
          <Text style={styles.freeTitle}>{t('freeVersionIncludes')}</Text>
          
          <View style={styles.freeItem}>
            <View style={styles.freeIconContainer}>
              <Check size={20} color="white" />
            </View>
            <Text style={styles.freeText}>{t('dailyQuoteWithExplanation')}</Text>
          </View>
          
          <View style={styles.freeItem}>
            <View style={styles.freeIconContainer}>
              <X size={20} color="white" />
            </View>
            <Text style={styles.freeText}>{t('noSituationBasedSearch')}</Text>
          </View>
          
          <View style={styles.freeItem}>
            <View style={styles.freeIconContainer}>
              <X size={20} color="white" />
            </View>
            <Text style={styles.freeText}>{t('noVoiceInput')}</Text>
          </View>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('subscriptionRenewal')}
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
  header: {
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.lightText,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  pricingCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 24,
    alignItems: 'center',
    elevation: Platform.OS === 'android' ? 3 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 2 } : { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
    shadowRadius: Platform.OS === 'ios' ? 4 : 0,
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.premium,
    marginBottom: 4,
  },
  period: {
    fontSize: 16,
    fontWeight: 'normal',
    color: colors.lightText,
  },
  priceSubtext: {
    fontSize: 14,
    color: colors.lightText,
    marginBottom: 20,
  },
  planSelector: {
    marginBottom: 20,
    gap: 12,
  },
  planOption: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  planOptionSelected: {
    borderColor: colors.premium,
    backgroundColor: colors.premium + '10',
  },
  planOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  planOptionTextSelected: {
    color: colors.premium,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  planPriceSelected: {
    color: colors.premium,
  },
  savingsText: {
    fontSize: 12,
    color: colors.premium,
    fontWeight: '600',
    marginTop: 4,
  },
  subscribeButton: {
    backgroundColor: colors.premium,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  subscribeButtonDisabled: {
    backgroundColor: colors.lightText,
  },
  subscribeButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingIcon: {
    marginRight: 8,
  },
  featuresContainer: {
    padding: 16,
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.lightText,
  },
  freeContainer: {
    padding: 16,
    marginBottom: 24,
    backgroundColor: colors.card,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  freeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  freeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  freeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lightText,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  freeText: {
    fontSize: 16,
    color: colors.text,
  },
  footer: {
    padding: 16,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 12,
    color: colors.lightText,
    textAlign: 'center',
  },
});