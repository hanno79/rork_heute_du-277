import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Stripe from "stripe";

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

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
    };
  },
});

// Cancel subscription
export const cancelSubscription = action({
  args: {
    userId: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();

    const subscription = await stripe.subscriptions.update(
      args.subscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Update user profile
    await ctx.runMutation(api.stripe.updatePremiumStatus, {
      userId: args.userId,
      isPremium: false,
      premiumExpiresAt: subscription.current_period_end * 1000,
    });

    return { success: true, subscription };
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
        const subscription = event.data.object as Stripe.Subscription;
        const convexUserId = subscription.metadata?.convex_user_id;

        if (convexUserId) {
          await ctx.runMutation(api.stripe.updatePremiumStatus, {
            userId: convexUserId,
            isPremium: subscription.status === "active",
            premiumExpiresAt: subscription.current_period_end * 1000,
            stripeSubscriptionId: subscription.id,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
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
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
          const convexUserId = subscription.metadata?.convex_user_id;

          if (convexUserId) {
            await ctx.runMutation(api.stripe.updatePremiumStatus, {
              userId: convexUserId,
              isPremium: true,
              premiumExpiresAt: subscription.current_period_end * 1000,
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
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

      await ctx.db.patch(profile._id, updates);
    }
  },
});
