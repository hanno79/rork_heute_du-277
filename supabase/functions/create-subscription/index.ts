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

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data } = await supabaseClient.auth.getUser(token)
    const user = data.user

    if (!user) {
      throw new Error('User not authenticated')
    }

    const { priceId, userId } = await req.json()

    if (!priceId || !userId) {
      throw new Error('Missing required parameters: priceId and userId')
    }

    // Get or create Stripe customer
    let customer
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (profile?.stripe_customer_id) {
      customer = await stripe.customers.retrieve(profile.stripe_customer_id)
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: userId,
        },
      })

      // Save customer ID to user profile
      await supabaseClient
        .from('user_profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId)
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    })

    const invoice = subscription.latest_invoice as Stripe.Invoice
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent

    return new Response(
      JSON.stringify({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error creating subscription:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
