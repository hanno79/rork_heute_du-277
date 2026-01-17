import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// Schema for a single translation entry (matches TranslationData in aiQuotes.ts)
const translationEntrySchema = v.object({
  text: v.string(),
  reference: v.optional(v.string()),
  context: v.optional(v.string()),
  explanation: v.optional(v.string()),
  situations: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
});

// Internal mutation to update a single quote with translations
export const updateQuoteTranslations = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    translations: v.record(v.string(), translationEntrySchema),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteId, {
      translations: args.translations,
    });
    return { success: true };
  },
});

// Action to translate all existing quotes that are missing translations
// SECURITY: This is an internal action - cannot be called from clients
// Protects against API credit abuse (OpenRouter calls)
export const translateExistingQuotes = internalAction({
  args: {
    dryRun: v.optional(v.boolean()), // If true, only report what would be done
    limit: v.optional(v.number()), // Limit number of quotes to process
  },
  handler: async (ctx, args) => {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    // Get all quotes that need translations
    const allQuotes: Doc<"quotes">[] = await ctx.runQuery(internal.translateExisting.getQuotesNeedingTranslation, {
      limit: args.limit || 50,
    });

    console.log(`Found ${allQuotes.length} quotes needing translation`);

    if (args.dryRun) {
      return {
        dryRun: true,
        quotesFound: allQuotes.length,
        quotes: allQuotes.map((q: Doc<"quotes">) => {
          const text = q.text ?? "";
          return {
            id: q._id,
            text: text.length > 50 ? text.substring(0, 50) + "..." : text,
            language: q.language,
            hasTranslations: Object.keys(q.translations || {}).length > 0,
          };
        }),
      };
    }

    const results: { id: string; success: boolean; error?: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const quote of allQuotes) {
      try {
        // Determine target language (translate to the opposite)
        const targetLang = quote.language === "de" ? "en" : "de";

        console.log(`Translating quote ${quote._id} from ${quote.language} to ${targetLang}`);

        // Generate translation using AI
        const translation = await generateTranslation(
          openrouterApiKey,
          quote,
          targetLang
        );

        if (translation) {
          // Build new translations object
          const newTranslations = {
            ...(quote.translations || {}),
            [targetLang]: translation,
          };

          // Update the quote
          await ctx.runMutation(internal.translateExisting.updateQuoteTranslations, {
            quoteId: quote._id,
            translations: newTranslations,
          });

          results.push({ id: quote._id, success: true });
          successCount++;
          console.log(`Successfully translated quote ${quote._id}`);
        } else {
          results.push({ id: quote._id, success: false, error: "No translation generated" });
          errorCount++;
        }

        // Rate limiting: wait between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`Error translating quote ${quote._id}:`, error.message);
        results.push({ id: quote._id, success: false, error: error.message });
        errorCount++;
      }
    }

    return {
      dryRun: false,
      totalProcessed: allQuotes.length,
      successCount,
      errorCount,
      results,
    };
  },
});

// Query to get quotes that need translation
// SECURITY: Internal query - only callable from other Convex functions
// OPTIMIZATION: Uses streaming iteration with early termination to avoid OOM on large datasets
// Instead of .collect() which loads all records, we iterate and break early once limit is reached
export const getQuotesNeedingTranslation = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const needsTranslation: Doc<"quotes">[] = [];

    // OPTIMIZATION: Use take() instead of .collect() to avoid loading all records into memory
    // This prevents OOM issues when there are many AI-generated quotes in the database
    // We fetch a bounded batch (limit + buffer for filtering) and stop once we have enough results
    // The buffer accounts for quotes that already have translations and will be skipped
    const fetchLimit = Math.min(limit * 3, 200); // Fetch up to 3x the limit or 200 max

    // Fetch a bounded batch of AI-generated quotes
    const batch = await ctx.db
      .query("quotes")
      .withIndex("by_source", (q) => q.eq("source", "ai_generated"))
      .take(fetchLimit);

    // Filter in memory with early termination once we have enough results
    for (const quote of batch) {
      if (needsTranslation.length >= limit) {
        break;
      }

      const translations = quote.translations as Record<string, any> | undefined;
      if (!translations || Object.keys(translations).length === 0) {
        needsTranslation.push(quote);
        continue;
      }

      // Check if the opposite language translation is missing
      const targetLang = quote.language === "de" ? "en" : "de";
      if (!translations[targetLang]?.text) {
        needsTranslation.push(quote);
      }
    }

    return needsTranslation;
  },
});

// Helper function to generate translation using AI
async function generateTranslation(
  apiKey: string,
  quote: Doc<"quotes">,
  targetLang: "en" | "de"
): Promise<{
  text: string;
  reference?: string;
  context?: string;
  explanation?: string;
  situations?: string[];
  tags?: string[];
} | null> {
  const sourceLang = quote.language === "de" ? "German" : "English";
  const targetLangName = targetLang === "de" ? "German" : "English";

  const prompt = `Translate the following quote/saying from ${sourceLang} to ${targetLangName}.

ORIGINAL QUOTE:
Text: "${quote.text}"
${quote.reference ? `Reference: ${quote.reference}` : ""}
${quote.author ? `Author: ${quote.author}` : ""}
${quote.context ? `Context: ${quote.context}` : ""}
${quote.explanation ? `Explanation: ${quote.explanation}` : ""}
${quote.situations?.length ? `Situations: ${quote.situations.join(", ")}` : ""}
${quote.tags?.length ? `Tags: ${quote.tags.join(", ")}` : ""}

REQUIREMENTS:
- Translate the quote text naturally, preserving the meaning and tone
- If it's a Bible verse, use the standard ${targetLangName} Bible translation
- Translate all metadata (context, explanation, situations, tags) to ${targetLangName}
- Keep the same formatting and structure

Respond with ONLY a valid JSON object (no markdown):
{
  "text": "The translated quote text",
  "reference": "Translated reference if applicable",
  "context": "Translated context",
  "explanation": "Translated explanation",
  "situations": ["translated situation 1", "translated situation 2"],
  "tags": ["translated tag 1", "translated tag 2"]
}`;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://heutedu.app",
          "X-Title": "Heute Du App - Translation",
        },
        body: JSON.stringify({
          model: "anthropic/claude-3-haiku",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3, // Lower temperature for more consistent translations
          max_tokens: 1500,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content || "";

    // Parse JSON - strip markdown code blocks if present
    if (content.includes("```")) {
      content = content
        .replace(/```json?\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
    }

    // Parse with detailed error handling for debugging
    let translation: Record<string, unknown>;
    try {
      translation = JSON.parse(content);
    } catch (parseError: any) {
      // Log detailed info for debugging malformed AI responses
      const contentPreview = content.length > 200 ? content.substring(0, 200) + "..." : content;
      console.error("JSON parse error in translation response:", {
        parseError: parseError.message,
        contentLength: content.length,
        contentPreview,
      });
      throw new Error(`JSON parse failed: ${parseError.message} | Content preview: ${contentPreview}`);
    }

    if (!translation.text || typeof translation.text !== 'string' || translation.text.length < 10) {
      const textPreview = String(translation.text || "").substring(0, 50);
      throw new Error(`Invalid translation: text too short or missing (got: "${textPreview}")`);
    }

    // Runtime type validation for optional string fields
    const reference = typeof translation.reference === 'string' ? translation.reference : undefined;
    const context = typeof translation.context === 'string' ? translation.context : undefined;
    const explanation = typeof translation.explanation === 'string' ? translation.explanation : undefined;

    // Runtime type validation for array fields - filter to ensure only strings
    const situations = Array.isArray(translation.situations)
      ? translation.situations.filter((s): s is string => typeof s === 'string')
      : [];
    const tags = Array.isArray(translation.tags)
      ? translation.tags.filter((t): t is string => typeof t === 'string')
      : [];

    return {
      text: translation.text,
      reference,
      context,
      explanation,
      situations,
      tags,
    };
  } catch (error: any) {
    console.error("Translation API error:", error.message);
    return null;
  }
}
