import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import colors from '@/constants/colors';
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';
import useLanguage from '@/hooks/useLanguage';

export default function RegisterScreen() {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Security question state
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [securityAnswer, setSecurityAnswer] = useState<string>('');
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  const { register } = useAuth();
  const setSecurityQuestionMutation = useMutation(api.auth.setSecurityQuestion);
  const { alertState, showAlert, AlertComponent } = useCustomAlert();
  const { t } = useLanguage();

  // Translated security questions - memoized to avoid re-creating on every render
  const securityQuestions = useMemo(() => [
    t('securityQuestionPet'),
    t('securityQuestionMotherCity'),
    t('securityQuestionSchool'),
    t('securityQuestionMovie'),
    t('securityQuestionFriend'),
  ], [t]);

  const selectedQuestion = securityQuestions[selectedQuestionIndex];

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      showAlert(t('error'), t('authFillAllFields'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    if (password !== confirmPassword) {
      showAlert(t('error'), t('authPasswordsDontMatch'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    // Enhanced password validation (min 8 chars, uppercase, lowercase, number)
    if (password.length < 8) {
      showAlert(t('error'), t('authPasswordMinLength'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showAlert(t('error'), t('authPasswordUppercase'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[a-z]/.test(password)) {
      showAlert(t('error'), t('authPasswordLowercase'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[0-9]/.test(password)) {
      showAlert(t('error'), t('authPasswordNumber'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(email.trim(), password, name.trim());

      if (result.success) {
        // Store the user ID and show security question modal
        if (result.userId) {
          setRegisteredUserId(result.userId);
          setShowSecurityModal(true);
        } else {
          // Fallback if no userId returned - go directly to app
          showAlert(
            t('authRegistrationSuccess'),
            t('authWelcomeToApp'),
            [{ text: t('ok'), onPress: () => router.replace('/(tabs)') }],
            '🎉'
          );
        }
      } else {
        const errorMessage = result.error || t('authUnknownError');

        // Provide more user-friendly error messages
        let displayMessage = errorMessage;
        if (errorMessage.includes('email confirmation')) {
          displayMessage = t('authRegistrationCompleteLogin');
          showAlert(t('authRegistrationComplete'), displayMessage, [
            { text: t('authGoToLogin'), onPress: () => router.push('/auth/login') }
          ], '✅');
          return;
        }

        showAlert(t('authRegistrationFailed'), displayMessage, [{ text: t('ok'), onPress: () => {} }], '❌');
      }
    } catch (err) {
      showAlert(t('error'), t('authUnexpectedError'), [{ text: t('ok'), onPress: () => {} }], '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    router.push('/auth/login');
  };

  const handleSaveSecurityQuestion = async () => {
    if (!securityAnswer.trim()) {
      showAlert(t('error'), t('authEnterAnswer'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    if (!registeredUserId) {
      setShowSecurityModal(false);
      router.replace('/(tabs)');
      return;
    }

    setIsLoading(true);
    try {
      await setSecurityQuestionMutation({
        userId: registeredUserId,
        question: selectedQuestion,
        answer: securityAnswer.trim(),
      });

      setShowSecurityModal(false);
      showAlert(
        t('authRegistrationComplete'),
        t('authSecurityQuestionSaved'),
        [{ text: t('ok'), onPress: () => router.replace('/(tabs)') }],
        '🎉'
      );
    } catch (error) {
      // Save failed, but registration succeeded - let user continue
      setShowSecurityModal(false);
      showAlert(
        t('authRegistrationSuccess'),
        t('authSecurityQuestionFailed'),
        [{ text: t('ok'), onPress: () => router.replace('/(tabs)') }],
        '🎉'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipSecurityQuestion = () => {
    setShowSecurityModal(false);
    showAlert(
      t('authRegistrationSuccess'),
      t('authSecurityQuestionSkipped'),
      [{ text: t('ok'), onPress: () => router.replace('/(tabs)') }],
      '🎉'
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('authCreateAccount')}</Text>
          <Text style={styles.subtitle}>{t('authCreateYourAccount')}</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('authName')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('authNamePlaceholder')}
                placeholderTextColor={colors.lightText}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isLoading}
                testID="name-input"
              />
            </View>

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
                  placeholder={t('authPasswordRequirements')}
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
                  testID="confirm-password-input"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
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
              style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              testID="register-button"
            >
              <Text style={styles.registerButtonText}>
                {isLoading ? t('authRegistering') : t('authRegister')}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>{t('authAlreadyHaveAccount')}</Text>
              <TouchableOpacity onPress={navigateToLogin} disabled={isLoading}>
                <Text style={styles.loginLink}>{t('authSignIn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <AlertComponent />

      {/* Security Question Modal */}
      <Modal
        visible={showSecurityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('authSetupSecurityQuestion')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('authSecurityQuestionHelp')}
            </Text>

            <Text style={styles.label}>{t('authChooseQuestion')}</Text>
            <ScrollView style={styles.questionsList} nestedScrollEnabled>
              {securityQuestions.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.questionOption,
                    selectedQuestionIndex === index && styles.questionOptionSelected
                  ]}
                  onPress={() => setSelectedQuestionIndex(index)}
                >
                  <Text style={[
                    styles.questionOptionText,
                    selectedQuestionIndex === index && styles.questionOptionTextSelected
                  ]}>
                    {question}
                  </Text>
                  {selectedQuestionIndex === index && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>{t('authYourAnswer')}</Text>
            <TextInput
              style={styles.input}
              value={securityAnswer}
              onChangeText={setSecurityAnswer}
              placeholder={t('authEnterYourAnswer')}
              placeholderTextColor={colors.lightText}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
              onPress={handleSaveSecurityQuestion}
              disabled={isLoading}
            >
              <Text style={styles.registerButtonText}>
                {isLoading ? t('authSaving') : t('authSave')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipSecurityQuestion}
              disabled={isLoading}
            >
              <Text style={styles.skipButtonText}>{t('authSetupLater')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.lightText,
    textAlign: 'center',
    marginBottom: 24,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: colors.lightText,
  },
  questionsList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  questionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionOptionSelected: {
    backgroundColor: '#F0F4FF',
    borderColor: colors.primary,
  },
  questionOptionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginRight: 8,
  },
  questionOptionTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
});