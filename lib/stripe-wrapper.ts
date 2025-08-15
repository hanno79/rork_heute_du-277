import { Platform } from 'react-native';

// Web-safe Stripe wrapper
export const getStripeProvider = async () => {
  if (Platform.OS === 'web') {
    return null;
  }
  
  try {
    // Use dynamic import to avoid bundling on web
    const stripeNative = await import('@/lib/stripe-native');
    return stripeNative.StripeProvider;
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
    const stripeNative = await import('@/lib/stripe-native');
    return { STRIPE_PUBLISHABLE_KEY: stripeNative.STRIPE_PUBLISHABLE_KEY };
  } catch (error) {
    console.warn('Stripe config not available:', error);
    return { STRIPE_PUBLISHABLE_KEY: '' };
  }
};