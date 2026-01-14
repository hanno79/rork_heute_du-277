import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import Constants from 'expo-constants';
import { ConvexProvider, ConvexReactClient } from "convex/react";

import colors from "@/constants/colors";
import { FavoritesProvider } from "@/hooks/useFavorites";
import { AuthProvider } from "@/providers/AuthProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import { STRIPE_PUBLISHABLE_KEY, initializeStripe } from "@/lib/stripe";

// Initialize Convex client
const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Conditionally import StripeProvider only for native platforms (but not Expo Go)
let StripeProvider: any = null;

if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    StripeProvider = stripeModule.StripeProvider;
    console.log('Stripe module loaded successfully');
  } catch (error) {
    console.warn('Stripe not available on this platform:', error);
  }
} else {
  console.log('Skipping Stripe module load - running in Expo Go or Web');
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Initialize Stripe only on native platforms (but not Expo Go)
      if (Platform.OS !== 'web' && !isExpoGo) {
        initializeStripe().then((success) => {
          if (success) {
            console.log('Stripe initialized successfully');
          } else {
            console.warn('Stripe initialization failed');
          }
        });
      } else {
        console.log('Stripe initialization skipped - running in Expo Go or Web');
      }
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const AppContent = () => (
    <ConvexProvider client={convex}>
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
            <Stack.Screen name="test" options={{ headerShown: true, title: "Test" }} />
            <Stack.Screen name="premium" options={{ presentation: "card" }} />
            <Stack.Screen name="quote/[id]" options={{ headerShown: true }} />
            <Stack.Screen name="auth/login" options={{ headerShown: true, title: "Anmelden" }} />
            <Stack.Screen name="auth/register" options={{ headerShown: true, title: "Registrieren" }} />
            <Stack.Screen name="disclaimer" options={{ headerShown: true }} />
          </Stack>
        </FavoritesProvider>
      </AuthProvider>
    </ConvexProvider>
  );

  return (
    <ErrorBoundary>
      {Platform.OS !== 'web' && !isExpoGo && StripeProvider ? (
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
          <AppContent />
        </StripeProvider>
      ) : (
        <AppContent />
      )}
    </ErrorBoundary>
  );
}