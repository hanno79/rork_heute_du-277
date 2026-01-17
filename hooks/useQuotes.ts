import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import quotes, { Quote } from '@/mocks/quotes';
import useLanguage from '@/hooks/useLanguage';
import { useAuth } from '@/providers/AuthProvider';

// Enable Convex features
const USE_CONVEX = true;

// Rate limit info type
export interface RateLimitInfo {
  aiSearchCount: number;
  maxSearches: number;
  canUseAI: boolean;
  remaining: number;
}

// Search result type with extra info
export interface SearchResult {
  quotes: Quote[];
  source: 'cached' | 'category' | 'database' | 'ai' | 'insufficient';
  wasAIGenerated: boolean;
  rateLimit: RateLimitInfo | null;
}

export default function useQuotes() {
  const [quoteOfTheDay, setQuoteOfTheDay] = useState<Quote | null>(null);
  const [searchResults, setSearchResults] = useState<Quote[]>([]);
  const [allSearchResults, setAllSearchResults] = useState<Quote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [dynamicQuotes, setDynamicQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [searchSource, setSearchSource] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const { currentLanguage } = useLanguage();
  const { user, tokens } = useAuth();

  // Convex queries and mutations
  const dailyQuoteData = useQuery(
    api.quotes.getDailyQuote,
    USE_CONVEX ? { language: currentLanguage, userId: user?.id } : "skip"
  );

  const recordHistoryMutation = useMutation(api.quotes.recordQuoteHistory);
  const ensureDailyQuoteMutation = useMutation(api.quotes.ensureDailyQuote);
  const performSmartSearchAction = useAction(api.search.performSmartSearch);

  // Get user profile for premium status
  const userProfile = useQuery(
    api.auth.getCurrentUser,
    user?.id ? { userId: user.id } : "skip"
  );
  const isPremium = userProfile?.isPremium === true;

  // Track if we've already triggered ensureDailyQuote to prevent multiple calls
  const [dailyQuoteInitialized, setDailyQuoteInitialized] = useState(false);

  // Load dynamic quotes from storage (for local fallback)
  useEffect(() => {
    loadDynamicQuotes();
  }, []);

  // Get quote of the day when it's loaded from Convex
  // This handles the global daily quote system - same quote for all users
  useEffect(() => {
    const handleDailyQuote = async () => {
      if (!dailyQuoteData) return; // Still loading

      // Case 1: Daily quote exists - use it
      if (dailyQuoteData.quote) {
        const localizedQuote = applyLocalization(dailyQuoteData.quote, currentLanguage);
        setQuoteOfTheDay(localizedQuote);
        setDailyQuoteInitialized(true);

        // Record in history if user is logged in
        if (user?.id && dailyQuoteData.quote._id) {
          recordHistoryMutation({
            userId: user.id,
            quoteId: dailyQuoteData.quote._id as any,
          }).catch(() => {});
        }

        // Cache locally
        cacheQuote(localizedQuote);
        return;
      }

      // Case 2: No daily quote yet - need to select one (first user of the day)
      if (dailyQuoteData.needsSelection && !dailyQuoteInitialized) {
        setDailyQuoteInitialized(true); // Prevent multiple calls

        try {
          const result = await ensureDailyQuoteMutation({
            language: currentLanguage,
          });

          if (result.quote) {
            const localizedQuote = applyLocalization(result.quote, currentLanguage);
            setQuoteOfTheDay(localizedQuote);

            // Record in history if user is logged in
            if (user?.id && result.quote._id) {
              recordHistoryMutation({
                userId: user.id,
                quoteId: result.quote._id as any,
              }).catch(() => {});
            }

            // Cache locally
            cacheQuote(localizedQuote);
          }
        } catch (error) {
          // Fallback to local
          const localQuote = fallbackToLocalQuote();
          if (localQuote) {
            setQuoteOfTheDay(localQuote);
            cacheQuote(localQuote);
          }
        }
      }
    };

    handleDailyQuote();
  }, [dailyQuoteData, currentLanguage, user?.id, dailyQuoteInitialized]);

  // Reset initialized flag when language changes (need to get quote for new language)
  useEffect(() => {
    setDailyQuoteInitialized(false);
  }, [currentLanguage]);

  // Fallback: Get quote from cache or local on mount
  useEffect(() => {
    getQuoteOfTheDay();
  }, [currentLanguage]);

  const loadDynamicQuotes = async () => {
    try {
      const stored = await AsyncStorage.getItem('dynamicQuotes');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDynamicQuotes(parsed);
      }
    } catch (error) {
      // Failed to load dynamic quotes from storage
    }
  };

  const saveDynamicQuotes = async (newQuotes: Quote[]) => {
    try {
      await AsyncStorage.setItem('dynamicQuotes', JSON.stringify(newQuotes));
    } catch (error) {
      // Failed to save dynamic quotes to storage
    }
  };

  const cacheQuote = async (quote: Quote) => {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem('quoteOfTheDayDate', today);
      await AsyncStorage.setItem('quoteOfTheDayQuote', JSON.stringify(quote));
    } catch (error) {
      // Failed to cache quote
    }
  };

  // Helper function to apply localization to a quote
  // Preserves _id for Convex operations (favorites, etc.)
  const applyLocalization = useCallback((quote: any, language: string): Quote & { _id?: string } => {
    if (!quote) return quote;

    // Handle Convex format (camelCase)
    const normalizedQuote: Quote = {
      id: quote._id || quote.id,
      text: quote.text,
      reference: quote.reference || quote.author || '',
      author: quote.author,
      book: quote.book,
      chapter: quote.chapter,
      verse: quote.verse,
      type: quote.category || quote.type || 'quote',
      context: quote.context || '',
      explanation: quote.explanation || '',
      situations: quote.situations || [],
      tags: quote.tags || [],
      translations: quote.translations || {},
      reflectionQuestions: quote.reflectionQuestions,
      practicalTips: quote.practicalTips,
    };

    // Apply translation if available and not English
    if (language !== 'en' && normalizedQuote.translations?.[language]) {
      const translation = normalizedQuote.translations[language];
      return {
        ...normalizedQuote,
        text: translation.text || normalizedQuote.text,
        context: translation.context || normalizedQuote.context,
        explanation: translation.explanation || normalizedQuote.explanation,
        situations: translation.situations || normalizedQuote.situations,
        tags: translation.tags || normalizedQuote.tags,
        reflectionQuestions: translation.reflectionQuestions || normalizedQuote.reflectionQuestions,
        practicalTips: translation.practicalTips || normalizedQuote.practicalTips,
        _id: quote._id,  // Preserve Convex ID for database operations
      };
    }

    // Return with preserved _id for Convex operations
    return {
      ...normalizedQuote,
      _id: quote._id,  // Preserve Convex ID for database operations
    };
  }, []);

  // Fallback to local quotes when API is unavailable
  const fallbackToLocalQuote = useCallback(() => {
    const allQuotes = [...quotes, ...dynamicQuotes];
    if (allQuotes.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * allQuotes.length);
    const quote = allQuotes[randomIndex];

    return applyLocalization(quote, currentLanguage);
  }, [dynamicQuotes, currentLanguage, applyLocalization]);

  // Main function to get quote of the day
  const getQuoteOfTheDay = useCallback(async () => {
    setIsLoading(true);

    try {
      // Check local cache first
      const today = new Date().toDateString();
      const cachedDate = await AsyncStorage.getItem('quoteOfTheDayDate');
      const cachedQuote = await AsyncStorage.getItem('quoteOfTheDayQuote');

      if (cachedDate === today && cachedQuote) {
        const quote = JSON.parse(cachedQuote);
        setQuoteOfTheDay(quote);
        setIsLoading(false);
        return;
      }

      // If Convex is enabled, it will load via useQuery hook
      if (USE_CONVEX && !dailyQuoteData) {
        setIsLoading(false);
        return; // Wait for Convex query
      }

      // Fallback to local quotes
      const localQuote = fallbackToLocalQuote();

      if (localQuote) {
        setQuoteOfTheDay(localQuote);
        await cacheQuote(localQuote);
      }
    } catch (error) {
      // Last resort fallback
      const localQuote = fallbackToLocalQuote();
      if (localQuote) {
        setQuoteOfTheDay(localQuote);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentLanguage, applyLocalization, fallbackToLocalQuote, dailyQuoteData]);

  // Smart search function - uses Convex smartSearch with AI fallback
  // DB-First approach: Check DB for existing quotes before calling AI
  const searchQuotes = useCallback(async (query: string, usePremiumAI: boolean = true) => {
    if (!query.trim()) {
      setSearchResults([]);
      setAllSearchResults([]);
      setHasMoreResults(false);
      setSearchSource('');
      return;
    }

    setIsSearching(true);
    setSearchSource('');

    try {
      if (!USE_CONVEX) {
        // Fallback to local search
        const localResults = searchLocalQuotes(query);
        const uniqueResults = removeDuplicateQuotes(localResults);

        setAllSearchResults(uniqueResults);
        const initialResults = getInitialResults(uniqueResults);
        setSearchResults(initialResults);
        setHasMoreResults(uniqueResults.length > initialResults.length);
        setSearchSource('local');
        return;
      }

      // Use the new performSmartSearch action (DB-first, then AI if needed)
      setIsGeneratingAI(true); // Show loading state

      try {
        // SECURITY: Pass sessionToken instead of userId/isPremium - server validates and derives these
        const result = await performSmartSearchAction({
          query,
          language: currentLanguage,
          sessionToken: tokens?.sessionToken,
        });

        // Process the quotes
        if (result.quotes && result.quotes.length > 0) {
          const normalizedQuotes = result.quotes.map((q: any) => applyLocalization(q, currentLanguage));
          setAllSearchResults(normalizedQuotes);
          setSearchResults(normalizedQuotes.slice(0, 3));
          setHasMoreResults(normalizedQuotes.length > 3);
          setSearchSource(result.source || 'database');

          // Update rate limit info if available
          if (result.rateLimit) {
            setRateLimit(result.rateLimit);
          }

          return;
        }

        // No results from smart search, fall back to local
        const localResults = searchLocalQuotes(query);
        const uniqueResults = removeDuplicateQuotes(localResults);

        setAllSearchResults(uniqueResults);
        const initialResults = getInitialResults(uniqueResults);
        setSearchResults(initialResults);
        setHasMoreResults(uniqueResults.length > initialResults.length);
        setSearchSource('local');
      } catch (error: any) {
        // Check for rate limit error
        if (error.message?.includes('AI_RATE_LIMIT_EXCEEDED')) {
          setRateLimit({
            aiSearchCount: 10,
            maxSearches: 10,
            canUseAI: false,
            remaining: 0,
          });
        }

        // Fall back to local search
        const localResults = searchLocalQuotes(query);
        const uniqueResults = removeDuplicateQuotes(localResults);

        setAllSearchResults(uniqueResults);
        const initialResults = getInitialResults(uniqueResults);
        setSearchResults(initialResults);
        setHasMoreResults(uniqueResults.length > initialResults.length);
        setSearchSource('local');
      }
    } catch (error) {
      // Last resort fallback to local
      const localResults = searchLocalQuotes(query);
      const uniqueResults = removeDuplicateQuotes(localResults);
      setAllSearchResults(uniqueResults);
      setSearchResults(uniqueResults.slice(0, 3));
      setHasMoreResults(uniqueResults.length > 3);
      setSearchSource('local');
    } finally {
      setIsSearching(false);
      setIsGeneratingAI(false);
    }
  }, [currentLanguage, tokens?.sessionToken, applyLocalization, performSmartSearchAction]);

  // Local search function (simplified version)
  const searchLocalQuotes = (query: string): Quote[] => {
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0);
    const allQuotes = [...quotes, ...dynamicQuotes];

    return allQuotes.filter(quote => {
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
  };

  const removeDuplicateQuotes = (quotesToFilter: Quote[]): Quote[] => {
    const seen = new Set<string>();
    return quotesToFilter.filter(quote => {
      if (!quote?.text) return false;
      const normalized = quote.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  };

  const getInitialResults = (results: Quote[]): Quote[] => {
    const bibleVerse = results.find(q => q.type === 'bible');
    const quote = results.find(q => q.type === 'quote');
    const saying = results.find(q => q.type === 'saying');
    const poem = results.find(q => q.type === 'poem');

    const initial: Quote[] = [];
    if (bibleVerse) initial.push(bibleVerse);
    if (quote) initial.push(quote);
    if (saying) initial.push(saying);
    if (poem) initial.push(poem);

    if (initial.length < 3) {
      const remaining = results.filter(r => !initial.includes(r));
      initial.push(...remaining.slice(0, 3 - initial.length));
    }

    return initial.slice(0, 3);
  };

  const loadMoreResults = useCallback(() => {
    const currentIds = new Set(searchResults.map(q => q.id));
    const remainingResults = allSearchResults.filter(q => !currentIds.has(q.id));

    const nextResults = remainingResults.slice(0, 3);
    const updatedResults = [...searchResults, ...nextResults];

    setSearchResults(updatedResults);
    setHasMoreResults(updatedResults.length < allSearchResults.length);
  }, [searchResults, allSearchResults]);

  const getQuoteById = useCallback((id: string): Quote | null => {
    const allQuotes = [...quotes, ...dynamicQuotes];
    const quote = allQuotes.find(q => q.id === id);

    if (!quote) return null;

    return applyLocalization(quote, currentLanguage);
  }, [dynamicQuotes, currentLanguage, applyLocalization]);

  // Force refresh quote of the day
  const refreshQuote = useCallback(async () => {
    await AsyncStorage.removeItem('quoteOfTheDayDate');
    await AsyncStorage.removeItem('quoteOfTheDayQuote');
    await getQuoteOfTheDay();
  }, [getQuoteOfTheDay]);

  return {
    quotes: [...quotes, ...dynamicQuotes],
    quoteOfTheDay,
    searchResults,
    allSearchResults,
    isSearching,
    isLoading: isLoading || (USE_CONVEX && dailyQuoteData === undefined),
    hasMoreResults,
    searchQuotes,
    loadMoreResults,
    getQuoteById,
    refreshQuote,
    dynamicQuotes,
    // New properties for premium search
    rateLimit,
    searchSource,
    isGeneratingAI,
  };
}
