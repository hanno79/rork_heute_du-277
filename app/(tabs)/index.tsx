import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useQuotes from '@/hooks/useQuotes';
import useLanguage from '@/hooks/useLanguage';
import QuoteCard from '@/components/QuoteCard';

export default function HomeScreen() {
  const { quoteOfTheDay } = useQuotes();
  const { t } = useLanguage();

  if (!quoteOfTheDay) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={typography.body}>{t('loadingQuote')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: t('todaysQuote'),
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }} 
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={typography.title}>{t('todayQuote')}</Text>
          <Text style={typography.caption}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  section: {
    padding: 16,
    marginTop: 8,
  },
});