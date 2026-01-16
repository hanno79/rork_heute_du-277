import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

// SECURITY NOTE: Token generation now happens server-side in Convex
// The server returns sessionToken and sessionExpiresAt on login/register

interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthTokens {
  sessionToken: string;  // SECURITY: Server-generated session token
  expiresAt: number;     // Token expiration timestamp
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string; userId?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

// Type-safe interface for user profile data returned from Convex auth mutations
interface ConvexUserProfile {
  userId: string;
  id?: string;  // Alternative ID field
  email: string;
  name: string;
  isPremium?: boolean;
  _creationTime?: number;
}

// Type-safe interface for Convex login/register response
// Matches the shape returned by api.auth.login and api.auth.register
interface AuthResponse {
  success: boolean;
  error?: string;
  user?: ConvexUserProfile;
  sessionToken?: string;
  sessionExpiresAt?: number;
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
      // Log error for debugging (no sensitive data)
      console.error('[AuthProvider] saveAuthData failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hasUser: !!user,
      });
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
      // Log error for debugging (no sensitive data)
      console.error('[AuthProvider] clearAuthData failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
      // Call Convex login and cast to typed response
      const result = await loginMutation({ email, password }) as AuthResponse;

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
        const userProfile = result.user;
        const userId = userProfile.userId || userProfile.id || '';
        const creationTime = userProfile._creationTime;

        const user: User = {
          id: userId,
          email: userProfile.email,
          name: userProfile.name,
          isPremium: userProfile.isPremium || false,
          createdAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
          updatedAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
        };

        // SECURITY: Use server-generated session token instead of client-side generation
        if (!result.sessionToken || !result.sessionExpiresAt) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
          return { success: false, error: 'Server-Authentifizierung fehlgeschlagen' };
        }

        const tokens: AuthTokens = {
          sessionToken: result.sessionToken,
          expiresAt: result.sessionExpiresAt,
        };

        await saveAuthData(user, tokens);
        return { success: true };
      }

      // No user returned but success was true - should not happen
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: true };

    } catch (error: unknown) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      // Extract meaningful error message
      const errorMessage = error instanceof Error ? error.message : 'Login fehlgeschlagen';
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
      // Call Convex registration and cast to typed response
      const result = await registerMutation({ email, password, name }) as AuthResponse;

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
        const userProfile = result.user;
        const userId = userProfile.userId || userProfile.id || '';
        const creationTime = userProfile._creationTime;

        const user: User = {
          id: userId,
          email: userProfile.email,
          name: userProfile.name,
          isPremium: false,
          createdAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
          updatedAt: creationTime ? new Date(creationTime).toISOString() : new Date().toISOString(),
        };

        // SECURITY: Use server-generated session token instead of client-side generation
        if (!result.sessionToken || !result.sessionExpiresAt) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
          return { success: false, error: 'Server-Authentifizierung fehlgeschlagen' };
        }

        const tokens: AuthTokens = {
          sessionToken: result.sessionToken,
          expiresAt: result.sessionExpiresAt,
        };

        await saveAuthData(user, tokens);
        return { success: true, userId: userId };
      }

      // No user returned but success was true - should not happen
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: true };

    } catch (error: unknown) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      // Extract meaningful error message
      const errorMessage = error instanceof Error ? error.message : 'Registrierung fehlgeschlagen';
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  // Convex logout mutation
  const logoutMutation = useMutation(api.auth.logout);

  const logout = async () => {
    try {
      // SECURITY: Invalidate session token on server before clearing local data
      // Only call server logout if we have a valid sessionToken (new format)
      if (authState.user && authState.tokens?.sessionToken) {
        try {
          await logoutMutation({
            userId: authState.user.id,
            sessionToken: authState.tokens.sessionToken,
          });
        } catch (serverError) {
          // Log server logout error but continue with local logout
          console.error('[AuthProvider] Server logout failed:', {
            error: serverError instanceof Error ? serverError.message : 'Unknown error',
          });
        }
      }
      // Always clear local auth data regardless of server logout result
      await clearAuthData();
    } catch (error) {
      // Log error for debugging (no sensitive data)
      console.error('[AuthProvider] logout failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Still clear local data even if there's an error
      await clearAuthData();
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
        const parsedTokens = JSON.parse(tokensData);

        // Check if tokens are in old format (accessToken/refreshToken) vs new format (sessionToken)
        // If old format, force re-login to get new server-generated session token
        if (!parsedTokens.sessionToken && (parsedTokens.accessToken || parsedTokens.refreshToken)) {
          // Old token format - clear and require re-login
          console.log('[AuthProvider] Old token format detected, requiring re-login');
          await clearAuthData();
          return;
        }

        const tokens: AuthTokens = parsedTokens;

        // Check if token is expired
        if (tokens.sessionToken && tokens.expiresAt > Date.now()) {
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
