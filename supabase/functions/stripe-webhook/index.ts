import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase client (using service role key for admin operations)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !webhookSecret) {
      throw new Error('Missing stripe signature or webhook secret')
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log(`Received event: ${event.type}`)

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        
        // Get customer to find user ID
        const customer = await stripe.customers.retrieve(customerId)
        const userId = (customer as Stripe.Customer).metadata?.supabase_user_id

        if (!userId) {
          console.error('No user ID found in customer metadata')
          break
        }

        const isActive = subscription.status === 'active'
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()

        // Update user profile
        await supabaseClient
          .from('user_profiles')
          .update({
            is_premium: isActive,
            premium_expires_at: currentPeriodEnd,
            stripe_subscription_id: subscription.id,
          })
          .eq('id', userId)

        console.log(`Updated user ${userId} premium status to ${isActive}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        
        // Get customer to find user ID
        const customer = await stripe.customers.retrieve(customerId)
        const userId = (customer as Stripe.Customer).metadata?.supabase_user_id

        if (!userId) {
          console.error('No user ID found in customer metadata')
          break
        }

        // Update user profile to remove premium
        await supabaseClient
          .from('user_profiles')
          .update({
            is_premium: false,
            premium_expires_at: null,
            stripe_subscription_id: null,
          })
          .eq('id', userId)

        console.log(`Removed premium status for user ${userId}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string
        
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const customerId = subscription.customer as string
          const customer = await stripe.customers.retrieve(customerId)
          const userId = (customer as Stripe.Customer).metadata?.supabase_user_id

          if (userId) {
            const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()
            
            await supabaseClient
              .from('user_profiles')
              .update({
                is_premium: true,
                premium_expires_at: currentPeriodEnd,
              })
              .eq('id', userId)

            console.log(`Payment succeeded for user ${userId}`)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string
        
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const customerId = subscription.customer as string
          const customer = await stripe.customers.retrieve(customerId)
          const userId = (customer as Stripe.Customer).metadata?.supabase_user_id

          if (userId) {
            console.log(`Payment failed for user ${userId}`)
            // Optionally handle payment failures (e.g., send notification)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
