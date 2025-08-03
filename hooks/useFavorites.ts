import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Quote } from '@/mocks/quotes';

const FAVORITES_KEY = 'favorites';

export const [FavoritesProvider, useFavorites] = createContextHook(() => {
  const [favorites, setFavorites] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
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
      console.error('Error loading favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFavorites = async (newFavorites: Quote[]) => {
    try {
      console.log('Saving favorites to AsyncStorage:', newFavorites.length);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const addToFavorites = async (quote: Quote) => {
    console.log('Adding quote to favorites:', quote.id);
    const newFavorites = [...favorites, quote];
    await saveFavorites(newFavorites);
  };

  const removeFromFavorites = async (quoteId: string) => {
    console.log('Removing quote from favorites:', quoteId);
    const newFavorites = favorites.filter(fav => fav.id !== quoteId);
    await saveFavorites(newFavorites);
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