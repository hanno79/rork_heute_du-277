import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query: Get daily quote history for a user
// Free users: last 3 days, Premium users: last 7 days
export const getDailyQuoteHistory = query({
  args: {
    userId: v.string(),
    limit: v.number() // 3 for free, 7 for premium
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("userQuoteHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit);

    // Get quote details for each entry
    const results = await Promise.all(
      history.map(async (h) => {
        const quote = await ctx.db.get(h.quoteId);
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
            translations: quote.translations,
          } : null,
        };
      })
    );

    return results.filter((r) => r.quote !== null);
  },
});

// Query: Get search history for a user (Premium only)
// Returns last N searches with up to M quotes per search
export const getSearchHistory = query({
  args: {
    userId: v.string(),
    searchLimit: v.number(), // Max 5 searches
    quotesPerSearch: v.number() // Max 3 quotes per search
  },
  handler: async (ctx, args) => {
    // Get user's search history
    const searches = await ctx.db
      .query("userSearchHistory")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.searchLimit);

    // Get search context and associated quotes for each search
    const results = await Promise.all(
      searches.map(async (s) => {
        const context = await ctx.db.get(s.searchContextId);

        if (!context) {
          return null;
        }

        // Get quote mappings for this search context
        const mappings = await ctx.db
          .query("quoteContextMappings")
          .withIndex("by_context", (q) => q.eq("contextId", s.searchContextId))
          .order("desc")
          .take(args.quotesPerSearch);

        // Get quote details
        const quotes = await Promise.all(
          mappings.map(async (m) => {
            const quote = await ctx.db.get(m.quoteId);
            return quote ? {
              _id: quote._id,
              text: quote.text,
              author: quote.author,
              reference: quote.reference,
              category: quote.category,
              context: quote.context,
              explanation: quote.explanation,
              situations: quote.situations,
              tags: quote.tags,
              translations: quote.translations,
              relevanceScore: m.relevanceScore,
            } : null;
          })
        );

        return {
          searchQuery: context.searchQuery,
          searchedAt: s.searchedAt,
          quotes: quotes.filter(Boolean),
        };
      })
    );

    return results.filter(Boolean);
  },
});

// Mutation: Record a user's search in history
export const recordUserSearch = mutation({
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
