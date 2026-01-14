import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Quotes table
  quotes: defineTable({
    text: v.string(),
    author: v.optional(v.string()),
    reference: v.optional(v.string()),
    source: v.union(v.literal("static"), v.literal("ai_generated")),
    category: v.optional(
      v.union(
        v.literal("bible"),
        v.literal("quote"),
        v.literal("saying"),
        v.literal("poem")
      )
    ),
    language: v.string(),
    isPremium: v.boolean(),
    context: v.optional(v.string()),
    explanation: v.optional(v.string()),
    situations: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    translations: v.optional(v.any()), // JSON object for nested translations
    reflectionQuestions: v.optional(v.array(v.string())),
    practicalTips: v.optional(v.array(v.string())),
    aiPrompt: v.optional(v.string()),
  })
    .index("by_language", ["language"])
    .index("by_source", ["source"])
    .index("by_language_source", ["language", "source"]),

  // User profiles
  userProfiles: defineTable({
    userId: v.string(), // Convex user ID
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    isPremium: v.boolean(),
    premiumExpiresAt: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),

  // User favorites
  userFavorites: defineTable({
    userId: v.string(),
    quoteId: v.id("quotes"),
  })
    .index("by_userId", ["userId"])
    .index("by_quoteId", ["quoteId"])
    .index("by_user_and_quote", ["userId", "quoteId"]),

  // User settings
  userSettings: defineTable({
    userId: v.string(),
    language: v.string(),
    notificationsEnabled: v.boolean(),
    notificationTime: v.optional(v.string()),
    notificationDays: v.optional(v.array(v.number())),
    dailyQuote: v.boolean(),
    motivationalReminders: v.boolean(),
    weeklyDigest: v.boolean(),
  }).index("by_userId", ["userId"]),

  // User quote history
  userQuoteHistory: defineTable({
    userId: v.string(),
    quoteId: v.id("quotes"),
    shownAt: v.string(), // ISO date string (YYYY-MM-DD)
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_date", ["userId", "shownAt"])
    .index("by_user_and_quote", ["userId", "quoteId"]),
});
