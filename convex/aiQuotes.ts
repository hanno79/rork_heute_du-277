import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Generate new quote with AI - BILINGUAL (English + German)
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

    const promptContext = args.searchQuery
      ? `for the search query: "${args.searchQuery}"`
      : "that is meaningful and inspiring";

    // BILINGUAL PROMPT: Generate quote in BOTH English and German
    const prompt = `Generate a meaningful and inspiring quote, Bible verse, or saying ${promptContext}.

IMPORTANT: Provide the quote in BOTH English AND German in a single response.

Requirements:
- Must be authentic (real quote from known person, actual Bible verse, or traditional saying)
- Include proper attribution/reference
- Provide context and explanation in BOTH languages

Respond with ONLY a valid JSON object (no markdown):
{
  "en": {
    "text": "The quote text in English",
    "reference": "Proverbs 3:5",
    "author": "Author name or null for Bible verses",
    "type": "bible",
    "context": "Brief historical or situational context in English (2-3 sentences)",
    "explanation": "Why this is meaningful and how to apply it in English (2-3 sentences)",
    "situations": ["situation1", "situation2", "situation3"],
    "tags": ["tag1", "tag2", "tag3"]
  },
  "de": {
    "text": "Das Zitat auf Deutsch",
    "reference": "Sprüche 3:5",
    "author": "Autorenname oder null für Bibelverse",
    "type": "bible",
    "context": "Kurzer historischer oder situativer Kontext auf Deutsch (2-3 Sätze)",
    "explanation": "Warum dies bedeutsam ist und wie man es anwenden kann auf Deutsch (2-3 Sätze)",
    "situations": ["Situation1", "Situation2", "Situation3"],
    "tags": ["Schlagwort1", "Schlagwort2", "Schlagwort3"]
  }
}

type must be one of: "bible", "quote", "saying", "poem"`;

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
            max_tokens: 2000, // Increased for bilingual content
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

      const bilingualData = JSON.parse(jsonStr);

      // Determine primary and secondary language based on user's language preference
      const primaryLang = args.language === "de" ? "de" : "en";
      const secondaryLang = primaryLang === "de" ? "en" : "de";

      const primaryData = bilingualData[primaryLang];
      const translationData = bilingualData[secondaryLang];

      if (!primaryData || !primaryData.text) {
        throw new Error("Missing primary language data in AI response");
      }

      // Build translations object for the secondary language
      const translations: any = {};
      if (translationData && translationData.text) {
        translations[secondaryLang] = {
          text: translationData.text,
          reference: translationData.reference,
          context: translationData.context,
          explanation: translationData.explanation,
          situations: translationData.situations || [],
          tags: translationData.tags || [],
        };
      }

      // Save to database with translations
      const insertData: any = {
        text: primaryData.text,
        source: "ai_generated",
        language: primaryLang,
        isPremium: false,
        situations: primaryData.situations || [],
        tags: primaryData.tags || [],
        translations,
        aiPrompt: args.searchQuery
          ? `Search: ${args.searchQuery}`
          : "Daily quote generation",
      };

      // Add optional fields only if they have values
      if (primaryData.author && primaryData.author !== "null" && primaryData.author !== null) {
        insertData.author = primaryData.author;
      }
      if (primaryData.reference) {
        insertData.reference = primaryData.reference;
      }
      if (primaryData.type) {
        insertData.category = primaryData.type;
      }
      if (primaryData.context) {
        insertData.context = primaryData.context;
      }
      if (primaryData.explanation) {
        insertData.explanation = primaryData.explanation;
      }

      const quoteId = await ctx.runMutation(api.quotes.insertAIQuote, insertData);

      return { quoteId, quote: primaryData, translations };
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

// Generate multiple quotes for search (Premium feature) - BILINGUAL with context saving
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

    // BILINGUAL PROMPT: Generate quotes in BOTH English and German
    const prompt = `Find ${count} meaningful quotes, Bible verses, or sayings for: "${args.query}"

IMPORTANT: For EACH quote, provide BOTH English AND German versions.

Requirements:
- Authentic quotes with proper attribution, diverse types
- Provide BOTH language versions for each quote
- For EACH quote, provide "relevantQueries" in BOTH languages

IMPORTANT: Return ONLY valid JSON array, no explanations before or after.

[
  {
    "en": {
      "text": "Quote in English",
      "reference": "Proverbs 3:5",
      "author": "Author or null",
      "type": "quote",
      "context": "English context (2-3 sentences)",
      "explanation": "English explanation (2-3 sentences)",
      "situations": ["situation1", "situation2"],
      "tags": ["tag1", "tag2"],
      "relevantQueries": ["heartbreak", "sadness", "healing"]
    },
    "de": {
      "text": "Zitat auf Deutsch",
      "reference": "Sprüche 3:5",
      "context": "Deutscher Kontext (2-3 Sätze)",
      "explanation": "Deutsche Erklärung (2-3 Sätze)",
      "situations": ["Situation1", "Situation2"],
      "tags": ["Schlagwort1", "Schlagwort2"],
      "relevantQueries": ["Liebeskummer", "Traurigkeit", "Heilung"]
    },
    "relevanceScore": 85
  }
]

Types: "bible", "quote", "saying", "poem"
relevanceScore: 0-100 based on match quality`;

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

      // Determine primary and secondary language
      const primaryLang = args.language === "de" ? "de" : "en";
      const secondaryLang = primaryLang === "de" ? "en" : "de";

      // Validate and filter valid bilingual quotes
      const quotes = rawQuotes.filter((q: any) => {
        if (!q || typeof q !== 'object') return false;
        // Check for bilingual structure
        const primary = q[primaryLang];
        if (!primary || !primary.text || typeof primary.text !== 'string' || primary.text.length < 10) return false;
        return true;
      });

      if (quotes.length === 0) {
        throw new Error("No valid quotes in AI response");
      }

      // Save search context first (for primary language)
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
        const primary = q[primaryLang];
        const secondary = q[secondaryLang];

        // Build translations object for the secondary language
        const translations: any = {};
        if (secondary && secondary.text) {
          translations[secondaryLang] = {
            text: secondary.text,
            reference: secondary.reference,
            context: secondary.context,
            explanation: secondary.explanation,
            situations: secondary.situations || [],
            tags: secondary.tags || [],
          };
        }

        // Prepare primary language data
        const quoteData: any = {
          text: primary.text,
          source: "ai_generated",
          language: primaryLang,
          isPremium: false,
          situations: primary.situations || [],
          tags: [...(primary.tags || []), args.query.toLowerCase()],
          translations,
          aiPrompt: `Search: ${args.query}`,
        };

        // Add optional fields only if they have values
        if (primary.author && primary.author !== "null" && primary.author !== null) {
          quoteData.author = primary.author;
        }
        if (primary.reference) {
          quoteData.reference = primary.reference;
        }
        if (primary.type) {
          quoteData.category = primary.type;
        }
        if (primary.context) {
          quoteData.context = primary.context;
        }
        if (primary.explanation) {
          quoteData.explanation = primary.explanation;
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
        // Process relevantQueries from PRIMARY language
        if (primary.relevantQueries && Array.isArray(primary.relevantQueries)) {
          for (const relatedQuery of primary.relevantQueries) {
            if (typeof relatedQuery === 'string' && relatedQuery.trim().length > 0) {
              const relatedNormalized = normalizeQuery(relatedQuery);

              const relatedContextId = await ctx.runMutation(api.search.saveSearchContext, {
                searchQuery: relatedQuery.trim(),
                normalizedQuery: relatedNormalized,
                categoryId: args.categoryId,
                language: primaryLang,
              });

              await ctx.runMutation(api.search.addQuoteContextMapping, {
                quoteId,
                contextId: relatedContextId,
                relevanceScore: Math.max(50, (q.relevanceScore || 80) - 10),
                isAiGenerated: true,
              });
            }
          }
        }

        // Also create context mappings for SECONDARY language relevantQueries
        // This enables cross-language search
        if (secondary?.relevantQueries && Array.isArray(secondary.relevantQueries)) {
          for (const relatedQuery of secondary.relevantQueries) {
            if (typeof relatedQuery === 'string' && relatedQuery.trim().length > 0) {
              const relatedNormalized = normalizeQuery(relatedQuery);

              const relatedContextId = await ctx.runMutation(api.search.saveSearchContext, {
                searchQuery: relatedQuery.trim(),
                normalizedQuery: relatedNormalized,
                categoryId: args.categoryId,
                language: secondaryLang,
              });

              await ctx.runMutation(api.search.addQuoteContextMapping, {
                quoteId,
                contextId: relatedContextId,
                relevanceScore: Math.max(50, (q.relevanceScore || 80) - 15), // Slightly lower for cross-language
                isAiGenerated: true,
              });
            }
          }
        }

        savedQuotes.push({ _id: quoteId, ...primary, translations, relevanceScore: q.relevanceScore || 80 });
      }

      // Record search history (search count is now incremented in performSmartSearch)
      if (args.userId) {
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
