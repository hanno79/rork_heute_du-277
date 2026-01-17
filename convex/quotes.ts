import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

// SECURITY: Helper to validate session token
async function validateSessionToken(
  ctx: any,
  userId: string,
  sessionToken: string
): Promise<{ valid: boolean; error?: string }> {
  const user = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();

  if (!user) {
    return { valid: false, error: "User not found" };
  }

  // SECURITY: Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(user.sessionToken, sessionToken)) {
    return { valid: false, error: "Invalid session token" };
  }

  if (user.sessionExpiresAt && user.sessionExpiresAt < Date.now()) {
    return { valid: false, error: "Session expired" };
  }

  return { valid: true };
}

// Add to favorites
// SECURITY: Requires valid session token for authorization
export const addFavorite = mutation({
  args: {
    userId: v.string(),
    quoteId: v.id("quotes"),
    sessionToken: v.string(), // SECURITY: Required for authorization
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate session token to prevent IDOR
    const session = await validateSessionToken(ctx, args.userId, args.sessionToken);
    if (!session.valid) {
      return { success: false, error: session.error || "Unauthorized" };
    }

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
// SECURITY: Requires valid session token for authorization
export const removeFavorite = mutation({
  args: {
    userId: v.string(),
    quoteId: v.id("quotes"),
    sessionToken: v.string(), // SECURITY: Required for authorization
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate session token to prevent IDOR
    const session = await validateSessionToken(ctx, args.userId, args.sessionToken);
    if (!session.valid) {
      return { success: false, error: session.error || "Unauthorized" };
    }

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
// SECURITY: Requires valid session token for authorization
export const getFavorites = query({
  args: {
    userId: v.string(),
    sessionToken: v.string(), // SECURITY: Required for authorization
  },
  handler: async (ctx, args) => {
    // SECURITY: Validate session token to prevent IDOR
    const session = await validateSessionToken(ctx, args.userId, args.sessionToken);
    if (!session.valid) {
      return { favorites: [], error: session.error || "Unauthorized" };
    }

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
