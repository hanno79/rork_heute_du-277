import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Crown, Check, X, ArrowLeft, Loader2 } from 'lucide-react-native';
import Constants from 'expo-constants';
import colors from '@/constants/colors';

import useSubscription from '@/hooks/useSubscription';
import useLanguage from '@/hooks/useLanguage';
import { useMockStripeService } from '@/services/mockStripeService';
import { SUBSCRIPTION_PLANS, formatPrice, STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe';
import { useAuth } from '@/providers/AuthProvider';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Conditionally import Stripe services based on platform
let useStripeService: any = null;
let useStripeWebService: any = null;

if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    const stripeServiceModule = require('@/services/stripeService');
    useStripeService = stripeServiceModule.useStripeService;
  } catch (error) {
    console.warn('Stripe service not available:', error);
  }
} else if (Platform.OS === 'web') {
  try {
    const stripeWebServiceModule = require('@/services/stripeWebService');
    useStripeWebService = stripeWebServiceModule.useStripeWebService;
  } catch (error) {
    console.warn('Stripe web service not available:', error);
  }
}

export default function PremiumScreen() {
  const { isPremium, setIsPremium } = useSubscription();
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  // Initialize Stripe service
  let stripeService: any = null;
  let stripeWebService: any = null;
  let stripeAvailable = false;
  const mockStripeService = useMockStripeService();

  // Check if Stripe is properly configured
  const isStripeConfigured = STRIPE_PUBLISHABLE_KEY &&
    STRIPE_PUBLISHABLE_KEY !== '' &&
    !STRIPE_PUBLISHABLE_KEY.includes('placeholder') &&
    !STRIPE_PUBLISHABLE_KEY.includes('test_51QYourTestKeyHere');

  // Platform-specific Stripe initialization
  if (Platform.OS !== 'web' && !isExpoGo) {
    try {
      if (isStripeConfigured && useStripeService) {
        stripeService = useStripeService();
        stripeAvailable = true;
        console.log('Stripe service initialized successfully');
      } else {
        console.log('Using mock Stripe service for development');
        stripeAvailable = false;
      }
    } catch (error) {
      console.warn('Stripe not available, using mock service:', error);
      stripeAvailable = false;
    }
  } else if (Platform.OS === 'web') {
    // On web, use Stripe.js service
    try {
      if (isStripeConfigured && useStripeWebService) {
        stripeWebService = useStripeWebService();
        stripeAvailable = true;
        console.log('Stripe web service initialized successfully');
      } else {
        console.log('Using mock Stripe service for web development');
        stripeAvailable = false;
      }
    } catch (error) {
      console.warn('Stripe web service not available, using mock service:', error);
      stripeAvailable = false;
    }
  } else {
    // In Expo Go, always use mock service
    console.log('Using mock Stripe service in Expo Go');
    stripeAvailable = false;
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

    setIsLoading(true);

    try {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
      if (!plan) {
        throw new Error('Plan not found');
      }

      let result;

      if (stripeAvailable) {
        if (Platform.OS !== 'web' && !isExpoGo && stripeService) {
          // Use native Stripe service
          result = await stripeService.handleSubscriptionWithPaymentSheet(
            plan.priceId,
            user.id
          );
        } else if (Platform.OS === 'web' && stripeWebService) {
          // Use web Stripe service with Checkout
          result = await stripeWebService.createCheckoutSession(
            plan.priceId,
            user.id
          );
        } else {
          // Fallback to mock service
          result = await mockStripeService.handleSubscriptionWithPaymentSheet(
            plan.priceId,
            user.id,
            plan
          );
        }
      } else {
        // Use mock Stripe service for development/Expo Go
        result = await mockStripeService.handleSubscriptionWithPaymentSheet(
          plan.priceId,
          user.id,
          plan
        );
      }

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

          {!stripeAvailable && (
            <View style={styles.developmentBanner}>
              <Text style={styles.developmentText}>
                🧪 Development Mode - Payment Simulation
              </Text>
            </View>
          )}

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