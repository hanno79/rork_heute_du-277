import React from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Heart } from 'lucide-react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';
import { useFavorites } from '@/hooks/useFavorites';
import QuoteCard from '@/components/QuoteCard';
import { Quote } from '@/mocks/quotes';

export default function FavoritesScreen() {
  const { t } = useLanguage();
  const { favorites, isLoading } = useFavorites();

  const renderQuote = ({ item }: { item: Quote }) => (
    <QuoteCard quote={item} compact={false} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Heart size={64} color={colors.lightText} />
      <Text style={styles.emptyTitle}>{t('noFavorites')}</Text>
      <Text style={styles.emptyDescription}>{t('noFavoritesDescription')}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen 
          options={{
            title: t('favorites'),
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTitleStyle: {
              color: colors.text,
              fontWeight: '600',
            },
          }} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: t('favorites'),
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }} 
      />
      
      <FlatList
        data={favorites}
        renderItem={renderQuote}
        keyExtractor={(item) => item.id}
        contentContainerStyle={favorites.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    marginTop: 16,
    color: colors.lightText,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    ...typography.title,
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    ...typography.body,
    color: colors.lightText,
    textAlign: 'center',
    lineHeight: 22,
  },
});