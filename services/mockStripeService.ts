import { SubscriptionPlan } from '@/lib/stripe';

export interface PaymentResult {
  success: boolean;
  error?: string;
  subscriptionId?: string;
  customerId?: string;
  cancelAt?: number; // Timestamp when subscription will end after cancellation
}

// Callback types for UI dialogs - these are handled by the calling component
export interface PaymentConfirmationConfig {
  plan: SubscriptionPlan;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface CancellationConfirmationConfig {
  expiryDate: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Mock Stripe service for development/testing
// This service no longer shows its own dialogs - it returns configs for the caller to display
export class MockStripeService {
  // Returns the config for showing a payment confirmation dialog
  // The caller should show the dialog and call onConfirm/onCancel
  getPaymentConfirmationConfig(
    priceId: string,
    userId: string,
    plan: SubscriptionPlan,
    onResult: (result: PaymentResult) => void
  ): PaymentConfirmationConfig {
    console.log('=== MOCK STRIPE SERVICE ===');
    console.log('getPaymentConfirmationConfig called');
    console.log('priceId:', priceId);
    console.log('userId:', userId);
    console.log('plan:', plan);

    return {
      plan,
      onConfirm: () => {
        console.log('MOCK: User confirmed payment - processing...');
        // Small delay to simulate processing
        setTimeout(() => {
          console.log('MOCK: Payment successful!');
          onResult({
            success: true,
            subscriptionId: `mock_sub_${Date.now()}`,
            customerId: `mock_cus_${Date.now()}`,
          });
        }, 500);
      },
      onCancel: () => {
        console.log('MOCK: User cancelled payment');
        onResult({
          success: false,
          error: 'Zahlung abgebrochen',
        });
      },
    };
  }

  // Returns the config for showing a cancellation confirmation dialog
  getCancellationConfirmationConfig(
    subscriptionId: string,
    premiumExpiresAt: number | undefined,
    onResult: (result: PaymentResult) => void
  ): CancellationConfirmationConfig {
    // Calculate the end date for display
    const expiryDate = premiumExpiresAt
      ? new Date(premiumExpiresAt).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : 'unbekannt';

    return {
      expiryDate,
      onConfirm: () => {
        console.log('MOCK: User confirmed cancellation');
        setTimeout(() => {
          console.log('MOCK: Cancellation successful!');
          onResult({
            success: true,
            cancelAt: premiumExpiresAt,
          });
        }, 500);
      },
      onCancel: () => {
        console.log('MOCK: User kept subscription');
        onResult({
          success: false,
          error: 'Kündigung abgebrochen',
        });
      },
    };
  }

  // Format expiry date helper
  formatExpiryDate(timestamp: number | undefined): string {
    if (!timestamp) return 'unbekannt';
    return new Date(timestamp).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}

// Hook to use mock Stripe service
export const useMockStripeService = () => {
  return new MockStripeService();
};
