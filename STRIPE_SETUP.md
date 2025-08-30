# Stripe Integration Setup Guide

## 🎯 Overview
Complete Stripe payment integration has been implemented with the new pricing structure:
- **Monthly Plan**: 3,00 € / month
- **Yearly Plan**: 30,00 € / year (17% savings)

## 🔧 Setup Steps

### 1. Stripe Dashboard Configuration

#### A. Create Products and Prices
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** → **Add Product**

**Monthly Plan:**
- Product Name: "Heute Du Premium Monthly"
- Price: 3.00 EUR
- Billing: Recurring monthly
- Copy the Price ID (starts with `price_`)

**Yearly Plan:**
- Product Name: "Heute Du Premium Yearly" 
- Price: 30.00 EUR
- Billing: Recurring yearly
- Copy the Price ID (starts with `price_`)

#### B. Configure Webhooks
1. Go to **Developers** → **Webhooks**
2. Add endpoint: `https://slrbnqvvomppzpvazvdu.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret

### 2. Environment Variables

Update your `.env` file with actual Stripe values:

```env
# Stripe Configuration
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_actual_publishable_key
EXPO_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_your_monthly_price_id
EXPO_PUBLIC_STRIPE_YEARLY_PRICE_ID=price_your_yearly_price_id
```

### 3. Supabase Configuration

Add these secrets to your Supabase project:
1. Go to **Settings** → **API** → **Project API keys**
2. Add the following secrets:

```
STRIPE_SECRET_KEY=sk_live_your_actual_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 4. Deploy Edge Functions

```bash
# Deploy all Stripe functions
supabase functions deploy create-subscription
supabase functions deploy cancel-subscription  
supabase functions deploy stripe-webhook
```

## 🧪 Testing

### Test Mode Setup
For testing, use Stripe test keys:
- Publishable key: `pk_test_...`
- Secret key: `sk_test_...`
- Test card: `4242 4242 4242 4242`

### Test Flow
1. Open app → Profile → Premium
2. Select a plan (monthly/yearly)
3. Tap "Subscribe Now"
4. Complete payment with test card
5. Verify premium status is activated

## 🔒 Security Features

✅ **Webhook Signature Verification**: All webhooks are verified
✅ **User Authentication**: Only authenticated users can subscribe
✅ **Secure Customer Management**: Stripe customer IDs are securely stored
✅ **Automatic Status Sync**: Premium status syncs automatically via webhooks
✅ **Error Handling**: Comprehensive error handling and user feedback

## 📱 User Experience

✅ **Visual Plan Selection**: Interactive plan comparison
✅ **Loading States**: Clear feedback during payment processing
✅ **Error Messages**: User-friendly error handling
✅ **Localization**: Full German/English support
✅ **Authentication Flow**: Seamless login integration

## 🔄 Subscription Lifecycle

1. **Creation**: User selects plan → Stripe customer created → Subscription started
2. **Payment Success**: Webhook updates premium status → User gets access
3. **Payment Failure**: User notified → Retry flow available
4. **Cancellation**: Subscription cancelled at period end → Status updated
5. **Renewal**: Automatic renewal → Status maintained

## 🚀 Production Checklist

- [ ] Replace test Stripe keys with live keys
- [ ] Create actual products and prices in Stripe
- [ ] Configure webhook endpoint in Stripe dashboard
- [ ] Deploy Edge Functions to Supabase
- [ ] Test complete payment flow
- [ ] Verify webhook events are processed
- [ ] Test subscription cancellation
- [ ] Verify premium feature access

## 📊 Monitoring

Monitor these in Stripe Dashboard:
- Subscription creation/cancellation rates
- Payment success/failure rates
- Webhook delivery status
- Customer lifetime value

## 🆘 Troubleshooting

**Payment fails:**
- Check Stripe keys are correct
- Verify webhook endpoint is accessible
- Check Supabase function logs

**Premium status not updating:**
- Verify webhook events are being received
- Check Supabase database for user_profiles updates
- Ensure webhook signature verification passes

**App crashes on payment:**
- Verify Stripe SDK is properly initialized
- Check environment variables are loaded
- Review error logs in development console
