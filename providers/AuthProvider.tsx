import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import * as Crypto from 'expo-crypto';

// Generate cryptographically secure tokens using expo-crypto
const generateSecureToken = (): string => {
  return Crypto.randomUUID() + Crypto.randomUUID();
};

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
      // Silent fail - auth data save error
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
      // Silent fail - auth data clear error
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return {
        success: false,
        error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@domain.com)'
      };
    }

    try {
      // Call Convex login
      const result = await loginMutation({ email, password });

      // Check if Convex returned an error
      if (!result.success) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: result.error || 'Ungültige E-Mail oder Passwort'
        };
      }

      // Login successful - process user data
      if (result.user) {
        const userId = (result.user as any).userId || (result.user as any).id;
        const creationTime = (result.user as any)._creationTime;

        const user: User = {
          id: userId,
          email: (result.user as any).email,
          name: (result.user as any).name,
          isPremium: (result.user as any).isPremium || false,
          createdAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
          updatedAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
        };

        // Generate cryptographically secure tokens
        const tokens: AuthTokens = {
          accessToken: generateSecureToken(),
          refreshToken: generateSecureToken(),
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        };

        await saveAuthData(user, tokens);
        return { success: true };
      }

      // No user returned but success was true - should not happen
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: true };

    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      // Extract meaningful error message
      const errorMessage = error?.message || error?.toString() || 'Login fehlgeschlagen';
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string; userId?: string }> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return {
        success: false,
        error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@domain.com)'
      };
    }

    try {
      // Call Convex registration
      const result = await registerMutation({ email, password, name });

      // Check if Convex returned an error
      if (!result.success) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: result.error || 'Registrierung fehlgeschlagen'
        };
      }

      // Registration successful - process user data
      if (result.user) {
        const userId = (result.user as any).userId || (result.user as any).id;
        const creationTime = (result.user as any)._creationTime;

        const user: User = {
          id: userId,
          email: (result.user as any).email,
          name: (result.user as any).name,
          isPremium: false,
          createdAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
          updatedAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
        };

        // Generate cryptographically secure tokens
        const tokens: AuthTokens = {
          accessToken: generateSecureToken(),
          refreshToken: generateSecureToken(),
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        };

        await saveAuthData(user, tokens);
        return { success: true, userId: userId };
      }

      // No user returned but success was true - should not happen
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: true };

    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      // Extract meaningful error message
      const errorMessage = error?.message || error?.toString() || 'Registrierung fehlgeschlagen';
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const logout = async () => {
    try {
      await clearAuthData();
    } catch (error) {
      // Silent fail - logout error
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
