import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Quote } from '@/mocks/quotes';
import colors from '@/constants/colors';
import typography from '@/constants/typography';
import useLanguage from '@/hooks/useLanguage';
import { useFavorites } from '@/hooks/useFavorites';
import { useRouter } from 'expo-router';

interface QuoteCardProps {
  quote: Quote;
  compact?: boolean;
}

export default function QuoteCard({ quote, compact = false }: QuoteCardProps) {
  const router = useRouter();
  const { t, currentLanguage } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isToggling, setIsToggling] = useState<boolean>(false);

  const handlePress = () => {
    router.push({
      pathname: '/quote/[id]',
      params: { id: quote.id }
    });
  };

  const handleFavoritePress = async () => {
    if (isToggling) return;

    setIsToggling(true);
    try {
      const result = await toggleFavorite(quote);

      if (result.requiresLogin) {
        // User is not logged in
        if (Platform.OS !== 'web') {
          Alert.alert(
            t('loginRequiredForFavorites'),
            t('loginRequiredMessage'),
            [
              {
                text: t('cancelButton'),
                style: 'cancel',
              },
              {
                text: t('loginButton'),
                onPress: () => {
                  router.push('/auth/login');
                },
              },
            ]
          );
        }
      } else if (result.success) {
        // Successfully added/removed favorite
        const message = result.wasAdded ? t('addedToFavorites') : t('removedFromFavorites');

        if (Platform.OS !== 'web') {
          Alert.alert('', message);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsToggling(false);
    }
  };

  // Get localized content
  const localizedQuote = quote.translations[currentLanguage];
  const displayText = localizedQuote?.text || quote.text;
  const displaySituations = localizedQuote?.situations || quote.situations;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bible': return t('bibleVerse');
      case 'quote': return t('quote');
      case 'saying': return t('saying');
      case 'poem': return t('poem');
      default: return t('quote');
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.card, compact && styles.compactCard]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.typeContainer}>
          <Text style={styles.typeLabel}>{getTypeLabel(quote.type)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={handleFavoritePress}
          disabled={isToggling}
          activeOpacity={0.7}
        >
          <Heart 
            size={20} 
            color={isFavorite(quote.id) ? colors.primary : colors.lightText}
            fill={isFavorite(quote.id) ? colors.primary : 'transparent'}
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.quoteContainer}>
        <Text style={typography.verse}>&quot;{displayText}&quot;</Text>
        <Text style={typography.reference}>
          {quote.author ? `— ${quote.author}` : quote.reference}
        </Text>
      </View>
      
      {!compact && (
        <View style={styles.situationsContainer}>
          <Text style={typography.subtitle}>{t('relevantForLabel')}</Text>
          <View style={styles.tagsContainer}>
            {displaySituations.slice(0, 3).map((situation, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{situation}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: Platform.OS === 'android' ? 3 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 2 } : { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
    shadowRadius: Platform.OS === 'ios' ? 4 : 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  favoriteButton: {
    padding: 4,
    marginTop: -4,
    marginRight: -4,
  },
  compactCard: {
    padding: 12,
    marginVertical: 6,
  },
  quoteContainer: {
    marginBottom: 12,
  },
  typeContainer: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  situationsContainer: {
    marginTop: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
});