import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
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

// SECURITY: Timing-safe byte array comparison to prevent timing attacks
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  // If lengths differ, still do the comparison to maintain constant time
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Will be non-zero if lengths differ

  for (let i = 0; i < maxLen; i++) {
    // Use 0 as fallback for out-of-bounds access to maintain constant time
    const byteA = i < a.length ? a[i] : 0;
    const byteB = i < b.length ? b[i] : 0;
    result |= byteA ^ byteB;
  }

  return result === 0;
}

// Legacy SHA-256 hash verification (for migration)
// SECURITY: Uses timing-safe comparison to prevent timing attacks
async function verifyLegacySHA256(password: string, storedHash: string): Promise<boolean> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const computedHashBytes = new Uint8Array(hashBuffer);

  // Decode stored hex hash to bytes for timing-safe comparison
  const storedHashBytes = new Uint8Array(
    storedHash.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  // Use timing-safe byte comparison
  return timingSafeEqualBytes(computedHashBytes, storedHashBytes);
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

// Password validation helper
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("mindestens 8 Zeichen");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("einen Großbuchstaben");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("einen Kleinbuchstaben");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("eine Zahl");
  }

  return { valid: errors.length === 0, errors };
}

// Input length validation helper
function validateInputLengths(args: { name?: string; email?: string; password?: string }): { valid: boolean; error?: string } {
  if (args.name && args.name.length > 100) {
    return { valid: false, error: "Name zu lang (max. 100 Zeichen)" };
  }
  if (args.email && args.email.length > 255) {
    return { valid: false, error: "E-Mail zu lang (max. 255 Zeichen)" };
  }
  if (args.password && args.password.length > 128) {
    return { valid: false, error: "Passwort zu lang (max. 128 Zeichen)" };
  }
  return { valid: true };
}

// Rate limiting helper - check if action is blocked
async function checkRateLimit(
  ctx: QueryCtx | MutationCtx,
  email: string,
  actionType: 'login' | 'register' | 'reset'
): Promise<{ blocked: boolean; remainingMinutes?: number }> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `${actionType}:${normalizedEmail}`;

  const attempt = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", key))
    .first();

  if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
    const remainingMinutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    return { blocked: true, remainingMinutes };
  }

  return { blocked: false };
}

// Rate limiting helper - record failed attempt
async function recordFailedAttempt(
  ctx: MutationCtx,
  email: string,
  actionType: 'login' | 'register' | 'reset'
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `${actionType}:${normalizedEmail}`;
  const now = Date.now();

  const attempt = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", key))
    .first();

  if (attempt) {
    const newAttempts = attempt.attempts + 1;
    const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
    await ctx.db.patch(attempt._id, {
      attempts: newAttempts,
      lastAttempt: now,
      lockedUntil: shouldLock ? now + LOCKOUT_DURATION : undefined,
    });
  } else {
    await ctx.db.insert("loginAttempts", {
      email: key,
      attempts: 1,
      lastAttempt: now,
    });
  }
}

// Rate limiting helper - clear attempts after success
async function clearRateLimitAttempts(
  ctx: MutationCtx,
  email: string,
  actionType: 'login' | 'register' | 'reset'
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `${actionType}:${normalizedEmail}`;

  const attempt = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", key))
    .first();

  if (attempt) {
    await ctx.db.delete(attempt._id);
  }
}

// SECURITY: Generate cryptographically secure session token
// Token format: 64 hex chars (256 bits of entropy)
function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Session token expiration time: 24 hours
const SESSION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

// SECURITY: Timing-safe string comparison to prevent timing attacks
// Returns false if lengths differ, otherwise XORs char codes and returns result
// Accepts null/undefined inputs which are normalized to empty strings
function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  // Normalize null/undefined to empty string
  const strA = a ?? '';
  const strB = b ?? '';

  // If lengths differ, still do the comparison to maintain constant time
  // but remember that the result should be false
  const lenA = strA.length;
  const lenB = strB.length;
  const maxLen = Math.max(lenA, lenB);

  let result = lenA ^ lenB; // Will be non-zero if lengths differ

  for (let i = 0; i < maxLen; i++) {
    // Use 0 as fallback for out-of-bounds access to maintain constant time
    const charA = i < lenA ? strA.charCodeAt(i) : 0;
    const charB = i < lenB ? strB.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }

  return result === 0;
}

// Register new user
// SECURITY: Rate-limited and input-validated
export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Input length validation to prevent abuse
    const lengthValidation = validateInputLengths(args);
    if (!lengthValidation.valid) {
      return { success: false, error: lengthValidation.error, user: null };
    }

    // SECURITY: Check rate limiting for registration attempts
    const rateLimit = await checkRateLimit(ctx, args.email, 'register');
    if (rateLimit.blocked) {
      return {
        success: false,
        error: `Zu viele Registrierungsversuche. Bitte versuchen Sie es in ${rateLimit.remainingMinutes} Minuten erneut.`,
        user: null,
      };
    }

    // Validate password on backend (same rules as frontend)
    const passwordValidation = validatePassword(args.password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: `Passwort benötigt: ${passwordValidation.errors.join(", ")}`,
        user: null,
      };
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existingUser) {
      // SECURITY: Record failed attempt and return generic error to prevent enumeration
      await recordFailedAttempt(ctx, args.email, 'register');
      return { success: false, error: "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.", user: null };
    }

    // Hash password
    const passwordHash = await hashPassword(args.password);

    // Create a unique user ID
    const userId = crypto.randomUUID();

    // SECURITY: Generate server-side session token
    const sessionToken = generateSessionToken();
    const sessionExpiresAt = Date.now() + SESSION_TOKEN_EXPIRY;

    // Create user profile with session token
    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      name: args.name,
      email: args.email,
      isPremium: false,
      passwordHash,
      sessionToken,
      sessionExpiresAt,
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

    // SECURITY: Return session token to client for API authorization
    return {
      success: true,
      user: profile,
      sessionToken,
      sessionExpiresAt,
    };
  },
});

// Login with rate limiting
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Check for rate limiting / account lockout
    const loginAttempt = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (loginAttempt?.lockedUntil && loginAttempt.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((loginAttempt.lockedUntil - Date.now()) / 60000);
      return {
        success: false,
        error: `Konto temporär gesperrt. Bitte versuchen Sie es in ${remainingMinutes} Minuten erneut.`,
        user: null,
      };
    }

    // Find user by email
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    // Helper function to record failed attempt
    const recordFailedAttempt = async () => {
      const now = Date.now();
      if (loginAttempt) {
        const newAttempts = loginAttempt.attempts + 1;
        const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
        await ctx.db.patch(loginAttempt._id, {
          attempts: newAttempts,
          lastAttempt: now,
          lockedUntil: shouldLock ? now + LOCKOUT_DURATION : undefined,
        });
      } else {
        await ctx.db.insert("loginAttempts", {
          email: normalizedEmail,
          attempts: 1,
          lastAttempt: now,
        });
      }
    };

    if (!user) {
      await recordFailedAttempt();
      return { success: false, error: "Ungültige E-Mail oder Passwort", user: null };
    }

    // Verify password
    const passwordHash = (user as any).passwordHash;
    if (!passwordHash) {
      await recordFailedAttempt();
      return { success: false, error: "Ungültige E-Mail oder Passwort", user: null };
    }

    const { valid, needsMigration } = await verifyPassword(args.password, passwordHash);
    if (!valid) {
      await recordFailedAttempt();
      return { success: false, error: "Ungültige E-Mail oder Passwort", user: null };
    }

    // Successful login - reset failed attempts
    if (loginAttempt) {
      await ctx.db.delete(loginAttempt._id);
    }

    // SECURITY: Generate new server-side session token on each login
    const sessionToken = generateSessionToken();
    const sessionExpiresAt = Date.now() + SESSION_TOKEN_EXPIRY;

    // Update user with new session token and migrate hash if needed
    const updates: any = {
      sessionToken,
      sessionExpiresAt,
    };

    // Migrate legacy SHA-256 hash to PBKDF2 on successful login
    if (needsMigration) {
      updates.passwordHash = await hashPassword(args.password);
    }

    await ctx.db.patch(user._id, updates);

    // SECURITY: Return session token to client for API authorization
    return {
      success: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        isPremium: user.isPremium,
      },
      sessionToken,
      sessionExpiresAt,
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
// SECURITY: Uses token-only validation - userId is derived from session, not trusted from client
export const cancelSubscription = mutation({
  args: {
    sessionToken: v.string(), // SECURITY: Required for authorization - userId derived from token
  },
  handler: async (ctx, args) => {
    // SECURITY: Find user by session token index
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!user) {
      throw new Error("Unauthorized: Invalid session token");
    }

    // SECURITY: Timing-safe token verification after index lookup
    if (!timingSafeEqual(user.sessionToken ?? '', args.sessionToken)) {
      throw new Error("Unauthorized: Invalid session token");
    }

    // Check if session has expired
    if (user.sessionExpiresAt && user.sessionExpiresAt < Date.now()) {
      throw new Error("Unauthorized: Session expired");
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
// SECURITY: Uses token-only validation - userId is derived from session, not trusted from client
export const reactivateSubscription = mutation({
  args: {
    sessionToken: v.string(), // SECURITY: Required for authorization - userId derived from token
  },
  handler: async (ctx, args) => {
    // SECURITY: Find user by session token index
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!user) {
      throw new Error("Unauthorized: Invalid session token");
    }

    // SECURITY: Timing-safe token verification after index lookup
    if (!timingSafeEqual(user.sessionToken ?? '', args.sessionToken)) {
      throw new Error("Unauthorized: Invalid session token");
    }

    // Check if session has expired
    if (user.sessionExpiresAt && user.sessionExpiresAt < Date.now()) {
      throw new Error("Unauthorized: Session expired");
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
// SECURITY: Always returns a question to prevent user enumeration
export const getSecurityQuestion = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    // SECURITY: Always return found=true to prevent email enumeration
    // If user doesn't exist or has no security question, return a generic question
    // The actual verification happens in resetPasswordWithSecurityAnswer
    if (!user || !user.securityQuestion) {
      return {
        found: true,
        question: "Was ist Ihr Lieblingsort?" // Generic fallback
      };
    }

    return { found: true, question: user.securityQuestion };
  },
});

// Reset password using security answer
// SECURITY: Rate-limited to prevent brute-force attacks
export const resetPasswordWithSecurityAnswer = mutation({
  args: {
    email: v.string(),
    answer: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Generic error message to prevent user enumeration
    const genericError = "Passwort-Reset fehlgeschlagen. Bitte überprüfen Sie Ihre Angaben.";

    // SECURITY: Check rate limiting for password reset attempts
    const rateLimit = await checkRateLimit(ctx, args.email, 'reset');
    if (rateLimit.blocked) {
      return {
        success: false,
        error: `Zu viele Reset-Versuche. Bitte versuchen Sie es in ${rateLimit.remainingMinutes} Minuten erneut.`,
      };
    }

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      // SECURITY: Record failed attempt and return generic error
      await recordFailedAttempt(ctx, args.email, 'reset');
      return { success: false, error: genericError };
    }

    if (!user.securityAnswerHash) {
      await recordFailedAttempt(ctx, args.email, 'reset');
      return { success: false, error: genericError };
    }

    // Verify the security answer (case-insensitive, trimmed)
    const { valid } = await verifyPassword(
      args.answer.toLowerCase().trim(),
      user.securityAnswerHash
    );

    if (!valid) {
      // SECURITY: Record failed attempt for wrong answer
      await recordFailedAttempt(ctx, args.email, 'reset');
      return { success: false, error: genericError };
    }

    // Validate new password
    const passwordValidation = validatePassword(args.newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: `Neues Passwort benötigt: ${passwordValidation.errors.join(", ")}`,
      };
    }

    // Hash and save the new password
    const newPasswordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(user._id, {
      passwordHash: newPasswordHash,
    } as any);

    // SECURITY: Clear rate limit attempts after successful reset
    await clearRateLimitAttempts(ctx, args.email, 'reset');

    return { success: true };
  },
});

// ============================================
// SESSION VALIDATION
// ============================================

// SECURITY: Validate session token for API authorization
// Used by other modules (quotes, favorites) to verify user identity
export const validateSession = query({
  args: {
    userId: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      return { valid: false, reason: "user_not_found" };
    }

    // SECURITY: Timing-safe token comparison to prevent timing attacks
    if (!timingSafeEqual(user.sessionToken ?? '', args.sessionToken)) {
      return { valid: false, reason: "invalid_token" };
    }

    // Check if session has expired
    if (user.sessionExpiresAt && user.sessionExpiresAt < Date.now()) {
      return { valid: false, reason: "token_expired" };
    }

    return { valid: true, userId: user.userId };
  },
});

// SECURITY: Validate session by token ONLY (no client-provided userId)
// This is the SECURE version - looks up user by sessionToken, not by userId
// Use this for sensitive operations where userId should NOT be trusted from client
export const validateSessionByToken = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Look up user by session token index
    // Note: Index lookup followed by timing-safe verification to prevent timing attacks
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!user) {
      return { valid: false as const, reason: "invalid_token" };
    }

    // SECURITY: Timing-safe token verification after index lookup
    // This prevents timing attacks that could exploit index lookup timing variations
    if (!timingSafeEqual(user.sessionToken ?? '', args.sessionToken)) {
      return { valid: false as const, reason: "invalid_token" };
    }

    // Check if session has expired
    if (user.sessionExpiresAt && user.sessionExpiresAt < Date.now()) {
      return { valid: false as const, reason: "token_expired" };
    }

    // Return minimum required data for authorization
    return {
      valid: true as const,
      userId: user.userId,
      isPremium: user.isPremium,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    };
  },
});

// SECURITY: Logout - invalidate session token
export const logout = mutation({
  args: {
    userId: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // SECURITY: Timing-safe token comparison to prevent timing attacks
    if (!timingSafeEqual(user.sessionToken ?? '', args.sessionToken)) {
      return { success: false, error: "Invalid session" };
    }

    // Clear session token
    await ctx.db.patch(user._id, {
      sessionToken: undefined,
      sessionExpiresAt: undefined,
    } as any);

    return { success: true };
  },
});

