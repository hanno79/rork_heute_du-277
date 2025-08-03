import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform } from 'react-native';

import colors from "@/constants/colors";
import { FavoritesProvider } from "@/hooks/useFavorites";
import { AuthProvider } from "@/providers/AuthProvider";
import ErrorBoundary from "@/components/ErrorBoundary";

let StripeProvider: any = null;
let STRIPE_PUBLISHABLE_KEY = '';

if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    StripeProvider = stripeModule.StripeProvider;
    const stripeConfig = require('@/lib/stripe');
    STRIPE_PUBLISHABLE_KEY = stripeConfig.STRIPE_PUBLISHABLE_KEY;
  } catch (error) {
    console.warn('Stripe not available:', error);
  }
}

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error(error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const AppContent = (
    <AuthProvider>
      <FavoritesProvider>
        <StatusBar
          style="dark"
          backgroundColor={colors.background}
        />
        <Stack
          screenOptions={{
            headerBackTitle: "Back",
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="premium" options={{ presentation: "card" }} />
          <Stack.Screen name="quote/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="auth/login" options={{ headerShown: true, title: "Anmelden" }} />
          <Stack.Screen name="auth/register" options={{ headerShown: true, title: "Registrieren" }} />
          <Stack.Screen name="disclaimer" options={{ headerShown: true }} />
        </Stack>
      </FavoritesProvider>
    </AuthProvider>
  );

  return (
    <ErrorBoundary>
      {Platform.OS !== 'web' && StripeProvider ? (
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
          {AppContent}
        </StripeProvider>
      ) : (
        AppContent
      )}
    </ErrorBoundary>
  );
}