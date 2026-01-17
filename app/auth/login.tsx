import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import useLanguage from '@/hooks/useLanguage';
import colors from '@/constants/colors';
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { login } = useAuth();
  const { t } = useLanguage();
  const { alertState, showAlert, AlertComponent } = useCustomAlert();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert(t('error'), t('authFillAllFields'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);

      if (result.success) {
        router.replace('/(tabs)');
      } else {
        showAlert(t('authLoginFailed'), result.error || t('authUnknownError'), [{ text: t('ok'), onPress: () => {} }], '❌');
      }
    } catch (err) {
      showAlert(t('error'), t('authUnexpectedError'), [{ text: t('ok'), onPress: () => {} }], '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToRegister = () => {
    router.push('/auth/register');
  };

  const navigateToForgotPassword = () => {
    router.push('/auth/forgot-password');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('authWelcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('authSignInToAccount')}</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('authEmail')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('authEmailPlaceholder')}
                placeholderTextColor={colors.lightText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                testID="email-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('authPassword')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('authPasswordPlaceholder')}
                  placeholderTextColor={colors.lightText}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  testID="password-input"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={24}
                    color={colors.lightText}
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.forgotPasswordContainer}
                onPress={navigateToForgotPassword}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>{t('authForgotPassword')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              testID="login-button"
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? t('authSigningIn') : t('authSignIn')}
              </Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>{t('authNoAccount')}</Text>
              <TouchableOpacity onPress={navigateToRegister} disabled={isLoading}>
                <Text style={styles.registerLink}>{t('authRegister')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <AlertComponent />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.lightText,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#F8F9FA',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: colors.lightText,
    marginRight: 4,
  },
  registerLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
});
