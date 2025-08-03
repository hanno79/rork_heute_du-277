import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Quote } from '@/mocks/quotes';
import quotes from '@/mocks/quotes';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import useLanguage from '@/hooks/useLanguage';

const FAVORITES_KEY = 'favorites';
const USE_SUPABASE = true;

// Helper function to check if user ID is a valid UUID (Supabase user)
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Helper function to determine if we should use Supabase for this user
const shouldUseSupabase = (user: any): boolean => {
  return USE_SUPABASE && user && isValidUUID(user.id);
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

  // Fallback: create quote from basic Supabase data
  return {
    id: basicQuoteData.id,
    text: basicQuoteData.text,
    reference: basicQuoteData.source || '',
    author: basicQuoteData.author || '',
    book: '',
    chapter: 0,
    verse: 0,
    type: (basicQuoteData.category || 'quote') as 'bible' | 'quote' | 'saying' | 'poem',
    context: '',
    explanation: '',
    situations: [],
    tags: [],
    translations: {}
  } as Quote;
};

export const [FavoritesProvider, useFavorites] = createContextHook(() => {
  const [favorites, setFavorites] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { user, isAuthenticated } = useAuth();
  const { currentLanguage } = useLanguage();

  useEffect(() => {
    if (isAuthenticated && user) {
      loadFavorites();
    } else {
      setFavorites([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user, currentLanguage]); // Reload when language changes

  const testSupabaseConnection = async () => {
    try {
      console.log('Testing Supabase connection...');
      const { data, error } = await supabase.from('quotes').select('id').limit(1);
      if (error) {
        console.error('Supabase connection test failed:', error);
        return false;
      }
      console.log('Supabase connection test successful, found quotes:', data?.length || 0);
      return true;
    } catch (error) {
      console.error('Supabase connection test error:', error);
      return false;
    }
  };

  const loadFavorites = async () => {
    if (!user || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      if (shouldUseSupabase(user)) {
        console.log('Loading favorites from Supabase for UUID user:', user.id);
        
        // Test connection first
        const connectionOk = await testSupabaseConnection();
        if (!connectionOk) {
          console.log('Supabase connection failed, falling back to AsyncStorage');
          await loadFavoritesFromStorage();
          return;
        }
        const { data, error } = await supabase
          .from('user_favorites')
          .select(`
            id,
            created_at,
            quotes (
              id,
              text,
              author,
              source,
              category,
              language,
              is_premium
            )
          `)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error loading favorites from Supabase:', error);
          // If it's a UUID error, this user should use AsyncStorage
          if (error.message?.includes('invalid input syntax for type uuid')) {
            console.log('UUID error detected, switching to AsyncStorage for this user');
          }
          // Fallback to AsyncStorage
          await loadFavoritesFromStorage();
        } else {
          const favoritesData = data?.map(fav => {
            const quote = fav.quotes as any;
            if (!quote) {
              console.warn('Quote data missing for favorite:', fav.id);
              return null;
            }

            // Get complete quote data from mocks with localization
            const completeQuote = getCompleteQuoteData(quote.id, quote, currentLanguage);
            console.log('Complete localized quote data for', quote.id, 'in', currentLanguage, ':', completeQuote.situations, completeQuote.tags);

            return completeQuote;
          }).filter(Boolean) || [];

          console.log('Loaded favorites from Supabase with complete data:', favoritesData.length);
          setFavorites(favoritesData as Quote[]);
        }
      } else {
        console.log('Loading favorites from AsyncStorage for mock user:', user.id);
        await loadFavoritesFromStorage();
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      await loadFavoritesFromStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const loadFavoritesFromStorage = async () => {
    try {
      console.log('Loading favorites from AsyncStorage...');
      // Use user-specific key for mock users
      const storageKey = user ? `${FAVORITES_KEY}_${user.id}` : FAVORITES_KEY;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const parsedFavorites = JSON.parse(stored);
        console.log('Loaded favorites from storage:', parsedFavorites.length);

        // Apply localization to stored favorites
        const localizedFavorites = parsedFavorites.map((favorite: Quote) => {
          return getCompleteQuoteData(favorite.id, favorite, currentLanguage);
        });

        setFavorites(localizedFavorites);
      } else {
        console.log('No favorites found in storage');
        setFavorites([]);
      }
    } catch (error) {
      console.error('Error loading favorites from storage:', error);
      setFavorites([]);
    }
  };

  const saveFavoritesToStorage = async (newFavorites: Quote[]) => {
    try {
      console.log('Saving favorites to AsyncStorage:', newFavorites.length);
      // Use user-specific key for mock users
      const storageKey = user ? `${FAVORITES_KEY}_${user.id}` : FAVORITES_KEY;
      await AsyncStorage.setItem(storageKey, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const addToFavorites = async (quote: Quote) => {
    if (!user || !isAuthenticated) {
      console.log('User not authenticated, cannot add to favorites');
      return;
    }

    console.log('Adding quote to favorites:', quote.id);

    if (shouldUseSupabase(user)) {
      try {
        console.log('Using Supabase for UUID user:', user.id);
        // First, ensure the quote exists in the quotes table
        const { data: existingQuote, error: selectError } = await supabase
          .from('quotes')
          .select('id')
          .eq('id', quote.id)
          .single();

        if (selectError && selectError.code === 'PGRST116') {
          // Quote doesn't exist, insert it first
          console.log('Quote not found in database, inserting:', quote.id);
          const { error: quoteError } = await supabase
            .from('quotes')
            .insert({
              id: quote.id,
              text: quote.text,
              author: quote.author || '',
              source: quote.reference || '',
              category: quote.type || 'quote',
              language: 'de',
              is_premium: false,
            });

          if (quoteError) {
            console.error('Error inserting quote:', quoteError);
            // Fallback to local storage
            const newFavorites = [...favorites, quote];
            await saveFavoritesToStorage(newFavorites);
            return;
          }
          console.log('Quote inserted successfully:', quote.id);
        } else if (selectError) {
          console.error('Error checking quote existence:', selectError);
          // Fallback to local storage
          const newFavorites = [...favorites, quote];
          await saveFavoritesToStorage(newFavorites);
          return;
        }

        // Check if already in favorites to avoid duplicates
        const { data: existingFavorite } = await supabase
          .from('user_favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('quote_id', quote.id)
          .single();

        if (existingFavorite) {
          console.log('Quote already in favorites:', quote.id);
          return;
        }

        // Add to user favorites
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            quote_id: quote.id,
          });

        if (error) {
          console.error('Error adding to favorites:', error);
          // Fallback to local storage
          const newFavorites = [...favorites, quote];
          await saveFavoritesToStorage(newFavorites);
        } else {
          console.log('Successfully added to favorites in Supabase:', quote.id);
          // Update local state
          setFavorites(prev => [...prev, quote]);
          // Also reload favorites to ensure consistency
          setTimeout(() => loadFavorites(), 500);
        }
      } catch (error) {
        console.error('Error adding to favorites:', error);
        const newFavorites = [...favorites, quote];
        await saveFavoritesToStorage(newFavorites);
      }
    } else {
      console.log('Using AsyncStorage for mock user:', user.id);
      const newFavorites = [...favorites, quote];
      await saveFavoritesToStorage(newFavorites);
    }
  };

  const removeFromFavorites = async (quoteId: string) => {
    if (!user || !isAuthenticated) {
      console.log('User not authenticated, cannot remove from favorites');
      return;
    }

    console.log('Removing quote from favorites:', quoteId);

    if (shouldUseSupabase(user)) {
      try {
        console.log('Using Supabase for UUID user:', user.id);
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('quote_id', quoteId);

        if (error) {
          console.error('Error removing from favorites:', error);
          // Fallback to local storage
          const newFavorites = favorites.filter(fav => fav.id !== quoteId);
          await saveFavoritesToStorage(newFavorites);
        } else {
          console.log('Successfully removed from favorites in Supabase:', quoteId);
          // Update local state
          setFavorites(prev => prev.filter(fav => fav.id !== quoteId));
          // Also reload favorites to ensure consistency
          setTimeout(() => loadFavorites(), 500);
        }
      } catch (error) {
        console.error('Error removing from favorites:', error);
        const newFavorites = favorites.filter(fav => fav.id !== quoteId);
        await saveFavoritesToStorage(newFavorites);
      }
    } else {
      console.log('Using AsyncStorage for mock user:', user.id);
      const newFavorites = favorites.filter(fav => fav.id !== quoteId);
      await saveFavoritesToStorage(newFavorites);
    }
  };

  const isFavorite = (quoteId: string): boolean => {
    return favorites.some(fav => fav.id === quoteId);
  };

  const toggleFavorite = async (quote: Quote) => {
    console.log('Toggling favorite for quote:', quote.id);
    if (isFavorite(quote.id)) {
      await removeFromFavorites(quote.id);
      return false;
    } else {
      await addToFavorites(quote);
      return true;
    }
  };

  return {
    favorites,
    isLoading,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    toggleFavorite,
    reloadFavorites: loadFavorites,
    testSupabaseConnection,
  };
});