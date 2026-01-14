import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import quotes, { Quote } from '@/mocks/quotes';
import useLanguage from '@/hooks/useLanguage';
import { useAuth } from '@/providers/AuthProvider';

// Enable Convex features
const USE_CONVEX = true;

export default function useQuotes() {
  const [quoteOfTheDay, setQuoteOfTheDay] = useState<Quote | null>(null);
  const [searchResults, setSearchResults] = useState<Quote[]>([]);
  const [allSearchResults, setAllSearchResults] = useState<Quote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [dynamicQuotes, setDynamicQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentLanguage } = useLanguage();
  const { user } = useAuth();

  // Convex queries
  const dailyQuoteData = useQuery(
    api.quotes.getDailyQuote,
    USE_CONVEX ? { language: currentLanguage, userId: user?.id } : "skip"
  );

  const recordHistoryMutation = useMutation(api.quotes.recordQuoteHistory);

  // Load dynamic quotes from storage (for local fallback)
  useEffect(() => {
    loadDynamicQuotes();
  }, []);

  // Get quote of the day when it's loaded from Convex
  useEffect(() => {
    if (dailyQuoteData?.quote) {
      const localizedQuote = applyLocalization(dailyQuoteData.quote, currentLanguage);
      setQuoteOfTheDay(localizedQuote);

      // Record in history if user is logged in
      if (user?.id && dailyQuoteData.quote._id) {
        recordHistoryMutation({
          userId: user.id,
          quoteId: dailyQuoteData.quote._id as any,
        }).catch(console.error);
      }

      // Cache locally
      cacheQuote(localizedQuote);
    }
  }, [dailyQuoteData, currentLanguage, user?.id]);

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

  const cacheQuote = async (quote: Quote) => {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem('quoteOfTheDayDate', today);
      await AsyncStorage.setItem('quoteOfTheDayQuote', JSON.stringify(quote));
    } catch (error) {
      console.error('Error caching quote:', error);
    }
  };

  // Helper function to apply localization to a quote
  const applyLocalization = useCallback((quote: any, language: string): Quote => {
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
      };
    }

    return normalizedQuote;
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
      console.log('Using local fallback for quote of the day');
      const localQuote = fallbackToLocalQuote();

      if (localQuote) {
        setQuoteOfTheDay(localQuote);
        await cacheQuote(localQuote);
      }
    } catch (error) {
      console.error('Error getting quote of the day:', error);
      // Last resort fallback
      const localQuote = fallbackToLocalQuote();
      if (localQuote) {
        setQuoteOfTheDay(localQuote);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentLanguage, applyLocalization, fallbackToLocalQuote, dailyQuoteData]);

  // Search function
  const searchQuotes = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setAllSearchResults([]);
      setHasMoreResults(false);
      return;
    }

    setIsSearching(true);

    try {
      // For now, use local search until Convex search is fully tested
      const localResults = searchLocalQuotes(query);
      const uniqueResults = removeDuplicateQuotes(localResults);

      setAllSearchResults(uniqueResults);
      const initialResults = getInitialResults(uniqueResults);
      setSearchResults(initialResults);
      setHasMoreResults(uniqueResults.length > initialResults.length);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setAllSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentLanguage]);

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
    dynamicQuotes
  };
}
