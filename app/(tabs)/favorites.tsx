import React from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Heart, LogIn } from 'lucide-react-native';
import { router } from 'expo-router';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/providers/AuthProvider';
import QuoteCard from '@/components/QuoteCard';
import { Quote } from '@/mocks/quotes';

export default function FavoritesScreen() {
  const { t } = useLanguage();
  const { favorites, isLoading } = useFavorites();
  const { isAuthenticated } = useAuth();

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

  // Show login prompt for non-authenticated users
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.loginPromptContainer}>
          <LogIn size={64} color={colors.lightText} />
          <Text style={styles.loginTitle}>{t('loginRequired')}</Text>
          <Text style={styles.loginDescription}>
            {t('loginToSaveFavorites')}
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>{t('login')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('loadingFavorites')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        renderItem={renderQuote}
        keyExtractor={(item) => item.id}
        contentContainerStyle={favorites.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
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
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loginTitle: {
    ...typography.title,
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  loginDescription: {
    ...typography.body,
    color: colors.lightText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
