import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Type for translation data stored in quotes.translations
interface TranslationData {
  text: string;
  reference?: string;
  context?: string;
  explanation?: string;
  situations: string[];
  tags: string[];
}

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

CRITICAL REQUIREMENT: You MUST provide the quote in BOTH English AND German.
If you fail to provide both languages, your response will be REJECTED.
VALIDATION: Both "en" and "de" objects with non-empty "text" fields are REQUIRED.

Requirements:
- Must be authentic (real quote from known person, actual Bible verse, or traditional saying)
- Include proper attribution/reference
- Provide context and explanation in BOTH languages
- BOTH "en" AND "de" sections are MANDATORY - do not skip either language

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

      // VALIDATION: Ensure BOTH languages are present with minimum length
      const MIN_TEXT_LENGTH = 10;
      const enText = bilingualData.en?.text;
      const deText = bilingualData.de?.text;
      const enLength = typeof enText === 'string' ? enText.length : 0;
      const deLength = typeof deText === 'string' ? deText.length : 0;

      if (!enText || !deText || enLength < MIN_TEXT_LENGTH || deLength < MIN_TEXT_LENGTH) {
        console.error("AI response missing required bilingual content:", {
          hasEnglish: !!enText,
          hasGerman: !!deText,
          enLength,
          deLength,
          minRequired: MIN_TEXT_LENGTH,
        });
        throw new Error(`AI response missing required bilingual content - both EN and DE texts must be at least ${MIN_TEXT_LENGTH} characters`);
      }

      // Determine primary and secondary language based on user's language preference
      const primaryLang = args.language === "de" ? "de" : "en";
      const secondaryLang = primaryLang === "de" ? "en" : "de";

      const primaryData = bilingualData[primaryLang];
      const translationData = bilingualData[secondaryLang];

      if (!primaryData || !primaryData.text) {
        throw new Error("Missing primary language data in AI response");
      }

      // Log successful bilingual generation
      console.log("Bilingual quote generated successfully:", {
        primaryLang,
        secondaryLang,
        primaryTextLength: primaryData.text.length,
        translationTextLength: translationData?.text?.length || 0,
      });

      // Build translations object for the secondary language
      const translations: Record<string, TranslationData> = {};
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

      const quoteId: string = await ctx.runMutation(api.quotes.insertAIQuote, insertData);

      return { quoteId, quote: primaryData, translations };
    } catch (error: any) {
      console.error("AI generation error:", error);
      throw new Error(`Failed to generate quote: ${error.message}`);
    }
  },
});

// Helper: Parse possibly malformed JSON from AI responses
// Handles common issues: trailing commas, newlines in strings, truncated responses
function parsePossiblyMalformedJSON(content: string): unknown[] {
  // First attempt: standard JSON parse
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (parseError) {
    console.error("JSON parse error in AI response, attempting recovery");

    // Second attempt: fix common JSON issues
    const fixedContent = content
      // Replace null without quotes (already valid, but normalize)
      .replace(/:(\s*)null(\s*[,}\]])/gi, ':$1null$2')
      // Remove newlines inside strings (common AI output issue)
      .replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1 $2"');

    try {
      const parsed = JSON.parse(fixedContent);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Third attempt: manually extract complete JSON objects
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
        const recovered = objectMatches
          .map(match => {
            try {
              return JSON.parse(match);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (recovered.length > 0) {
          console.log(`Recovered ${recovered.length} quotes from truncated response`);
          return recovered;
        }
      }

      // All recovery attempts failed, throw original error
      throw parseError;
    }
  }
}

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
      const rateLimit = await ctx.runQuery(internal.search.checkRateLimit, {
        userId: args.userId,
      });
      if (!rateLimit.canUseAI) {
        throw new Error("AI_RATE_LIMIT_EXCEEDED");
      }
    }

    const count = args.count || 3;

    // BILINGUAL PROMPT: Generate quotes in BOTH English and German
    const prompt = `Find ${count} meaningful quotes, Bible verses, or sayings for: "${args.query}"

CRITICAL REQUIREMENT: For EACH quote, you MUST provide BOTH English AND German versions.
If ANY quote is missing either language, the ENTIRE response will be REJECTED.
VALIDATION: Every quote object MUST have both "en" and "de" with non-empty "text" fields.

Requirements:
- Authentic quotes with proper attribution, diverse types
- BOTH "en" AND "de" sections are MANDATORY for EACH quote - do not skip either language
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

      // Parse JSON with recovery for malformed AI responses
      const rawQuotes = parsePossiblyMalformedJSON(content) as Record<string, any>[];

      // Determine primary and secondary language
      const primaryLang = args.language === "de" ? "de" : "en";
      const secondaryLang = primaryLang === "de" ? "en" : "de";

      // VALIDATION: Ensure BOTH languages are present for each quote
      // Filter and validate bilingual quotes
      const quotes = rawQuotes.filter((q: any) => {
        if (!q || typeof q !== 'object') return false;

        // Check for BOTH language versions
        const hasEnglish = q.en?.text && typeof q.en.text === 'string' && q.en.text.length >= 10;
        const hasGerman = q.de?.text && typeof q.de.text === 'string' && q.de.text.length >= 10;

        if (!hasEnglish || !hasGerman) {
          console.warn("Filtering out quote missing bilingual content:", {
            hasEnglish,
            hasGerman,
            enText: q.en?.text?.substring(0, 50) || "missing",
            deText: q.de?.text?.substring(0, 50) || "missing",
          });
          return false;
        }

        return true;
      });

      // Log validation results
      console.log("Bilingual search quotes validation:", {
        rawCount: rawQuotes.length,
        validCount: quotes.length,
        filteredOut: rawQuotes.length - quotes.length,
      });

      if (quotes.length === 0) {
        throw new Error("No valid bilingual quotes in AI response - all quotes were filtered out");
      }

      // Save search context first (for primary language)
      const normalizedQuery = normalizeQuery(args.query);
      const contextId: Id<"searchContexts"> = await ctx.runMutation(api.search.saveSearchContext, {
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
        const translations: Record<string, TranslationData> = {};
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

        const quoteId: Id<"quotes"> = await ctx.runMutation(api.quotes.insertAIQuote, quoteData);

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
        await ctx.runMutation(internal.readingHistory.recordUserSearch, {
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
