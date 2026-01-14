import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useQuotes from '@/hooks/useQuotes';
import useLanguage from '@/hooks/useLanguage';
import SearchInput from '@/components/SearchInput';
import QuoteCard from '@/components/QuoteCard';
import PremiumBanner from '@/components/PremiumBanner';
import { Quote } from '@/mocks/quotes';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from '@/providers/AuthProvider';

export default function SearchScreen() {
  const {
    searchQuotes,
    searchResults,
    isSearching,
    hasMoreResults,
    loadMoreResults,
    rateLimit,
    searchSource,
    isGeneratingAI,
  } = useQuotes();
  const { t } = useLanguage();

  // Use Convex as the single source of truth for premium status
  const { user } = useAuth();
  const userProfile = useQuery(
    api.auth.getCurrentUser,
    user?.id ? { userId: user.id } : "skip"
  );
  const isPremium = userProfile?.isPremium === true;
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch rate limit directly from Convex for real-time display
  const rateLimitData = useQuery(
    api.search.checkRateLimit,
    user?.id && isPremium ? { userId: user.id } : "skip"
  );

  const handleSearch = async (query: string) => {
    if (isPremium) {
      await searchQuotes(query);
      setHasSearched(true);
    } else {
      setHasSearched(true);
    }
  };

  const renderItem = ({ item }: { item: Quote }) => (
    <QuoteCard quote={item} compact />
  );

  return (
    <View style={styles.container}>
      <SearchInput 
        onSearch={handleSearch} 
        isPremium={isPremium}
        placeholder={t('searchPlaceholder')}
      />
      
      {!isPremium && (
        <PremiumBanner />
      )}
      
      {/* Rate limit info for premium users - use rateLimitData for initial load, rateLimit for after search */}
      {isPremium && (rateLimitData || rateLimit) && (
        <View style={styles.rateLimitContainer}>
          <Sparkles size={16} color={(rateLimitData?.canUseAI ?? rateLimit?.canUseAI) ? colors.primary : colors.lightText} />
          <Text style={[typography.caption, styles.rateLimitText]}>
            {t('aiSearchesRemaining', {
              remaining: rateLimitData?.remaining ?? rateLimit?.remaining ?? 10,
              max: rateLimitData?.maxSearches ?? rateLimit?.maxSearches ?? 10
            })}
          </Text>
        </View>
      )}

      <View style={styles.resultsContainer}>
        {isSearching || isGeneratingAI ? (
          <View style={styles.loadingContainer}>
            {isGeneratingAI ? (
              <>
                <Sparkles size={32} color={colors.primary} />
                <Text style={[typography.body, styles.loadingText]}>
                  {t('aiGeneratingQuotes')}
                </Text>
                <Text style={[typography.caption, styles.loadingSubtext]}>
                  {t('aiGeneratingWait')}
                </Text>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[typography.body, styles.loadingText]}>{t('searchingQuotes')}</Text>
              </>
            )}
          </View>
        ) : hasSearched ? (
          isPremium ? (
            searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <View>
                    <Text style={[typography.subtitle, styles.resultsHeader]}>
                      {t('foundQuotes', { count: searchResults.length })}
                    </Text>
                    {searchSource === 'ai' && (
                      <View style={styles.aiSourceBadge}>
                        <Sparkles size={14} color={colors.primary} />
                        <Text style={styles.aiSourceText}>
                          {t('personalizedAiResults')}
                        </Text>
                      </View>
                    )}
                  </View>
                }
                ListFooterComponent={
                  hasMoreResults ? (
                    <TouchableOpacity 
                      style={styles.loadMoreButton}
                      onPress={loadMoreResults}
                      testID="load-more-button"
                    >
                      <Text style={[typography.body, styles.loadMoreText]}>
                        {t('loadMore')}
                      </Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={typography.body}>{t('noQuotesFound')}</Text>
                <Text style={[typography.caption, styles.emptySubtext]}>
                  {t('tryDifferentKeywords')}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.premiumLockContainer}>
              <Text style={typography.subtitle}>{t('premiumFeature')}</Text>
              <Text style={[typography.body, styles.premiumText]}>
                {t('upgradeToSearchPremium')}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.initialContainer}>
            <Text style={typography.subtitle}>{t('findRightQuote')}</Text>
            <Text style={[typography.body, styles.initialText]}>
              {isPremium 
                ? t('describeYourSituation')
                : t('upgradeToSearch')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  resultsHeader: {
    marginVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.lightText,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: 'center',
  },
  initialContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  initialText: {
    marginTop: 8,
    textAlign: 'center',
    color: colors.lightText,
  },
  premiumLockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  premiumText: {
    marginTop: 8,
    textAlign: 'center',
    color: colors.lightText,
  },
  loadMoreButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    color: colors.background,
    fontWeight: '600',
  },
  rateLimitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    gap: 8,
  },
  rateLimitText: {
    color: colors.lightText,
  },
  loadingSubtext: {
    marginTop: 8,
    color: colors.lightText,
    textAlign: 'center',
  },
  aiSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  aiSourceText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
});