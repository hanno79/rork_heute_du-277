import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubscriptionState {
  isPremium: boolean;
  setIsPremium: (value: boolean) => void;
}

const useSubscription = create<SubscriptionState>()(
  persist(
    (set) => ({
      isPremium: false,
      setIsPremium: (value) => set({ isPremium: value }),
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useSubscription;