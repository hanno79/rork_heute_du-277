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
  const resetPasswordMutation = useMutation(api.auth.resetPasswordWithSecurityAnswer);

  // Query for security question - only runs when email is set and we need it
  const securityQuestionResult = useQuery(
    api.auth.getSecurityQuestion,
    step === 'email' && email.trim() ? { email: email.trim() } : 'skip'
  );

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      showAlert('Fehler', 'Bitte geben Sie Ihre E-Mail-Adresse ein.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showAlert('Fehler', 'Bitte geben Sie eine gültige E-Mail-Adresse ein.', [{ text: 'OK', onPress: () => {} }], '⚠️');
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
          'Keine Sicherheitsfrage',
          'Für dieses Konto wurde keine Sicherheitsfrage eingerichtet. Bitte kontaktieren Sie den Support.',
          [{ text: 'OK', onPress: () => {} }],
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
      showAlert('Fehler', 'Bitte beantworten Sie die Sicherheitsfrage.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }

    setStep('password');
  };

  const handlePasswordSubmit = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showAlert('Fehler', 'Bitte füllen Sie beide Passwort-Felder aus.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Fehler', 'Die Passwörter stimmen nicht überein.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }

    // Password validation
    if (newPassword.length < 8) {
      showAlert('Fehler', 'Das Passwort muss mindestens 8 Zeichen lang sein.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showAlert('Fehler', 'Das Passwort muss mindestens einen Großbuchstaben enthalten.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      showAlert('Fehler', 'Das Passwort muss mindestens einen Kleinbuchstaben enthalten.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showAlert('Fehler', 'Das Passwort muss mindestens eine Zahl enthalten.', [{ text: 'OK', onPress: () => {} }], '⚠️');
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
      const errorMessage = error.message || 'Passwort konnte nicht zurückgesetzt werden.';
      showAlert('Fehler', errorMessage, [{ text: 'OK', onPress: () => {} }], '❌');
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
      <Text style={styles.title}>Passwort vergessen?</Text>
      <Text style={styles.subtitle}>
        Geben Sie Ihre E-Mail-Adresse ein, um Ihr Passwort zurückzusetzen.
      </Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>E-Mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Ihre E-Mail-Adresse"
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
            <Text style={styles.buttonText}>Weiter</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSecurityStep = () => (
    <>
      <Text style={styles.title}>Sicherheitsfrage</Text>
      <Text style={styles.subtitle}>
        Beantworten Sie Ihre Sicherheitsfrage, um fortzufahren.
      </Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Ihre Sicherheitsfrage</Text>
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{securityQuestion}</Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Ihre Antwort</Text>
          <TextInput
            style={styles.input}
            value={securityAnswer}
            onChangeText={setSecurityAnswer}
            placeholder="Geben Sie Ihre Antwort ein"
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
          <Text style={styles.buttonText}>Weiter</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <Text style={styles.title}>Neues Passwort</Text>
      <Text style={styles.subtitle}>
        Geben Sie Ihr neues Passwort ein.
      </Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Neues Passwort</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Min. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl"
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
          <Text style={styles.label}>Passwort bestätigen</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Passwort wiederholen"
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
            <Text style={styles.buttonText}>Passwort zurücksetzen</Text>
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
      <Text style={styles.title}>Passwort geändert!</Text>
      <Text style={styles.subtitle}>
        Ihr Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt mit Ihrem neuen Passwort anmelden.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={navigateToLogin}
      >
        <Text style={styles.buttonText}>Zur Anmeldung</Text>
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
              <Text style={styles.loginText}>Erinnern Sie sich an Ihr Passwort?</Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={styles.loginLink}>Anmelden</Text>
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
