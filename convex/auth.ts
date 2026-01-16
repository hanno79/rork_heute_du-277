import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Constants for rate limiting
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Secure password hashing with PBKDF2 (600,000 iterations as per NIST 2023 recommendation)
const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

async function hashPassword(password: string): Promise<string> {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  // Derive hash using PBKDF2
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH * 8 // bits
  );

  // Combine salt + hash for storage
  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(SALT_LENGTH + HASH_LENGTH);
  combined.set(salt);
  combined.set(hashArray, SALT_LENGTH);

  return Array.from(combined)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Legacy SHA-256 hash verification (for migration)
async function verifyLegacySHA256(password: string, storedHash: string): Promise<boolean> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return computedHash === storedHash;
}

// Check if hash is in legacy SHA-256 format (64 hex chars = 32 bytes)
function isLegacyHash(storedHash: string): boolean {
  // PBKDF2 hash is 96 hex chars (16 bytes salt + 32 bytes hash = 48 bytes)
  // Legacy SHA-256 is 64 hex chars (32 bytes)
  return storedHash.length === 64;
}

async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsMigration: boolean }> {
  // Check if this is a legacy SHA-256 hash
  if (isLegacyHash(storedHash)) {
    const valid = await verifyLegacySHA256(password, storedHash);
    return { valid, needsMigration: valid }; // If valid, needs migration to PBKDF2
  }

  // PBKDF2 verification
  const hashBytes = new Uint8Array(
    storedHash.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  if (hashBytes.length !== SALT_LENGTH + HASH_LENGTH) {
    return { valid: false, needsMigration: false };
  }

  const salt = hashBytes.slice(0, SALT_LENGTH);
  const storedHashPart = hashBytes.slice(SALT_LENGTH);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  // Derive hash using same salt
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH * 8
  );

  const computedHash = new Uint8Array(hashBuffer);

  // Timing-safe comparison
  if (computedHash.length !== storedHashPart.length) {
    return { valid: false, needsMigration: false };
  }

  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash[i] ^ storedHashPart[i];
  }

  return { valid: result === 0, needsMigration: false };
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
      return { success: false, error: "Ein Benutzer mit dieser E-Mail existiert bereits", user: null };
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
      return { success: false, error: "Ungültige E-Mail oder Passwort", user: null };
    }

    // Verify password
    const passwordHash = (user as any).passwordHash;
    if (!passwordHash) {
      return { success: false, error: "Ungültige E-Mail oder Passwort", user: null };
    }

    const { valid, needsMigration } = await verifyPassword(args.password, passwordHash);
    if (!valid) {
      return { success: false, error: "Ungültige E-Mail oder Passwort", user: null };
    }

    // Migrate legacy SHA-256 hash to PBKDF2 on successful login
    if (needsMigration) {
      const newHash = await hashPassword(args.password);
      await ctx.db.patch(user._id, { passwordHash: newHash } as any);
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

    // Check if premium has expired (for canceled subscriptions)
    let isPremiumActive = profile.isPremium;
    if (
      profile.isPremium &&
      profile.stripeSubscriptionStatus === "canceled" &&
      profile.premiumExpiresAt &&
      profile.premiumExpiresAt < Date.now()
    ) {
      // Premium has expired - return false but don't update DB in query
      // (mutations should handle the actual DB update)
      isPremiumActive = false;
    }

    return {
      id: profile.userId,
      email: profile.email,
      name: profile.name,
      isPremium: isPremiumActive,
      premiumExpiresAt: profile.premiumExpiresAt,
      stripeCustomerId: profile.stripeCustomerId,
      stripeSubscriptionId: profile.stripeSubscriptionId,
      // Subscription management fields
      stripeSubscriptionStatus: profile.stripeSubscriptionStatus,
      subscriptionCanceledAt: profile.subscriptionCanceledAt,
      subscriptionPlan: profile.subscriptionPlan,
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


// Update user premium status
export const updatePremiumStatus = mutation({
  args: {
    userId: v.string(),
    isPremium: v.boolean(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    premiumExpiresAt: v.optional(v.number()),
    stripeSubscriptionStatus: v.optional(v.string()),
    subscriptionPlan: v.optional(v.string()),
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
      stripeSubscriptionStatus: args.stripeSubscriptionStatus,
      subscriptionPlan: args.subscriptionPlan,
    });

    return { success: true };
  },
});

// Cancel subscription (sets status to canceled, keeps premium until expiry)
export const cancelSubscription = mutation({
  args: {
    userId: v.string(),
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

    if (!user.isPremium) {
      throw new Error("No active subscription to cancel");
    }

    // Set subscription status to canceled
    // User keeps premium access until premiumExpiresAt
    await ctx.db.patch(user._id, {
      stripeSubscriptionStatus: "canceled",
      subscriptionCanceledAt: Date.now(),
    });

    return {
      success: true,
      premiumExpiresAt: user.premiumExpiresAt,
    };
  },
});

// Reactivate subscription (for users who canceled but want to continue)
export const reactivateSubscription = mutation({
  args: {
    userId: v.string(),
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

    if (!user.isPremium || user.stripeSubscriptionStatus !== "canceled") {
      throw new Error("No canceled subscription to reactivate");
    }

    // Reactivate subscription
    await ctx.db.patch(user._id, {
      stripeSubscriptionStatus: "active",
      subscriptionCanceledAt: undefined,
    });

    return { success: true };
  },
});

// Check and update expired premium subscriptions
export const checkAndExpirePremium = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!user) {
      return { updated: false, reason: "User not found" };
    }

    // Check if premium should be expired
    if (
      user.isPremium &&
      user.stripeSubscriptionStatus === "canceled" &&
      user.premiumExpiresAt &&
      user.premiumExpiresAt < Date.now()
    ) {
      // Premium has expired - update database
      await ctx.db.patch(user._id, {
        isPremium: false,
        stripeSubscriptionStatus: "expired",
      });
      return { updated: true, reason: "Premium expired" };
    }

    return { updated: false, reason: "Premium still active or not canceled" };
  },
});

// ============================================
// SECURITY QUESTION / PASSWORD RECOVERY
// ============================================

// Set security question for a user
export const setSecurityQuestion = mutation({
  args: {
    userId: v.string(),
    question: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Hash the security answer (case-insensitive, trimmed)
    const answerHash = await hashPassword(args.answer.toLowerCase().trim());

    await ctx.db.patch(user._id, {
      securityQuestion: args.question,
      securityAnswerHash: answerHash,
    } as any);

    return { success: true };
  },
});

// Get security question for an email (only returns the question, not the answer)
export const getSecurityQuestion = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user || !user.securityQuestion) {
      return { found: false, question: null };
    }

    return { found: true, question: user.securityQuestion };
  },
});

// Reset password using security answer
export const resetPasswordWithSecurityAnswer = mutation({
  args: {
    email: v.string(),
    answer: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("Benutzer nicht gefunden");
    }

    if (!user.securityAnswerHash) {
      throw new Error("Keine Sicherheitsfrage eingerichtet");
    }

    // Verify the security answer (case-insensitive, trimmed)
    const { valid } = await verifyPassword(
      args.answer.toLowerCase().trim(),
      user.securityAnswerHash
    );

    if (!valid) {
      throw new Error("Falsche Sicherheitsantwort");
    }

    // Hash and save the new password
    const newPasswordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(user._id, {
      passwordHash: newPasswordHash,
    } as any);

    return { success: true };
  },
});

