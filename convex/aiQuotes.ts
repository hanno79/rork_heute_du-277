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

    const prompt = `Generate a meaningful and inspiring quote, Bible verse, or saying ${promptContext}.

Requirements:
- Language: ${langName}
- Must be authentic (real quote from known person, actual Bible verse, or traditional saying)
- Include proper attribution/reference
- Provide context and explanation

Respond with ONLY a valid JSON object (no markdown):
{
  "text": "The quote text",
  "reference": "Author name or Bible reference (e.g., 'Proverbs 3:5')",
  "author": "Author name if it's a quote (optional, null for Bible verses)",
  "type": "bible" | "quote" | "saying" | "poem",
  "context": "Brief historical or situational context (2-3 sentences)",
  "explanation": "Why this is meaningful and how to apply it (2-3 sentences)",
  "situations": ["situation1", "situation2", "situation3"],
  "tags": ["tag1", "tag2", "tag3"]
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

      // Save to database
      const quoteId = await ctx.runMutation(api.quotes.insertAIQuote, {
        text: quoteData.text,
        author: quoteData.author || null,
        reference: quoteData.reference,
        source: "ai_generated",
        category: quoteData.type || "quote",
        language: args.language,
        isPremium: false,
        context: quoteData.context,
        explanation: quoteData.explanation,
        situations: quoteData.situations || [],
        tags: quoteData.tags || [],
        aiPrompt: args.searchQuery
          ? `Search: ${args.searchQuery}`
          : "Daily quote generation",
      });

      return { quoteId, quote: quoteData };
    } catch (error: any) {
      console.error("AI generation error:", error);
      throw new Error(`Failed to generate quote: ${error.message}`);
    }
  },
});

// Generate multiple quotes for search (Premium feature)
export const generateSearchQuotes = action({
  args: {
    query: v.string(),
    language: v.string(),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const count = args.count || 3;
    const langName = args.language === "de" ? "German" : "English";

    const prompt = `Find ${count} meaningful and relevant quotes, Bible verses, or sayings for: "${args.query}"

Requirements:
- Language: ${langName}
- Must be authentic (real quotes, actual Bible verses, or traditional sayings)
- Include proper attribution
- Diverse types (try: 1 Bible verse, 1 famous quote, 1 saying/proverb)

Respond with ONLY a valid JSON array (no markdown):
[
  {
    "text": "The quote text",
    "reference": "Author or Bible reference",
    "author": "Author name (null for Bible)",
    "type": "bible" | "quote" | "saying" | "poem",
    "context": "Brief context (2 sentences)",
    "explanation": "Why relevant to query (2 sentences)",
    "situations": ["situation1", "situation2", "situation3"],
    "tags": ["tag1", "tag2", "tag3"]
  }
]`;

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
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      let content = data.choices[0]?.message?.content || "";

      // JSON extrahieren
      if (content.includes("```")) {
        content = content
          .replace(/```json?\n?/g, "")
          .replace(/```$/g, "")
          .trim();
      }

      const quotesData = JSON.parse(content);
      const quotes = Array.isArray(quotesData) ? quotesData : [quotesData];

      // In DB speichern
      const savedQuotes = [];
      for (const q of quotes) {
        const quoteId = await ctx.runMutation(api.quotes.insertAIQuote, {
          text: q.text,
          author: q.author || null,
          reference: q.reference,
          source: "ai_generated",
          category: q.type || "quote",
          language: args.language,
          isPremium: false,
          context: q.context,
          explanation: q.explanation,
          situations: q.situations || [],
          tags: [...(q.tags || []), args.query.toLowerCase()],
          aiPrompt: `Search: ${args.query}`,
        });

        savedQuotes.push({ _id: quoteId, ...q });
      }

      return { quotes: savedQuotes, count: savedQuotes.length };
    } catch (error: any) {
      console.error("AI search error:", error);
      throw new Error(`Failed to generate search quotes: ${error.message}`);
    }
  },
});
