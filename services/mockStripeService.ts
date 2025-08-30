import { Alert } from 'react-native';
import { SubscriptionPlan } from '@/lib/stripe';

export interface PaymentResult {
  success: boolean;
  error?: string;
  subscriptionId?: string;
}

// Mock Stripe service for development/testing
export class MockStripeService {
  // Simulate payment processing with realistic delays and UI
  async handleSubscriptionWithPaymentSheet(
    priceId: string,
    userId: string,
    plan: SubscriptionPlan
  ): Promise<PaymentResult> {
    return new Promise((resolve) => {
      // Show payment simulation dialog
      Alert.alert(
        '💳 Stripe Payment Simulation',
        `Plan: ${plan.name}\nPrice: ${plan.price}€/${plan.interval}\n\nThis is a development simulation. In production, this would open the real Stripe payment sheet.`,
        [
          {
            text: 'Cancel Payment',
            style: 'cancel',
            onPress: () => {
              resolve({
                success: false,
                error: 'Payment cancelled by user',
              });
            },
          },
          {
            text: 'Simulate Success',
            onPress: () => {
              // Simulate processing delay
              setTimeout(() => {
                resolve({
                  success: true,
                  subscriptionId: `mock_sub_${Date.now()}`,
                });
              }, 1500);
            },
          },
          {
            text: 'Simulate Failure',
            style: 'destructive',
            onPress: () => {
              setTimeout(() => {
                resolve({
                  success: false,
                  error: 'Your card was declined. Please try a different payment method.',
                });
              }, 1000);
            },
          },
        ]
      );
    });
  }

  // Mock subscription cancellation
  async cancelSubscription(subscriptionId: string): Promise<PaymentResult> {
    return new Promise((resolve) => {
      Alert.alert(
        'Cancel Subscription',
        'This would cancel your subscription in production. Simulate cancellation?',
        [
          {
            text: 'Keep Subscription',
            style: 'cancel',
            onPress: () => {
              resolve({
                success: false,
                error: 'Cancellation aborted',
              });
            },
          },
          {
            text: 'Simulate Cancellation',
            style: 'destructive',
            onPress: () => {
              setTimeout(() => {
                resolve({
                  success: true,
                });
              }, 800);
            },
          },
        ]
      );
    });
  }
}

// Hook to use mock Stripe service
export const useMockStripeService = () => {
  return new MockStripeService();
};
