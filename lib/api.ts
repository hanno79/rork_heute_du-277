import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { AuthError, User as SupabaseUser } from '@supabase/supabase-js';
import { Quote, mockQuotes } from '@/mocks/quotes';

const API_BASE_URL = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://api.rork.com';
const USE_MOCK_API = false; // Now using Supabase backend
const USE_SUPABASE = true; // Enable Supabase integration

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private generateMockUser(email: string, name: string): User {
    return {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name,
      isPremium: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private generateMockTokens(): AuthTokens {
    return {
      accessToken: 'mock_access_token_' + Math.random().toString(36).substr(2, 9),
      refreshToken: 'mock_refresh_token_' + Math.random().toString(36).substr(2, 9),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    };
  }

  private async mockDelay(ms: number = 1000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    if (USE_SUPABASE) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return {
            success: false,
            error: error.message === 'Invalid login credentials'
              ? 'Ungültige E-Mail oder Passwort'
              : error.message,
          };
        }

        if (data.user && data.session) {
          // Get user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          const user: User = {
            id: data.user.id,
            email: data.user.email!,
            name: profile?.name || data.user.email!,
            isPremium: profile?.is_premium || false,
            createdAt: data.user.created_at,
            updatedAt: profile?.updated_at || data.user.created_at,
          };

          const tokens: AuthTokens = {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at! * 1000, // Convert to milliseconds
          };

          return {
            success: true,
            data: { user, tokens },
          };
        }

        return {
          success: false,
          error: 'Login fehlgeschlagen',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Login fehlgeschlagen',
        };
      }
    }

    if (USE_MOCK_API) {
      await this.mockDelay(800);

      try {
        const storedUsers = await AsyncStorage.getItem('mock_users');
        const users: Array<{ email: string; password: string; user: User }> = storedUsers ? JSON.parse(storedUsers) : [];

        const foundUser = users.find(u => u.email === email && u.password === password);

        if (foundUser) {
          const tokens = this.generateMockTokens();
          return {
            success: true,
            data: {
              user: foundUser.user,
              tokens,
            },
          };
        } else {
          return {
            success: false,
            error: 'Ungültige E-Mail oder Passwort',
          };
        }
      } catch (error) {
        return {
          success: false,
          error: 'Login fehlgeschlagen',
        };
      }
    }

    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    if (USE_SUPABASE) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
            },
          },
        });

        if (error) {
          return {
            success: false,
            error: error.message === 'User already registered'
              ? 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits'
              : error.message,
          };
        }

        if (data.user && data.session) {
          // Get user profile (should be created by trigger)
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          const user: User = {
            id: data.user.id,
            email: data.user.email!,
            name: profile?.name || name,
            isPremium: profile?.is_premium || false,
            createdAt: data.user.created_at,
            updatedAt: profile?.updated_at || data.user.created_at,
          };

          const tokens: AuthTokens = {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at! * 1000, // Convert to milliseconds
          };

          return {
            success: true,
            data: { user, tokens },
          };
        }

        return {
          success: false,
          error: 'Registrierung fehlgeschlagen',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Registrierung fehlgeschlagen',
        };
      }
    }

    if (USE_MOCK_API) {
      await this.mockDelay(1000);

      try {
        const storedUsers = await AsyncStorage.getItem('mock_users');
        const users: Array<{ email: string; password: string; user: User }> = storedUsers ? JSON.parse(storedUsers) : [];

        // Check if user already exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
          return {
            success: false,
            error: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits',
          };
        }

        // Create new user
        const newUser = this.generateMockUser(email, name);
        const tokens = this.generateMockTokens();

        users.push({ email, password, user: newUser });
        await AsyncStorage.setItem('mock_users', JSON.stringify(users));

        return {
          success: true,
          data: {
            user: newUser,
            tokens,
          },
        };
      } catch (error) {
        console.error('Mock register error:', error);
        return {
          success: false,
          error: 'Registrierung fehlgeschlagen',
        };
      }
    }

    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
    if (USE_SUPABASE) {
      try {
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });

        if (error) {
          return {
            success: false,
            error: error.message,
          };
        }

        if (data.session) {
          const tokens: AuthTokens = {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at! * 1000, // Convert to milliseconds
          };

          return {
            success: true,
            data: tokens,
          };
        }

        return {
          success: false,
          error: 'Token refresh fehlgeschlagen',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Token refresh fehlgeschlagen',
        };
      }
    }

    if (USE_MOCK_API) {
      await this.mockDelay(500);

      // In mock mode, always return new tokens
      const tokens = this.generateMockTokens();
      return {
        success: true,
        data: tokens,
      };
    }

    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    if (USE_SUPABASE) {
      try {
        const { error } = await supabase.auth.signOut();

        if (error) {
          return {
            success: false,
            error: error.message,
          };
        }

        return {
          success: true,
          data: undefined,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Logout fehlgeschlagen',
        };
      }
    }

    if (USE_MOCK_API) {
      await this.mockDelay(300);
      return {
        success: true,
        data: undefined,
      };
    }

    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // User endpoints
  async getProfile(): Promise<ApiResponse<User>> {
    if (USE_MOCK_API) {
      await this.mockDelay(500);
      
      // Return mock user data - in real app this would come from token
      const mockUser = this.generateMockUser('user@example.com', 'Mock User');
      return {
        success: true,
        data: mockUser,
      };
    }
    
    return this.request('/user/profile');
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    if (USE_MOCK_API) {
      await this.mockDelay(800);
      
      // In mock mode, just return the updated data
      const mockUser = this.generateMockUser('user@example.com', 'Mock User');
      return {
        success: true,
        data: { ...mockUser, ...data },
      };
    }
    
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Subscription endpoints
  async createSubscription(priceId: string): Promise<ApiResponse<{ clientSecret: string }>> {
    if (USE_MOCK_API) {
      await this.mockDelay(1200);
      
      return {
        success: true,
        data: {
          clientSecret: 'mock_client_secret_' + Math.random().toString(36).substr(2, 9),
        },
      };
    }
    
    return this.request('/subscriptions/create', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    });
  }

  async cancelSubscription(): Promise<ApiResponse<void>> {
    if (USE_MOCK_API) {
      await this.mockDelay(800);
      
      return {
        success: true,
        data: undefined,
      };
    }
    
    return this.request('/subscriptions/cancel', {
      method: 'POST',
    });
  }

  // Quotes endpoints
  async getQuotes(category?: string, language?: string): Promise<ApiResponse<Quote[]>> {
    if (USE_SUPABASE) {
      try {
        let query = supabase
          .from('quotes')
          .select('*')
          .order('created_at', { ascending: false });

        if (category && category !== 'all') {
          query = query.eq('category', category);
        }

        if (language) {
          query = query.eq('language', language);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching quotes from Supabase:', error);
          // Fallback to mock data
          return this.getMockQuotes(category, language);
        }

        const quotes: Quote[] = data?.map(quote => ({
          id: quote.id,
          text: quote.text,
          author: quote.author || '',
          source: quote.source || '',
          category: quote.category || '',
          language: quote.language,
          isPremium: quote.is_premium,
        })) || [];

        return {
          success: true,
          data: quotes,
        };
      } catch (error) {
        console.error('Error fetching quotes:', error);
        return this.getMockQuotes(category, language);
      }
    }

    if (USE_MOCK_API) {
      return this.getMockQuotes(category, language);
    }

    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (language) params.append('language', language);

    return this.request(`/quotes?${params.toString()}`);
  }

  private getMockQuotes(category?: string, language?: string): ApiResponse<Quote[]> {
    let filteredQuotes = mockQuotes;

    if (category && category !== 'all') {
      filteredQuotes = filteredQuotes.filter(quote =>
        quote.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (language) {
      filteredQuotes = filteredQuotes.filter(quote => quote.language === language);
    }

    return {
      success: true,
      data: filteredQuotes,
    };
  }

  async getFavoriteQuotes(): Promise<ApiResponse<any[]>> {
    if (USE_MOCK_API) {
      await this.mockDelay(600);
      
      try {
        const storedFavorites = await AsyncStorage.getItem('mock_favorite_quotes');
        const favorites = storedFavorites ? JSON.parse(storedFavorites) : [];
        
        return {
          success: true,
          data: favorites,
        };
      } catch (error) {
        return {
          success: false,
          error: 'Fehler beim Laden der Favoriten',
        };
      }
    }
    
    return this.request('/quotes/favorites');
  }

  async addFavoriteQuote(quoteId: string): Promise<ApiResponse<void>> {
    if (USE_MOCK_API) {
      await this.mockDelay(400);
      
      try {
        const storedFavorites = await AsyncStorage.getItem('mock_favorite_quotes');
        const favorites = storedFavorites ? JSON.parse(storedFavorites) : [];
        
        if (!favorites.includes(quoteId)) {
          favorites.push(quoteId);
          await AsyncStorage.setItem('mock_favorite_quotes', JSON.stringify(favorites));
        }
        
        return {
          success: true,
          data: undefined,
        };
      } catch (error) {
        return {
          success: false,
          error: 'Fehler beim Hinzufügen zu Favoriten',
        };
      }
    }
    
    return this.request('/quotes/favorites', {
      method: 'POST',
      body: JSON.stringify({ quoteId }),
    });
  }

  async removeFavoriteQuote(quoteId: string): Promise<ApiResponse<void>> {
    if (USE_MOCK_API) {
      await this.mockDelay(400);
      
      try {
        const storedFavorites = await AsyncStorage.getItem('mock_favorite_quotes');
        const favorites = storedFavorites ? JSON.parse(storedFavorites) : [];
        
        const updatedFavorites = favorites.filter((id: string) => id !== quoteId);
        await AsyncStorage.setItem('mock_favorite_quotes', JSON.stringify(updatedFavorites));
        
        return {
          success: true,
          data: undefined,
        };
      } catch (error) {
        return {
          success: false,
          error: 'Fehler beim Entfernen aus Favoriten',
        };
      }
    }
    
    return this.request(`/quotes/favorites/${quoteId}`, {
      method: 'DELETE',
    });
  }

  // Notifications endpoints
  async updateNotificationSettings(settings: any): Promise<ApiResponse<void>> {
    if (USE_MOCK_API) {
      await this.mockDelay(600);
      
      try {
        await AsyncStorage.setItem('mock_notification_settings', JSON.stringify(settings));
        return {
          success: true,
          data: undefined,
        };
      } catch (error) {
        return {
          success: false,
          error: 'Fehler beim Speichern der Einstellungen',
        };
      }
    }
    
    return this.request('/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getNotificationSettings(): Promise<ApiResponse<any>> {
    if (USE_MOCK_API) {
      await this.mockDelay(500);
      
      try {
        const storedSettings = await AsyncStorage.getItem('mock_notification_settings');
        const settings = storedSettings ? JSON.parse(storedSettings) : {
          dailyQuote: true,
          motivationalReminders: false,
          weeklyDigest: true,
        };
        
        return {
          success: true,
          data: settings,
        };
      } catch (error) {
        return {
          success: false,
          error: 'Fehler beim Laden der Einstellungen',
        };
      }
    }
    
    return this.request('/notifications/settings');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;