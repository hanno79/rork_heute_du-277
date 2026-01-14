import { Alert } from 'react-native';
import { SubscriptionPlan } from '@/lib/stripe';

export interface PaymentResult {
  success: boolean;
  error?: string;
  subscriptionId?: string;
  customerId?: string;
}

// Mock Stripe service for development/testing
export class MockStripeService {
  // Simulate payment processing with realistic delays and UI
  async handleSubscriptionWithPaymentSheet(
    priceId: string,
    userId: string,
    plan: SubscriptionPlan
  ): Promise<PaymentResult> {
    console.log('=== MOCK STRIPE SERVICE ===');
    console.log('handleSubscriptionWithPaymentSheet called');
    console.log('priceId:', priceId);
    console.log('userId:', userId);
    console.log('plan:', plan);

    // For development: Show confirmation and simulate success after user confirms
    return new Promise((resolve) => {
      console.log('Showing confirmation alert...');

      // Use a simpler approach - show alert and wait for response
      Alert.alert(
        '💳 Zahlung bestätigen',
        `Möchtest du das ${plan.name} Abo für ${plan.price}€/${plan.interval} aktivieren?\n\n(Dies ist eine Test-Simulation)`,
        [
          {
            text: 'Abbrechen',
            style: 'cancel',
            onPress: () => {
              console.log('MOCK: User cancelled payment');
              resolve({
                success: false,
                error: 'Zahlung abgebrochen',
              });
            },
          },
          {
            text: 'Bestätigen',
            style: 'default',
            onPress: () => {
              console.log('MOCK: User confirmed payment - processing...');
              // Small delay to simulate processing
              setTimeout(() => {
                console.log('MOCK: Payment successful!');
                resolve({
                  success: true,
                  subscriptionId: `mock_sub_${Date.now()}`,
                  customerId: `mock_cus_${Date.now()}`,
                });
              }, 500);
            },
          },
        ],
        { cancelable: false }
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
