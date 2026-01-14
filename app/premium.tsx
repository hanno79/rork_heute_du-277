import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
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
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';

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
  // NOTE: We use Convex as the ONLY source of truth for premium status
  const { setIsPremium, clearCache } = useSubscription();
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  // Convex mutations
  const updatePremiumStatus = useMutation(api.auth.updatePremiumStatus);
  const cancelSubscriptionMutation = useMutation(api.auth.cancelSubscription);
  const reactivateSubscriptionMutation = useMutation(api.auth.reactivateSubscription);

  // Query user's actual premium status from Convex - THIS IS THE SOURCE OF TRUTH
  const userProfile = useQuery(
    api.auth.getCurrentUser,
    user?.id ? { userId: user.id } : "skip"
  );

  // Cancellation loading state
  const [isCanceling, setIsCanceling] = useState(false);

  // Custom alert hook
  const { alertState, showAlert, AlertComponent } = useCustomAlert();

  // Payment confirmation dialog state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentDialogConfig, setPaymentDialogConfig] = useState<{
    planName: string;
    price: number;
    interval: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Cancellation confirmation dialog state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelDialogConfig, setCancelDialogConfig] = useState<{
    expiryDate: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Clear old cache and log status on mount
  React.useEffect(() => {
    clearCache();
    console.log('=== PREMIUM SCREEN MOUNTED ===');
    console.log('User ID:', user?.id);
    console.log('UserProfile from Convex:', userProfile);
    console.log('isPremium from Convex:', userProfile?.isPremium);
  }, []);

  // Log when userProfile updates
  React.useEffect(() => {
    if (userProfile !== undefined) {
      console.log('Convex userProfile updated:', userProfile?.isPremium);
    }
  }, [userProfile]);

  // Use Convex status as THE ONLY source of truth
  const actualIsPremium = userProfile?.isPremium === true;
  const subscriptionStatus = userProfile?.stripeSubscriptionStatus;
  const subscriptionCanceled = subscriptionStatus === 'canceled';
  const premiumExpiresAt = userProfile?.premiumExpiresAt;
  const subscriptionPlan = userProfile?.subscriptionPlan;

  // Format expiry date for display
  const formatExpiryDate = (timestamp: number | undefined) => {
    if (!timestamp) return 'unbekannt';
    return new Date(timestamp).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

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

  // Process the payment result (used by both real Stripe and mock)
  const processPaymentResult = async (result: any, plan: any) => {
    console.log('Payment result:', result);

    if (result.success) {
      console.log('Payment successful, updating Convex...');
      // Update premium status in Convex database
      const expiresAt = Date.now() + (plan?.interval === 'year' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000);

      try {
        console.log('Calling updatePremiumStatus with userId:', user!.id);
        await updatePremiumStatus({
          userId: user!.id,
          isPremium: true,
          stripeCustomerId: result.customerId,
          stripeSubscriptionId: result.subscriptionId,
          premiumExpiresAt: expiresAt,
          stripeSubscriptionStatus: 'active',
          subscriptionPlan: selectedPlan,
        });
        console.log('Convex update successful!');
      } catch (convexError) {
        console.error('Convex update FAILED:', convexError);
      }

      // Update local state
      setIsPremium(true);

      showAlert(
        t('success'),
        t('subscriptionActivated'),
        [{ text: t('ok'), onPress: () => router.back() }],
        '✅'
      );
    } else {
      console.log('Payment failed or cancelled:', result.error);
      if (result.error && result.error !== 'Zahlung abgebrochen') {
        showAlert(t('error'), result.error || t('paymentFailed'), [{ text: t('ok'), onPress: () => {} }], '❌');
      }
    }
    setIsLoading(false);
  };

  const handleSubscribe = async () => {
    if (!isAuthenticated || !user) {
      showAlert(
        t('loginRequired'),
        t('loginRequiredMessage'),
        [
          { text: t('cancel'), style: 'cancel', onPress: () => {} },
          { text: t('login'), onPress: () => router.push('/auth/login') },
        ],
        '🔐'
      );
      return;
    }

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
    if (!plan) {
      showAlert(t('error'), 'Plan not found', [{ text: t('ok'), onPress: () => {} }], '❌');
      return;
    }

    console.log('=== PREMIUM PURCHASE DEBUG ===');
    console.log('User ID:', user.id);
    console.log('Plan:', plan);
    console.log('Stripe Available:', stripeAvailable);
    console.log('Is Expo Go:', isExpoGo);

    if (stripeAvailable) {
      // Use real Stripe service
      setIsLoading(true);
      try {
        let result;
        if (Platform.OS !== 'web' && !isExpoGo && stripeService) {
          result = await stripeService.handleSubscriptionWithPaymentSheet(plan.priceId, user.id);
        } else if (Platform.OS === 'web' && stripeWebService) {
          result = await stripeWebService.createCheckoutSession(plan.priceId, user.id);
        }
        if (result) {
          await processPaymentResult(result, plan);
        }
      } catch (error) {
        console.error('Subscription error:', error);
        showAlert(t('error'), t('paymentFailed'), [{ text: t('ok'), onPress: () => {} }], '❌');
        setIsLoading(false);
      }
    } else {
      // Use mock Stripe service - show custom dialog
      console.log('Using MOCK Stripe service - showing custom dialog');
      const config = mockStripeService.getPaymentConfirmationConfig(
        plan.priceId,
        user.id,
        plan,
        async (result) => {
          setShowPaymentDialog(false);
          setPaymentDialogConfig(null);
          await processPaymentResult(result, plan);
        }
      );

      setPaymentDialogConfig({
        planName: config.plan.name,
        price: config.plan.price,
        interval: config.plan.interval,
        onConfirm: () => {
          setIsLoading(true);
          config.onConfirm();
        },
        onCancel: config.onCancel,
      });
      setShowPaymentDialog(true);
    }
  };

  // Handle subscription cancellation
  const handleCancelSubscription = () => {
    if (!user) return;

    // Get cancellation config from mock service
    const config = mockStripeService.getCancellationConfirmationConfig(
      userProfile?.stripeSubscriptionId || '',
      premiumExpiresAt,
      async (result) => {
        setShowCancelDialog(false);
        setCancelDialogConfig(null);

        if (result.success) {
          setIsCanceling(true);
          try {
            // Update Convex
            await cancelSubscriptionMutation({ userId: user.id });
            showAlert(
              t('success'),
              `Dein Abo wurde gekündigt. Du behältst Premium-Zugang bis zum ${formatExpiryDate(premiumExpiresAt)}.`,
              [{ text: t('ok'), onPress: () => {} }],
              '✅'
            );
          } catch (error) {
            console.error('Cancellation error:', error);
            showAlert(t('error'), 'Kündigung fehlgeschlagen', [{ text: t('ok'), onPress: () => {} }], '❌');
          } finally {
            setIsCanceling(false);
          }
        }
      }
    );

    setCancelDialogConfig({
      expiryDate: config.expiryDate,
      onConfirm: config.onConfirm,
      onCancel: config.onCancel,
    });
    setShowCancelDialog(true);
  };

  // Handle subscription reactivation
  const handleReactivateSubscription = async () => {
    if (!user) return;

    setIsCanceling(true);
    try {
      await reactivateSubscriptionMutation({ userId: user.id });
      showAlert(t('success'), 'Dein Abo wurde reaktiviert!', [{ text: t('ok'), onPress: () => {} }], '✅');
    } catch (error) {
      console.error('Reactivation error:', error);
      showAlert(t('error'), 'Reaktivierung fehlgeschlagen', [{ text: t('ok'), onPress: () => {} }], '❌');
    } finally {
      setIsCanceling(false);
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

          {/* Subscription Status Display */}
          {actualIsPremium && (
            <View style={styles.subscriptionStatusCard}>
              <Text style={styles.subscriptionStatusTitle}>
                {subscriptionCanceled ? '⏳ Abo gekündigt' : '✅ Premium aktiv'}
              </Text>
              <Text style={styles.subscriptionStatusText}>
                Plan: {subscriptionPlan === 'yearly' ? 'Jährlich' : 'Monatlich'}
              </Text>
              <Text style={styles.subscriptionStatusText}>
                {subscriptionCanceled
                  ? `Zugang bis: ${formatExpiryDate(premiumExpiresAt)}`
                  : `Nächste Zahlung: ${formatExpiryDate(premiumExpiresAt)}`}
              </Text>

              {/* Cancel or Reactivate Button */}
              {subscriptionCanceled ? (
                <TouchableOpacity
                  style={styles.reactivateButton}
                  onPress={handleReactivateSubscription}
                  disabled={isCanceling}
                >
                  <Text style={styles.reactivateButtonText}>
                    {isCanceling ? 'Wird reaktiviert...' : '🔄 Abo reaktivieren'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelSubscription}
                  disabled={isCanceling}
                >
                  <Text style={styles.cancelButtonText}>
                    {isCanceling ? 'Wird gekündigt...' : '🚫 Abo kündigen'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Development Mode Banner */}
          {!stripeAvailable && (
            <View style={styles.developmentBanner}>
              <Text style={styles.developmentText}>
                🧪 Development Mode
              </Text>
              {!actualIsPremium && user?.id && (
                <TouchableOpacity
                  style={{ backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, marginTop: 12 }}
                  onPress={async () => {
                    console.log('=== DIRECT PREMIUM ACTIVATION ===');
                    console.log('User ID:', user.id);
                    try {
                      await updatePremiumStatus({
                        userId: user.id,
                        isPremium: true,
                        premiumExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
                        stripeSubscriptionStatus: 'active',
                        subscriptionPlan: selectedPlan,
                      });
                      console.log('Premium activated successfully!');
                      showAlert('Erfolg', 'Premium wurde aktiviert!', [{ text: 'OK', onPress: () => {} }], '🎉');
                    } catch (error) {
                      console.error('Failed to activate premium:', error);
                      showAlert('Fehler', 'Premium konnte nicht aktiviert werden: ' + String(error), [{ text: 'OK', onPress: () => {} }], '❌');
                    }
                  }}
                >
                  <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                    🎁 Premium DIREKT aktivieren (Test)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Plan Selection - only show when not premium */}
          {!actualIsPremium && (
            <>
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
                style={[styles.subscribeButton, isLoading && styles.subscribeButtonDisabled]}
                onPress={handleSubscribe}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 size={20} color="white" style={styles.loadingIcon} />
                ) : (
                  <Text style={styles.subscribeButtonText}>
                    {t('subscribeNow')}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
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

      <AlertComponent />

      {/* Payment Confirmation Dialog */}
      {paymentDialogConfig && (
        <CustomAlert
          visible={showPaymentDialog}
          title="💳 Zahlung bestätigen"
          message={`Möchtest du das ${paymentDialogConfig.planName} Abo für ${paymentDialogConfig.price}€/${paymentDialogConfig.interval === 'year' ? 'Jahr' : 'Monat'} aktivieren?\n\n(Dies ist eine Test-Simulation)`}
          icon="💳"
          buttons={[
            {
              text: 'Abbrechen',
              style: 'cancel',
              onPress: () => {
                paymentDialogConfig.onCancel();
                setShowPaymentDialog(false);
                setPaymentDialogConfig(null);
              },
            },
            {
              text: 'Bestätigen',
              onPress: paymentDialogConfig.onConfirm,
            },
          ]}
          onClose={() => {
            paymentDialogConfig.onCancel();
            setShowPaymentDialog(false);
            setPaymentDialogConfig(null);
          }}
        />
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancelDialogConfig && (
        <CustomAlert
          visible={showCancelDialog}
          title="🚫 Abo kündigen"
          message={`Möchtest du dein Premium-Abo wirklich kündigen?\n\nDein Premium-Zugang bleibt bis zum ${cancelDialogConfig.expiryDate} aktiv.`}
          icon="🚫"
          buttons={[
            {
              text: 'Behalten',
              style: 'cancel',
              onPress: () => {
                cancelDialogConfig.onCancel();
                setShowCancelDialog(false);
                setCancelDialogConfig(null);
              },
            },
            {
              text: 'Kündigen',
              style: 'destructive',
              onPress: cancelDialogConfig.onConfirm,
            },
          ]}
          onClose={() => {
            cancelDialogConfig.onCancel();
            setShowCancelDialog(false);
            setCancelDialogConfig(null);
          }}
        />
      )}
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
  // Subscription status styles
  subscriptionStatusCard: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.premium,
  },
  subscriptionStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.premium,
    marginBottom: 8,
    textAlign: 'center',
  },
  subscriptionStatusText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FF6B6B',
    fontWeight: '600',
    fontSize: 14,
  },
  reactivateButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
    alignItems: 'center',
  },
  reactivateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // Development mode banner
  developmentBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  developmentText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
});