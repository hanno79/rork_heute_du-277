import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Days to avoid repeating a quote as "Quote of the Day"
const DAILY_QUOTE_REPEAT_DAYS = 30;

// Get daily quote - returns the SAME quote for ALL users on the same day
// This ensures consistency: everyone sees the same "Quote of the Day"
export const getDailyQuote = query({
  args: {
    language: v.string(),
    userId: v.optional(v.string()), // Optional - for recording history only
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0]; // "2026-01-14"

    // 1. Check if we already have a daily quote for today in this language
    const existingDaily = await ctx.db
      .query("dailyQuotes")
      .withIndex("by_date_language", (q) =>
        q.eq("date", today).eq("language", args.language)
      )
      .first();

    if (existingDaily) {
      // Return the existing daily quote
      const quote = await ctx.db.get(existingDaily.quoteId);
      if (quote) {
        return { quote, source: "daily", needsSelection: false };
      }
    }

    // 2. No daily quote for today - return null to trigger client-side selection
    // The client will call ensureDailyQuote mutation to select and store
    return { quote: null, source: "none", needsSelection: true };
  },
});

// Ensure daily quote exists - selects and stores a quote for today if needed
// This mutation is called by the client when no daily quote exists
export const ensureDailyQuote = mutation({
  args: {
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    // Double-check if already exists (race condition protection)
    const existing = await ctx.db
      .query("dailyQuotes")
      .withIndex("by_date_language", (q) =>
        q.eq("date", today).eq("language", args.language)
      )
      .first();

    if (existing) {
      const quote = await ctx.db.get(existing.quoteId);
      return { quote, alreadyExisted: true };
    }

    // Get recent daily quotes to avoid repetition
    const recentDailyQuotes = await ctx.db
      .query("dailyQuotes")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .order("desc")
      .take(DAILY_QUOTE_REPEAT_DAYS);

    const recentQuoteIds = new Set(recentDailyQuotes.map((d) => d.quoteId));

    // Get all available quotes
    const allQuotesInDb = await ctx.db.query("quotes").collect();

    // Prioritize: 1) Quotes in user's language, 2) English quotes (have translations)
    const quotesInUserLanguage = allQuotesInDb.filter((q) => q.language === args.language);
    const englishQuotes = allQuotesInDb.filter((q) => q.language === "en");
    const allQuotes = [...quotesInUserLanguage, ...englishQuotes];

    // Remove duplicates
    const seenTexts = new Set<string>();
    const uniqueQuotes = allQuotes.filter((q) => {
      const key = q.text.toLowerCase().substring(0, 50);
      if (seenTexts.has(key)) return false;
      seenTexts.add(key);
      return true;
    });

    if (uniqueQuotes.length === 0) {
      return { quote: null, error: "No quotes available" };
    }

    // Filter out recently used quotes
    const availableQuotes = uniqueQuotes.filter((q) => !recentQuoteIds.has(q._id));
    const candidates = availableQuotes.length > 0 ? availableQuotes : uniqueQuotes;

    // Select random quote
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const selectedQuote = candidates[randomIndex];

    // Store as today's daily quote
    await ctx.db.insert("dailyQuotes", {
      date: today,
      quoteId: selectedQuote._id,
      language: args.language,
      selectedAt: Date.now(),
    });

    return { quote: selectedQuote, alreadyExisted: false };
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
    // Build the document object, only including optional fields if they have values
    // v.optional() does NOT allow null, only undefined (missing field) or valid value
    const doc: any = {
      text: args.text,
      source: args.source as "static" | "ai_generated",
      language: args.language,
      isPremium: args.isPremium,
      situations: args.situations || [],
      tags: args.tags || [],
      translations: {},
      reflectionQuestions: [],
      practicalTips: [],
    };

    // Only add optional fields if they have truthy values
    if (args.author) doc.author = args.author;
    if (args.reference) doc.reference = args.reference;
    if (args.category) doc.category = args.category;
    if (args.context) doc.context = args.context;
    if (args.explanation) doc.explanation = args.explanation;
    if (args.aiPrompt) doc.aiPrompt = args.aiPrompt;

    const quoteId = await ctx.db.insert("quotes", doc);

    return quoteId;
  },
});
