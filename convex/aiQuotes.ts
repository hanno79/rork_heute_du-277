import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Generate new quote with AI
export const generateQuote = action({
  args: {
    language: v.string(),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const langName = args.language === "de" ? "German" : "English";
    const promptContext = args.searchQuery
      ? `for the search query: "${args.searchQuery}"`
      : "that is meaningful and inspiring";

    // IMPORTANT: Emphasize that ALL content must be in the target language
    const languageInstruction = args.language === "de"
      ? "WICHTIG: Alle Felder (text, context, explanation, situations, tags) MÜSSEN auf Deutsch sein!"
      : "IMPORTANT: All fields (text, context, explanation, situations, tags) MUST be in English!";

    const prompt = `Generate a meaningful and inspiring quote, Bible verse, or saying ${promptContext}.

Requirements:
- Language: ${langName}
- ${languageInstruction}
- Must be authentic (real quote from known person, actual Bible verse, or traditional saying)
- Include proper attribution/reference
- Provide context and explanation IN ${langName.toUpperCase()}

Respond with ONLY a valid JSON object (no markdown):
{
  "text": "The quote text in ${langName}",
  "reference": "Author name or Bible reference (e.g., 'Sprüche 3:5' for German, 'Proverbs 3:5' for English)",
  "author": "Author name if it's a quote (optional, null for Bible verses)",
  "type": "bible" | "quote" | "saying" | "poem",
  "context": "Brief historical or situational context in ${langName} (2-3 sentences)",
  "explanation": "Why this is meaningful and how to apply it in ${langName} (2-3 sentences)",
  "situations": ["situation1 in ${langName}", "situation2 in ${langName}", "situation3 in ${langName}"],
  "tags": ["tag1 in ${langName}", "tag2 in ${langName}", "tag3 in ${langName}"]
}`;

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://heutedu.app",
            "X-Title": "Heute Du App",
          },
          body: JSON.stringify({
            model: "anthropic/claude-3-haiku",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
            max_tokens: 1000,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No content in AI response");
      }

      // Parse JSON
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/```json?\n?/g, "")
          .replace(/```$/g, "")
          .trim();
      }

      const quoteData = JSON.parse(jsonStr);

      // Save to database - nur gültige Werte übergeben
      const insertData: any = {
        text: quoteData.text,
        source: "ai_generated",
        language: args.language,
        isPremium: false,
        situations: quoteData.situations || [],
        tags: quoteData.tags || [],
        aiPrompt: args.searchQuery
          ? `Search: ${args.searchQuery}`
          : "Daily quote generation",
      };

      // Füge optionale Felder nur hinzu wenn sie einen Wert haben
      if (quoteData.author && quoteData.author !== "null" && quoteData.author !== null) {
        insertData.author = quoteData.author;
      }
      if (quoteData.reference) {
        insertData.reference = quoteData.reference;
      }
      if (quoteData.type) {
        insertData.category = quoteData.type;
      }
      if (quoteData.context) {
        insertData.context = quoteData.context;
      }
      if (quoteData.explanation) {
        insertData.explanation = quoteData.explanation;
      }

      const quoteId = await ctx.runMutation(api.quotes.insertAIQuote, insertData);

      return { quoteId, quote: quoteData };
    } catch (error: any) {
      console.error("AI generation error:", error);
      throw new Error(`Failed to generate quote: ${error.message}`);
    }
  },
});

// Helper: Normalize a search query for matching
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\säöüß]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 2)
    .sort()
    .join(" ");
}

// Generate multiple quotes for search (Premium feature) - with context saving
export const generateSearchQuotes = action({
  args: {
    query: v.string(),
    language: v.string(),
    count: v.optional(v.number()),
    userId: v.optional(v.string()),
    categoryId: v.optional(v.id("searchCategories")),
  },
  handler: async (ctx, args) => {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    // Check rate limit if userId provided
    if (args.userId) {
      const rateLimit = await ctx.runQuery(api.search.checkRateLimit, {
        userId: args.userId,
      });
      if (!rateLimit.canUseAI) {
        throw new Error("AI_RATE_LIMIT_EXCEEDED");
      }
    }

    const count = args.count || 3;
    const langName = args.language === "de" ? "German" : "English";

    // IMPORTANT: Emphasize that ALL content must be in the target language
    const languageInstruction = args.language === "de"
      ? "KRITISCH WICHTIG: ALLE Felder (text, context, explanation, situations, tags, relevantQueries) MÜSSEN auf Deutsch sein! Keine englischen Wörter!"
      : "CRITICAL: ALL fields (text, context, explanation, situations, tags, relevantQueries) MUST be in English!";

    const prompt = `Find ${count} meaningful quotes, Bible verses, or sayings for: "${args.query}"

Language: ${langName}
${languageInstruction}

Requirements:
- Authentic quotes with proper attribution, diverse types
- ALL content must be in ${langName.toUpperCase()} - including context, explanation, situations, tags
- For EACH quote, provide "relevantQueries" - 3-5 ALTERNATIVE search terms in ${langName.toUpperCase()}

Example: If the query is "Liebeskummer" (heartbreak), a quote about healing might also be relevant for "Trennung" (breakup), "Herzschmerz" (heartache), "Loslassen" (letting go).

IMPORTANT: Return ONLY valid JSON, no explanations before or after.

[
{"text":"Quote text in ${langName}","reference":"Source","author":"Author or null","type":"quote","context":"Context in ${langName}","explanation":"Explanation in ${langName}","situations":["situation in ${langName}","situation2"],"tags":["tag in ${langName}","tag2"],"relevanceScore":85,"relevantQueries":["search term in ${langName}","term2","term3"]}
]

Types: "bible", "quote", "saying", "poem"
relevanceScore: 0-100 based on match quality
relevantQueries: 3-5 alternative search terms in ${langName} that would also match this quote`;

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://heutedu.app",
            "X-Title": "Heute Du App",
          },
          body: JSON.stringify({
            model: "anthropic/claude-3-haiku",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content || "";

      // JSON extrahieren - robuste Methode
      // Entferne Markdown code blocks
      if (content.includes("```")) {
        content = content
          .replace(/```json?\s*/gi, "")
          .replace(/```\s*/g, "")
          .trim();
      }

      // Finde das JSON Array im Content
      const jsonStart = content.indexOf("[");
      const jsonEnd = content.lastIndexOf("]");
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        content = content.substring(jsonStart, jsonEnd + 1);
      }

      // Entferne mögliche Trailing Kommas vor ] oder }
      content = content
        .replace(/,\s*]/g, "]")
        .replace(/,\s*}/g, "}")
        // Entferne Kommentare
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

      let quotesData;
      try {
        quotesData = JSON.parse(content);
      } catch (parseError) {
        console.error("JSON parse error in AI response");

        // Versuche das JSON zu reparieren
        // Manchmal fehlen Anführungszeichen um Werte
        let fixedContent = content
          // Ersetze null ohne Anführungszeichen
          .replace(/:(\s*)null(\s*[,}\]])/gi, ':$1null$2')
          // Entferne Zeilenumbrüche innerhalb von Strings (häufiges Problem)
          .replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1 $2"');

        try {
          quotesData = JSON.parse(fixedContent);
        } catch {
          // Letzter Versuch: Extrahiere einzelne vollständige Objekte manuell
          const objectMatches: string[] = [];
          let depth = 0;
          let start = -1;
          let inString = false;
          let escapeNext = false;

          for (let i = 0; i < content.length; i++) {
            const char = content[i];

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === '\\') {
              escapeNext = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (inString) continue;

            if (char === '{') {
              if (depth === 0) start = i;
              depth++;
            } else if (char === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                objectMatches.push(content.substring(start, i + 1));
                start = -1;
              }
            }
          }

          if (objectMatches.length > 0) {
            quotesData = objectMatches.map(match => {
              try {
                return JSON.parse(match);
              } catch {
                return null;
              }
            }).filter(Boolean);

            // Quotes recovered from truncated response
          }

          if (!quotesData || quotesData.length === 0) {
            throw parseError;
          }
        }
      }
      const rawQuotes = Array.isArray(quotesData) ? quotesData : [quotesData];

      // Validiere und filtere gültige Quotes
      const quotes = rawQuotes.filter((q: any) => {
        if (!q || typeof q !== 'object') return false;
        if (!q.text || typeof q.text !== 'string' || q.text.length < 10) return false;
        return true;
      });

      if (quotes.length === 0) {
        throw new Error("No valid quotes in AI response");
      }

      // Save search context first
      const normalizedQuery = normalizeQuery(args.query);
      const contextId = await ctx.runMutation(api.search.saveSearchContext, {
        searchQuery: args.query,
        normalizedQuery,
        categoryId: args.categoryId,
        language: args.language,
      });

      // In DB speichern and create mappings
      const savedQuotes = [];
      for (const q of quotes) {
        // Bereite die Daten vor - undefined statt null für optionale Felder
        const quoteData: any = {
          text: q.text,
          source: "ai_generated",
          language: args.language,
          isPremium: false,
          situations: q.situations || [],
          tags: [...(q.tags || []), args.query.toLowerCase()],
          aiPrompt: `Search: ${args.query}`,
        };

        // Füge optionale Felder nur hinzu wenn sie einen Wert haben
        if (q.author && q.author !== "null" && q.author !== null) {
          quoteData.author = q.author;
        }
        if (q.reference) {
          quoteData.reference = q.reference;
        }
        if (q.type) {
          quoteData.category = q.type;
        }
        if (q.context) {
          quoteData.context = q.context;
        }
        if (q.explanation) {
          quoteData.explanation = q.explanation;
        }

        const quoteId = await ctx.runMutation(api.quotes.insertAIQuote, quoteData);

        // Create quote-context mapping for the main search query
        await ctx.runMutation(api.search.addQuoteContextMapping, {
          quoteId,
          contextId,
          relevanceScore: q.relevanceScore || 80,
          isAiGenerated: true,
        });

        // Create additional context mappings for relevantQueries (multi-context support)
        // This allows the same quote to be found via related search terms
        if (q.relevantQueries && Array.isArray(q.relevantQueries)) {
          for (const relatedQuery of q.relevantQueries) {
            if (typeof relatedQuery === 'string' && relatedQuery.trim().length > 0) {
              const relatedNormalized = normalizeQuery(relatedQuery);

              // Create or get context for this related query
              const relatedContextId = await ctx.runMutation(api.search.saveSearchContext, {
                searchQuery: relatedQuery.trim(),
                normalizedQuery: relatedNormalized,
                categoryId: args.categoryId,
                language: args.language,
              });

              // Map the quote to this related context with slightly lower relevance
              await ctx.runMutation(api.search.addQuoteContextMapping, {
                quoteId,
                contextId: relatedContextId,
                relevanceScore: Math.max(50, (q.relevanceScore || 80) - 10), // Slightly lower score for related queries
                isAiGenerated: true,
              });
            }
          }
        }

        savedQuotes.push({ _id: quoteId, ...q, relevanceScore: q.relevanceScore || 80 });
      }

      // Increment AI search count and record search history
      if (args.userId) {
        await ctx.runMutation(api.search.incrementAISearchCount, {
          userId: args.userId,
        });

        // Record this search in user's history
        await ctx.runMutation(api.readingHistory.recordUserSearch, {
          userId: args.userId,
          searchContextId: contextId,
        });
      }

      return {
        quotes: savedQuotes,
        count: savedQuotes.length,
        contextId,
        wasAIGenerated: true,
      };
    } catch (error: any) {
      console.error("AI search error:", error);
      if (error.message === "AI_RATE_LIMIT_EXCEEDED") {
        throw error;
      }
      throw new Error(`Failed to generate search quotes: ${error.message}`);
    }
  },
});
