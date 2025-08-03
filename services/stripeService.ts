import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { STRIPE_PRICE_IDS, SubscriptionPlan } from '@/lib/stripe';

let useStripe: any = null;
if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    useStripe = stripeModule.useStripe;
  } catch (error) {
    console.warn('Stripe React Native not available:', error);
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

  // Process payment with Stripe
  async processPayment(
    clientSecret: string,
    plan: SubscriptionPlan
  ): Promise<PaymentResult> {
    try {
      const { error, paymentIntent } = await this.stripe.confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        console.error('Payment failed:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      if (paymentIntent?.status === 'Succeeded') {
        return {
          success: true,
          subscriptionId: paymentIntent.id,
        };
      }

      return {
        success: false,
        error: 'Payment was not successful',
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Handle subscription with payment sheet (easier UX)
  async handleSubscriptionWithPaymentSheet(
    priceId: string,
    userId: string
  ): Promise<PaymentResult> {
    try {
      // Create subscription intent
      const { clientSecret, subscriptionId } = await this.createSubscription(priceId, userId);

      // Initialize payment sheet
      const { error: initError } = await this.stripe.initPaymentSheet({
        merchantDisplayName: 'Heute Du',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          name: 'Customer',
        },
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        console.error('Error initializing payment sheet:', initError);
        return {
          success: false,
          error: initError.message,
        };
      }

      // Present payment sheet
      const { error: presentError } = await this.stripe.presentPaymentSheet();

      if (presentError) {
        console.error('Error presenting payment sheet:', presentError);
        return {
          success: false,
          error: presentError.message,
        };
      }

      // Payment successful
      return {
        success: true,
        subscriptionId,
      };
    } catch (error) {
      console.error('Error handling subscription:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<PaymentResult> {
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription', {
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

// Hook to use Stripe service
export const useStripeService = () => {
  if (Platform.OS === 'web' || !useStripe) {
    throw new Error('Stripe not available on this platform');
  }

  const stripe = useStripe();

  if (!stripe) {
    throw new Error('Stripe not initialized. Make sure StripeProvider is set up correctly.');
  }

  return new StripeService(stripe);
};
