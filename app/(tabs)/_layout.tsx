import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, Search, Heart, User } from 'lucide-react-native';
import colors from '@/constants/colors';
import useLanguage from '@/hooks/useLanguage';

// Custom Header Title Component with Logo
function HeaderTitle() {
  return (
    <View style={styles.headerTitle}>
      <Image
        source={require('@/assets/images/icon.png')}
        style={styles.headerLogo}
      />
      <Text style={styles.headerText}>Heute Du!</Text>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.lightText,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
          height: 80,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitle: () => <HeaderTitle />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: t('todaysQuote'),
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarLabel: t('search'),
          tabBarIcon: ({ color }) => <Search size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          tabBarLabel: t('favorites'),
          tabBarIcon: ({ color }) => <Heart size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: t('profile'),
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 28,
    height: 28,
    marginRight: 8,
    borderRadius: 6,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
});
