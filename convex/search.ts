import { query, mutation, action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const MAX_SEARCHES_PER_DAY = 10;      // Total searches allowed per day (all types)
const MAX_AI_SEARCHES_PER_DAY = 10;   // Keep for AI-specific limits if needed
const MIN_QUOTES_FOR_CACHED_RESULT = 3;

// Type for rate limit response
interface RateLimitResult {
  searchCount: number;
  aiSearchCount: number;
  maxSearches: number;
  canSearch: boolean;
  canUseAI: boolean;
  remaining: number;
}

// Internal history periods - quotes can be reused after this period
const FREE_USER_REUSE_DAYS = 30;      // Free: Quote reusable after 30 days
const PREMIUM_USER_REUSE_DAYS = 180;  // Premium: Quote reusable after 180 days

// Helper: Normalize a search query for matching
// NOTE: No .sort() - preserves word order so different queries don't match same cache
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\säöüß]/g, "") // Keep German umlauts
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 2) // Remove short words
    .join(" ");
}

// Helper: Shuffle quotes while maintaining relevance tier priority
// This provides variety in search results instead of always returning the same top quotes
function shuffleWithRelevanceBias(quotes: any[]): any[] {
  // Group quotes by relevance tiers (high: 80+, medium: 60-79, low: <60)
  const high = quotes.filter(q => q.relevanceScore >= 80);
  const medium = quotes.filter(q => q.relevanceScore >= 60 && q.relevanceScore < 80);
  const low = quotes.filter(q => q.relevanceScore < 60);

  // Fisher-Yates shuffle within each tier
  const shuffle = (arr: any[]) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  // Return shuffled quotes, maintaining tier priority (high first, then medium, then low)
  return [...shuffle(high), ...shuffle(medium), ...shuffle(low)];
}

// Helper: Extract keywords from a query
function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\säöüß]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

// Query: Check rate limit for user (both total searches and AI-specific)
export const checkRateLimit = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<RateLimitResult> => {
    const today = new Date().toISOString().split("T")[0];

    const limit = await ctx.db
      .query("userSearchLimits")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", today)
      )
      .first();

    const searchCount = limit?.searchCount ?? 0;
    const aiSearchCount = limit?.aiSearchCount ?? 0;
    const canSearch = searchCount < MAX_SEARCHES_PER_DAY;
    const canUseAI = aiSearchCount < MAX_AI_SEARCHES_PER_DAY;

    return {
      searchCount,
      aiSearchCount,
      maxSearches: MAX_SEARCHES_PER_DAY,
      canSearch,
      canUseAI,
      remaining: MAX_SEARCHES_PER_DAY - searchCount,
    };
  },
});

// Mutation: Increment search count (for ALL searches, not just AI)
export const incrementSearchCount = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();

    const existing = await ctx.db
      .query("userSearchLimits")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", today)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        searchCount: (existing.searchCount ?? 0) + 1,
        lastSearchAt: now,
      });
      return { newCount: (existing.searchCount ?? 0) + 1 };
    } else {
      await ctx.db.insert("userSearchLimits", {
        userId: args.userId,
        date: today,
        searchCount: 1,
        aiSearchCount: 0,
        lastSearchAt: now,
      });
      return { newCount: 1 };
    }
  },
});

// Mutation: Increment AI search count (kept for AI-specific tracking)
export const incrementAISearchCount = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();

    const existing = await ctx.db
      .query("userSearchLimits")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", today)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        aiSearchCount: existing.aiSearchCount + 1,
        lastSearchAt: now,
      });
      return { newCount: existing.aiSearchCount + 1 };
    } else {
      await ctx.db.insert("userSearchLimits", {
        userId: args.userId,
        date: today,
        searchCount: 0,
        aiSearchCount: 1,
        lastSearchAt: now,
      });
      return { newCount: 1 };
    }
  },
});

// Query: Find category by keywords
export const findCategoryByKeywords = query({
  args: {
    query: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const keywords = extractKeywords(args.query);
    const categories = await ctx.db.query("searchCategories").collect();

    let bestMatch: { category: typeof categories[0]; score: number } | null = null;

    for (const category of categories) {
      const categoryKeywords =
        args.language === "de" ? category.keywords_de : category.keywords_en;

      let score = 0;
      for (const keyword of keywords) {
        for (const catKeyword of categoryKeywords) {
          if (catKeyword.includes(keyword) || keyword.includes(catKeyword)) {
            score++;
          }
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { category, score };
      }
    }

    return bestMatch?.category ?? null;
  },
});

// Query: Find similar search contexts
export const findSimilarContexts = query({
  args: {
    normalizedQuery: v.string(),
    categoryId: v.optional(v.id("searchCategories")),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    // Try exact normalized match first
    const exactMatch = await ctx.db
      .query("searchContexts")
      .withIndex("by_normalized_query", (q) =>
        q.eq("normalizedQuery", args.normalizedQuery).eq("language", args.language)
      )
      .first();

    if (exactMatch) {
      return { match: exactMatch, matchType: "exact" as const };
    }

    // Try category match if we have a category
    if (args.categoryId) {
      const categoryMatches = await ctx.db
        .query("searchContexts")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .take(5);

      if (categoryMatches.length > 0) {
        // Return the most used context in this category
        const bestMatch = categoryMatches.reduce((best, current) =>
          current.searchCount > best.searchCount ? current : best
        );
        return { match: bestMatch, matchType: "category" as const };
      }
    }

    return { match: null, matchType: "none" as const };
  },
});

// Query: Get quotes for a context
export const getQuotesForContext = query({
  args: {
    contextId: v.id("searchContexts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    const mappings = await ctx.db
      .query("quoteContextMappings")
      .withIndex("by_context", (q) => q.eq("contextId", args.contextId))
      .take(limit * 2); // Get more to filter null quotes

    // Sort by relevance score
    mappings.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Fetch actual quotes
    const quotes = [];
    for (const mapping of mappings) {
      if (quotes.length >= limit) break;
      const quote = await ctx.db.get(mapping.quoteId);
      if (quote) {
        quotes.push({
          ...quote,
          relevanceScore: mapping.relevanceScore,
          isAiGenerated: mapping.isAiGenerated,
        });
      }
    }

    return quotes;
  },
});

// Mutation: Save search context
export const saveSearchContext = mutation({
  args: {
    searchQuery: v.string(),
    normalizedQuery: v.string(),
    categoryId: v.optional(v.id("searchCategories")),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if context already exists
    const existing = await ctx.db
      .query("searchContexts")
      .withIndex("by_normalized_query", (q) =>
        q.eq("normalizedQuery", args.normalizedQuery).eq("language", args.language)
      )
      .first();

    if (existing) {
      // Update existing context
      await ctx.db.patch(existing._id, {
        searchCount: existing.searchCount + 1,
        lastUsedAt: now,
      });
      return existing._id;
    }

    // Create new context
    const contextId = await ctx.db.insert("searchContexts", {
      searchQuery: args.searchQuery,
      normalizedQuery: args.normalizedQuery,
      categoryId: args.categoryId,
      language: args.language,
      searchCount: 1,
      createdAt: now,
      lastUsedAt: now,
    });

    return contextId;
  },
});

// Mutation: Add quote-context mapping
export const addQuoteContextMapping = mutation({
  args: {
    quoteId: v.id("quotes"),
    contextId: v.id("searchContexts"),
    relevanceScore: v.number(),
    isAiGenerated: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if mapping already exists
    const existing = await ctx.db
      .query("quoteContextMappings")
      .withIndex("by_context", (q) => q.eq("contextId", args.contextId))
      .filter((q) => q.eq(q.field("quoteId"), args.quoteId))
      .first();

    if (existing) {
      // Update relevance score if higher
      if (args.relevanceScore > existing.relevanceScore) {
        await ctx.db.patch(existing._id, {
          relevanceScore: args.relevanceScore,
        });
      }
      return existing._id;
    }

    // Create new mapping
    const mappingId = await ctx.db.insert("quoteContextMappings", {
      quoteId: args.quoteId,
      contextId: args.contextId,
      relevanceScore: args.relevanceScore,
      isAiGenerated: args.isAiGenerated,
      createdAt: Date.now(),
    });

    return mappingId;
  },
});

// Query: Smart search - the main entry point
// Now with synonym expansion for better matching
export const smartSearch = query({
  args: {
    query: v.string(),
    language: v.string(),
    userId: v.optional(v.string()),
    isPremium: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const normalizedQuery = normalizeQuery(args.query);
    const keywords = extractKeywords(args.query);

    // PHASE 2: Expand keywords using synonym groups
    const synonymGroups = await ctx.db.query("synonymGroups").collect();
    const expandedKeywords = new Set<string>(keywords);

    for (const group of synonymGroups) {
      const groupTerms = args.language === "de" ? group.terms_de : group.terms_en;

      // Check if any keyword matches any term in this group
      const hasMatch = keywords.some((keyword) =>
        groupTerms.some(
          (groupTerm) =>
            groupTerm.includes(keyword) || keyword.includes(groupTerm)
        )
      );

      if (hasMatch) {
        // Add all terms from this group to expanded keywords
        for (const groupTerm of groupTerms) {
          expandedKeywords.add(groupTerm);
        }
      }
    }

    // Use expanded keywords for searching
    const allKeywords = Array.from(expandedKeywords);

    // Determine reuse period based on premium status
    const reuseDays = args.isPremium ? PREMIUM_USER_REUSE_DAYS : FREE_USER_REUSE_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - reuseDays);
    const cutoffTimestamp = cutoffDate.getTime();
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    // Get user's favorites and recent history to filter out
    let userFavoriteIds = new Set<Id<"quotes">>();
    let userRecentQuoteIds = new Set<Id<"quotes">>();

    if (args.userId) {
      // Get user favorites - these should always be excluded from search results
      const favorites = await ctx.db
        .query("userFavorites")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
        .collect();
      userFavoriteIds = new Set(favorites.map((f) => f.quoteId));

      // Get quotes shown to user in the reuse period
      const recentHistory = await ctx.db
        .query("userQuoteHistory")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
        .collect();

      // Filter by date string comparison
      userRecentQuoteIds = new Set(
        recentHistory
          .filter((h) => h.shownAt >= cutoffDateStr)
          .map((h) => h.quoteId)
      );
    }

    // Helper to check if quote should be excluded
    const shouldExcludeQuote = (quoteId: Id<"quotes">) => {
      return userFavoriteIds.has(quoteId) || userRecentQuoteIds.has(quoteId);
    };

    // Find category using expanded keywords for better matching
    const categories = await ctx.db.query("searchCategories").collect();
    let matchedCategory: typeof categories[0] | null = null;
    let bestCategoryScore = 0;

    for (const category of categories) {
      const categoryKeywords =
        args.language === "de" ? category.keywords_de : category.keywords_en;
      let score = 0;
      // Use allKeywords (expanded with synonyms) for category matching
      for (const keyword of allKeywords) {
        for (const catKeyword of categoryKeywords) {
          if (catKeyword.includes(keyword) || keyword.includes(catKeyword)) {
            score++;
          }
        }
      }
      if (score > bestCategoryScore) {
        bestCategoryScore = score;
        matchedCategory = category;
      }
    }

    // Check rate limit if user is provided
    let rateLimit = null;
    if (args.userId) {
      const today = new Date().toISOString().split("T")[0];
      const limit = await ctx.db
        .query("userSearchLimits")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", args.userId!).eq("date", today)
        )
        .first();

      const aiSearchCount = limit?.aiSearchCount ?? 0;
      rateLimit = {
        aiSearchCount,
        maxSearches: MAX_AI_SEARCHES_PER_DAY,
        canUseAI: aiSearchCount < MAX_AI_SEARCHES_PER_DAY,
        remaining: MAX_AI_SEARCHES_PER_DAY - aiSearchCount,
      };
    }

    // Find existing context - exact match first
    const existingContext = await ctx.db
      .query("searchContexts")
      .withIndex("by_normalized_query", (q) =>
        q.eq("normalizedQuery", normalizedQuery).eq("language", args.language)
      )
      .first();

    // PHASE 2: Also search for contexts matching expanded keywords (synonyms)
    // This allows "Trennung" to find quotes previously generated for "Liebeskummer"
    const allMatchingContexts: Array<{ context: any; isExact: boolean }> = [];

    if (existingContext) {
      allMatchingContexts.push({ context: existingContext, isExact: true });
    }

    // Search for contexts that contain any of the expanded keywords
    const allContexts = await ctx.db
      .query("searchContexts")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .take(100);

    for (const context of allContexts) {
      if (existingContext && context._id === existingContext._id) {
        continue; // Already added
      }

      // Check if this context's query matches any of our expanded keywords
      const contextKeywords = extractKeywords(context.searchQuery);
      const hasMatch = allKeywords.some((expandedKeyword) =>
        contextKeywords.some(
          (contextKeyword) =>
            contextKeyword.includes(expandedKeyword) ||
            expandedKeyword.includes(contextKeyword)
        )
      );

      if (hasMatch) {
        allMatchingContexts.push({ context, isExact: false });
      }
    }

    // Collect quotes from all matching contexts
    if (allMatchingContexts.length > 0) {
      const allQuoteIds = new Set<Id<"quotes">>();
      const quoteRelevance = new Map<Id<"quotes">, number>();
      const quoteAiGenerated = new Map<Id<"quotes">, boolean>();

      for (const { context, isExact } of allMatchingContexts) {
        const mappings = await ctx.db
          .query("quoteContextMappings")
          .withIndex("by_context", (q) => q.eq("contextId", context._id))
          .take(20);

        for (const mapping of mappings) {
          if (shouldExcludeQuote(mapping.quoteId)) {
            continue;
          }

          allQuoteIds.add(mapping.quoteId);
          // Boost exact matches, slight penalty for synonym matches
          const adjustedScore = isExact
            ? mapping.relevanceScore
            : mapping.relevanceScore * 0.9;
          const existingScore = quoteRelevance.get(mapping.quoteId) ?? 0;
          quoteRelevance.set(
            mapping.quoteId,
            Math.max(existingScore, adjustedScore)
          );
          quoteAiGenerated.set(
            mapping.quoteId,
            quoteAiGenerated.get(mapping.quoteId) || mapping.isAiGenerated
          );
        }
      }

      const quotes = [];
      for (const quoteId of allQuoteIds) {
        const quote = await ctx.db.get(quoteId);
        if (quote) {
          quotes.push({
            ...quote,
            relevanceScore: quoteRelevance.get(quoteId) ?? 50,
            isAiGenerated: quoteAiGenerated.get(quoteId) ?? false,
          });
        }
      }

      quotes.sort((a, b) => b.relevanceScore - a.relevanceScore);

      if (quotes.length >= MIN_QUOTES_FOR_CACHED_RESULT) {
        // Shuffle quotes with relevance bias for variety in results
        const shuffledQuotes = shuffleWithRelevanceBias(quotes);
        return {
          source: "cached" as const,
          quotes: shuffledQuotes.slice(0, 5),
          contextId: existingContext?._id ?? null,
          category: matchedCategory,
          rateLimit,
          needsAI: false,
          synonymsUsed: allKeywords.length > keywords.length,
        };
      }
    }

    // Try category-based search
    if (matchedCategory) {
      const categoryContexts = await ctx.db
        .query("searchContexts")
        .withIndex("by_category", (q) => q.eq("categoryId", matchedCategory!._id))
        .take(10);

      const allQuoteIds = new Set<Id<"quotes">>();
      const quoteRelevance = new Map<Id<"quotes">, number>();

      for (const context of categoryContexts) {
        const mappings = await ctx.db
          .query("quoteContextMappings")
          .withIndex("by_context", (q) => q.eq("contextId", context._id))
          .take(10); // Get more to have buffer after filtering

        for (const mapping of mappings) {
          // Skip quotes the user has already seen or favorited
          if (shouldExcludeQuote(mapping.quoteId)) {
            continue;
          }
          allQuoteIds.add(mapping.quoteId);
          const existingScore = quoteRelevance.get(mapping.quoteId) ?? 0;
          quoteRelevance.set(
            mapping.quoteId,
            Math.max(existingScore, mapping.relevanceScore)
          );
        }
      }

      if (allQuoteIds.size >= MIN_QUOTES_FOR_CACHED_RESULT) {
        const quotes = [];
        for (const quoteId of allQuoteIds) {
          const quote = await ctx.db.get(quoteId);
          if (quote) {
            quotes.push({
              ...quote,
              relevanceScore: quoteRelevance.get(quoteId) ?? 50,
              isAiGenerated: false,
            });
          }
        }

        quotes.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Shuffle quotes with relevance bias for variety in results
        const shuffledQuotes = shuffleWithRelevanceBias(quotes);
        return {
          source: "category" as const,
          quotes: shuffledQuotes.slice(0, 5),
          contextId: existingContext?._id ?? null,
          category: matchedCategory,
          rateLimit,
          needsAI: false,
        };
      }
    }

    // Fall back to full-text search in quotes
    const searchTerm = args.query.toLowerCase();
    const allQuotes = await ctx.db.query("quotes").take(200); // Get more to have buffer after filtering

    const matchingQuotes = allQuotes.filter((quote) => {
      // First check if this quote should be excluded (already seen or favorited)
      if (shouldExcludeQuote(quote._id)) {
        return false;
      }

      const matchText = quote.text.toLowerCase().includes(searchTerm);
      const matchContext = quote.context?.toLowerCase().includes(searchTerm);
      const matchExplanation = quote.explanation?.toLowerCase().includes(searchTerm);
      const matchAuthor = quote.author?.toLowerCase().includes(searchTerm);
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
          const t = quote.translations[lang];
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

      // Also check individual keywords (using expanded keywords with synonyms)
      const keywordMatch = allKeywords.some((keyword) => {
        return (
          quote.text.toLowerCase().includes(keyword) ||
          quote.situations?.some((s) => s.toLowerCase().includes(keyword)) ||
          quote.tags?.some((t) => t.toLowerCase().includes(keyword))
        );
      });

      return (
        matchText ||
        matchContext ||
        matchExplanation ||
        matchAuthor ||
        matchTags ||
        matchSituations ||
        translationMatch ||
        keywordMatch
      );
    });

    if (matchingQuotes.length >= MIN_QUOTES_FOR_CACHED_RESULT) {
      // Assign relevance scores and shuffle for variety
      const quotesWithScores = matchingQuotes.map((q) => ({
        ...q,
        relevanceScore: 50,
        isAiGenerated: false,
      }));
      const shuffledQuotes = shuffleWithRelevanceBias(quotesWithScores);
      return {
        source: "database" as const,
        quotes: shuffledQuotes.slice(0, 5),
        contextId: existingContext?._id ?? null,
        category: matchedCategory,
        rateLimit,
        needsAI: false,
      };
    }

    // Not enough results - need AI
    return {
      source: "insufficient" as const,
      quotes: matchingQuotes.map((q) => ({
        ...q,
        relevanceScore: 50,
        isAiGenerated: false,
      })),
      contextId: existingContext?._id ?? null,
      category: matchedCategory,
      rateLimit,
      needsAI: true,
      normalizedQuery,
    };
  },
});

// Query: Get all categories
export const getAllCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("searchCategories").collect();
  },
});

// Query: Find synonyms for a search term
// Returns all terms in the same synonym group(s) as the input terms
export const findSynonyms = query({
  args: {
    terms: v.array(v.string()),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const synonymGroups = await ctx.db.query("synonymGroups").collect();
    const expandedTerms = new Set<string>();

    // Add original terms
    for (const term of args.terms) {
      expandedTerms.add(term.toLowerCase());
    }

    // Find matching groups and add all their terms
    for (const group of synonymGroups) {
      const groupTerms = args.language === "de" ? group.terms_de : group.terms_en;

      // Check if any of our input terms match any term in this group
      const hasMatch = args.terms.some((inputTerm) =>
        groupTerms.some(
          (groupTerm) =>
            groupTerm.includes(inputTerm.toLowerCase()) ||
            inputTerm.toLowerCase().includes(groupTerm)
        )
      );

      if (hasMatch) {
        // Add all terms from this group
        for (const groupTerm of groupTerms) {
          expandedTerms.add(groupTerm);
        }
      }
    }

    return {
      originalTerms: args.terms,
      expandedTerms: Array.from(expandedTerms),
      expansionCount: expandedTerms.size - args.terms.length,
    };
  },
});

// Action: Perform smart search with DB-first, then AI fallback
// This is the main entry point for client-side search
export const performSmartSearch = action({
  args: {
    query: v.string(),
    language: v.string(),
    userId: v.optional(v.string()),
    isPremium: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Step 0: Increment search count for ALL searches (not just AI)
    // This happens BEFORE the search to count attempts, not just successful searches
    if (args.userId) {
      // Check rate limit FIRST
      const currentRateLimit = await ctx.runQuery(api.search.checkRateLimit, {
        userId: args.userId,
      });

      // If limit exceeded, return early with message
      if (!currentRateLimit.canSearch) {
        return {
          quotes: [],
          source: "rate_limited" as const,
          rateLimit: currentRateLimit,
          wasAIGenerated: false,
          error: "SEARCH_RATE_LIMIT_EXCEEDED",
        };
      }

      // Increment search count
      await ctx.runMutation(api.search.incrementSearchCount, {
        userId: args.userId,
      });
    }

    // Step 1: Try smart search (DB-first approach)
    const searchResult = await ctx.runQuery(api.search.smartSearch, {
      query: args.query,
      language: args.language,
      userId: args.userId,
      isPremium: args.isPremium,
    });

    // Get updated rate limit after incrementing
    let updatedRateLimit = searchResult.rateLimit;
    if (args.userId) {
      updatedRateLimit = await ctx.runQuery(api.search.checkRateLimit, {
        userId: args.userId,
      });
    }

    // Step 2: If we have enough results from DB, return them
    if (!searchResult.needsAI || searchResult.quotes.length >= MIN_QUOTES_FOR_CACHED_RESULT) {
      return {
        quotes: searchResult.quotes,
        source: searchResult.source,
        rateLimit: updatedRateLimit,
        wasAIGenerated: false,
        category: searchResult.category,
      };
    }

    // Step 3: Check if user can use AI
    if (!args.userId || !updatedRateLimit?.canUseAI) {
      // Return whatever we have from DB
      return {
        quotes: searchResult.quotes,
        source: searchResult.quotes.length > 0 ? "database" : "insufficient",
        rateLimit: updatedRateLimit,
        wasAIGenerated: false,
        category: searchResult.category,
      };
    }

    // Step 4: Generate with AI
    try {
      const aiResult = await ctx.runAction(api.aiQuotes.generateSearchQuotes, {
        query: args.query,
        language: args.language,
        count: 5,
        userId: args.userId,
        categoryId: searchResult.category?._id,
      });

      // Get updated rate limit after AI generation
      const rateLimitAfterAI: RateLimitResult = await ctx.runQuery(api.search.checkRateLimit, {
        userId: args.userId,
      });

      return {
        quotes: aiResult.quotes,
        source: "ai" as const,
        rateLimit: rateLimitAfterAI,
        wasAIGenerated: true,
        category: searchResult.category,
        contextId: aiResult.contextId,
      };
    } catch (error: any) {
      console.error("AI generation failed:", error);

      // If rate limit exceeded, update and return DB results
      if (error.message === "AI_RATE_LIMIT_EXCEEDED") {
        return {
          quotes: searchResult.quotes,
          source: searchResult.quotes.length > 0 ? "database" : "insufficient",
          rateLimit: {
            aiSearchCount: MAX_AI_SEARCHES_PER_DAY,
            maxSearches: MAX_AI_SEARCHES_PER_DAY,
            canUseAI: false,
            remaining: 0,
          },
          wasAIGenerated: false,
          category: searchResult.category,
          error: "AI_RATE_LIMIT_EXCEEDED",
        };
      }

      // Return DB results on other errors
      return {
        quotes: searchResult.quotes,
        source: searchResult.quotes.length > 0 ? "database" : "insufficient",
        rateLimit: searchResult.rateLimit,
        wasAIGenerated: false,
        category: searchResult.category,
        error: error.message,
      };
    }
  },
});
