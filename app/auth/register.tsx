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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import colors from '@/constants/colors';
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';

const SECURITY_QUESTIONS = [
  'Name Ihres ersten Haustieres?',
  'Geburtsstadt Ihrer Mutter?',
  'Name Ihrer ersten Schule?',
  'Lieblingsfilm aus Ihrer Kindheit?',
  'Name Ihres besten Freundes aus der Kindheit?',
];

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
  const [selectedQuestion, setSelectedQuestion] = useState<string>(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState<string>('');
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  const { register } = useAuth();
  const setSecurityQuestionMutation = useMutation(api.auth.setSecurityQuestion);
  const { alertState, showAlert, AlertComponent } = useCustomAlert();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      showAlert('Fehler', 'Bitte füllen Sie alle Felder aus.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Fehler', 'Die Passwörter stimmen nicht überein.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }

    // Enhanced password validation (min 8 chars, uppercase, lowercase, number)
    if (password.length < 8) {
      showAlert('Fehler', 'Das Passwort muss mindestens 8 Zeichen lang sein.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showAlert('Fehler', 'Das Passwort muss mindestens einen Großbuchstaben enthalten.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[a-z]/.test(password)) {
      showAlert('Fehler', 'Das Passwort muss mindestens einen Kleinbuchstaben enthalten.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }
    if (!/[0-9]/.test(password)) {
      showAlert('Fehler', 'Das Passwort muss mindestens eine Zahl enthalten.', [{ text: 'OK', onPress: () => {} }], '⚠️');
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
            'Registrierung erfolgreich!',
            'Willkommen bei Heute Du. Sie sind jetzt angemeldet.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
            '🎉'
          );
        }
      } else {
        const errorMessage = result.error || 'Unbekannter Fehler';

        // Provide more user-friendly error messages
        let displayMessage = errorMessage;
        if (errorMessage.includes('email confirmation')) {
          displayMessage = 'Die Registrierung war erfolgreich! Sie können sich jetzt mit Ihren Daten anmelden.';
          showAlert('Registrierung abgeschlossen', displayMessage, [
            { text: 'Zur Anmeldung', onPress: () => router.push('/auth/login') }
          ], '✅');
          return;
        }

        showAlert('Registrierung fehlgeschlagen', displayMessage, [{ text: 'OK', onPress: () => {} }], '❌');
      }
    } catch (err) {
      showAlert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.', [{ text: 'OK', onPress: () => {} }], '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    router.push('/auth/login');
  };

  const handleSaveSecurityQuestion = async () => {
    if (!securityAnswer.trim()) {
      showAlert('Fehler', 'Bitte geben Sie eine Antwort ein.', [{ text: 'OK', onPress: () => {} }], '⚠️');
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
        'Registrierung abgeschlossen!',
        'Ihre Sicherheitsfrage wurde gespeichert. Willkommen bei Heute Du!',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
        '🎉'
      );
    } catch (error) {
      // Save failed, but registration succeeded - let user continue
      setShowSecurityModal(false);
      showAlert(
        'Registrierung erfolgreich!',
        'Willkommen bei Heute Du. (Sicherheitsfrage konnte nicht gespeichert werden)',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
        '🎉'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipSecurityQuestion = () => {
    setShowSecurityModal(false);
    showAlert(
      'Registrierung erfolgreich!',
      'Willkommen bei Heute Du. Sie können die Sicherheitsfrage später in den Einstellungen hinzufügen.',
      [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
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
          <Text style={styles.title}>Konto erstellen</Text>
          <Text style={styles.subtitle}>Registrieren Sie sich für Heute Du.</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ihr vollständiger Name"
                placeholderTextColor={colors.lightText}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isLoading}
                testID="name-input"
              />
            </View>

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
                testID="email-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Passwort</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl"
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
                {isLoading ? 'Registrieren...' : 'Registrieren'}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Bereits ein Konto?</Text>
              <TouchableOpacity onPress={navigateToLogin} disabled={isLoading}>
                <Text style={styles.loginLink}>Anmelden</Text>
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
            <Text style={styles.modalTitle}>Sicherheitsfrage einrichten</Text>
            <Text style={styles.modalSubtitle}>
              Diese Frage hilft Ihnen, Ihr Passwort zurückzusetzen, falls Sie es vergessen.
            </Text>

            <Text style={styles.label}>Wählen Sie eine Frage</Text>
            <ScrollView style={styles.questionsList} nestedScrollEnabled>
              {SECURITY_QUESTIONS.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.questionOption,
                    selectedQuestion === question && styles.questionOptionSelected
                  ]}
                  onPress={() => setSelectedQuestion(question)}
                >
                  <Text style={[
                    styles.questionOptionText,
                    selectedQuestion === question && styles.questionOptionTextSelected
                  ]}>
                    {question}
                  </Text>
                  {selectedQuestion === question && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Ihre Antwort</Text>
            <TextInput
              style={styles.input}
              value={securityAnswer}
              onChangeText={setSecurityAnswer}
              placeholder="Geben Sie Ihre Antwort ein"
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
                {isLoading ? 'Speichern...' : 'Speichern'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipSecurityQuestion}
              disabled={isLoading}
            >
              <Text style={styles.skipButtonText}>Später einrichten</Text>
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