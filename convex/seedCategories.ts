import { mutation } from "./_generated/server";

// Seed data for search categories
const SEARCH_CATEGORIES = [
  {
    name: "relationship",
    displayName_de: "Beziehung",
    displayName_en: "Relationship",
    keywords_de: ["partner", "liebe", "ehe", "freundschaft", "trennung", "streit", "vertrauen", "treue", "zusammen", "beziehung", "heiraten", "scheidung", "dating", "verliebt", "herzschmerz"],
    keywords_en: ["partner", "love", "marriage", "friendship", "breakup", "argument", "trust", "loyalty", "together", "relationship", "wedding", "divorce", "dating", "romance", "heartbreak"],
  },
  {
    name: "work",
    displayName_de: "Arbeit & Karriere",
    displayName_en: "Work & Career",
    keywords_de: ["arbeit", "job", "chef", "kollege", "stress", "karriere", "beruf", "büro", "gehalt", "kündigung", "bewerbung", "erfolg", "leistung", "überstunden", "burnout"],
    keywords_en: ["work", "job", "boss", "colleague", "stress", "career", "profession", "office", "salary", "resignation", "application", "success", "performance", "overtime", "burnout"],
  },
  {
    name: "family",
    displayName_de: "Familie",
    displayName_en: "Family",
    keywords_de: ["familie", "eltern", "kinder", "mutter", "vater", "geschwister", "großeltern", "erziehung", "zuhause", "heim", "verwandte", "schwiegermutter", "teenager", "baby"],
    keywords_en: ["family", "parents", "children", "mother", "father", "siblings", "grandparents", "upbringing", "home", "relatives", "mother-in-law", "teenager", "baby"],
  },
  {
    name: "health",
    displayName_de: "Gesundheit",
    displayName_en: "Health",
    keywords_de: ["gesundheit", "krankheit", "arzt", "schmerzen", "heilung", "genesung", "therapie", "krankenhaus", "diagnose", "wohlbefinden", "fitness", "ernährung", "schlaf"],
    keywords_en: ["health", "illness", "doctor", "pain", "healing", "recovery", "therapy", "hospital", "diagnosis", "wellbeing", "fitness", "nutrition", "sleep"],
  },
  {
    name: "grief",
    displayName_de: "Trauer & Verlust",
    displayName_en: "Grief & Loss",
    keywords_de: ["trauer", "verlust", "tod", "sterben", "abschied", "vermissen", "erinnerung", "trost", "beerdigung", "loslassen", "weinen", "schmerz", "traurig"],
    keywords_en: ["grief", "loss", "death", "dying", "farewell", "missing", "memory", "comfort", "funeral", "letting go", "crying", "pain", "sad"],
  },
  {
    name: "motivation",
    displayName_de: "Motivation & Ziele",
    displayName_en: "Motivation & Goals",
    keywords_de: ["motivation", "ziel", "träume", "anfang", "neustart", "durchhalten", "aufgeben", "kämpfen", "stärke", "mut", "selbstvertrauen", "erfolg", "wachstum", "veränderung"],
    keywords_en: ["motivation", "goal", "dreams", "beginning", "restart", "perseverance", "giving up", "fighting", "strength", "courage", "confidence", "success", "growth", "change"],
  },
  {
    name: "conflict",
    displayName_de: "Konflikte & Vergebung",
    displayName_en: "Conflicts & Forgiveness",
    keywords_de: ["konflikt", "streit", "wut", "ärger", "verzeihen", "vergebung", "entschuldigung", "versöhnung", "frieden", "schuld", "reue", "nachsicht", "groll"],
    keywords_en: ["conflict", "argument", "anger", "rage", "forgive", "forgiveness", "apology", "reconciliation", "peace", "guilt", "regret", "patience", "grudge"],
  },
  {
    name: "faith",
    displayName_de: "Glaube & Spiritualität",
    displayName_en: "Faith & Spirituality",
    keywords_de: ["glaube", "gott", "gebet", "hoffnung", "segen", "bibel", "kirche", "spiritualität", "seele", "dankbarkeit", "vertrauen", "führung", "sinn"],
    keywords_en: ["faith", "god", "prayer", "hope", "blessing", "bible", "church", "spirituality", "soul", "gratitude", "trust", "guidance", "meaning"],
  },
  {
    name: "anxiety",
    displayName_de: "Angst & Sorgen",
    displayName_en: "Anxiety & Worry",
    keywords_de: ["angst", "sorgen", "panik", "furcht", "unsicherheit", "zukunft", "nervös", "überfordert", "belastung", "druck", "erschöpft", "hilflos"],
    keywords_en: ["anxiety", "worry", "panic", "fear", "uncertainty", "future", "nervous", "overwhelmed", "pressure", "stress", "exhausted", "helpless"],
  },
  {
    name: "selfworth",
    displayName_de: "Selbstwert & Identität",
    displayName_en: "Self-Worth & Identity",
    keywords_de: ["selbstwert", "selbstliebe", "zweifel", "wert", "identität", "akzeptanz", "vergleich", "minderwertig", "stolz", "selbstbewusst", "einzigartig"],
    keywords_en: ["self-worth", "self-love", "doubt", "value", "identity", "acceptance", "comparison", "inferior", "proud", "confident", "unique"],
  },
];

// Mutation to seed all categories
export const seedAllCategories = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if categories already exist
    const existingCategories = await ctx.db.query("searchCategories").collect();

    if (existingCategories.length > 0) {
      return {
        success: false,
        message: `Categories already exist (${existingCategories.length} found). Delete existing categories first if you want to re-seed.`,
        count: existingCategories.length
      };
    }

    // Insert all categories
    const insertedIds = [];
    for (const category of SEARCH_CATEGORIES) {
      const id = await ctx.db.insert("searchCategories", category);
      insertedIds.push(id);
    }

    return {
      success: true,
      message: `Successfully seeded ${insertedIds.length} categories`,
      count: insertedIds.length
    };
  },
});

// Mutation to delete all categories (for re-seeding)
export const deleteAllCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("searchCategories").collect();

    for (const category of categories) {
      await ctx.db.delete(category._id);
    }

    return {
      success: true,
      message: `Deleted ${categories.length} categories`
    };
  },
});
