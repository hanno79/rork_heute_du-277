import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Quote } from '@/mocks/quotes';
import quotes from '@/mocks/quotes';
import { useAuth } from '@/providers/AuthProvider';
import useLanguage from '@/hooks/useLanguage';

const FAVORITES_KEY = 'favorites';
const USE_CONVEX = true;

// Helper to check if a quote has a valid Convex ID
const hasConvexId = (quote: any): boolean => {
  // Convex IDs are typically longer and don't follow UUID format
  // Mock IDs follow UUID format like "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  const id = quote._id || quote.id;
  if (!id) return false;

  // Check if it's a UUID (mock ID format)
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (uuidPattern.test(id)) return false;

  // If it has _id property, it's likely a Convex quote
  return !!quote._id;
};

// Helper function to get complete quote data from mocks with localization
const getCompleteQuoteData = (quoteId: string, basicQuoteData: any, currentLanguage: string): Quote => {
  // Try to find the complete quote in mocks first
  const mockQuote = quotes.find(q => q.id === quoteId);

  if (mockQuote) {
    // Apply localization if available
    const localizedQuote = mockQuote.translations?.[currentLanguage];

    if (localizedQuote && currentLanguage !== 'en') {
      // Return localized version
      return {
        ...mockQuote,
        text: localizedQuote.text,
        context: localizedQuote.context,
        explanation: localizedQuote.explanation,
        situations: localizedQuote.situations,
        tags: localizedQuote.tags,
      };
    }

    // Return the complete mock quote data (English or no translation available)
    return mockQuote;
  }

  // Fallback: create quote from basic Convex data
  return {
    id: basicQuoteData._id || basicQuoteData.id,
    text: basicQuoteData.text,
    reference: basicQuoteData.reference || '',
    author: basicQuoteData.author || '',
    book: '',
    chapter: 0,
    verse: 0,
    type: (basicQuoteData.category || 'quote') as 'bible' | 'quote' | 'saying' | 'poem',
    context: basicQuoteData.context || '',
    explanation: basicQuoteData.explanation || '',
    situations: basicQuoteData.situations || [],
    tags: basicQuoteData.tags || [],
    translations: basicQuoteData.translations || {}
  } as Quote;
};

export const [FavoritesProvider, useFavorites] = createContextHook(() => {
  const [favorites, setFavorites] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { user, isAuthenticated, tokens } = useAuth();
  const { currentLanguage } = useLanguage();

  // SECURITY: Get session token for API authorization
  const sessionToken = tokens?.sessionToken || '';

  // Convex queries and mutations
  // SECURITY: Session token is required for all favorites operations
  const convexFavorites = useQuery(
    api.quotes.getFavorites,
    USE_CONVEX && user?.id && sessionToken ? { userId: user.id, sessionToken } : "skip"
  );
  const addFavoriteMutation = useMutation(api.quotes.addFavorite);
  const removeFavoriteMutation = useMutation(api.quotes.removeFavorite);

  // Load favorites from Convex or AsyncStorage
  useEffect(() => {
    if (isAuthenticated && user) {
      if (USE_CONVEX) {
        // Convex is being used
        if (convexFavorites !== undefined) {
          // Query has completed - process the results
          const processedFavorites = convexFavorites.favorites
            .map((quote: any) => getCompleteQuoteData(quote._id, quote, currentLanguage))
            .filter(Boolean) as Quote[];

          setFavorites(processedFavorites);
          setIsLoading(false);
        }
        // If convexFavorites === undefined, the query is still loading (isLoading stays true)
      } else {
        // Load from AsyncStorage
        loadFavoritesFromStorage();
      }
    } else {
      // Not authenticated
      setFavorites([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user, currentLanguage, convexFavorites]);

  const loadFavoritesFromStorage = async () => {
    try {
      const storageKey = user ? `${FAVORITES_KEY}_${user.id}` : FAVORITES_KEY;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const parsedFavorites = JSON.parse(stored);
        const localizedFavorites = parsedFavorites.map((favorite: Quote) => {
          return getCompleteQuoteData(favorite.id, favorite, currentLanguage);
        });
        setFavorites(localizedFavorites);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      setFavorites([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFavoritesToStorage = async (newFavorites: Quote[]) => {
    try {
      const storageKey = user ? `${FAVORITES_KEY}_${user.id}` : FAVORITES_KEY;
      await AsyncStorage.setItem(storageKey, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      // Log storage error for debugging (no sensitive data)
      console.error('[useFavorites] saveFavoritesToStorage failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        favoritesCount: newFavorites.length,
        hasUser: !!user,
      });
    }
  };

  const addToFavorites = async (quote: Quote) => {
    if (!user || !isAuthenticated || !sessionToken) {
      return;
    }

    const quoteWithId = quote as any;
    const convexId = quoteWithId._id;

    // Check if the quote has a valid Convex ID
    if (USE_CONVEX && hasConvexId(quoteWithId)) {
      try {
        // SECURITY: Include session token for authorization
        await addFavoriteMutation({
          userId: user.id,
          quoteId: convexId,
          sessionToken,
        });
      } catch (error) {
        // Fallback to local storage
        const newFavorites = [...favorites, quote];
        await saveFavoritesToStorage(newFavorites);
      }
    } else {
      // Mock quote without Convex ID - use local storage
      const newFavorites = [...favorites, quote];
      await saveFavoritesToStorage(newFavorites);
    }
  };

  const removeFromFavorites = async (quote: Quote) => {
    if (!user || !isAuthenticated || !sessionToken) {
      return;
    }

    const quoteWithId = quote as any;
    const convexId = quoteWithId._id;

    // Check if the quote has a valid Convex ID
    if (USE_CONVEX && hasConvexId(quoteWithId)) {
      try {
        // SECURITY: Include session token for authorization
        await removeFavoriteMutation({
          userId: user.id,
          quoteId: convexId,
          sessionToken,
        });
      } catch (error) {
        // Fallback to local storage
        const newFavorites = favorites.filter(fav => fav.id !== quote.id);
        await saveFavoritesToStorage(newFavorites);
      }
    } else {
      // Mock quote without Convex ID - use local storage
      const newFavorites = favorites.filter(fav => fav.id !== quote.id);
      await saveFavoritesToStorage(newFavorites);
    }
  };

  const isFavorite = (quoteId: string): boolean => {
    // Check by both id and _id
    return favorites.some(fav => fav.id === quoteId || (fav as any)._id === quoteId);
  };

  const toggleFavorite = async (quote: Quote): Promise<{ success: boolean; wasAdded?: boolean; requiresLogin?: boolean }> => {
    // Check if user is authenticated
    if (!isAuthenticated || !user) {
      return { success: false, requiresLogin: true };
    }

    const quoteWithId = quote as any;

    if (isFavorite(quote.id) || (quoteWithId._id && isFavorite(quoteWithId._id))) {
      await removeFromFavorites(quote);
      return { success: true, wasAdded: false };
    } else {
      await addToFavorites(quote);
      return { success: true, wasAdded: true };
    }
  };

  const reloadFavorites = async () => {
    if (USE_CONVEX && user?.id) {
      // Convex will automatically reload via useQuery
      return;
    } else {
      await loadFavoritesFromStorage();
    }
  };

  return {
    favorites,
    isLoading: isLoading || (USE_CONVEX && convexFavorites === undefined),
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    toggleFavorite,
    reloadFavorites,
  };
});
