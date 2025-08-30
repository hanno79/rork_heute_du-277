import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { STRIPE_PRICE_IDS, SubscriptionPlan } from '@/lib/stripe';

export interface PaymentResult {
  success: boolean;
  error?: string;
  subscriptionId?: string;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  subscriptionId: string;
}

// Web-specific Stripe service using Stripe.js
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
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          priceId,
          userId,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
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

      // Redirect to Stripe Checkout for web
      const { error } = await this.stripe.redirectToCheckout({
        sessionId: clientSecret, // This would need to be a session ID for Checkout
      });

      if (error) {
        console.error('Error redirecting to checkout:', error);
        return {
          success: false,
          error: error.message,
        };
      }

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
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId,
          userId,
          successUrl: `${window.location.origin}/premium?success=true`,
          cancelUrl: `${window.location.origin}/premium?canceled=true`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (this.stripe && data.sessionId) {
        const { error: stripeError } = await this.stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });

        if (stripeError) {
          return {
            success: false,
            error: stripeError.message,
          };
        }

        return {
          success: true,
          subscriptionId: data.subscriptionId,
        };
      }

      return {
        success: false,
        error: 'Failed to create checkout session',
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
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: {
          subscriptionId,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

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
