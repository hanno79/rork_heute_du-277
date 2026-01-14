import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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
  USER_ID: 'auth_user_id',
} as const;

export const [AuthContext, useAuth] = createContextHook(() => {
  const [authState, setAuthState] = React.useState<AuthState>({
    user: null,
    tokens: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Convex mutations
  const loginMutation = useMutation(api.auth.login);
  const registerMutation = useMutation(api.auth.register);

  const saveAuthData = async (user: User, tokens: AuthTokens) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.USER, JSON.stringify(user)],
        [STORAGE_KEYS.TOKENS, JSON.stringify(tokens)],
        [STORAGE_KEYS.USER_ID, user.id],
      ]);
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
      await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKENS, STORAGE_KEYS.USER_ID]);
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
      console.log('Starting login for:', email);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@domain.com)'
        };
      }

      // Try Convex login
      try {
        const result = await loginMutation({ email, password });

        if (!result.success) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
          return {
            success: false,
            error: result.error || 'Login fehlgeschlagen'
          };
        }

        if (result.user) {
          // Use userId field (UUID) as the primary identifier, NOT _id (Convex document ID)
          const userId = (result.user as any).userId || result.user.id;
          const creationTime = (result.user as any)._creationTime;

          console.log('Login successful - userId:', userId);

          const user: User = {
            id: userId,
            email: result.user.email,
            name: result.user.name,
            isPremium: result.user.isPremium || false,
            createdAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
            updatedAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
          };

          const tokens: AuthTokens = {
            accessToken: 'convex_token_' + userId,
            refreshToken: 'convex_refresh_' + userId,
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          };

          await saveAuthData(user, tokens);
          return { success: true };
        }

        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: 'Ungültige E-Mail oder Passwort',
        };
      } catch (convexError) {
        console.error('Convex login error:', convexError);
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: 'Login fehlgeschlagen',
        };
      }
    } catch (error) {
      console.error('Login catch error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login fehlgeschlagen'
      };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      console.log('Starting registration for:', email);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@domain.com)'
        };
      }

      // Try Convex registration
      try {
        const result = await registerMutation({ email, password, name });

        console.log('Convex registration response:', result);

        if (!result.success) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
          return {
            success: false,
            error: result.error || 'Registrierung fehlgeschlagen'
          };
        }

        if (result.user) {
          // Use userId field (UUID) as the primary identifier, NOT _id (Convex document ID)
          const userId = (result.user as any).userId || result.user.id;
          const creationTime = (result.user as any)._creationTime;

          console.log('User created successfully - userId:', userId);

          const user: User = {
            id: userId,
            email: result.user.email,
            name: result.user.name,
            isPremium: false,
            createdAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
            updatedAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
          };

          const tokens: AuthTokens = {
            accessToken: 'convex_token_' + userId,
            refreshToken: 'convex_refresh_' + userId,
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          };

          await saveAuthData(user, tokens);
          return { success: true };
        }

        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: 'Registrierung fehlgeschlagen',
        };
      } catch (convexError) {
        console.error('Convex registration error:', convexError);
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: 'Registrierung fehlgeschlagen',
        };
      }
    } catch (error) {
      console.error('Registration catch error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registrierung fehlgeschlagen'
      };
    }
  };

  const logout = async () => {
    try {
      await clearAuthData();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const refreshAuth = async () => {
    try {
      // Check AsyncStorage for stored auth
      const storedData = await AsyncStorage.multiGet([STORAGE_KEYS.USER, STORAGE_KEYS.TOKENS]);
      const userData = storedData[0][1];
      const tokensData = storedData[1][1];

      if (userData && tokensData) {
        const user: User = JSON.parse(userData);
        const tokens: AuthTokens = JSON.parse(tokensData);

        // Check if token is expired
        if (tokens.expiresAt > Date.now()) {
          setAuthState({
            user,
            tokens,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          await clearAuthData();
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
