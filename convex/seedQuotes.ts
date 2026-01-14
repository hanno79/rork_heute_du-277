import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Static quotes from mocks/quotes.ts
// We'll import a simplified version here
const staticQuotes = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    text: "An eye for an eye, a tooth for a tooth.",
    reference: "Exodus 21:24",
    author: null,
    type: 'bible' as const,
    language: 'en',
    context: "This verse appears in the context of the Law of Moses, specifically in a section about personal injuries.",
    explanation: "Contrary to popular belief, this verse was not encouraging revenge but limiting it.",
    situations: ["facing injustice", "dealing with revenge", "legal matters"],
    tags: ["justice", "law", "retribution"],
    translations: {
      de: {
        text: "Auge um Auge, Zahn um Zahn.",
        context: "Dieser Vers erscheint im Kontext des Gesetzes des Mose.",
        explanation: "Entgegen der landläufigen Meinung ermutigte dieser Vers nicht zur Rache, sondern begrenzte sie.",
        situations: ["Ungerechtigkeit erleben", "mit Rache umgehen"],
        tags: ["Gerechtigkeit", "Gesetz"]
      }
    }
  },
  {
    id: 'b2c3d4e5-f6g7-8901-bcde-f12345678901',
    text: "Love your neighbor as yourself.",
    reference: "Leviticus 19:18",
    author: null,
    type: 'bible' as const,
    language: 'en',
    context: "Part of the Holiness Code in Leviticus, this commandment emphasizes treating others with the same care you give yourself.",
    explanation: "This is one of the most quoted verses in both Jewish and Christian traditions, forming the basis of the Golden Rule.",
    situations: ["building relationships", "community living", "resolving conflicts"],
    tags: ["love", "community", "compassion"],
    translations: {
      de: {
        text: "Liebe deinen Nächsten wie dich selbst.",
        context: "Teil des Heiligkeitsgesetzes im Levitikus.",
        explanation: "Dies ist einer der am häufigsten zitierten Verse in jüdischen und christlichen Traditionen.",
        situations: ["Beziehungen aufbauen", "Gemeinschaftsleben"],
        tags: ["Liebe", "Gemeinschaft", "Mitgefühl"]
      }
    }
  },
  {
    id: 'c3d4e5f6-g7h8-9012-cdef-123456789012',
    text: "Trust in the Lord with all your heart.",
    reference: "Proverbs 3:5",
    author: null,
    type: 'bible' as const,
    language: 'en',
    context: "From the Book of Proverbs, this verse encourages complete reliance on God rather than human understanding.",
    explanation: "This verse calls for total trust in God's wisdom, even when situations don't make sense from a human perspective.",
    situations: ["facing uncertainty", "making difficult decisions", "dealing with fear"],
    tags: ["faith", "trust", "wisdom"],
    translations: {
      de: {
        text: "Vertraue auf den Herrn von ganzem Herzen.",
        context: "Aus dem Buch der Sprüche ermutigt dieser Vers zum vollständigen Vertrauen auf Gott.",
        explanation: "Dieser Vers ruft zu vollkommenem Vertrauen in Gottes Weisheit auf.",
        situations: ["Unsicherheit begegnen", "schwierige Entscheidungen treffen"],
        tags: ["Glaube", "Vertrauen", "Weisheit"]
      }
    }
  },
  {
    id: 'd4e5f6g7-h8i9-0123-defg-234567890123',
    text: "Do unto others as you would have them do unto you.",
    reference: "Matthew 7:12",
    author: null,
    type: 'bible' as const,
    language: 'en',
    context: "Known as the Golden Rule, this teaching from Jesus' Sermon on the Mount encapsulates ethical behavior.",
    explanation: "This principle appears in many religions and philosophies, but Jesus presents it as a positive command rather than a prohibition.",
    situations: ["ethical dilemmas", "workplace relationships", "family conflicts"],
    tags: ["ethics", "golden rule", "compassion"],
    translations: {
      de: {
        text: "Was du nicht willst, dass man dir tu, das füg auch keinem andern zu.",
        context: "Bekannt als Goldene Regel aus Jesu Bergpredigt.",
        explanation: "Dieses Prinzip erscheint in vielen Religionen, aber Jesus präsentiert es als positives Gebot.",
        situations: ["ethische Dilemmata", "Arbeitsbeziehungen", "Familienkonflikte"],
        tags: ["Ethik", "Goldene Regel", "Mitgefühl"]
      }
    }
  },
  {
    id: 'e5f6g7h8-i9j0-1234-efgh-345678901234',
    text: "The truth will set you free.",
    reference: "John 8:32",
    author: null,
    type: 'bible' as const,
    language: 'en',
    context: "Jesus spoke these words to believers, explaining that knowing the truth about him brings spiritual freedom.",
    explanation: "While often quoted out of context, this verse speaks about liberation from sin and falsehood through Christ's teachings.",
    situations: ["seeking authenticity", "breaking free from deception", "personal growth"],
    tags: ["truth", "freedom", "authenticity"],
    translations: {
      de: {
        text: "Die Wahrheit wird euch frei machen.",
        context: "Jesus sprach diese Worte zu Gläubigen über spirituelle Freiheit.",
        explanation: "Dieser Vers spricht über Befreiung von Sünde und Falschheit durch Christi Lehren.",
        situations: ["Authentizität suchen", "sich von Täuschung befreien"],
        tags: ["Wahrheit", "Freiheit", "Authentizität"]
      }
    }
  }
];

export const seedInitialQuotes = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("quotes").first();
    if (existing) {
      return {
        success: false,
        message: "Quotes already seeded",
        count: 0
      };
    }

    let insertedCount = 0;

    // Insert all static quotes
    for (const quote of staticQuotes) {
      try {
        await ctx.db.insert("quotes", {
          text: quote.text,
          author: quote.author || undefined,
          reference: quote.reference,
          source: "static",
          category: quote.type,
          language: quote.language,
          isPremium: false,
          context: quote.context,
          explanation: quote.explanation,
          situations: quote.situations,
          tags: quote.tags,
          translations: quote.translations,
          reflectionQuestions: [],
          practicalTips: [],
          // aiPrompt is optional, don't include it for static quotes
        });
        insertedCount++;
      } catch (error) {
        console.error(`Failed to insert quote ${quote.id}:`, error);
      }
    }

    return {
      success: true,
      message: `Successfully seeded ${insertedCount} quotes`,
      count: insertedCount
    };
  },
});

// Helper mutation to clear all quotes (for testing)
export const clearAllQuotes = mutation({
  args: {},
  handler: async (ctx) => {
    const quotes = await ctx.db.query("quotes").collect();

    for (const quote of quotes) {
      await ctx.db.delete(quote._id);
    }

    return {
      success: true,
      message: `Deleted ${quotes.length} quotes`,
      count: quotes.length
    };
  },
});
