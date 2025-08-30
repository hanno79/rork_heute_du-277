import { Platform } from 'react-native';

// Web-safe Stripe wrapper
export const getStripeProvider = async () => {
  if (Platform.OS === 'web') {
    return null;
  }
  
  try {
    // Use require instead of import to avoid bundling issues
    const { StripeProvider } = require('@stripe/stripe-react-native');
    return StripeProvider;
  } catch (error) {
    console.warn('Stripe not available:', error);
    return null;
  }
};

export const getStripeConfig = async () => {
  if (Platform.OS === 'web') {
    return { STRIPE_PUBLISHABLE_KEY: '' };
  }
  
  try {
    const { STRIPE_PUBLISHABLE_KEY } = require('@/lib/stripe');
    return { STRIPE_PUBLISHABLE_KEY };
  } catch (error) {
    console.warn('Stripe config not available:', error);
    return { STRIPE_PUBLISHABLE_KEY: '' };
  }
};