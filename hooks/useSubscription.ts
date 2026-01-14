import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubscriptionState {
  isPremium: boolean;
  setIsPremium: (value: boolean) => void;
  resetPremium: () => void;
  clearCache: () => Promise<void>;
}

// IMPORTANT: No more persist middleware - Convex is the source of truth
const useSubscription = create<SubscriptionState>()((set) => ({
  isPremium: false,
  setIsPremium: (value) => {
    console.log('useSubscription: Setting isPremium to', value);
    set({ isPremium: value });
  },
  resetPremium: () => {
    console.log('useSubscription: Resetting isPremium to false');
    set({ isPremium: false });
  },
  clearCache: async () => {
    console.log('useSubscription: Clearing old AsyncStorage cache');
    try {
      await AsyncStorage.removeItem('subscription-storage');
      console.log('Old cache cleared successfully');
    } catch (e) {
      console.log('No old cache to clear');
    }
    set({ isPremium: false });
  },
}));

// Clear old cache on app start
AsyncStorage.removeItem('subscription-storage').catch(() => {});

export default useSubscription;