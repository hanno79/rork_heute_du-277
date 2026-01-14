import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useQuotes from '@/hooks/useQuotes';
import useLanguage from '@/hooks/useLanguage';
import QuoteCard from '@/components/QuoteCard';

export default function HomeScreen() {
  const { quoteOfTheDay } = useQuotes();
  const { t, currentLanguage } = useLanguage();

  // Localized date based on user language
  const localizedDate = new Date().toLocaleDateString(
    currentLanguage === 'de' ? 'de-DE' : 'en-US',
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  if (!quoteOfTheDay) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={typography.body}>{t('loadingQuote')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.dateText}>{localizedDate}</Text>
        </View>

        <QuoteCard quote={quoteOfTheDay} />

        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('context')}</Text>
          <Text style={typography.body}>{quoteOfTheDay.context}</Text>
        </View>

        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('explanation')}</Text>
          <Text style={typography.body}>{quoteOfTheDay.explanation}</Text>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  dateText: {
    ...typography.caption,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    marginTop: 8,
  },
});
