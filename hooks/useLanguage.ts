import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Localization from 'expo-localization';
import { translations, SupportedLanguage, TranslationKey } from '@/constants/translations';

interface LanguageState {
  currentLanguage: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

// Get device language and map to supported languages
const getDeviceLanguage = (): SupportedLanguage => {
  if (Platform.OS === 'web') {
    const browserLanguage = navigator.language?.split('-')[0] || 'en';
    return browserLanguage === 'de' ? 'de' : 'en';
  }
  
  // For native platforms (iOS and Android), use expo-localization
  const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'en';
  return deviceLanguage === 'de' ? 'de' : 'en';
};

const useLanguage = create<LanguageState>()(
  persist(
    (set, get) => ({
      currentLanguage: getDeviceLanguage(),
      
      setLanguage: (language: SupportedLanguage) => {
        set({ currentLanguage: language });
      },
      
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        const { currentLanguage } = get();
        let translation = translations[currentLanguage]?.[key] || translations.en[key] || key;
        
        // Replace parameters in translation
        if (params) {
          Object.entries(params).forEach(([paramKey, value]) => {
            translation = translation.replace(`{${paramKey}}`, String(value));
          });
        }
        
        return translation;
      },
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useLanguage;