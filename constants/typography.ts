import { StyleSheet } from 'react-native';
import colors from './colors';

const typography = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 6,
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    color: colors.lightText,
    lineHeight: 20,
  },
  verse: {
    fontSize: 18,
    fontStyle: 'italic' as const,
    color: colors.text,
    lineHeight: 28,
    marginVertical: 12,
  },
  reference: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
    marginBottom: 16,
    lineHeight: 20,
  },
});

// Add sizes and weights for compatibility
const sizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 24,
};

const weights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export default {
  ...typography,
  sizes,
  weights,
};