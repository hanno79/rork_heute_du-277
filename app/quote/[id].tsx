import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Share2, ArrowLeft, Heart } from 'lucide-react-native';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';
import { useFavorites } from '@/hooks/useFavorites';
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams();
  const { t, currentLanguage } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const router = useRouter();
  const { alertState, showAlert, AlertComponent } = useCustomAlert();

  // Get quote from Convex
  const quoteData = useQuery(api.quotes.getQuoteById, { quoteId: id as any });

  if (!quoteData) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={typography.body}>{t('quoteNotFound')}</Text>
      </SafeAreaView>
    );
  }

  // Normalize Convex quote to local Quote format
  // Convex uses _id/category, local uses id/type
  // Preserve _id for Convex operations (favorites, etc.)
  const quote = {
    id: quoteData._id,
    _id: quoteData._id, // Preserve for Convex operations
    text: quoteData.text,
    reference: quoteData.reference || quoteData.author || '',
    author: quoteData.author,
    // Extract book name from reference, handling numbered books like "1. Mose 3:15"
    book: quoteData.reference?.match(/^(\d+\.\s*)?[A-Za-zäöüÄÖÜß]+/)?.[0]?.trim(),
    type: quoteData.category || 'quote',
    context: quoteData.context || '',
    explanation: quoteData.explanation || '',
    situations: quoteData.situations || [],
    tags: quoteData.tags || [],
    translations: quoteData.translations || {},
    reflectionQuestions: quoteData.reflectionQuestions || [],
    practicalTips: quoteData.practicalTips || [],
  };

  // Get localized content with proper typing
  const localizedQuote = quote.translations?.[currentLanguage];
  const displayText: string = localizedQuote?.text || quote.text || '';
  const displayContext: string = localizedQuote?.context || quote.context || '';
  const displayExplanation: string = localizedQuote?.explanation || quote.explanation || '';
  const displaySituations: string[] = localizedQuote?.situations || quote.situations || [];
  const displayTags: string[] = localizedQuote?.tags || quote.tags || [];
  const displayReflectionQuestions: string[] = localizedQuote?.reflectionQuestions || quote.reflectionQuestions || [];
  const displayPracticalTips: string[] = localizedQuote?.practicalTips || quote.practicalTips || [];

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bible': return t('bibleVerse');
      case 'quote': return t('quote');
      case 'saying': return t('saying');
      case 'poem': return t('poem');
      default: return t('quote');
    }
  };
  
  const handleShare = async () => {
    try {
      const shareText = quote.author 
        ? `"${displayText}" — ${quote.author}`
        : `"${displayText}" - ${quote.reference}`;
      
      await Share.share({
        message: `${shareText}

Shared from ${t('appName')}`,
      });
    } catch (error) {
      // Share cancelled or failed - no action needed
    }
  };
  
  const handleFavoritePress = async () => {
    if (isToggling) return;

    setIsToggling(true);
    try {
      const result = await toggleFavorite(quote);

      if (result.requiresLogin) {
        // User is not logged in
        showAlert(
          t('loginRequiredForFavorites'),
          t('loginRequiredMessage'),
          [
            {
              text: t('cancelButton'),
              style: 'cancel',
              onPress: () => {},
            },
            {
              text: t('loginButton'),
              onPress: () => {
                router.push('/auth/login');
              },
            },
          ],
          '🔐'
        );
      } else if (result.success) {
        // Successfully added/removed favorite
        const message = result.wasAdded ? t('addedToFavorites') : t('removedFromFavorites');
        const icon = result.wasAdded ? '❤️' : '💔';

        showAlert(
          'Favorit',
          message,
          [{ text: 'OK', onPress: () => {} }],
          icon
        );
      }
    } catch (error) {
      // Favorite toggle failed - error already handled by useFavorites
    } finally {
      setIsToggling(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{
          title: quote.author || quote.reference,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <TouchableOpacity 
                onPress={handleFavoritePress} 
                style={styles.favoriteButton}
                disabled={isToggling}
              >
                <Heart 
                  size={20} 
                  color={isFavorite(quote.id) ? colors.primary : colors.text}
                  fill={isFavorite(quote.id) ? colors.primary : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
                <Share2 size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.quoteContainer}>
          <Text style={styles.typeLabel}>{getTypeLabel(quote.type)}</Text>
          <Text style={styles.quoteText}>&quot;{displayText}&quot;</Text>
          <Text style={styles.reference}>
            {quote.author ? `— ${quote.author}` : quote.reference}
          </Text>
        </View>

        {quote.book && (
          <View style={styles.section}>
            <Text style={typography.subtitle}>{t('book')}</Text>
            <Text style={typography.body}>{quote.book}</Text>
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('context')}</Text>
          <Text style={typography.body}>{displayContext}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('explanation')}</Text>
          <Text style={typography.body}>{displayExplanation}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('relevantSituations')}</Text>
          <View style={styles.tagsContainer}>
            {displaySituations.map((situation, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{situation}</Text>
              </View>
            ))}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={typography.subtitle}>{t('tags')}</Text>
          <View style={styles.tagsContainer}>
            {displayTags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {displayReflectionQuestions && displayReflectionQuestions.length > 0 && (
          <View style={styles.section}>
            <Text style={typography.subtitle}>{t('reflectionQuestions')}</Text>
            {displayReflectionQuestions.map((question, index) => (
              <View key={index} style={styles.questionItem}>
                <Text style={styles.questionNumber}>{index + 1}.</Text>
                <Text style={[typography.body, styles.questionText]}>{question}</Text>
              </View>
            ))}
          </View>
        )}

        {displayPracticalTips && displayPracticalTips.length > 0 && (
          <View style={styles.section}>
            <Text style={typography.subtitle}>{t('practicalApplication')}</Text>
            {displayPracticalTips.map((tip, index) => (
              <View key={index} style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={[typography.body, styles.tipText]}>{tip}</Text>
              </View>
            ))}
            <View style={styles.disclaimerContainer}>
              <Text style={[typography.caption, styles.disclaimerText]}>
                {t('disclaimerText')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      <AlertComponent />
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
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteButton: {
    padding: 8,
    marginRight: 4,
  },
  shareButton: {
    padding: 8,
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  quoteContainer: {
    padding: 20,
    backgroundColor: colors.card,
    margin: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: Platform.OS === 'android' ? 3 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 2 } : { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
    shadowRadius: Platform.OS === 'ios' ? 4 : 0,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 20,
    fontStyle: 'italic',
    color: colors.text,
    lineHeight: 28,
    marginBottom: 12,
  },
  reference: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginTop: 8,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 8,
    marginTop: 2,
  },
  questionText: {
    flex: 1,
    lineHeight: 22,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    marginTop: 4,
  },
  tipBullet: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 8,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    lineHeight: 22,
  },
  disclaimerContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  disclaimerText: {
    color: colors.lightText,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});