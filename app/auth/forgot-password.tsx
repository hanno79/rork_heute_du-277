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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import colors from '@/constants/colors';
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';
import useLanguage from '@/hooks/useLanguage';

type Step = 'email' | 'security' | 'password' | 'success';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState<string>('');
  const [securityQuestion, setSecurityQuestion] = useState<string>('');
  const [securityAnswer, setSecurityAnswer] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { showAlert, AlertComponent } = useCustomAlert();
  const { t } = useLanguage();
  const resetPasswordMutation = useMutation(api.auth.resetPasswordWithSecurityAnswer);

  // Query for security question - only runs when email is set and we need it
  const securityQuestionResult = useQuery(
    api.auth.getSecurityQuestion,
    step === 'email' && email.trim() ? { email: email.trim() } : 'skip'
  );

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      showAlert(t('error'), t('authEnterEmailForReset'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showAlert(t('error'), t('authEnterValidEmail'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    setIsLoading(true);

    // Wait for the query result
    // Since useQuery is reactive, we need to check the result
    setTimeout(() => {
      if (securityQuestionResult === undefined) {
        // Still loading
        return;
      }

      if (!securityQuestionResult.found || !securityQuestionResult.question) {
        showAlert(
          t('authNoSecurityQuestion'),
          t('authNoSecurityQuestionSet'),
          [{ text: t('ok'), onPress: () => {} }],
          '❌'
        );
        setIsLoading(false);
        return;
      }

      setSecurityQuestion(securityQuestionResult.question);
      setStep('security');
      setIsLoading(false);
    }, 500);
  };

  const handleSecuritySubmit = () => {
    if (!securityAnswer.trim()) {
      showAlert(t('error'), t('authAnswerQuestion'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    setStep('password');
  };

  const handlePasswordSubmit = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showAlert(t('error'), t('authFillBothPasswordFields'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert(t('error'), t('authPasswordsDontMatch'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    // Password validation
    if (newPassword.length < 8) {
      showAlert(t('error'), t('authPasswordMinLength'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showAlert(t('error'), t('authPasswordUppercase'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      showAlert(t('error'), t('authPasswordLowercase'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showAlert(t('error'), t('authPasswordNumber'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    setIsLoading(true);
    try {
      await resetPasswordMutation({
        email: email.trim(),
        answer: securityAnswer.trim(),
        newPassword: newPassword,
      });

      setStep('success');
    } catch (error: any) {
      const errorMessage = error.message || t('authPasswordResetFailed');
      showAlert(t('error'), errorMessage, [{ text: t('ok'), onPress: () => {} }], '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    router.replace('/auth/login');
  };

  const goBack = () => {
    if (step === 'security') {
      setStep('email');
      setSecurityAnswer('');
    } else if (step === 'password') {
      setStep('security');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      router.back();
    }
  };

  const renderEmailStep = () => (
    <>
      <Text style={styles.title}>{t('authForgotPassword').replace('?', '')}</Text>
      <Text style={styles.subtitle}>
        {t('authEnterEmailForReset')}
      </Text>

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
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleEmailSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{t('authContinue')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSecurityStep = () => (
    <>
      <Text style={styles.title}>{t('authSecurityQuestion')}</Text>
      <Text style={styles.subtitle}>
        {t('authAnswerSecurityQuestion')}
      </Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('authYourSecurityQuestion')}</Text>
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{securityQuestion}</Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('authYourAnswer')}</Text>
          <TextInput
            style={styles.input}
            value={securityAnswer}
            onChangeText={setSecurityAnswer}
            placeholder={t('authEnterYourAnswer')}
            placeholderTextColor={colors.lightText}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSecuritySubmit}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>{t('authContinue')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <Text style={styles.title}>{t('authNewPassword')}</Text>
      <Text style={styles.subtitle}>
        {t('authEnterNewPassword')}
      </Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('authNewPassword')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t('authPasswordRequirements')}
              placeholderTextColor={colors.lightText}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={24}
                color={colors.lightText}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('authConfirmPassword')}</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('authConfirmPasswordPlaceholder')}
              placeholderTextColor={colors.lightText}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={24}
                color={colors.lightText}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handlePasswordSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{t('authResetPasswordButton')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
      </View>
      <Text style={styles.title}>{t('authPasswordResetSuccess')}</Text>
      <Text style={styles.subtitle}>
        {t('authPasswordResetSuccessMessage')}
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={navigateToLogin}
      >
        <Text style={styles.buttonText}>{t('authGoToLogin')}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {step !== 'success' && step !== 'email' && (
            <TouchableOpacity style={styles.backButton} onPress={goBack}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          )}

          {step === 'email' && renderEmailStep()}
          {step === 'security' && renderSecurityStep()}
          {step === 'password' && renderPasswordStep()}
          {step === 'success' && renderSuccessStep()}

          {step === 'email' && (
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>{t('authRememberPassword')}</Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={styles.loginLink}>{t('authSignIn')}</Text>
              </TouchableOpacity>
            </View>
          )}
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
  backButton: {
    position: 'absolute',
    top: 16,
    left: 0,
    padding: 8,
    zIndex: 1,
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
  questionContainer: {
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  questionText: {
    fontSize: 16,
    color: colors.text,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: colors.lightText,
    marginRight: 4,
  },
  loginLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: 24,
  },
});
