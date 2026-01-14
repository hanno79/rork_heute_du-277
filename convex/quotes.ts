import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const FREE_USER_REPEAT_DAYS = 30;
const PREMIUM_USER_REPEAT_DAYS = 180;

// Get daily quote (with history tracking)
export const getDailyQuote = query({
  args: {
    language: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // For now, always fetch English quotes (they have translations embedded)
    const queryLanguage = "en";

    if (!args.userId) {
      // Guest user - return random quote
      const quotes = await ctx.db
        .query("quotes")
        .withIndex("by_language", (q) => q.eq("language", queryLanguage))
        .collect();

      if (quotes.length === 0) {
        return { quote: null, source: "none" };
      }

      const randomIndex = Math.floor(Math.random() * quotes.length);
      return { quote: quotes[randomIndex], source: "database" };
    }

    // Authenticated user - get unseen quote
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    const repeatDays = profile?.isPremium
      ? PREMIUM_USER_REPEAT_DAYS
      : FREE_USER_REPEAT_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - repeatDays);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    // Get recent history
    const recentHistory = await ctx.db
      .query("userQuoteHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const recentQuoteIds = new Set(
      recentHistory
        .filter((h) => h.shownAt >= cutoffDateStr)
        .map((h) => h.quoteId)
    );

    // Get all quotes for the language
    const allQuotes = await ctx.db
      .query("quotes")
      .withIndex("by_language", (q) => q.eq("language", queryLanguage))
      .collect();

    const unseenQuotes = allQuotes.filter((q) => !recentQuoteIds.has(q._id));

    let quote;
    if (unseenQuotes.length > 0) {
      const randomIndex = Math.floor(Math.random() * unseenQuotes.length);
      quote = unseenQuotes[randomIndex];
    } else {
      // All seen - return random (AI generation will be triggered separately)
      const randomIndex = Math.floor(Math.random() * allQuotes.length);
      quote = allQuotes[randomIndex];
    }

    return { quote, source: "database", isPremium: profile?.isPremium };
  },
});

// Record quote in history
export const recordQuoteHistory = mutation({
  args: {
    userId: v.string(),
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    // Check if already recorded today
    const existing = await ctx.db
      .query("userQuoteHistory")
      .withIndex("by_user_and_quote", (q) =>
        q.eq("userId", args.userId).eq("quoteId", args.quoteId)
      )
      .filter((q) => q.eq(q.field("shownAt"), today))
      .first();

    if (existing) {
      return { success: true, alreadyRecorded: true };
    }

    await ctx.db.insert("userQuoteHistory", {
      userId: args.userId,
      quoteId: args.quoteId,
      shownAt: today,
    });

    return { success: true };
  },
});

// Search quotes
export const searchQuotes = query({
  args: {
    query: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();

    // Get all quotes for the language
    const quotes = await ctx.db.query("quotes").collect();

    const results = quotes.filter((quote) => {
      const matchText = quote.text.toLowerCase().includes(searchTerm);
      const matchContext = quote.context?.toLowerCase().includes(searchTerm);
      const matchExplanation = quote.explanation
        ?.toLowerCase()
        .includes(searchTerm);
      const matchAuthor = quote.author?.toLowerCase().includes(searchTerm);
      const matchReference = quote.reference?.toLowerCase().includes(searchTerm);
      const matchTags = quote.tags?.some((tag) =>
        tag.toLowerCase().includes(searchTerm)
      );
      const matchSituations = quote.situations?.some((s) =>
        s.toLowerCase().includes(searchTerm)
      );

      return (
        matchText ||
        matchContext ||
        matchExplanation ||
        matchAuthor ||
        matchReference ||
        matchTags ||
        matchSituations
      );
    });

    return { results, totalCount: results.length };
  },
});

// Add to favorites
export const addFavorite = mutation({
  args: {
    userId: v.string(),
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args) => {
    // Check if already favorited
    const existing = await ctx.db
      .query("userFavorites")
      .withIndex("by_user_and_quote", (q) =>
        q.eq("userId", args.userId).eq("quoteId", args.quoteId)
      )
      .first();

    if (existing) {
      return { success: true, alreadyFavorited: true };
    }

    await ctx.db.insert("userFavorites", {
      userId: args.userId,
      quoteId: args.quoteId,
    });

    return { success: true };
  },
});

// Remove from favorites
export const removeFavorite = mutation({
  args: {
    userId: v.string(),
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args) => {
    const favorite = await ctx.db
      .query("userFavorites")
      .withIndex("by_user_and_quote", (q) =>
        q.eq("userId", args.userId).eq("quoteId", args.quoteId)
      )
      .first();

    if (favorite) {
      await ctx.db.delete(favorite._id);
    }

    return { success: true };
  },
});

// Get user favorites
export const getFavorites = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const favorites = await ctx.db
      .query("userFavorites")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Fetch quote details
    const quotes = await Promise.all(
      favorites.map((fav) => ctx.db.get(fav.quoteId))
    );

    return { favorites: quotes.filter((q) => q !== null) };
  },
});

// Get quote by ID
export const getQuoteById = query({
  args: {
    quoteId: v.id("quotes"),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    return quote;
  },
});

// Insert AI-generated quote (called from actions)
export const insertAIQuote = mutation({
  args: {
    text: v.string(),
    author: v.optional(v.string()),
    reference: v.optional(v.string()),
    source: v.string(),
    category: v.optional(v.string()),
    language: v.string(),
    isPremium: v.boolean(),
    context: v.optional(v.string()),
    explanation: v.optional(v.string()),
    situations: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    aiPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const quoteId = await ctx.db.insert("quotes", {
      text: args.text,
      author: args.author || null,
      reference: args.reference || null,
      source: args.source as "static" | "ai_generated",
      category: args.category as any,
      language: args.language,
      isPremium: args.isPremium,
      context: args.context || null,
      explanation: args.explanation || null,
      situations: args.situations || [],
      tags: args.tags || [],
      translations: {},
      reflectionQuestions: [],
      practicalTips: [],
      aiPrompt: args.aiPrompt || null,
    });

    return quoteId;
  },
});
