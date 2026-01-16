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
    set({ isPremium: value });
  },
  resetPremium: () => {
    set({ isPremium: false });
  },
  clearCache: async () => {
    try {
      await AsyncStorage.removeItem('subscription-storage');
    } catch (e) {
      // Cache was already cleared or doesn't exist
    }
    set({ isPremium: false });
  },
}));

// Clear old cache on app start
AsyncStorage.removeItem('subscription-storage').catch(() => {});

export default useSubscription;