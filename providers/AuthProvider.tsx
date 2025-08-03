import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { apiClient, User, AuthTokens } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const STORAGE_KEYS = {
  USER: 'auth_user',
  TOKENS: 'auth_tokens',
} as const;

export const [AuthContext, useAuth] = createContextHook(() => {
  const [authState, setAuthState] = React.useState<AuthState>({
    user: null,
    tokens: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const saveAuthData = async (user: User, tokens: AuthTokens) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.USER, JSON.stringify(user)],
        [STORAGE_KEYS.TOKENS, JSON.stringify(tokens)],
      ]);
      apiClient.setAccessToken(tokens.accessToken);
      setAuthState({
        user,
        tokens,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Failed to save auth data:', error);
    }
  };

  const clearAuthData = async () => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKENS]);
      apiClient.setAccessToken(null);
      setAuthState({
        user: null,
        tokens: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Use Supabase for login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: error.message };
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
          expiresAt: data.session.expires_at! * 1000,
        };

        await saveAuthData(user, tokens);
        return { success: true };
      }

      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Login failed' };
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Use Supabase for registration
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            name,
            is_premium: false,
          });

        if (profileError) {
          console.error('Failed to create user profile:', profileError);
        }

        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          name,
          isPremium: false,
          createdAt: data.user.created_at,
          updatedAt: new Date().toISOString(),
        };

        const tokens: AuthTokens = {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at! * 1000,
        };

        await saveAuthData(user, tokens);
        return { success: true };
      }

      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Registration failed' };
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Registration failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      await clearAuthData();
    }
  };

  const refreshAuth = async () => {
    try {
      // First check Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (session && !error) {
        try {
          // Get user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            name: profile?.name || session.user.email!,
            isPremium: profile?.is_premium || false,
            createdAt: session.user.created_at,
            updatedAt: profile?.updated_at || session.user.created_at,
          };

          const tokens: AuthTokens = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at! * 1000,
          };

          await saveAuthData(user, tokens);
          return;
        } catch (profileError) {
          console.error('Error fetching user profile:', profileError);
          // Continue with basic user data if profile fetch fails
          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.email!,
            isPremium: false,
            createdAt: session.user.created_at,
            updatedAt: session.user.created_at,
          };

          const tokens: AuthTokens = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at! * 1000,
          };

          await saveAuthData(user, tokens);
          return;
        }
      }

      // Fallback to AsyncStorage for backward compatibility
      const storedData = await AsyncStorage.multiGet([STORAGE_KEYS.USER, STORAGE_KEYS.TOKENS]);
      const userData = storedData[0][1];
      const tokensData = storedData[1][1];

      if (userData && tokensData) {
        const user: User = JSON.parse(userData);
        const tokens: AuthTokens = JSON.parse(tokensData);

        // Check if token is expired
        if (tokens.expiresAt > Date.now()) {
          apiClient.setAccessToken(tokens.accessToken);
          setAuthState({
            user,
            tokens,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          // Try to refresh token
          const refreshResponse = await apiClient.refreshToken(tokens.refreshToken);
          if (refreshResponse.success && refreshResponse.data) {
            await saveAuthData(user, refreshResponse.data);
          } else {
            await clearAuthData();
          }
        }
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    refreshAuth();

    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Supabase auth state changed:', event, session?.user?.email);

        if (event === 'SIGNED_IN' && session) {
          // Get user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            name: profile?.name || session.user.email!,
            isPremium: profile?.is_premium || false,
            createdAt: session.user.created_at,
            updatedAt: profile?.updated_at || session.user.created_at,
          };

          const tokens: AuthTokens = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at! * 1000,
          };

          await saveAuthData(user, tokens);
        } else if (event === 'SIGNED_OUT') {
          await clearAuthData();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const actions: AuthActions = {
    login,
    register,
    logout,
    refreshAuth,
  };

  return {
    ...authState,
    ...actions,
  };
});

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext>
        {children}
      </AuthContext>
    </QueryClientProvider>
  );
}