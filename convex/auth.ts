import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple password hashing (in production, use bcrypt or similar)
async function hashPassword(password: string): Promise<string> {
  // For now, we'll use a simple hash. In production, use a proper library
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Register new user
export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await hashPassword(args.password);

    // Create a unique user ID
    const userId = crypto.randomUUID();

    // Create user profile
    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      name: args.name,
      email: args.email,
      isPremium: false,
      passwordHash,
    } as any);

    // Create default settings
    await ctx.db.insert("userSettings", {
      userId,
      language: "de",
      notificationsEnabled: true,
      dailyQuote: true,
      motivationalReminders: false,
      weeklyDigest: false,
    });

    // Get the created profile
    const profile = await ctx.db.get(profileId);

    return {
      success: true,
      user: profile,
    };
  },
});

// Login
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const passwordHash = (user as any).passwordHash;
    if (!passwordHash) {
      throw new Error("Invalid credentials");
    }

    const valid = await verifyPassword(args.password, passwordHash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    return {
      success: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        isPremium: user.isPremium,
      },
    };
  },
});

// Get current user profile by userId
export const getCurrentUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!profile) {
      return null;
    }

    return {
      id: profile.userId,
      email: profile.email,
      name: profile.name,
      isPremium: profile.isPremium,
      premiumExpiresAt: profile.premiumExpiresAt,
      stripeCustomerId: profile.stripeCustomerId,
      stripeSubscriptionId: profile.stripeSubscriptionId,
    };
  },
});

// Get user settings
export const getUserSettings = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return settings;
  },
});

// Update user settings
export const updateUserSettings = mutation({
  args: {
    userId: v.string(),
    settings: v.object({
      language: v.optional(v.string()),
      notificationsEnabled: v.optional(v.boolean()),
      notificationTime: v.optional(v.string()),
      notificationDays: v.optional(v.array(v.number())),
      dailyQuote: v.optional(v.boolean()),
      motivationalReminders: v.optional(v.boolean()),
      weeklyDigest: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!existingSettings) {
      throw new Error("User settings not found");
    }

    await ctx.db.patch(existingSettings._id, args.settings);
    return { success: true };
  },
});

// Delete user by email (for testing/cleanup)
export const deleteUserByEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      return { success: false, message: "User not found" };
    }

    // Delete user settings
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .first();
    if (settings) {
      await ctx.db.delete(settings._id);
    }

    // Delete user favorites
    const favorites = await ctx.db
      .query("userFavorites")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();
    for (const favorite of favorites) {
      await ctx.db.delete(favorite._id);
    }

    // Delete user quote history
    const history = await ctx.db
      .query("userQuoteHistory")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();
    for (const entry of history) {
      await ctx.db.delete(entry._id);
    }

    // Delete user profile
    await ctx.db.delete(user._id);

    return { success: true, message: "User deleted successfully" };
  },
});

// Update user premium status
export const updatePremiumStatus = mutation({
  args: {
    userId: v.string(),
    isPremium: v.boolean(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    premiumExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find user by userId
    const user = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Update user profile
    await ctx.db.patch(user._id, {
      isPremium: args.isPremium,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      premiumExpiresAt: args.premiumExpiresAt,
    });

    return { success: true };
  },
});

// Get all users (for debugging)
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("userProfiles").collect();
    return users.map((u) => ({
      id: u.userId,
      email: u.email,
      name: u.name,
      isPremium: u.isPremium,
      stripeCustomerId: u.stripeCustomerId,
      stripeSubscriptionId: u.stripeSubscriptionId,
      premiumExpiresAt: u.premiumExpiresAt,
    }));
  },
});
