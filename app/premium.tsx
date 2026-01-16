import React, { useState, useRef, useEffect } from 'react';
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
    // Stripe service not available
  }
} else if (Platform.OS === 'web') {
  try {
    const stripeWebServiceModule = require('@/services/stripeWebService');
    useStripeWebService = stripeWebServiceModule.useStripeWebService;
  } catch (error) {
    // Stripe web service not available
  }
}

export default function PremiumScreen() {
  // NOTE: We use Convex as the ONLY source of truth for premium status
  const { setIsPremium } = useSubscription();
  const { t } = useLanguage();
  const { user, isAuthenticated, tokens } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // SECURITY: Use ref to always access the latest tokens in callbacks
  // This prevents stale closure issues where callbacks capture outdated token values
  const tokensRef = useRef(tokens);
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);
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
      } else {
        stripeAvailable = false;
      }
    } catch (error) {
      stripeAvailable = false;
    }
  } else if (Platform.OS === 'web') {
    // On web, use Stripe.js service
    try {
      if (isStripeConfigured && useStripeWebService) {
        stripeWebService = useStripeWebService();
        stripeAvailable = true;
      } else {
        stripeAvailable = false;
      }
    } catch (error) {
      stripeAvailable = false;
    }
  } else {
    // In Expo Go, always use mock service
    stripeAvailable = false;
  }

  // Process the payment result (used by both real Stripe and mock)
  const processPaymentResult = async (result: any, plan: any) => {
    // Guard clause: ensure user is authenticated before processing payment
    if (!user) {
      showAlert(t('error'), t('loginRequired'), [{ text: t('ok'), onPress: () => {} }], '❌');
      setIsLoading(false);
      return;
    }

    if (result.success) {
      // Update premium status in Convex database with retry logic
      const expiresAt = Date.now() + (plan?.interval === 'year' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000);

      const updateData = {
        userId: user.id,
        isPremium: true,
        stripeCustomerId: result.customerId,
        stripeSubscriptionId: result.subscriptionId,
        premiumExpiresAt: expiresAt,
        stripeSubscriptionStatus: 'active' as const,
        subscriptionPlan: selectedPlan,
      };

      // Retry logic: attempt up to 3 times with exponential backoff
      let updateSucceeded = false;
      let lastError: Error | null = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await updatePremiumStatus(updateData);
          updateSucceeded = true;
          break;
        } catch (convexError: any) {
          lastError = convexError;
          if (attempt < maxRetries) {
            // Wait before retry: 500ms, 1000ms, 2000ms
            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
          }
        }
      }

      if (!updateSucceeded) {
        // All retries failed - inform user but payment was successful
        setIsLoading(false);
        showAlert(
          t('paymentSuccessful'),
          t('paymentSuccessfulButSaveFailed'),
          [
            {
              text: t('retryButton'),
              onPress: async () => {
                setIsLoading(true);
                try {
                  await updatePremiumStatus(updateData);
                  setIsPremium(true);
                  showAlert(t('success'), t('subscriptionActivated'), [{ text: t('ok'), onPress: () => router.back() }], '✅');
                } catch (retryError) {
                  showAlert(t('error'), t('statusSaveFailed'), [{ text: t('ok'), onPress: () => {} }], '❌');
                } finally {
                  setIsLoading(false);
                }
              },
            },
            { text: t('ok'), onPress: () => router.back() },
          ],
          '⚠️'
        );
        return;
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
        t('loginRequiredForPremium'),
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
        showAlert(t('error'), t('paymentFailed'), [{ text: t('ok'), onPress: () => {} }], '❌');
        setIsLoading(false);
      }
    } else {
      // Use mock Stripe service - show custom dialog
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

    // SECURITY: Validate session token before proceeding
    if (!tokens?.sessionToken) {
      showAlert(
        t('error'),
        t('sessionExpired'),
        [
          { text: t('cancel'), style: 'cancel', onPress: () => {} },
          { text: t('login'), onPress: () => router.push('/auth/login') },
        ],
        '🔐'
      );
      return;
    }

    // Get cancellation config from mock service
    const config = mockStripeService.getCancellationConfirmationConfig(
      userProfile?.stripeSubscriptionId || '',
      premiumExpiresAt,
      async (result) => {
        setShowCancelDialog(false);
        setCancelDialogConfig(null);

        if (result.success) {
          // SECURITY: Read current token from ref to avoid stale closure
          const currentToken = tokensRef.current?.sessionToken;

          // Re-validate token before API call (could have expired during dialog)
          if (!currentToken) {
            showAlert(
              t('error'),
              t('sessionExpired'),
              [
                { text: t('cancel'), style: 'cancel', onPress: () => {} },
                { text: t('login'), onPress: () => router.push('/auth/login') },
              ],
              '🔐'
            );
            return;
          }

          setIsCanceling(true);
          try {
            // Update Convex with validated session token
            await cancelSubscriptionMutation({ sessionToken: currentToken });
            showAlert(
              t('success'),
              t('subscriptionCanceled').replace('{date}', formatExpiryDate(premiumExpiresAt)),
              [{ text: t('ok'), onPress: () => {} }],
              '✅'
            );
          } catch (error) {
            showAlert(t('error'), t('cancellationFailed'), [{ text: t('ok'), onPress: () => {} }], '❌');
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

    // SECURITY: Read current token from ref to avoid stale closure issues
    const currentToken = tokensRef.current?.sessionToken;

    // SECURITY: Validate session token before proceeding
    if (!currentToken) {
      showAlert(
        t('error'),
        t('sessionExpired'),
        [
          { text: t('cancel'), style: 'cancel', onPress: () => {} },
          { text: t('login'), onPress: () => router.push('/auth/login') },
        ],
        '🔐'
      );
      return;
    }

    setIsCanceling(true);
    try {
      await reactivateSubscriptionMutation({ sessionToken: currentToken });
      showAlert(t('success'), t('subscriptionReactivated'), [{ text: t('ok'), onPress: () => {} }], '✅');
    } catch (error) {
      showAlert(t('error'), t('reactivationFailed'), [{ text: t('ok'), onPress: () => {} }], '❌');
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
                {subscriptionCanceled ? `⏳ ${t('premiumStatusCanceled')}` : `✅ ${t('premiumStatusActive')}`}
              </Text>
              <Text style={styles.subscriptionStatusText}>
                {t('premiumPlanLabel')} {subscriptionPlan === 'yearly' ? t('premiumPlanYearly') : t('premiumPlanMonthly')}
              </Text>
              <Text style={styles.subscriptionStatusText}>
                {subscriptionCanceled
                  ? t('premiumAccessUntil').replace('{date}', formatExpiryDate(premiumExpiresAt))
                  : t('premiumNextPayment').replace('{date}', formatExpiryDate(premiumExpiresAt))}
              </Text>

              {/* Cancel or Reactivate Button */}
              {subscriptionCanceled ? (
                <TouchableOpacity
                  style={styles.reactivateButton}
                  onPress={handleReactivateSubscription}
                  disabled={isCanceling}
                >
                  <Text style={styles.reactivateButtonText}>
                    {isCanceling ? t('premiumReactivating') : `🔄 ${t('premiumReactivate')}`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelSubscription}
                  disabled={isCanceling}
                >
                  <Text style={styles.cancelButtonText}>
                    {isCanceling ? t('premiumCanceling') : `🚫 ${t('premiumCancel')}`}
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
                    try {
                      await updatePremiumStatus({
                        userId: user.id,
                        isPremium: true,
                        premiumExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
                        stripeSubscriptionStatus: 'active',
                        subscriptionPlan: selectedPlan,
                      });
                      showAlert('Erfolg', 'Premium wurde aktiviert!', [{ text: 'OK', onPress: () => {} }], '🎉');
                    } catch (error) {
                      showAlert('Fehler', 'Premium konnte nicht aktiviert werden', [{ text: 'OK', onPress: () => {} }], '❌');
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