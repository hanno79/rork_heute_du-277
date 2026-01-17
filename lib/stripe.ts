import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Conditionally import Stripe only for native platforms (but not Expo Go)
let initStripe: any = null;
if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    initStripe = stripeModule.initStripe;
  } catch (error) {
    // Stripe not available on this platform
  }
}

// Stripe configuration
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Price IDs for the subscription plans
export const STRIPE_PRICE_IDS = {
  monthly: process.env.EXPO_PUBLIC_STRIPE_MONTHLY_PRICE_ID || 'price_monthly_3eur',
  yearly: process.env.EXPO_PUBLIC_STRIPE_YEARLY_PRICE_ID || 'price_yearly_30eur',
};

// Initialize Stripe
export const initializeStripe = async () => {
  if (Platform.OS === 'web' || isExpoGo) {
    return true; // Return true to indicate "success" on web/Expo Go
  }

  if (!STRIPE_PUBLISHABLE_KEY || !initStripe) {
    return false;
  }

  try {
    await initStripe({
      publishableKey: STRIPE_PUBLISHABLE_KEY,
      merchantIdentifier: 'merchant.com.rork.heutedu', // For Apple Pay
      urlScheme: 'heutedu', // For redirects
    });
    return true;
  } catch (error) {
    return false;
  }
};

// Subscription plan types
export interface SubscriptionPlan {
  id: 'monthly' | 'yearly';
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  priceId: string;
  savings?: string;
}

// Available subscription plans
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 3.00,
    currency: 'EUR',
    interval: 'month',
    priceId: STRIPE_PRICE_IDS.monthly,
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 30.00,
    currency: 'EUR',
    interval: 'year',
    priceId: STRIPE_PRICE_IDS.yearly,
    savings: '17%',
  },
];

// Helper function to format price with locale support
export const formatPrice = (
  price: number,
  currency: string = 'EUR',
  locale: string = 'de-DE'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(price);
};

// Helper function to get plan by ID
export const getPlanById = (planId: string): SubscriptionPlan | undefined => {
  return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
};
