import { Platform } from 'react-native';
import { STRIPE_PRICE_IDS, SubscriptionPlan } from '@/lib/stripe';
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || '';
const convex = new ConvexHttpClient(convexUrl);

export interface PaymentResult {
  success: boolean;
  error?: string;
  subscriptionId?: string;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  subscriptionId: string;
}

// Web-specific Stripe service using Stripe.js and Convex
export class StripeWebService {
  private stripe: any = null;

  constructor() {
    if (Platform.OS === 'web') {
      this.initializeStripeJS();
    }
  }

  private async initializeStripeJS() {
    try {
      // Dynamically load Stripe.js only on web
      const { loadStripe } = await import('@stripe/stripe-js');
      const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      if (publishableKey) {
        this.stripe = await loadStripe(publishableKey);
      }
      // If no key, Stripe stays null and mock service will be used
    } catch (error) {
      // Stripe.js load failed - will use mock service
    }
  }

  // Create a subscription payment intent
  async createSubscription(priceId: string, userId: string): Promise<CreatePaymentIntentResponse> {
    try {
      // Return mock data - Convex Stripe integration needs API keys configured
      return {
        clientSecret: 'mock_client_secret',
        subscriptionId: 'mock_sub_' + Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
      throw error;
    }
  }

  // Handle subscription with Stripe Elements (web-specific)
  async handleSubscriptionWithElements(
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

      // Create subscription intent
      const { clientSecret, subscriptionId } = await this.createSubscription(priceId, userId);

      // Return success for mock implementation
      return {
        success: true,
        subscriptionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  // Alternative: Create Checkout Session for web
  async createCheckoutSession(
    priceId: string,
    userId: string
  ): Promise<PaymentResult> {
    try {
      // Return mock success - real implementation pending
      return {
        success: true,
        subscriptionId: 'mock_sub_' + Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Checkout failed',
      };
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<PaymentResult> {
    try {
      // Return mock success - real implementation pending
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

// Hook to use Stripe web service
export const useStripeWebService = () => {
  if (Platform.OS !== 'web') {
    throw new Error('StripeWebService is only available on web platform.');
  }

  return new StripeWebService();
};
