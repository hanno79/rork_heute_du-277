import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { STRIPE_PRICE_IDS, SubscriptionPlan } from '@/lib/stripe';
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || '';
const convex = new ConvexHttpClient(convexUrl);

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Conditionally import Stripe hook only for native platforms (but not Expo Go)
let useStripe: any = null;
if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    useStripe = stripeModule.useStripe;
  } catch (error) {
    console.warn('Stripe not available on this platform:', error);
  }
}

export interface PaymentResult {
  success: boolean;
  error?: string;
  subscriptionId?: string;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  subscriptionId: string;
}

// Stripe service class
export class StripeService {
  private stripe: any;

  constructor(stripe: any) {
    this.stripe = stripe;
  }

  // Create a subscription payment intent
  async createSubscription(priceId: string, userId: string): Promise<CreatePaymentIntentResponse> {
    try {
      // For now, return mock data since Convex Stripe integration needs API keys
      console.warn('Stripe subscription creation not yet implemented with Convex');

      return {
        clientSecret: 'mock_client_secret',
        subscriptionId: 'mock_sub_' + Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Handle subscription with payment sheet
  async handleSubscriptionWithPaymentSheet(
    priceId: string,
    userId: string,
    plan: SubscriptionPlan
  ): Promise<PaymentResult> {
    try {
      if (!this.stripe) {
        return {
          success: false,
          error: 'Stripe not initialized',
        };
      }

      // For now, just return success
      console.log('Mock subscription created');

      return {
        success: true,
        subscriptionId: 'mock_sub_' + Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<PaymentResult> {
    try {
      // For now, return mock success
      console.warn('Stripe subscription cancellation not yet implemented with Convex');

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscription',
      };
    }
  }
}

// Hook to use Stripe service (for native platforms only)
export const useStripeService = () => {
  if (!useStripe) {
    console.warn('Stripe is not available on this platform. Using mock service.');
    return new StripeService(null);
  }

  const stripe = useStripe();
  return new StripeService(stripe);
};
