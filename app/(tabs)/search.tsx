import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useQuotes from '@/hooks/useQuotes';
import useSubscription from '@/hooks/useSubscription';
import useLanguage from '@/hooks/useLanguage';
import SearchInput from '@/components/SearchInput';
import QuoteCard from '@/components/QuoteCard';
import PremiumBanner from '@/components/PremiumBanner';
import { Quote } from '@/mocks/quotes';

export default function SearchScreen() {
  const { searchQuotes, searchResults, isSearching, hasMoreResults, loadMoreResults } = useQuotes();
  const { isPremium } = useSubscription();
  const { t } = useLanguage();
  const [hasSearched, setHasSearched] = useState(false);

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
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: t('searchQuotes'),
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }} 
      />
      
      <SearchInput 
        onSearch={handleSearch} 
        isPremium={isPremium}
        placeholder={t('searchPlaceholder')}
      />
      
      {!isPremium && (
        <PremiumBanner />
      )}
      
      <View style={styles.resultsContainer}>
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.body, styles.loadingText]}>{t('searchingQuotes')}</Text>
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
                  <Text style={[typography.subtitle, styles.resultsHeader]}>
                    {t('foundQuotes', { count: searchResults.length })}
                  </Text>
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
    </SafeAreaView>
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
});