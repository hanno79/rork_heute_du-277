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
    // Subscription management fields
    stripeSubscriptionStatus: v.optional(v.string()), // "active", "canceled", "past_due"
    subscriptionCanceledAt: v.optional(v.number()),   // Timestamp when user canceled
    subscriptionPlan: v.optional(v.string()),         // "monthly" or "yearly"
    // Security question for password recovery
    securityQuestion: v.optional(v.string()),         // The selected security question
    securityAnswerHash: v.optional(v.string()),       // PBKDF2 hashed answer
    // Session token for API authorization (SECURITY: server-generated tokens)
    sessionToken: v.optional(v.string()),             // Server-generated session token
    sessionExpiresAt: v.optional(v.number()),         // Token expiration timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"])
    .index("by_sessionToken", ["sessionToken"]), // SECURITY: For token-only session validation

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

  // Search categories (Stammdaten)
  searchCategories: defineTable({
    name: v.string(), // "relationship", "work", "family", "health", "grief", "motivation", "conflict"
    displayName_de: v.string(), // "Beziehung"
    displayName_en: v.string(), // "Relationship"
    keywords_de: v.array(v.string()), // ["partner", "liebe", "ehe", "freundschaft"]
    keywords_en: v.array(v.string()), // ["partner", "love", "marriage", "friendship"]
  }).index("by_name", ["name"]),

  // Search contexts (stores search queries with their context)
  searchContexts: defineTable({
    searchQuery: v.string(), // Original search query ("Streit mit Partner")
    normalizedQuery: v.string(), // Normalized for matching
    categoryId: v.optional(v.id("searchCategories")), // Category (AI-determined or keyword-matched)
    language: v.string(), // "de" or "en"
    searchCount: v.number(), // How often was this searched?
    createdAt: v.number(), // Timestamp
    lastUsedAt: v.number(), // Last access
  })
    .index("by_normalized_query", ["normalizedQuery", "language"])
    .index("by_category", ["categoryId"])
    .index("by_language", ["language"])
    .searchIndex("search_query", { searchField: "searchQuery" }),

  // Quote-Context mappings (Many-to-Many)
  quoteContextMappings: defineTable({
    quoteId: v.id("quotes"), // Reference to quote
    contextId: v.id("searchContexts"), // Reference to search context
    relevanceScore: v.number(), // How relevant is the quote (0-100)
    isAiGenerated: v.boolean(), // Was this result AI-generated?
    createdAt: v.number(),
  })
    .index("by_quote", ["quoteId"])
    .index("by_context", ["contextId"])
    .index("by_context_relevance", ["contextId", "relevanceScore"]),

  // User search limits (Rate-Limiting)
  userSearchLimits: defineTable({
    date: v.string(), // "2026-01-14" (date string)
    userId: v.string(), // User ID
    searchCount: v.number(), // Total searches today (all types)
    aiSearchCount: v.number(), // Number of AI generations today
    lastSearchAt: v.number(), // Last search timestamp
  }).index("by_user_date", ["userId", "date"]),

  // User search history (tracks which searches a user performed)
  userSearchHistory: defineTable({
    userId: v.string(),
    searchContextId: v.id("searchContexts"),
    searchedAt: v.number(), // Timestamp when the search was performed
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_date", ["userId", "searchedAt"]),

  // Global daily quotes (one quote per day per language for ALL users)
  dailyQuotes: defineTable({
    date: v.string(), // "2026-01-14" (ISO date string)
    quoteId: v.id("quotes"), // Reference to the quote
    language: v.string(), // "de" or "en"
    selectedAt: v.number(), // Timestamp when selected
  })
    .index("by_date_language", ["date", "language"])
    .index("by_language", ["language"]),

  // Synonym groups for semantic search matching
  // Allows finding quotes via related terms (e.g., "Liebeskummer" ≈ "Trennung" ≈ "Herzschmerz")
  synonymGroups: defineTable({
    groupName: v.string(), // Unique identifier, e.g., "heartbreak"
    terms_de: v.array(v.string()), // German synonyms: ["liebeskummer", "herzschmerz", "trennung"]
    terms_en: v.array(v.string()), // English synonyms: ["heartbreak", "breakup", "heartache"]
  }).index("by_groupName", ["groupName"]),

  // Login attempts tracking for rate limiting
  // Prevents brute-force attacks by locking accounts after failed attempts
  loginAttempts: defineTable({
    email: v.string(),
    attempts: v.number(),
    lastAttempt: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_email", ["email"]),
});
