import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { SessionValidationResult } from "./utils/types";

// Days to avoid repeating a quote as "Quote of the Day"
const DAILY_QUOTE_REPEAT_DAYS = 30;

// Get daily quote - returns the SAME quote for ALL users on the same day
// This ensures consistency: everyone sees the same "Quote of the Day"
// WICHTIG: Das Zitat ist GLOBAL (ein Zitat pro Tag für alle Sprachen)
// Die Übersetzung wird client-seitig via applyLocalization angewendet
export const getDailyQuote = query({
  args: {
    language: v.string(), // Nur für Logging, nicht für Selektion
    userId: v.optional(v.string()), // Optional - for recording history only
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0]; // "2026-01-14"

    // 1. Check if we already have a daily quote for today (OHNE Sprachfilter!)
    // Das globale Zitat des Tages wird für alle Sprachen verwendet
    const existingDaily = await ctx.db
      .query("dailyQuotes")
      .filter((q) => q.eq(q.field("date"), today))
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
// WICHTIG: Wählt EIN globales Zitat pro Tag (für alle Sprachen)
// Bevorzugt Zitate MIT Übersetzungen für bessere Multi-Language Support
export const ensureDailyQuote = mutation({
  args: {
    language: v.optional(v.string()), // Optional, nur für Fallback-Logik
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];

    // Double-check if already exists (race condition protection)
    // OHNE Sprachfilter - globales Zitat pro Tag
    const existing = await ctx.db
      .query("dailyQuotes")
      .filter((q) => q.eq(q.field("date"), today))
      .first();

    if (existing) {
      const quote = await ctx.db.get(existing.quoteId);
      return { quote, alreadyExisted: true };
    }

    // Get recent daily quotes to avoid repetition (alle Sprachen)
    const recentDailyQuotes = await ctx.db
      .query("dailyQuotes")
      .order("desc")
      .take(DAILY_QUOTE_REPEAT_DAYS);

    const recentQuoteIds = new Set(recentDailyQuotes.map((d) => d.quoteId));

    // Get all available quotes
    const allQuotesInDb = await ctx.db.query("quotes").collect();

    // BEVORZUGE Zitate MIT Übersetzungen (für bessere Multi-Language Support)
    const quotesWithTranslations = allQuotesInDb.filter((q) =>
      q.translations && typeof q.translations === 'object' && Object.keys(q.translations).length > 0
    );

    // Fallback: Alle Zitate wenn keine mit Übersetzungen verfügbar
    const allQuotes = quotesWithTranslations.length > 0 ? quotesWithTranslations : allQuotesInDb;

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

    // Store as today's daily quote (OHNE Sprache - global)
    await ctx.db.insert("dailyQuotes", {
      date: today,
      quoteId: selectedQuote._id,
      language: "global", // Marker für globales Zitat
      selectedAt: Date.now(),
    });

    return { quote: selectedQuote, alreadyExisted: false };
  },
});

// Record quote in history
// SECURITY: internalMutation - only callable from other Convex functions, not from clients
// This prevents unauthorized users from recording history for other users
export const recordQuoteHistory = internalMutation({
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

// Search quotes - with bilingual translation support
export const searchQuotes = query({
  args: {
    query: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();

    // Get all quotes (no language filter - we search all and their translations)
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

      // NEW: Search in translations for bilingual support
      let translationMatch = false;
      if (quote.translations && typeof quote.translations === 'object') {
        for (const lang of Object.keys(quote.translations)) {
          const t = (quote.translations as any)[lang];
          if (t && typeof t === 'object') {
            if (
              t.text?.toLowerCase().includes(searchTerm) ||
              t.context?.toLowerCase().includes(searchTerm) ||
              t.explanation?.toLowerCase().includes(searchTerm) ||
              t.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm)) ||
              t.situations?.some((s: string) => s.toLowerCase().includes(searchTerm))
            ) {
              translationMatch = true;
              break;
            }
          }
        }
      }

      return (
        matchText ||
        matchContext ||
        matchExplanation ||
        matchAuthor ||
        matchReference ||
        matchTags ||
        matchSituations ||
        translationMatch
      );
    });

    return { results, totalCount: results.length };
  },
});

// Add to favorites
// SECURITY: Uses sessionToken-only validation - userId derived from session, not trusted from client
export const addFavorite = mutation({
  args: {
    quoteId: v.id("quotes"),
    sessionToken: v.string(), // SECURITY: Required - userId derived from token
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate session and get userId from server - NEVER trust client-provided userId
    const session: SessionValidationResult = await ctx.runQuery(api.auth.validateSessionByToken, {
      sessionToken: args.sessionToken,
    });

    if (!session.valid || !session.userId) {
      return { success: false, error: session.error || "Unauthorized" };
    }

    const userId = session.userId;

    // Check if already favorited
    const existing = await ctx.db
      .query("userFavorites")
      .withIndex("by_user_and_quote", (q) =>
        q.eq("userId", userId).eq("quoteId", args.quoteId)
      )
      .first();

    if (existing) {
      return { success: true, alreadyFavorited: true };
    }

    await ctx.db.insert("userFavorites", {
      userId,
      quoteId: args.quoteId,
    });

    return { success: true };
  },
});

// Remove from favorites
// SECURITY: Uses sessionToken-only validation - userId derived from session, not trusted from client
export const removeFavorite = mutation({
  args: {
    quoteId: v.id("quotes"),
    sessionToken: v.string(), // SECURITY: Required - userId derived from token
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate session and get userId from server - NEVER trust client-provided userId
    const session: SessionValidationResult = await ctx.runQuery(api.auth.validateSessionByToken, {
      sessionToken: args.sessionToken,
    });

    if (!session.valid || !session.userId) {
      return { success: false, error: session.error || "Unauthorized" };
    }

    const userId = session.userId;

    const favorite = await ctx.db
      .query("userFavorites")
      .withIndex("by_user_and_quote", (q) =>
        q.eq("userId", userId).eq("quoteId", args.quoteId)
      )
      .first();

    if (favorite) {
      await ctx.db.delete(favorite._id);
    }

    return { success: true };
  },
});

// Get user favorites
// SECURITY: Uses sessionToken-only validation - userId derived from session, not trusted from client
export const getFavorites = query({
  args: {
    sessionToken: v.string(), // SECURITY: Required - userId derived from token
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate session and get userId from server - NEVER trust client-provided userId
    const session: SessionValidationResult = await ctx.runQuery(api.auth.validateSessionByToken, {
      sessionToken: args.sessionToken,
    });

    if (!session.valid || !session.userId) {
      return { favorites: [], error: session.error || "Unauthorized" };
    }

    const userId = session.userId;

    const favorites = await ctx.db
      .query("userFavorites")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
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
// Now supports bilingual quotes with translations
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
    translations: v.optional(v.any()), // Bilingual translations object
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
      translations: args.translations || {}, // Use provided translations or empty object
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
