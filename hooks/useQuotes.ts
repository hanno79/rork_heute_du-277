import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import quotes, { Quote } from '@/mocks/quotes';
import useLanguage from '@/hooks/useLanguage';

const USE_AI_FEATURES = false; // Set to true when backend is available

export default function useQuotes() {
  const [quoteOfTheDay, setQuoteOfTheDay] = useState<Quote | null>(null);
  const [searchResults, setSearchResults] = useState<Quote[]>([]);
  const [allSearchResults, setAllSearchResults] = useState<Quote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [dynamicQuotes, setDynamicQuotes] = useState<Quote[]>([]);
  const { currentLanguage } = useLanguage();

  // Load dynamic quotes from storage
  useEffect(() => {
    loadDynamicQuotes();
  }, []);

  // Get a random quote for "Quote of the Day" - prefer new quotes
  useEffect(() => {
    getQuoteOfTheDay();
  }, [currentLanguage, dynamicQuotes]);

  const loadDynamicQuotes = async () => {
    try {
      const stored = await AsyncStorage.getItem('dynamicQuotes');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDynamicQuotes(parsed);
      }
    } catch (error) {
      console.error('Error loading dynamic quotes:', error);
    }
  };

  const saveDynamicQuotes = async (newQuotes: Quote[]) => {
    try {
      await AsyncStorage.setItem('dynamicQuotes', JSON.stringify(newQuotes));
    } catch (error) {
      console.error('Error saving dynamic quotes:', error);
    }
  };

  const getQuoteOfTheDay = async () => {
    try {
      // Check if we already have a quote for today
      const today = new Date().toDateString();
      const storedDate = await AsyncStorage.getItem('quoteOfTheDayDate');
      const storedQuote = await AsyncStorage.getItem('quoteOfTheDayQuote');
      
      if (storedDate === today && storedQuote) {
        const quote = JSON.parse(storedQuote);
        setQuoteOfTheDay(quote);
        return;
      }

      // Try to get a new quote first (only if AI features are enabled)
      if (USE_AI_FEATURES) {
        const newQuote = await generateDailyQuote();
        if (newQuote) {
          setQuoteOfTheDay(newQuote);
          await AsyncStorage.setItem('quoteOfTheDayDate', today);
          await AsyncStorage.setItem('quoteOfTheDayQuote', JSON.stringify(newQuote));
          return;
        }
      }

      // Fallback to existing quotes
      const allQuotes = [...quotes, ...dynamicQuotes];
      const randomIndex = Math.floor(Math.random() * allQuotes.length);
      const selectedQuote = allQuotes[randomIndex];
      
      // Apply translations to the quote of the day
      const localizedQuote = selectedQuote.translations?.[currentLanguage];
      const finalQuote = localizedQuote ? {
        ...selectedQuote,
        context: localizedQuote.context,
        explanation: localizedQuote.explanation,
        situations: localizedQuote.situations,
        tags: localizedQuote.tags,
      } : selectedQuote;
      
      setQuoteOfTheDay(finalQuote);
      await AsyncStorage.setItem('quoteOfTheDayDate', today);
      await AsyncStorage.setItem('quoteOfTheDayQuote', JSON.stringify(finalQuote));
    } catch (error) {
      console.error('Error getting quote of the day:', error);
      // Fallback to static quote
      const randomIndex = Math.floor(Math.random() * quotes.length);
      setQuoteOfTheDay(quotes[randomIndex]);
    }
  };

  const generateDailyQuote = async (): Promise<Quote | null> => {
    if (!USE_AI_FEATURES) {
      console.log('AI features disabled, skipping daily quote generation');
      return null;
    }
    
    try {
      console.log('Generating new daily quote...');
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a wise quote curator for the app "Heute Du.". Generate a meaningful quote, Bible verse, or saying for today. 

Respond with a JSON object containing:
- text: the quote/verse/saying text
- reference: author or Bible reference
- type: "bible", "quote", "saying", or "poem"
- context: brief background context
- explanation: why this is meaningful
- situations: array of 3-4 life situations where this applies
- tags: array of 3-4 relevant tags
- author: if it's a quote (optional)
- book/chapter/verse: if it's a Bible verse (optional)

Language: ${currentLanguage === 'de' ? 'German' : 'English'}

Make it inspiring and relevant for daily life. Avoid repeating common quotes.`
            },
            {
              role: 'user',
              content: 'Generate a meaningful quote for today.'
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate quote');
      }

      const result = await response.json();
      let completion = result.completion;
      
      console.log('Daily quote raw response:', completion);
      
      // Clean up markdown formatting if present
      if (completion.includes('```json')) {
        completion = completion.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      
      // Remove any text before the first [ or {
      const jsonStart = Math.min(
        completion.indexOf('[') !== -1 ? completion.indexOf('[') : Infinity,
        completion.indexOf('{') !== -1 ? completion.indexOf('{') : Infinity
      );
      
      if (jsonStart !== Infinity) {
        completion = completion.substring(jsonStart);
      }
      
      // Remove any text after the last ] or }
      const jsonEnd = Math.max(
        completion.lastIndexOf(']'),
        completion.lastIndexOf('}')
      );
      
      if (jsonEnd !== -1) {
        completion = completion.substring(0, jsonEnd + 1);
      }
      
      console.log('Cleaned daily quote response:', completion);
      
      // Try to parse JSON
      let quoteData;
      try {
        quoteData = JSON.parse(completion);
      } catch (parseError) {
        console.error('JSON parse error in daily quote:', parseError);
        console.error('Failed to parse:', completion);
        throw new Error('Invalid JSON response from AI for daily quote');
      }
      
      const newQuote: Quote = {
        id: `dynamic_${Date.now()}`,
        text: quoteData.text,
        reference: quoteData.reference,
        author: quoteData.author,
        book: quoteData.book,
        chapter: quoteData.chapter,
        verse: quoteData.verse,
        type: quoteData.type || 'quote',
        context: quoteData.context,
        explanation: quoteData.explanation,
        situations: quoteData.situations || [],
        tags: quoteData.tags || [],
        translations: {}
      };

      // Add to dynamic quotes collection
      const updatedDynamicQuotes = [newQuote, ...dynamicQuotes].slice(0, 100); // Keep only last 100
      setDynamicQuotes(updatedDynamicQuotes);
      await saveDynamicQuotes(updatedDynamicQuotes);

      console.log('Generated new quote:', newQuote);
      return newQuote;
    } catch (error) {
      console.error('Error generating daily quote:', error);
      return null;
    }
  };

  // Enhanced search function with AI-powered search and fallback to local search
  const searchQuotes = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      let combinedResults: Quote[] = [];
      
      if (USE_AI_FEATURES) {
        // First try to find new relevant quotes using AI
        const aiResults = await searchWithAI(query);
        
        // Then search in existing quotes
        const localResults = searchLocalQuotes(query);
        
        // Combine results, prioritizing AI results
        combinedResults = [...aiResults, ...localResults];
      } else {
        // Only use local search when AI features are disabled
        combinedResults = searchLocalQuotes(query);
      }
      
      // Remove duplicates based on text similarity
      const uniqueResults = removeDuplicateQuotes(combinedResults);
      
      setAllSearchResults(uniqueResults);
      const initialResults = getInitialResults(uniqueResults);
      setSearchResults(initialResults);
      setHasMoreResults(uniqueResults.length > initialResults.length);
    } catch (error) {
      console.error('Error in search, falling back to local search:', error);
      // Fallback to local search only
      const localResults = searchLocalQuotes(query);
      setAllSearchResults(localResults);
      const initialResults = getInitialResults(localResults);
      setSearchResults(initialResults);
      setHasMoreResults(localResults.length > initialResults.length);
    } finally {
      setIsSearching(false);
    }
  }, [currentLanguage, dynamicQuotes]);

  const searchWithAI = async (query: string): Promise<Quote[]> => {
    if (!USE_AI_FEATURES) {
      console.log('AI features disabled, skipping AI search');
      return [];
    }
    
    try {
      console.log('Searching for new quotes with AI for query:', query);
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a wise quote curator for the app "Heute Du.". Find 3 meaningful and relevant quotes, Bible verses, or sayings that match the user's search query.

For each result, respond with a JSON array containing objects with:
- text: the quote/verse/saying text
- reference: author or Bible reference
- type: "bible", "quote", "saying", or "poem"
- context: brief background context
- explanation: why this is relevant to the query
- situations: array of 3-4 life situations where this applies
- tags: array of 3-4 relevant tags
- author: if it's a quote (optional)
- book/chapter/verse: if it's a Bible verse (optional)

Language: ${currentLanguage === 'de' ? 'German' : 'English'}

Make them diverse (try to include one Bible verse, one famous quote, and one saying/proverb if possible). Focus on quality and relevance over quantity.`
            },
            {
              role: 'user',
              content: `Find quotes related to: ${query}`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('AI search failed');
      }

      const result = await response.json();
      let completion = result.completion;
      
      console.log('AI search raw response:', completion);
      
      // Clean up markdown formatting if present
      if (completion.includes('```json')) {
        completion = completion.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      
      // Remove any text before the first [ or {
      const jsonStart = Math.min(
        completion.indexOf('[') !== -1 ? completion.indexOf('[') : Infinity,
        completion.indexOf('{') !== -1 ? completion.indexOf('{') : Infinity
      );
      
      if (jsonStart !== Infinity) {
        completion = completion.substring(jsonStart);
      }
      
      // Remove any text after the last ] or }
      const jsonEnd = Math.max(
        completion.lastIndexOf(']'),
        completion.lastIndexOf('}')
      );
      
      if (jsonEnd !== -1) {
        completion = completion.substring(0, jsonEnd + 1);
      }
      
      console.log('Cleaned AI search response:', completion);
      
      // Try to parse JSON
      let quotesData;
      try {
        quotesData = JSON.parse(completion);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse:', completion);
        throw new Error('Invalid JSON response from AI');
      }
      
      // Ensure we have an array
      if (!Array.isArray(quotesData)) {
        if (typeof quotesData === 'object' && quotesData !== null) {
          quotesData = [quotesData];
        } else {
          throw new Error('AI response is not a valid array or object');
        }
      }
      
      const aiQuotes: Quote[] = quotesData.map((quoteData: any, index: number) => ({
        id: `ai_${Date.now()}_${index}`,
        text: quoteData.text,
        reference: quoteData.reference,
        author: quoteData.author,
        book: quoteData.book,
        chapter: quoteData.chapter,
        verse: quoteData.verse,
        type: quoteData.type || 'quote',
        context: quoteData.context,
        explanation: quoteData.explanation,
        situations: quoteData.situations || [],
        tags: quoteData.tags || [],
        translations: {}
      }));

      // Add to dynamic quotes collection for future use
      const updatedDynamicQuotes = [...aiQuotes, ...dynamicQuotes].slice(0, 200); // Keep only last 200
      setDynamicQuotes(updatedDynamicQuotes);
      await saveDynamicQuotes(updatedDynamicQuotes);

      console.log('Found AI quotes:', aiQuotes.length);
      return aiQuotes;
    } catch (error) {
      console.error('Error in AI search:', error);
      return [];
    }
  };

  const removeDuplicateQuotes = (quotes: Quote[]): Quote[] => {
    const seen = new Set<string>();
    return quotes.filter(quote => {
      // Create a normalized version for comparison
      const normalized = quote.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  };

  const searchLocalQuotes = (query: string): Quote[] => {
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0);
    const allQuotes = [...quotes, ...dynamicQuotes];
      
      // Define synonyms and related terms for better matching
      const synonymMap: { [key: string]: string[] } = {
        // German synonyms
        'liebe': ['lieben', 'zuneigung', 'herz', 'gefühl', 'romantik', 'beziehung', 'partner'],
        'hoffnung': ['hoffen', 'zuversicht', 'optimismus', 'vertrauen', 'glaube', 'zukunft'],
        'kraft': ['stärke', 'macht', 'energie', 'mut', 'stark', 'mächtig'],
        'angst': ['furcht', 'sorge', 'panik', 'ängstlich', 'beunruhigung'],
        'erfolg': ['gelingen', 'triumph', 'sieg', 'erfolgreich', 'gewinn'],
        'freude': ['glück', 'fröhlichkeit', 'heiterkeit', 'vergnügen', 'freuen'],
        'trauer': ['kummer', 'leid', 'schmerz', 'verlust', 'traurig'],
        'arbeit': ['job', 'beruf', 'karriere', 'arbeiten', 'beschäftigung'],
        'familie': ['eltern', 'kinder', 'verwandte', 'angehörige'],
        'freunde': ['freundschaft', 'kameraden', 'begleiter'],
        'gott': ['herr', 'jesus', 'christus', 'glaube', 'religion', 'spirituell'],
        'leben': ['existenz', 'dasein', 'lebendig'],
        'tod': ['sterben', 'ende', 'verlust'],
        'gerechtigkeit': ['recht', 'fairness', 'gleichberechtigung'],
        'frieden': ['ruhe', 'harmonie', 'gelassenheit'],
        'weisheit': ['klugheit', 'verstand', 'intelligenz', 'wissen'],
        'mut': ['tapferkeit', 'courage', 'bravour', 'kühnheit'],
        'geduld': ['ausdauer', 'beharrlichkeit', 'warten'],
        'vergebung': ['verzeihen', 'entschuldigung', 'gnade'],
        'dankbarkeit': ['dank', 'anerkennung', 'wertschätzung'],
        // English synonyms
        'love': ['affection', 'heart', 'romance', 'relationship', 'care'],
        'hope': ['optimism', 'faith', 'trust', 'future', 'belief'],
        'strength': ['power', 'force', 'energy', 'courage', 'strong'],
        'fear': ['anxiety', 'worry', 'panic', 'afraid', 'scared'],
        'success': ['achievement', 'triumph', 'victory', 'win'],
        'joy': ['happiness', 'delight', 'pleasure', 'cheerfulness'],
        'sadness': ['sorrow', 'grief', 'pain', 'loss', 'sad'],
        'work': ['job', 'career', 'employment', 'profession'],
        'family': ['parents', 'children', 'relatives'],
        'friends': ['friendship', 'companions', 'buddies'],
        'god': ['lord', 'jesus', 'christ', 'faith', 'religion', 'spiritual'],
        'life': ['existence', 'living', 'alive'],
        'death': ['dying', 'end', 'loss'],
        'justice': ['fairness', 'equality', 'right'],
        'peace': ['calm', 'harmony', 'serenity'],
        'wisdom': ['knowledge', 'intelligence', 'understanding'],
        'courage': ['bravery', 'boldness', 'valor'],
        'patience': ['endurance', 'persistence', 'waiting'],
        'forgiveness': ['pardon', 'mercy', 'grace'],
        'gratitude': ['thankfulness', 'appreciation', 'thanks']
      };
      
      // Function to get all related terms for a word
      const getRelatedTerms = (word: string): string[] => {
        const related = [word];
        for (const [key, synonyms] of Object.entries(synonymMap)) {
          if (key === word || synonyms.includes(word)) {
            related.push(key, ...synonyms);
          }
        }
        return [...new Set(related)];
      };
      
  // Function to calculate relevance score
  const calculateRelevanceScore = (quote: Quote): number => {
    let score = 0;
    const localizedQuote = quote.translations?.[currentLanguage];
        
        // Get all searchable text
        const textToSearch = [
          quote.text,
          localizedQuote?.text || '',
          quote.context,
          localizedQuote?.context || '',
          quote.explanation,
          localizedQuote?.explanation || '',
          quote.author || '',
          quote.reference,
          ...(localizedQuote?.situations || quote.situations),
          ...(localizedQuote?.tags || quote.tags)
        ].join(' ').toLowerCase();
        
        // Check each query word and its synonyms
        queryWords.forEach(queryWord => {
          const relatedTerms = getRelatedTerms(queryWord);
          
          relatedTerms.forEach(term => {
            // Exact match gets highest score
            if (textToSearch.includes(term)) {
              if (term === queryWord) {
                score += 10; // Exact match
              } else {
                score += 5; // Synonym match
              }
            }
            
            // Partial match gets lower score
            const words = textToSearch.split(/\s+/);
            words.forEach(word => {
              if (word.includes(term) || term.includes(word)) {
                if (term === queryWord) {
                  score += 3; // Partial exact match
                } else {
                  score += 1; // Partial synonym match
                }
              }
            });
          });
        });
        
        // Boost score for matches in important fields
        const importantFields = [
          ...(localizedQuote?.situations || quote.situations),
          ...(localizedQuote?.tags || quote.tags)
        ];
        
        importantFields.forEach(field => {
          queryWords.forEach(queryWord => {
            const relatedTerms = getRelatedTerms(queryWord);
            relatedTerms.forEach(term => {
              if (field.toLowerCase().includes(term)) {
                score += 15; // High boost for situation/tag matches
              }
            });
          });
        });
        
    return score;
  };
      
    // Calculate scores and filter results
    const scoredResults = allQuotes
      .map(quote => ({
        quote,
        score: calculateRelevanceScore(quote)
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(result => result.quote);
    
    // If no results with the enhanced search, fall back to simple contains search
    let results = scoredResults;
    if (results.length === 0) {
      results = allQuotes.filter(quote => {
        const localizedQuote = quote.translations?.[currentLanguage];
        const allText = [
          quote.text,
          localizedQuote?.text || '',
          quote.context,
          localizedQuote?.context || '',
          quote.explanation,
          localizedQuote?.explanation || '',
          quote.author || '',
          quote.reference,
          ...(localizedQuote?.situations || quote.situations),
          ...(localizedQuote?.tags || quote.tags)
        ].join(' ').toLowerCase();
        
        return queryWords.some(word => allText.includes(word));
      });
    }
    
    return results;
  };

  // Function to get initial 3 results (one of each type)
  const getInitialResults = (results: Quote[]): Quote[] => {
    const bibleVerse = results.find(q => q.type === 'bible');
    const quote = results.find(q => q.type === 'quote');
    const saying = results.find(q => q.type === 'saying');
    const poem = results.find(q => q.type === 'poem');
    
    const initial: Quote[] = [];
    
    // Add one of each type if available
    if (bibleVerse) initial.push(bibleVerse);
    if (quote) initial.push(quote);
    if (saying) initial.push(saying);
    if (poem) initial.push(poem);
    
    // If we have less than 3, fill with remaining results
    if (initial.length < 3) {
      const remaining = results.filter(r => !initial.includes(r));
      const needed = 3 - initial.length;
      initial.push(...remaining.slice(0, needed));
    }
    
    return initial.slice(0, 3);
  };

  // Function to load more results
  const loadMoreResults = useCallback(() => {
    const currentIds = new Set(searchResults.map(q => q.id));
    const remainingResults = allSearchResults.filter(q => !currentIds.has(q.id));
    
    // Get next 3 results
    const nextResults = remainingResults.slice(0, 3);
    const updatedResults = [...searchResults, ...nextResults];
    
    setSearchResults(updatedResults);
    setHasMoreResults(updatedResults.length < allSearchResults.length);
  }, [searchResults, allSearchResults]);

  const getQuoteById = useCallback((id: string) => {
    const allQuotes = [...quotes, ...dynamicQuotes];
    const quote = allQuotes.find(quote => quote.id === id);

    if (!quote) return null;

    // Apply localization if available
    const localizedQuote = quote.translations?.[currentLanguage];
    if (localizedQuote && currentLanguage !== 'en') {
      return {
        ...quote,
        text: localizedQuote.text,
        context: localizedQuote.context,
        explanation: localizedQuote.explanation,
        situations: localizedQuote.situations,
        tags: localizedQuote.tags,
        reflectionQuestions: localizedQuote.reflectionQuestions || quote.reflectionQuestions,
        practicalTips: localizedQuote.practicalTips || quote.practicalTips,
      };
    }

    return quote;
  }, [dynamicQuotes, currentLanguage]);

  return {
    quotes: [...quotes, ...dynamicQuotes],
    quoteOfTheDay,
    searchResults,
    allSearchResults,
    isSearching,
    hasMoreResults,
    searchQuotes,
    loadMoreResults,
    getQuoteById,
    dynamicQuotes
  };
}