/**
 * Database Reset Script for Testing
 *
 * This script clears all USER data while preserving MASTER data (quotes, categories, etc.)
 * Run via Convex Dashboard: Functions > resetUserData > resetAllUserData
 *
 * DELETES:
 * - userProfiles (user accounts)
 * - userFavorites (saved favorites)
 * - userSettings (user preferences)
 * - userQuoteHistory (quote reading history)
 * - userSearchLimits (rate limit counters)
 * - userSearchHistory (search history)
 * - loginAttempts (failed login tracking)
 * - dailyQuotes (daily quote selections - will regenerate)
 *
 * PRESERVES:
 * - quotes (the actual quotes)
 * - searchCategories (category definitions)
 * - searchContexts (search context mappings)
 * - quoteContextMappings (quote-context relationships)
 * - synonymGroups (synonym definitions)
 */

import { internalMutation } from "./_generated/server";

// SECURITY: This is an internal mutation - cannot be called from clients
// Can only be called from other Convex functions or via the Convex Dashboard
export const resetAllUserData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      userProfiles: 0,
      userFavorites: 0,
      userSettings: 0,
      userQuoteHistory: 0,
      userSearchLimits: 0,
      userSearchHistory: 0,
      loginAttempts: 0,
      dailyQuotes: 0,
    };

    // Delete all user profiles
    const userProfiles = await ctx.db.query("userProfiles").collect();
    for (const profile of userProfiles) {
      await ctx.db.delete(profile._id);
      results.userProfiles++;
    }

    // Delete all user favorites
    const userFavorites = await ctx.db.query("userFavorites").collect();
    for (const favorite of userFavorites) {
      await ctx.db.delete(favorite._id);
      results.userFavorites++;
    }

    // Delete all user settings
    const userSettings = await ctx.db.query("userSettings").collect();
    for (const setting of userSettings) {
      await ctx.db.delete(setting._id);
      results.userSettings++;
    }

    // Delete all user quote history
    const userQuoteHistory = await ctx.db.query("userQuoteHistory").collect();
    for (const history of userQuoteHistory) {
      await ctx.db.delete(history._id);
      results.userQuoteHistory++;
    }

    // Delete all user search limits
    const userSearchLimits = await ctx.db.query("userSearchLimits").collect();
    for (const limit of userSearchLimits) {
      await ctx.db.delete(limit._id);
      results.userSearchLimits++;
    }

    // Delete all user search history
    const userSearchHistory = await ctx.db.query("userSearchHistory").collect();
    for (const search of userSearchHistory) {
      await ctx.db.delete(search._id);
      results.userSearchHistory++;
    }

    // Delete all login attempts
    const loginAttempts = await ctx.db.query("loginAttempts").collect();
    for (const attempt of loginAttempts) {
      await ctx.db.delete(attempt._id);
      results.loginAttempts++;
    }

    // Delete all daily quotes (will regenerate automatically)
    const dailyQuotes = await ctx.db.query("dailyQuotes").collect();
    for (const daily of dailyQuotes) {
      await ctx.db.delete(daily._id);
      results.dailyQuotes++;
    }

    return {
      success: true,
      message: "All user data has been reset",
      deletedRecords: results,
      totalDeleted: Object.values(results).reduce((a, b) => a + b, 0),
    };
  },
});

/**
 * Clean up duplicate daily quotes from language-based system
 * Keeps only one entry per day (the most recent) for the global system
 *
 * SECURITY: This is an internal mutation - cannot be called from clients
 */
export const cleanupDuplicateDailyQuotes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allDailyQuotes = await ctx.db.query("dailyQuotes").collect();

    // Group by date
    const byDate: Record<string, typeof allDailyQuotes> = {};
    for (const dq of allDailyQuotes) {
      if (!byDate[dq.date]) {
        byDate[dq.date] = [];
      }
      byDate[dq.date].push(dq);
    }

    let deletedCount = 0;
    const keptDates: string[] = [];

    for (const [date, entries] of Object.entries(byDate)) {
      if (entries.length > 1) {
        // Sort by selectedAt descending (keep the most recent)
        entries.sort((a, b) => b.selectedAt - a.selectedAt);

        // Delete all but the first (most recent)
        for (let i = 1; i < entries.length; i++) {
          await ctx.db.delete(entries[i]._id);
          deletedCount++;
        }

        // Update the kept entry to be "global"
        await ctx.db.patch(entries[0]._id, { language: "global" });
        keptDates.push(date);
      } else if (entries.length === 1 && entries[0].language !== "global") {
        // Update single entry to be "global"
        await ctx.db.patch(entries[0]._id, { language: "global" });
        keptDates.push(date);
      }
    }

    return {
      success: true,
      message: `Cleaned up duplicate daily quotes`,
      deletedCount,
      datesProcessed: keptDates.length,
      keptDates,
    };
  },
});
