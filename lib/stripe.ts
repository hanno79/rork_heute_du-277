import { Platform } from 'react-native';

// Stripe configuration
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Price IDs for the subscription plans
export const STRIPE_PRICE_IDS = {
  monthly: process.env.EXPO_PUBLIC_STRIPE_MONTHLY_PRICE_ID || 'price_monthly_3eur',
  yearly: process.env.EXPO_PUBLIC_STRIPE_YEARLY_PRICE_ID || 'price_yearly_30eur',
};

let initStripe: any = null;

// Only load Stripe on native platforms
if (Platform.OS !== 'web') {
  try {
    // Use dynamic import to prevent bundler from including Stripe on web
    const stripeModule = eval('require("@stripe/stripe-react-native")');
    initStripe = stripeModule.initStripe;
  } catch (error) {
    console.warn('Stripe React Native not available:', error);
  }
}

// Initialize Stripe
export const initializeStripe = async () => {
  if (Platform.OS === 'web') {
    console.log('Stripe initialization skipped on web');
    return false;
  }

  if (!STRIPE_PUBLISHABLE_KEY) {
    console.warn('Stripe publishable key not found. Stripe functionality will be disabled.');
    return false;
  }

  if (!initStripe) {
    console.warn('Stripe React Native not available. Stripe functionality will be disabled.');
    return false;
  }

  try {
    await initStripe({
      publishableKey: STRIPE_PUBLISHABLE_KEY,
      merchantIdentifier: 'merchant.com.rork.heutedu', // For Apple Pay
      urlScheme: 'heutedu', // For redirects
    });
    console.log('Stripe initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
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

// Helper function to format price
export const formatPrice = (price: number, currency: string = 'EUR'): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
  }).format(price);
};

// Helper function to get plan by ID
export const getPlanById = (planId: string): SubscriptionPlan | undefined => {
  return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
};