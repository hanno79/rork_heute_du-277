import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get environment variables with fallbacks
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://slrbnqvvomppzpvazvdu.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscmJucXZ2b21wcHpwdmF6dmR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMjQwNzcsImV4cCI6MjA2OTgwMDA3N30.3V9ZeU978tS3XKHrmlD7UKHGdY4QLYyCMz1TwUsg5uo';

if (!supabaseUrl || supabaseUrl === 'undefined') {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey || supabaseAnonKey === 'undefined') {
  console.error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Custom storage adapter for React Native
const customStorage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from AsyncStorage:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in AsyncStorage:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from AsyncStorage:', error);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          name: string;
          is_premium: boolean;
          premium_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          is_premium?: boolean;
          premium_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_premium?: boolean;
          premium_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      quotes: {
        Row: {
          id: string;
          text: string;
          author: string | null;
          source: string | null;
          category: string | null;
          language: string;
          is_premium: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          text: string;
          author?: string | null;
          source?: string | null;
          category?: string | null;
          language?: string;
          is_premium?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          text?: string;
          author?: string | null;
          source?: string | null;
          category?: string | null;
          language?: string;
          is_premium?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_favorites: {
        Row: {
          id: string;
          user_id: string;
          quote_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          quote_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          quote_id?: string;
          created_at?: string;
        };
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          language: string;
          notifications_enabled: boolean;
          notification_time: string;
          notification_days: number[];
          daily_quote: boolean;
          motivational_reminders: boolean;
          weekly_digest: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          language?: string;
          notifications_enabled?: boolean;
          notification_time?: string;
          notification_days?: number[];
          daily_quote?: boolean;
          motivational_reminders?: boolean;
          weekly_digest?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          language?: string;
          notifications_enabled?: boolean;
          notification_time?: string;
          notification_days?: number[];
          daily_quote?: boolean;
          motivational_reminders?: boolean;
          weekly_digest?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
