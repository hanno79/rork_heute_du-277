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
        console.log('Stripe.js initialized successfully');
      } else {
        console.warn('Stripe publishable key not found');
      }
    } catch (error) {
      console.error('Failed to initialize Stripe.js:', error);
    }
  }

  // Create a subscription payment intent
  async createSubscription(priceId: string, userId: string): Promise<CreatePaymentIntentResponse> {
    try {
      // For now, return mock data since Convex Stripe integration needs API keys
      // This will be implemented once Stripe keys are configured in Convex dashboard
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

      // For now, just return success
      console.log('Mock subscription created:', subscriptionId);

      return {
        success: true,
        subscriptionId,
      };
    } catch (error) {
      console.error('Error processing payment:', error);
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
      // For now, return mock success
      console.warn('Stripe checkout session not yet implemented with Convex');

      return {
        success: true,
        subscriptionId: 'mock_sub_' + Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Checkout failed',
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

// Hook to use Stripe web service
export const useStripeWebService = () => {
  if (Platform.OS !== 'web') {
    throw new Error('StripeWebService is only available on web platform.');
  }

  return new StripeWebService();
};
