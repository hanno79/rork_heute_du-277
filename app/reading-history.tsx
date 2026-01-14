import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Search, Calendar, Crown } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';
import { useAuth } from '@/providers/AuthProvider';
import QuoteCard from '@/components/QuoteCard';

export default function ReadingHistoryScreen() {
  const { t, currentLanguage } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  // Query user's premium status from Convex
  const userProfile = useQuery(
    api.auth.getCurrentUser,
    user?.id ? { userId: user.id } : "skip"
  );
  const isPremium = userProfile?.isPremium === true;

  // Determine limits based on premium status
  const dailyQuoteLimit = isPremium ? 7 : 3;
  const searchLimit = isPremium ? 5 : 0;
  const quotesPerSearch = 3;

  // Query daily quote history
  const dailyQuoteHistory = useQuery(
    api.readingHistory.getDailyQuoteHistory,
    user?.id ? { userId: user.id, limit: dailyQuoteLimit } : "skip"
  );

  // Query search history (only for premium users)
  const searchHistory = useQuery(
    api.readingHistory.getSearchHistory,
    user?.id && isPremium
      ? { userId: user.id, searchLimit, quotesPerSearch }
      : "skip"
  );

  // Loading state
  const isLoading = dailyQuoteHistory === undefined ||
    (isPremium && searchHistory === undefined);

  // Format date for display
  const formatDate = (dateStr: string | number) => {
    const date = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);
    return date.toLocaleDateString(
      currentLanguage === 'de' ? 'de-DE' : 'en-US',
      { weekday: 'short', day: 'numeric', month: 'short' }
    );
  };

  // Convert history quote to Quote type for QuoteCard
  const convertToQuote = (historyQuote: any) => {
    if (!historyQuote) return null;
    return {
      id: historyQuote._id,
      _id: historyQuote._id,
      text: historyQuote.text,
      author: historyQuote.author || '',
      reference: historyQuote.reference || '',
      book: '',
      chapter: 0,
      verse: 0,
      type: (historyQuote.category || 'quote') as 'bible' | 'quote' | 'saying' | 'poem',
      context: historyQuote.context || '',
      explanation: historyQuote.explanation || '',
      situations: historyQuote.situations || [],
      tags: historyQuote.tags || [],
      translations: historyQuote.translations || {},
    };
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: t('readingHistory'),
            headerStyle: { backgroundColor: colors.background },
            headerTitleStyle: { color: colors.text, fontWeight: '600' },
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <ArrowLeft size={24} color={colors.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.emptyContainer}>
          <BookOpen size={64} color={colors.lightText} />
          <Text style={styles.emptyTitle}>{t('loginRequired')}</Text>
          <Text style={styles.emptyText}>{t('loginToSaveFavorites')}</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.loginButtonText}>{t('login')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: t('readingHistory'),
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('loadingFavorites')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Daily Quotes Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('dailyQuotesSection')}</Text>
              <Text style={styles.sectionSubtitle}>
                ({isPremium ? t('last7Days') : t('last3Days')})
              </Text>
            </View>

            {dailyQuoteHistory && dailyQuoteHistory.length > 0 ? (
              dailyQuoteHistory.map((item: any, index: number) => {
                const quote = convertToQuote(item.quote);
                if (!quote) return null;
                return (
                  <View key={`daily-${index}`} style={styles.historyItem}>
                    <Text style={styles.dateLabel}>{formatDate(item.shownAt)}</Text>
                    <QuoteCard quote={quote} compact />
                  </View>
                );
              })
            ) : (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>{t('noReadingHistory')}</Text>
              </View>
            )}
          </View>

          {/* Search History Section (Premium only) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Search size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('searchHistorySection')}</Text>
              {!isPremium && (
                <Crown size={16} color={colors.premium} style={{ marginLeft: 8 }} />
              )}
            </View>

            {isPremium ? (
              searchHistory && searchHistory.length > 0 ? (
                searchHistory.map((search: any, searchIndex: number) => (
                  <View key={`search-${searchIndex}`} style={styles.searchHistoryItem}>
                    <View style={styles.searchQueryHeader}>
                      <Text style={styles.searchQueryText}>"{search.searchQuery}"</Text>
                      <Text style={styles.searchDateText}>{formatDate(search.searchedAt)}</Text>
                    </View>
                    {search.quotes && search.quotes.length > 0 ? (
                      search.quotes.slice(0, quotesPerSearch).map((quoteData: any, quoteIndex: number) => {
                        const quote = convertToQuote(quoteData);
                        if (!quote) return null;
                        return (
                          <QuoteCard key={`search-${searchIndex}-quote-${quoteIndex}`} quote={quote} compact />
                        );
                      })
                    ) : (
                      <Text style={styles.noQuotesText}>{t('noQuotesFound')}</Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>{t('noSearchHistory')}</Text>
                </View>
              )
            ) : (
              <View style={styles.premiumPrompt}>
                <Crown size={32} color={colors.premium} />
                <Text style={styles.premiumPromptText}>{t('premiumSearchHistory')}</Text>
                <TouchableOpacity
                  style={styles.premiumButton}
                  onPress={() => router.push('/premium')}
                >
                  <Text style={styles.premiumButtonText}>{t('upgradeToPremium')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isPremium
                ? t('premiumHistoryInfo')
                : t('freeHistoryInfo')}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginLeft: 8,
    flex: 1,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.lightText,
  },
  historyItem: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySection: {
    padding: 24,
    alignItems: 'center',
  },
  emptySectionText: {
    ...typography.body,
    color: colors.lightText,
    textAlign: 'center',
  },
  searchHistoryItem: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  searchQueryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchQueryText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  searchDateText: {
    ...typography.caption,
    color: colors.lightText,
  },
  noQuotesText: {
    ...typography.caption,
    color: colors.lightText,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  premiumPrompt: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: colors.card,
    margin: 16,
    borderRadius: 12,
  },
  premiumPromptText: {
    ...typography.body,
    color: colors.lightText,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  premiumButton: {
    backgroundColor: colors.premium,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  premiumButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    marginBottom: 24,
  },
  footerText: {
    ...typography.caption,
    color: colors.lightText,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    ...typography.title,
    marginTop: 24,
    marginBottom: 12,
  },
  emptyText: {
    ...typography.body,
    color: colors.lightText,
    textAlign: 'center',
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
