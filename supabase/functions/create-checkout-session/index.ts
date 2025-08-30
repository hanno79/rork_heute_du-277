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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { priceId, userId, successUrl, cancelUrl } = await req.json()

    if (!priceId || !userId) {
      throw new Error('Missing required parameters')
    }

    console.log('Creating checkout session for:', { priceId, userId })

    // Get or create Stripe customer
    let customer
    
    // First, check if user already has a Stripe customer ID
    const { data: userProfile } = await supabaseClient
      .from('user_profiles')
      .select('stripe_customer_id, email, name')
      .eq('id', userId)
      .single()

    if (userProfile?.stripe_customer_id) {
      // Retrieve existing customer
      customer = await stripe.customers.retrieve(userProfile.stripe_customer_id)
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email: userProfile?.email || `user-${userId}@example.com`,
        name: userProfile?.name || 'Customer',
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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.get('origin')}/premium?success=true`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/premium?canceled=true`,
      metadata: {
        user_id: userId,
      },
    })

    console.log('Checkout session created:', session.id)

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
