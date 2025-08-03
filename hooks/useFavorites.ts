import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Quote } from '@/mocks/quotes';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

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

export const [FavoritesProvider, useFavorites] = createContextHook(() => {
  const [favorites, setFavorites] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      loadFavorites();
    } else {
      setFavorites([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadFavorites = async () => {
    if (!user || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      if (shouldUseSupabase(user)) {
        console.log('Loading favorites from Supabase for UUID user:', user.id);
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
            return {
              id: quote.id,
              text: quote.text,
              reference: quote.source || '',
              author: quote.author || '',
              book: '',
              chapter: 0,
              verse: 0,
              type: 'quote' as const,
              context: '',
              explanation: '',
              situations: [],
              tags: [],
              translations: {}
            } as Quote;
          }) || [];

          console.log('Loaded favorites from Supabase:', favoritesData.length);
          setFavorites(favoritesData);
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
        setFavorites(parsedFavorites);
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
        const { data: existingQuote } = await supabase
          .from('quotes')
          .select('id')
          .eq('id', quote.id)
          .single();

        if (!existingQuote) {
          // Insert the quote first
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
          // Update local state
          setFavorites(prev => [...prev, quote]);
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
          // Update local state
          setFavorites(prev => prev.filter(fav => fav.id !== quoteId));
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
  };
});