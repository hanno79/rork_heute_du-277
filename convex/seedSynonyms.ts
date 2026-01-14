import { mutation, query } from "./_generated/server";

// Initial synonym groups for semantic search matching
const synonymGroups = [
  {
    groupName: "heartbreak",
    terms_de: ["liebeskummer", "herzschmerz", "trennung", "beziehungsende", "loslassen", "abschied", "verlassen", "gebrochenes herz"],
    terms_en: ["heartbreak", "breakup", "heartache", "separation", "letting go", "goodbye", "abandoned", "broken heart"],
  },
  {
    groupName: "stress",
    terms_de: ["stress", "überfordert", "burnout", "erschöpft", "druck", "überlastet", "anspannung", "belastung"],
    terms_en: ["stress", "overwhelmed", "burnout", "exhausted", "pressure", "overworked", "tension", "burden"],
  },
  {
    groupName: "grief",
    terms_de: ["trauer", "verlust", "tod", "abschied", "vermissen", "trauerfall", "beerdigung", "schmerz"],
    terms_en: ["grief", "loss", "death", "farewell", "missing", "bereavement", "funeral", "sorrow"],
  },
  {
    groupName: "fear",
    terms_de: ["angst", "sorgen", "furcht", "panik", "unsicherheit", "ängstlich", "besorgt", "bange"],
    terms_en: ["fear", "worry", "anxiety", "panic", "uncertainty", "anxious", "worried", "apprehensive"],
  },
  {
    groupName: "motivation",
    terms_de: ["motivation", "antrieb", "durchhalten", "ziele", "träume", "erfolg", "anfangen", "weitermachen", "nicht aufgeben"],
    terms_en: ["motivation", "drive", "perseverance", "goals", "dreams", "success", "starting", "keep going", "never give up"],
  },
  {
    groupName: "conflict",
    terms_de: ["streit", "konflikt", "wut", "ärger", "vergebung", "verzeihen", "auseinandersetzung", "meinungsverschiedenheit"],
    terms_en: ["argument", "conflict", "anger", "frustration", "forgiveness", "forgive", "dispute", "disagreement"],
  },
  {
    groupName: "self_doubt",
    terms_de: ["selbstzweifel", "unsicher", "minderwertig", "nicht gut genug", "versagen", "versagensangst", "selbstwert"],
    terms_en: ["self doubt", "insecure", "inferior", "not good enough", "failure", "fear of failure", "self worth"],
  },
  {
    groupName: "loneliness",
    terms_de: ["einsamkeit", "allein", "einsam", "isoliert", "verlassen", "niemand", "alleine"],
    terms_en: ["loneliness", "alone", "lonely", "isolated", "abandoned", "nobody", "solitude"],
  },
  {
    groupName: "hope",
    terms_de: ["hoffnung", "zuversicht", "optimismus", "besser werden", "licht", "neuanfang", "glaube"],
    terms_en: ["hope", "confidence", "optimism", "getting better", "light", "new beginning", "faith"],
  },
  {
    groupName: "gratitude",
    terms_de: ["dankbarkeit", "dankbar", "wertschätzung", "anerkennung", "zufriedenheit"],
    terms_en: ["gratitude", "grateful", "appreciation", "recognition", "contentment"],
  },
  {
    groupName: "family",
    terms_de: ["familie", "eltern", "kinder", "geschwister", "mutter", "vater", "sohn", "tochter", "verwandte"],
    terms_en: ["family", "parents", "children", "siblings", "mother", "father", "son", "daughter", "relatives"],
  },
  {
    groupName: "work",
    terms_de: ["arbeit", "beruf", "job", "karriere", "chef", "kollegen", "büro", "kündigung", "arbeitslos"],
    terms_en: ["work", "career", "job", "profession", "boss", "colleagues", "office", "fired", "unemployed"],
  },
  {
    groupName: "health",
    terms_de: ["gesundheit", "krankheit", "heilung", "genesung", "schmerzen", "arzt", "krankenhaus"],
    terms_en: ["health", "illness", "healing", "recovery", "pain", "doctor", "hospital"],
  },
  {
    groupName: "change",
    terms_de: ["veränderung", "wandel", "umbruch", "neuanfang", "anders", "neu", "transformation"],
    terms_en: ["change", "transition", "transformation", "new beginning", "different", "new", "evolution"],
  },
  {
    groupName: "patience",
    terms_de: ["geduld", "warten", "zeit", "aushalten", "durchhalten", "langmut"],
    terms_en: ["patience", "waiting", "time", "endure", "persevere", "forbearance"],
  },
];

// Seed function to populate synonym groups
export const seedSynonymGroups = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("synonymGroups").first();
    if (existing) {
      return { success: false, message: "Synonym groups already seeded", count: 0 };
    }

    let count = 0;
    for (const group of synonymGroups) {
      await ctx.db.insert("synonymGroups", {
        groupName: group.groupName,
        terms_de: group.terms_de,
        terms_en: group.terms_en,
      });
      count++;
    }

    return { success: true, message: `Seeded ${count} synonym groups`, count };
  },
});

// Query to get all synonym groups
export const getAllSynonymGroups = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("synonymGroups").collect();
  },
});

// Query to find synonym group by any term
export const findSynonymsByTerm = query({
  args: {},
  handler: async (ctx) => {
    // This function is called from search.ts - see findSynonyms there
    return await ctx.db.query("synonymGroups").collect();
  },
});
