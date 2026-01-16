import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Stripe from "stripe";

// Type-safe interface for Stripe subscription response fields we need
// This avoids unsafe "as any" casts while handling SDK type mismatches
interface StripeSubscriptionFields {
  id: string;
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: {
    convex_user_id?: string;
  };
}

// Initialize Stripe
const getStripe = () => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(stripeKey, {
    apiVersion: "2025-12-15.clover",
  });
};

// Create subscription
export const createSubscription = action({
  args: {
    userId: v.string(),
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();

    // Get user profile
    const profile = await ctx.runQuery(api.auth.getCurrentUser, {
      userId: args.userId,
    });

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Get or create Stripe customer
    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          convex_user_id: args.userId,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await ctx.runMutation(api.stripe.updateStripeCustomer, {
        userId: args.userId,
        stripeCustomerId: customerId,
      });
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: args.priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
    });

    // Type-safe access to expanded invoice
    const invoice = subscription.latest_invoice;
    if (!invoice || typeof invoice === 'string') {
      throw new Error("Invoice not expanded properly");
    }

    const paymentIntent = invoice.payment_intent;
    if (!paymentIntent || typeof paymentIntent === 'string') {
      throw new Error("Payment intent not expanded properly");
    }

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
    };
  },
});

// Cancel subscription
// SECURITY: Uses token-only validation - userId is derived from session, not trusted from client
export const cancelSubscription = action({
  args: {
    subscriptionId: v.string(),
    sessionToken: v.string(), // SECURITY: Required for authorization
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate session by token ONLY - do NOT trust client-provided userId
    const session = await ctx.runQuery(api.auth.validateSessionByToken, {
      sessionToken: args.sessionToken,
    });

    if (!session.valid) {
      throw new Error("Unauthorized: Invalid or expired session");
    }

    // SECURITY: Use server-derived userId from validated session
    const userId = session.userId;

    // SECURITY: Verify the subscription belongs to this user using session data
    if (session.stripeSubscriptionId !== args.subscriptionId) {
      throw new Error("Unauthorized: Subscription does not belong to this user");
    }

    const stripe = getStripe();

    const subscriptionResponse = await stripe.subscriptions.update(
      args.subscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Type-safe access to subscription data
    const subscriptionData = subscriptionResponse as unknown as StripeSubscriptionFields;
    const periodEnd: number = subscriptionData.current_period_end ?? 0;

    // Update user profile using server-derived userId
    // IMPORTANT: Keep isPremium=true until period end, but mark as canceled
    await ctx.runMutation(api.stripe.updatePremiumStatus, {
      userId,
      isPremium: true, // User keeps premium until period end
      premiumExpiresAt: periodEnd * 1000,
      cancelAtPeriodEnd: true, // Marks subscription as canceled (won't renew)
    });

    return { success: true, premiumExpiresAt: periodEnd * 1000 };
  },
});

// Stripe webhook handler
export const handleStripeWebhook = action({
  args: {
    signature: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        args.payload,
        args.signature,
        webhookSecret
      );
    } catch (err: any) {
      // Don't expose signature validation details
      throw new Error("Webhook validation failed");
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as unknown as StripeSubscriptionFields;
        const convexUserId = subscription.metadata?.convex_user_id;

        if (convexUserId) {
          // Keep premium active if subscription is active, regardless of cancel_at_period_end
          const isActive = subscription.status === "active";
          await ctx.runMutation(api.stripe.updatePremiumStatus, {
            userId: convexUserId,
            isPremium: isActive,
            premiumExpiresAt: (subscription.current_period_end ?? 0) * 1000,
            stripeSubscriptionId: subscription.id,
            cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as StripeSubscriptionFields;
        const convexUserId = subscription.metadata?.convex_user_id;

        if (convexUserId) {
          await ctx.runMutation(api.stripe.updatePremiumStatus, {
            userId: convexUserId,
            isPremium: false,
            premiumExpiresAt: null,
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as { subscription?: string | { id: string } };
        const subscriptionId = invoice.subscription;
        if (subscriptionId) {
          const subscriptionResponse = await stripe.subscriptions.retrieve(
            typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id
          );
          const subscription = subscriptionResponse as unknown as StripeSubscriptionFields;
          const convexUserId = subscription.metadata?.convex_user_id;

          if (convexUserId) {
            // Payment succeeded - premium is active, check if still set to cancel
            await ctx.runMutation(api.stripe.updatePremiumStatus, {
              userId: convexUserId,
              isPremium: true,
              premiumExpiresAt: (subscription.current_period_end ?? 0) * 1000,
              cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as { subscription?: string | { id: string } };
        const subscriptionId = invoice.subscription;
        if (subscriptionId) {
          const subscriptionResponse = await stripe.subscriptions.retrieve(
            typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id
          );
          const subscription = subscriptionResponse as unknown as StripeSubscriptionFields;
          const convexUserId = subscription.metadata?.convex_user_id;

          if (convexUserId) {
            await ctx.runMutation(api.stripe.updatePremiumStatus, {
              userId: convexUserId,
              isPremium: false,
              premiumExpiresAt: null,
            });
          }
        }
        break;
      }
    }

    return { success: true };
  },
});

// Mutations for Stripe updates
export const updateStripeCustomer = mutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
    }
  },
});

export const updatePremiumStatus = mutation({
  args: {
    userId: v.string(),
    isPremium: v.boolean(),
    premiumExpiresAt: v.optional(v.union(v.number(), v.null())),
    stripeSubscriptionId: v.optional(v.string()),
    // Flag to indicate subscription will not renew (canceled but still active until period end)
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (profile) {
      const updates: any = {
        isPremium: args.isPremium,
      };

      if (args.premiumExpiresAt !== undefined) {
        updates.premiumExpiresAt = args.premiumExpiresAt;
      }

      if (args.stripeSubscriptionId) {
        updates.stripeSubscriptionId = args.stripeSubscriptionId;
      }

      // Set subscription status based on cancelAtPeriodEnd flag
      if (args.cancelAtPeriodEnd === true) {
        updates.stripeSubscriptionStatus = "canceled";
        updates.subscriptionCanceledAt = Date.now();
      } else if (args.cancelAtPeriodEnd === false) {
        // Reactivation or new subscription - clear canceled status
        updates.stripeSubscriptionStatus = "active";
        // Use null to properly clear the field in Convex (undefined may be ignored by db.patch)
        updates.subscriptionCanceledAt = null;
      }

      await ctx.db.patch(profile._id, updates);
    }
  },
});
