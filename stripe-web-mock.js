// Mock Stripe module for web platform
// This file provides empty implementations of Stripe functions to prevent import errors on web

// Mock StripeProvider component
export const StripeProvider = ({ children }) => children;

// Mock useStripe hook
export const useStripe = () => null;

// Mock initStripe function
export const initStripe = async () => {
  console.log('Stripe initialization skipped on web platform');
  return Promise.resolve();
};

// Mock Stripe components
export const CardField = () => null;
export const CardForm = () => null;
export const ApplePayButton = () => null;
export const GooglePayButton = () => null;

// Default export
export default {
  StripeProvider,
  useStripe,
  initStripe,
  CardField,
  CardForm,
  ApplePayButton,
  GooglePayButton,
};
