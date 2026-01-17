import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { SessionValidationResult } from "./utils/types";

// Type for quote history entry
type QuoteHistoryEntry = {
  shownAt: string; // ISO date string (YYYY-MM-DD)
  quote: {
    _id: Id<"quotes">;
    text?: string;
    author?: string;
    reference?: string;
    category?: string;
    context?: string;
    explanation?: string;
    situations?: string[];
    tags?: string[];
    translations?: Record<string, unknown>;
  } | null;
};

// Type for search history entry
type SearchHistoryEntry = {
  searchQuery: string;
  searchedAt: number;
  quotes: Array<{
    _id: Id<"quotes">;
    text?: string;
    author?: string;
    reference?: string;
    category?: string;
    context?: string;
    explanation?: string;
    situations?: string[];
    tags?: string[];
    translations?: Record<string, unknown>;
    relevanceScore?: number;
  }>;
};

// Query: Get daily quote history for a user
// Free users: last 3 days, Premium users: last 7 days
// SECURITY: Validates sessionToken - userId derived from session, not trusted from client
export const getDailyQuoteHistory = query({
  args: {
    sessionToken: v.string(),
    limit: v.number() // 3 for free, 7 for premium
  },
  handler: async (ctx, args): Promise<QuoteHistoryEntry[]> => {
    // SECURITY: Validate session and get userId from server
    const session: SessionValidationResult = await ctx.runQuery(api.auth.validateSessionByToken, {
      sessionToken: args.sessionToken,
    });

    if (!session.valid || !session.userId) {
      return [];
    }

    const userId = session.userId;

    const history: Doc<"userQuoteHistory">[] = await ctx.db
      .query("userQuoteHistory")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit);

    // Get quote details for each entry
    const results: QuoteHistoryEntry[] = await Promise.all(
      history.map(async (h: Doc<"userQuoteHistory">): Promise<QuoteHistoryEntry> => {
        const quote: Doc<"quotes"> | null = await ctx.db.get(h.quoteId);
        return {
          shownAt: h.shownAt,
          quote: quote ? {
            _id: quote._id,
            text: quote.text,
            author: quote.author,
            reference: quote.reference,
            category: quote.category,
            context: quote.context,
            explanation: quote.explanation,
            situations: quote.situations,
            tags: quote.tags,
            translations: quote.translations as Record<string, unknown>,
          } : null,
        };
      })
    );

    return results.filter((r: QuoteHistoryEntry): boolean => r.quote !== null);
  },
});

// Query: Get search history for a user (Premium only)
// Returns last N searches with up to M quotes per search
// SECURITY: Validates sessionToken - userId derived from session, not trusted from client
// OPTIMIZATION: Uses batched queries to avoid N+1 pattern
export const getSearchHistory = query({
  args: {
    sessionToken: v.string(),
    searchLimit: v.number(), // Max 5 searches
    quotesPerSearch: v.number() // Max 3 quotes per search
  },
  handler: async (ctx, args): Promise<SearchHistoryEntry[]> => {
    // SECURITY: Validate session and get userId from server
    const session: SessionValidationResult = await ctx.runQuery(api.auth.validateSessionByToken, {
      sessionToken: args.sessionToken,
    });

    if (!session.valid || !session.userId) {
      return [];
    }

    const userId = session.userId;

    // Step 1: Get user's search history entries
    const searches: Doc<"userSearchHistory">[] = await ctx.db
      .query("userSearchHistory")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.searchLimit);

    if (searches.length === 0) {
      return [];
    }

    // Step 2: Batch fetch all search contexts in parallel
    const contextIds = searches.map(s => s.searchContextId);
    const contexts = await Promise.all(
      contextIds.map(id => ctx.db.get(id))
    );

    // Create a map for quick context lookup
    const contextMap = new Map<string, Doc<"searchContexts">>();
    contexts.forEach((ctx, idx) => {
      if (ctx) {
        contextMap.set(contextIds[idx], ctx);
      }
    });

    // Step 3: Batch fetch all quote mappings for all contexts
    // We fetch mappings for each context in parallel (one query per context is unavoidable with index)
    const allMappingsArrays = await Promise.all(
      contextIds.map(contextId =>
        ctx.db
          .query("quoteContextMappings")
          .withIndex("by_context", (q) => q.eq("contextId", contextId))
          .order("desc")
          .take(args.quotesPerSearch)
      )
    );

    // Create a map of contextId -> mappings
    const mappingsByContext = new Map<string, Doc<"quoteContextMappings">[]>();
    contextIds.forEach((contextId, idx) => {
      mappingsByContext.set(contextId, allMappingsArrays[idx]);
    });

    // Step 4: Collect all unique quote IDs and batch fetch quotes
    const allQuoteIds = new Set<Id<"quotes">>();
    allMappingsArrays.flat().forEach(m => allQuoteIds.add(m.quoteId));

    const quoteIdArray = Array.from(allQuoteIds);
    const allQuotes = await Promise.all(
      quoteIdArray.map(id => ctx.db.get(id))
    );

    // Create a map for quick quote lookup
    const quoteMap = new Map<string, Doc<"quotes">>();
    allQuotes.forEach((quote, idx) => {
      if (quote) {
        quoteMap.set(quoteIdArray[idx], quote);
      }
    });

    // Step 5: Reassemble the results using the pre-fetched data
    const results: SearchHistoryEntry[] = [];

    for (const search of searches) {
      const context = contextMap.get(search.searchContextId);
      if (!context) {
        continue;
      }

      const mappings = mappingsByContext.get(search.searchContextId) || [];
      const quotes = mappings
        .map(m => {
          const quote = quoteMap.get(m.quoteId);
          if (!quote) return null;
          return {
            _id: quote._id,
            text: quote.text,
            author: quote.author,
            reference: quote.reference,
            category: quote.category,
            context: quote.context,
            explanation: quote.explanation,
            situations: quote.situations,
            tags: quote.tags,
            translations: quote.translations as Record<string, unknown>,
            relevanceScore: m.relevanceScore,
          };
        })
        .filter((q): q is NonNullable<typeof q> => q !== null);

      results.push({
        searchQuery: context.searchQuery,
        searchedAt: search.searchedAt,
        quotes,
      });
    }

    return results;
  },
});

// Internal Mutation: Record a user's search in history
// SECURITY: internalMutation - only callable from other Convex functions, not from clients
export const recordUserSearch = internalMutation({
  args: {
    userId: v.string(),
    searchContextId: v.id("searchContexts"),
  },
  handler: async (ctx, args) => {
    // Check if this search was already recorded recently (within last minute)
    // to avoid duplicates from rapid searches
    const oneMinuteAgo = Date.now() - 60000;
    const recentSearch = await ctx.db
      .query("userSearchHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("searchContextId"), args.searchContextId),
          q.gt(q.field("searchedAt"), oneMinuteAgo)
        )
      )
      .first();

    if (recentSearch) {
      // Update timestamp instead of creating duplicate
      await ctx.db.patch(recentSearch._id, {
        searchedAt: Date.now(),
      });
      return recentSearch._id;
    }

    // Create new search history entry
    return await ctx.db.insert("userSearchHistory", {
      userId: args.userId,
      searchContextId: args.searchContextId,
      searchedAt: Date.now(),
    });
  },
});
