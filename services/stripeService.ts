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
    // Stripe not available on this platform - expected in Expo Go
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
      // Return mock data since Convex Stripe integration needs API keys
      return {
        clientSecret: 'mock_client_secret',
        subscriptionId: 'mock_sub_' + Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
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

      // Return success for mock implementation
      return {
        success: true,
        subscriptionId: 'mock_sub_' + Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<PaymentResult> {
    try {
      // Return mock success for now
      return {
        success: true,
      };
    } catch (error) {
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
    // Stripe not available - using mock service (expected in Expo Go/web)
    return new StripeService(null);
  }

  const stripe = useStripe();
  return new StripeService(stripe);
};
