import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Quote } from '@/mocks/quotes';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

const FAVORITES_KEY = 'favorites';
const USE_SUPABASE = true;

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
      if (USE_SUPABASE) {
        console.log('Loading favorites from Supabase...');
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
          // Fallback to AsyncStorage
          await loadFavoritesFromStorage();
        } else {
          const favoritesData = data?.map(fav => ({
            id: fav.quotes.id,
            text: fav.quotes.text,
            author: fav.quotes.author || '',
            source: fav.quotes.source || '',
            category: fav.quotes.category || '',
            language: fav.quotes.language,
            isPremium: fav.quotes.is_premium,
          })) || [];

          console.log('Loaded favorites from Supabase:', favoritesData.length);
          setFavorites(favoritesData);
        }
      } else {
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
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsedFavorites = JSON.parse(stored);
        console.log('Loaded favorites:', parsedFavorites.length);
        setFavorites(parsedFavorites);
      } else {
        console.log('No favorites found in storage');
      }
    } catch (error) {
      console.error('Error loading favorites from storage:', error);
    }
  };

  const saveFavoritesToStorage = async (newFavorites: Quote[]) => {
    try {
      console.log('Saving favorites to AsyncStorage:', newFavorites.length);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
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

    if (USE_SUPABASE) {
      try {
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
              author: quote.author,
              source: quote.source,
              category: quote.category,
              language: quote.language || 'de',
              is_premium: quote.isPremium || false,
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

    if (USE_SUPABASE) {
      try {
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
      const newFavorites = favorites.filter(fav => fav.id !== quoteId);
      await saveFavoritesToStorage(newFavorites);
    }
  };

  const isFavorite = (quoteId: string): boolean => {
    const result = favorites.some(fav => fav.id === quoteId);
    console.log(`Checking if quote ${quoteId} is favorite:`, result);
    return result;
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