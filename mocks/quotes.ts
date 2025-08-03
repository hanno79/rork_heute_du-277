export interface Quote {
  id: string;
  text: string;
  reference: string;
  author?: string;
  book?: string;
  chapter?: number;
  verse?: number;
  type: 'bible' | 'quote' | 'saying' | 'poem';
  context: string;
  explanation: string;
  situations: string[];
  tags: string[];
  translations: {
    [key: string]: {
      text: string;
      context: string;
      explanation: string;
      situations: string[];
      tags: string[];
    };
  };
}

const quotes: Quote[] = [
  {
    id: '1',
    text: "An eye for an eye, a tooth for a tooth.",
    reference: "Exodus 21:24",
    book: "Exodus",
    chapter: 21,
    verse: 24,
    type: 'bible',
    context: "This verse appears in the context of the Law of Moses, specifically in a section about personal injuries. It was meant to limit retribution to be proportional to the offense, rather than escalating violence.",
    explanation: "Contrary to popular belief, this verse was not encouraging revenge but limiting it. In ancient times, a minor offense might lead to a blood feud. This law ensured that punishment matched the crime - no more, no less.",
    situations: ["facing injustice", "dealing with revenge", "legal matters", "proportional response"],
    tags: ["justice", "law", "retribution"],
    translations: {
      de: {
        text: "Auge um Auge, Zahn um Zahn.",
        context: "Dieser Vers erscheint im Kontext des Gesetzes Moses, speziell in einem Abschnitt über Körperverletzungen. Er sollte die Vergeltung auf das Maß der Straftat begrenzen, anstatt Gewalt zu eskalieren.",
        explanation: "Entgegen der landläufigen Meinung ermutigte dieser Vers nicht zur Rache, sondern begrenzte sie. In der Antike konnte eine geringfügige Straftat zu einer Blutrache führen. Dieses Gesetz stellte sicher, dass die Strafe dem Verbrechen entsprach - nicht mehr, nicht weniger.",
        situations: ["Ungerechtigkeit erleben", "mit Rache umgehen", "rechtliche Angelegenheiten", "angemessene Reaktion"],
        tags: ["Gerechtigkeit", "Gesetz", "Vergeltung"]
      }
    }
  },
  {
    id: '2',
    text: "Love your neighbor as yourself.",
    reference: "Mark 12:31",
    book: "Mark",
    chapter: 12,
    verse: 31,
    type: 'bible',
    context: "Jesus identified this as the second greatest commandment, following only the command to love God with all your heart, soul, mind, and strength.",
    explanation: "This verse calls us to treat others with the same care, respect, and consideration we would want for ourselves. It's a foundation for ethical behavior in Christianity.",
    situations: ["community conflicts", "helping others", "ethical dilemmas", "relationships"],
    tags: ["love", "relationships", "ethics", "commandment"],
    translations: {
      de: {
        text: "Liebe deinen Nächsten wie dich selbst.",
        context: "Jesus bezeichnete dies als das zweitgrößte Gebot, das nur dem Gebot folgt, Gott mit ganzem Herzen, ganzer Seele, ganzem Verstand und ganzer Kraft zu lieben.",
        explanation: "Dieser Vers ruft uns dazu auf, andere mit derselben Fürsorge, demselben Respekt und derselben Rücksichtnahme zu behandeln, die wir uns für uns selbst wünschen würden. Es ist eine Grundlage für ethisches Verhalten im Christentum.",
        situations: ["Gemeindekonflikte", "anderen helfen", "ethische Dilemmata", "Beziehungen"],
        tags: ["Liebe", "Beziehungen", "Ethik", "Gebot"]
      }
    }
  },
  {
    id: '3',
    text: "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.",
    reference: "Jeremiah 29:11",
    book: "Jeremiah",
    chapter: 29,
    verse: 11,
    type: 'bible',
    context: "This was written to the Israelites during their exile in Babylon, promising that their captivity would eventually end and they would return to their homeland.",
    explanation: "While often quoted as a personal promise, this verse was originally addressed to the entire nation of Israel. It reminds us that even in difficult times, God has good plans for His people.",
    situations: ["uncertainty", "career decisions", "difficult times", "life transitions"],
    tags: ["hope", "future", "promise", "comfort"],
    translations: {
      de: {
        text: "Denn ich weiß wohl, was ich für Gedanken über euch habe, spricht der HERR: Gedanken des Friedens und nicht des Leides, dass ich euch gebe Zukunft und Hoffnung.",
        context: "Dies wurde an die Israeliten während ihres Exils in Babylon geschrieben, mit der Verheißung, dass ihre Gefangenschaft schließlich enden und sie in ihre Heimat zurückkehren würden.",
        explanation: "Obwohl oft als persönliche Verheißung zitiert, war dieser Vers ursprünglich an die gesamte Nation Israel gerichtet. Er erinnert uns daran, dass Gott auch in schwierigen Zeiten gute Pläne für sein Volk hat.",
        situations: ["Ungewissheit", "Berufsentscheidungen", "schwierige Zeiten", "Lebensübergänge"],
        tags: ["Hoffnung", "Zukunft", "Verheißung", "Trost"]
      }
    }
  },
  {
    id: '4',
    text: "The only way to do great work is to love what you do.",
    reference: "Steve Jobs",
    author: "Steve Jobs",
    type: 'quote',
    context: "Steve Jobs, co-founder of Apple, spoke these words in his famous Stanford commencement address in 2005, encouraging graduates to pursue their passions.",
    explanation: "This quote emphasizes the importance of passion in achieving excellence. When you genuinely love what you do, work doesn't feel like a burden, and you're more likely to put in the effort needed to excel.",
    situations: ["career choices", "job dissatisfaction", "finding purpose", "motivation"],
    tags: ["work", "passion", "success", "motivation"],
    translations: {
      de: {
        text: "Der einzige Weg, großartige Arbeit zu leisten, ist zu lieben, was man tut.",
        context: "Steve Jobs, Mitbegründer von Apple, sprach diese Worte in seiner berühmten Stanford-Abschlussrede 2005 und ermutigte die Absolventen, ihren Leidenschaften zu folgen.",
        explanation: "Dieses Zitat betont die Bedeutung von Leidenschaft beim Erreichen von Exzellenz. Wenn Sie wirklich lieben, was Sie tun, fühlt sich Arbeit nicht wie eine Last an, und Sie werden eher die Anstrengung aufbringen, die nötig ist, um zu glänzen.",
        situations: ["Berufswahl", "Jobunzufriedenheit", "Sinn finden", "Motivation"],
        tags: ["Arbeit", "Leidenschaft", "Erfolg", "Motivation"]
      }
    }
  },
  {
    id: '5',
    text: "In the middle of difficulty lies opportunity.",
    reference: "Albert Einstein",
    author: "Albert Einstein",
    type: 'quote',
    context: "Einstein, one of the greatest physicists of all time, understood that challenges often present hidden opportunities for growth and innovation.",
    explanation: "This quote reminds us that difficult situations, while challenging, often contain the seeds of opportunity. By changing our perspective, we can find ways to grow and improve even in tough times.",
    situations: ["facing challenges", "difficult times", "problem solving", "personal growth"],
    tags: ["opportunity", "challenges", "growth", "perspective"],
    translations: {
      de: {
        text: "Inmitten der Schwierigkeit liegt die Gelegenheit.",
        context: "Einstein, einer der größten Physiker aller Zeiten, verstand, dass Herausforderungen oft versteckte Möglichkeiten für Wachstum und Innovation bieten.",
        explanation: "Dieses Zitat erinnert uns daran, dass schwierige Situationen, obwohl herausfordernd, oft die Samen der Gelegenheit enthalten. Durch eine Änderung unserer Perspektive können wir Wege finden, auch in schweren Zeiten zu wachsen und uns zu verbessern.",
        situations: ["Herausforderungen bewältigen", "schwierige Zeiten", "Problemlösung", "persönliches Wachstum"],
        tags: ["Gelegenheit", "Herausforderungen", "Wachstum", "Perspektive"]
      }
    }
  },
  {
    id: '6',
    text: "Be yourself; everyone else is already taken.",
    reference: "Oscar Wilde",
    author: "Oscar Wilde",
    type: 'quote',
    context: "Oscar Wilde, the famous Irish playwright and poet, was known for his wit and wisdom about human nature and authenticity.",
    explanation: "This quote encourages authenticity and self-acceptance. It reminds us that trying to be someone else is futile because that person already exists. Our uniqueness is our strength.",
    situations: ["self-doubt", "peer pressure", "identity crisis", "authenticity"],
    tags: ["authenticity", "self-acceptance", "individuality", "confidence"],
    translations: {
      de: {
        text: "Sei du selbst; alle anderen sind bereits vergeben.",
        context: "Oscar Wilde, der berühmte irische Dramatiker und Dichter, war bekannt für seinen Witz und seine Weisheit über die menschliche Natur und Authentizität.",
        explanation: "Dieses Zitat ermutigt zur Authentizität und Selbstakzeptanz. Es erinnert uns daran, dass der Versuch, jemand anderes zu sein, sinnlos ist, weil diese Person bereits existiert. Unsere Einzigartigkeit ist unsere Stärke.",
        situations: ["Selbstzweifel", "Gruppendruck", "Identitätskrise", "Authentizität"],
        tags: ["Authentizität", "Selbstakzeptanz", "Individualität", "Selbstvertrauen"]
      }
    }
  },
  {
    id: '7',
    text: "What doesn't kill you makes you stronger.",
    reference: "Friedrich Nietzsche",
    author: "Friedrich Nietzsche",
    type: 'saying',
    context: "This saying, popularized by the German philosopher Nietzsche, has become a common expression of resilience and personal growth through adversity.",
    explanation: "This saying suggests that surviving difficult experiences builds character and resilience. Each challenge we overcome makes us better equipped to handle future difficulties.",
    situations: ["overcoming adversity", "building resilience", "personal growth", "recovery"],
    tags: ["resilience", "strength", "adversity", "growth"],
    translations: {
      de: {
        text: "Was dich nicht umbringt, macht dich stärker.",
        context: "Dieser Spruch, popularisiert durch den deutschen Philosophen Nietzsche, ist zu einem gängigen Ausdruck für Widerstandsfähigkeit und persönliches Wachstum durch Widrigkeiten geworden.",
        explanation: "Dieser Spruch besagt, dass das Überleben schwieriger Erfahrungen Charakter und Widerstandsfähigkeit aufbaut. Jede Herausforderung, die wir überwinden, macht uns besser gerüstet für zukünftige Schwierigkeiten.",
        situations: ["Widrigkeiten überwinden", "Widerstandsfähigkeit aufbauen", "persönliches Wachstum", "Erholung"],
        tags: ["Widerstandsfähigkeit", "Stärke", "Widrigkeiten", "Wachstum"]
      }
    }
  },
  {
    id: '8',
    text: "The journey of a thousand miles begins with one step.",
    reference: "Lao Tzu",
    author: "Lao Tzu",
    type: 'saying',
    context: "This ancient Chinese proverb, attributed to Lao Tzu, emphasizes the importance of taking the first step toward any goal, no matter how daunting it may seem.",
    explanation: "This saying reminds us that even the most ambitious goals are achieved through small, consistent actions. The key is to start, even if the path ahead seems overwhelming.",
    situations: ["starting new projects", "feeling overwhelmed", "goal setting", "procrastination"],
    tags: ["beginnings", "goals", "progress", "action"],
    translations: {
      de: {
        text: "Eine Reise von tausend Meilen beginnt mit einem Schritt.",
        context: "Dieses alte chinesische Sprichwort, das Lao Tzu zugeschrieben wird, betont die Wichtigkeit, den ersten Schritt zu jedem Ziel zu machen, egal wie entmutigend es erscheinen mag.",
        explanation: "Dieser Spruch erinnert uns daran, dass selbst die ehrgeizigsten Ziele durch kleine, konsequente Handlungen erreicht werden. Der Schlüssel ist anzufangen, auch wenn der Weg vor uns überwältigend erscheint.",
        situations: ["neue Projekte beginnen", "sich überfordert fühlen", "Ziele setzen", "Prokrastination"],
        tags: ["Anfänge", "Ziele", "Fortschritt", "Handlung"]
      }
    }
  },
  {
    id: '9',
    text: "Cast all your anxiety on him because he cares for you.",
    reference: "1 Peter 5:7",
    book: "1 Peter",
    chapter: 5,
    verse: 7,
    type: 'bible',
    context: "Peter wrote this letter to encourage Christians facing persecution and hardship, reminding them of God's care and protection.",
    explanation: "This verse offers comfort to those struggling with worry and anxiety. It reminds us that we don't have to carry our burdens alone - God cares deeply about our concerns.",
    situations: ["anxiety", "worry", "stress", "feeling overwhelmed", "mental health", "depression"],
    tags: ["anxiety", "care", "comfort", "trust", "worry", "stress"],
    translations: {
      de: {
        text: "Alle eure Sorge werft auf ihn; denn er sorgt für euch.",
        context: "Petrus schrieb diesen Brief, um Christen zu ermutigen, die Verfolgung und Schwierigkeiten erlebten, und erinnerte sie an Gottes Fürsorge und Schutz.",
        explanation: "Dieser Vers bietet Trost für diejenigen, die mit Sorgen und Ängsten kämpfen. Er erinnert uns daran, dass wir unsere Lasten nicht allein tragen müssen - Gott kümmert sich zutiefst um unsere Sorgen.",
        situations: ["Angst", "Sorgen", "Stress", "sich überfordert fühlen", "psychische Gesundheit", "Depression"],
        tags: ["Angst", "Fürsorge", "Trost", "Vertrauen", "Sorgen", "Stress"]
      }
    }
  },
  {
    id: '10',
    text: "Trust in the LORD with all your heart and lean not on your own understanding.",
    reference: "Proverbs 3:5",
    book: "Proverbs",
    chapter: 3,
    verse: 5,
    type: 'bible',
    context: "This is part of Solomon's wisdom literature, teaching about the importance of trusting God rather than relying solely on human wisdom.",
    explanation: "This verse encourages us to have complete faith in God's guidance, especially when we don't understand the circumstances we're facing. It reminds us that God's wisdom surpasses our limited understanding.",
    situations: ["difficult decisions", "uncertainty", "confusion", "life transitions", "career choices", "relationships"],
    tags: ["trust", "faith", "wisdom", "guidance", "understanding", "decisions"],
    translations: {
      de: {
        text: "Vertraue auf den HERRN von ganzem Herzen und verlass dich nicht auf deinen Verstand.",
        context: "Dies ist Teil von Salomos Weisheitsliteratur, die über die Wichtigkeit lehrt, Gott zu vertrauen, anstatt sich nur auf menschliche Weisheit zu verlassen.",
        explanation: "Dieser Vers ermutigt uns, vollständiges Vertrauen in Gottes Führung zu haben, besonders wenn wir die Umstände, denen wir gegenüberstehen, nicht verstehen. Er erinnert uns daran, dass Gottes Weisheit unser begrenztes Verständnis übersteigt.",
        situations: ["schwierige Entscheidungen", "Ungewissheit", "Verwirrung", "Lebensübergänge", "Berufswahl", "Beziehungen"],
        tags: ["Vertrauen", "Glaube", "Weisheit", "Führung", "Verständnis", "Entscheidungen"]
      }
    }
  },
  {
    id: '11',
    text: "The best time to plant a tree was 20 years ago. The second best time is now.",
    reference: "Chinese Proverb",
    type: 'saying',
    context: "This Chinese proverb emphasizes the importance of taking action now, rather than dwelling on missed opportunities from the past.",
    explanation: "This saying reminds us that while we may have missed opportunities in the past, the present moment is always the right time to start something new. It encourages action over regret.",
    situations: ["procrastination", "regret", "starting over", "new beginnings", "missed opportunities", "taking action"],
    tags: ["action", "timing", "regret", "opportunity", "present moment", "starting"],
    translations: {
      de: {
        text: "Die beste Zeit, einen Baum zu pflanzen, war vor 20 Jahren. Die zweitbeste Zeit ist jetzt.",
        context: "Dieses chinesische Sprichwort betont die Wichtigkeit, jetzt zu handeln, anstatt über verpasste Gelegenheiten aus der Vergangenheit zu grübeln.",
        explanation: "Dieser Spruch erinnert uns daran, dass wir zwar Gelegenheiten in der Vergangenheit verpasst haben mögen, aber der gegenwärtige Moment immer der richtige Zeitpunkt ist, etwas Neues zu beginnen. Er ermutigt zum Handeln statt zum Bedauern.",
        situations: ["Prokrastination", "Bedauern", "neu anfangen", "neue Anfänge", "verpasste Gelegenheiten", "handeln"],
        tags: ["Handlung", "Timing", "Bedauern", "Gelegenheit", "gegenwärtiger Moment", "Anfangen"]
      }
    }
  },
  {
    id: '12',
    text: "Happiness is not something ready made. It comes from your own actions.",
    reference: "Dalai Lama",
    author: "Dalai Lama",
    type: 'quote',
    context: "The Dalai Lama, spiritual leader of Tibet, often speaks about the nature of happiness and how it comes from within through our choices and actions.",
    explanation: "This quote teaches us that happiness is not a destination or something that happens to us, but rather something we create through our daily choices, attitudes, and actions.",
    situations: ["seeking happiness", "depression", "life satisfaction", "personal responsibility", "mindfulness"],
    tags: ["happiness", "actions", "responsibility", "choice", "mindfulness", "inner peace"],
    translations: {
      de: {
        text: "Glück ist nichts Fertiges. Es entsteht durch deine eigenen Handlungen.",
        context: "Der Dalai Lama, spiritueller Führer Tibets, spricht oft über die Natur des Glücks und wie es von innen durch unsere Entscheidungen und Handlungen entsteht.",
        explanation: "Dieses Zitat lehrt uns, dass Glück kein Ziel oder etwas ist, das uns widerfährt, sondern etwas, das wir durch unsere täglichen Entscheidungen, Einstellungen und Handlungen erschaffen.",
        situations: ["Glück suchen", "Depression", "Lebenszufriedenheit", "persönliche Verantwortung", "Achtsamkeit"],
        tags: ["Glück", "Handlungen", "Verantwortung", "Wahl", "Achtsamkeit", "innerer Frieden"]
      }
    }
  },
  {
    id: '13',
    text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
    reference: "Philippians 4:6",
    book: "Philippians",
    chapter: 4,
    verse: 6,
    type: 'bible',
    context: "Paul wrote this letter from prison, yet he speaks about joy and peace. This verse is part of his teaching on how to find peace in difficult circumstances.",
    explanation: "This verse provides a practical approach to dealing with anxiety: instead of worrying, we should pray about our concerns with a thankful heart, trusting God with our needs.",
    situations: ["anxiety", "worry", "prayer", "stress", "thanksgiving", "peace", "difficult times"],
    tags: ["anxiety", "prayer", "thanksgiving", "peace", "worry", "trust"],
    translations: {
      de: {
        text: "Sorgt euch um nichts, sondern in allen Dingen lasst eure Bitten in Gebet und Flehen mit Danksagung vor Gott kundwerden.",
        context: "Paulus schrieb diesen Brief aus dem Gefängnis, dennoch spricht er über Freude und Frieden. Dieser Vers ist Teil seiner Lehre darüber, wie man Frieden in schwierigen Umständen findet.",
        explanation: "Dieser Vers bietet einen praktischen Ansatz im Umgang mit Angst: Anstatt uns zu sorgen, sollten wir mit dankbarem Herzen über unsere Sorgen beten und Gott mit unseren Bedürfnissen vertrauen.",
        situations: ["Angst", "Sorgen", "Gebet", "Stress", "Dankbarkeit", "Frieden", "schwierige Zeiten"],
        tags: ["Angst", "Gebet", "Dankbarkeit", "Frieden", "Sorgen", "Vertrauen"]
      }
    }
  },
  {
    id: '14',
    text: "It is during our darkest moments that we must focus to see the light.",
    reference: "Aristotle",
    author: "Aristotle",
    type: 'quote',
    context: "This quote, often attributed to Aristotle, speaks to the human capacity to find hope and meaning even in the most difficult circumstances.",
    explanation: "This quote reminds us that hope and positivity require intentional focus, especially during difficult times. It's in our darkest moments that we must actively look for the light.",
    situations: ["depression", "difficult times", "loss", "grief", "hopelessness", "despair", "recovery"],
    tags: ["hope", "darkness", "light", "focus", "difficult times", "perseverance"],
    translations: {
      de: {
        text: "In unseren dunkelsten Momenten müssen wir uns darauf konzentrieren, das Licht zu sehen.",
        context: "Dieses Zitat, oft Aristoteles zugeschrieben, spricht über die menschliche Fähigkeit, Hoffnung und Bedeutung auch in den schwierigsten Umständen zu finden.",
        explanation: "Dieses Zitat erinnert uns daran, dass Hoffnung und Positivität bewusste Konzentration erfordern, besonders in schwierigen Zeiten. In unseren dunkelsten Momenten müssen wir aktiv nach dem Licht suchen.",
        situations: ["Depression", "schwierige Zeiten", "Verlust", "Trauer", "Hoffnungslosigkeit", "Verzweiflung", "Erholung"],
        tags: ["Hoffnung", "Dunkelheit", "Licht", "Fokus", "schwierige Zeiten", "Durchhaltevermögen"]
      }
    }
  },
  {
    id: '15',
    text: "Family is not an important thing. It's everything.",
    reference: "Michael J. Fox",
    author: "Michael J. Fox",
    type: 'quote',
    context: "Michael J. Fox, the actor who has battled Parkinson's disease, often speaks about the importance of family support in facing life's challenges.",
    explanation: "This quote emphasizes that family relationships are not just one priority among many, but the foundation that gives meaning and support to everything else in life.",
    situations: ["family relationships", "priorities", "support system", "life values", "relationships"],
    tags: ["family", "relationships", "priorities", "support", "love", "values"],
    translations: {
      de: {
        text: "Familie ist nicht etwas Wichtiges. Sie ist alles.",
        context: "Michael J. Fox, der Schauspieler, der gegen die Parkinson-Krankheit kämpft, spricht oft über die Bedeutung der Familienunterstützung beim Bewältigen von Lebensherausforderungen.",
        explanation: "Dieses Zitat betont, dass Familienbeziehungen nicht nur eine Priorität unter vielen sind, sondern das Fundament, das allem anderen im Leben Bedeutung und Unterstützung gibt.",
        situations: ["Familienbeziehungen", "Prioritäten", "Unterstützungssystem", "Lebenswerte", "Beziehungen"],
        tags: ["Familie", "Beziehungen", "Prioritäten", "Unterstützung", "Liebe", "Werte"]
      }
    }
  },
  {
    id: '16',
    text: "The Lord is my shepherd; I shall not want.",
    reference: "Psalm 23:1",
    book: "Psalms",
    chapter: 23,
    verse: 1,
    type: 'bible',
    context: "This is the opening line of one of the most beloved psalms, written by King David. It expresses complete trust in God's provision and care.",
    explanation: "This verse uses the metaphor of a shepherd caring for sheep to describe God's relationship with His people. It expresses confidence that God will provide for all our needs.",
    situations: ["financial worry", "provision", "trust", "care", "protection", "guidance"],
    tags: ["shepherd", "provision", "care", "trust", "protection", "guidance"],
    translations: {
      de: {
        text: "Der HERR ist mein Hirte, mir wird nichts mangeln.",
        context: "Dies ist die Eröffnungszeile eines der beliebtesten Psalmen, geschrieben von König David. Sie drückt vollständiges Vertrauen in Gottes Versorgung und Fürsorge aus.",
        explanation: "Dieser Vers verwendet die Metapher eines Hirten, der sich um Schafe kümmert, um Gottes Beziehung zu seinem Volk zu beschreiben. Er drückt Vertrauen aus, dass Gott für alle unsere Bedürfnisse sorgen wird.",
        situations: ["finanzielle Sorgen", "Versorgung", "Vertrauen", "Fürsorge", "Schutz", "Führung"],
        tags: ["Hirte", "Versorgung", "Fürsorge", "Vertrauen", "Schutz", "Führung"]
      }
    }
  }
];

export default quotes;