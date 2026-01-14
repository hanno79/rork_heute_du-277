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
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import colors from '@/constants/colors';
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';

export default function RegisterScreen() {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { register } = useAuth();
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

    if (password.length < 6) {
      showAlert('Fehler', 'Das Passwort muss mindestens 6 Zeichen lang sein.', [{ text: 'OK', onPress: () => {} }], '⚠️');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting registration process...');
      const result = await register(email.trim(), password, name.trim());
      console.log('Registration result:', result);

      if (result.success) {
        console.log('Registration successful, navigating to tabs');
        showAlert(
          'Registrierung erfolgreich!',
          'Willkommen bei Heute Du. Sie sind jetzt angemeldet.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
          '🎉'
        );
      } else {
        console.error('Registration failed:', result.error);
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
      console.error('Register error:', err);
      showAlert('Fehler', 'Ein unerwarteter Fehler ist aufgetreten.', [{ text: 'OK', onPress: () => {} }], '❌');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    router.push('/auth/login');
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
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Mindestens 6 Zeichen"
                placeholderTextColor={colors.lightText}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                testID="password-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Passwort bestätigen</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Passwort wiederholen"
                placeholderTextColor={colors.lightText}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                testID="confirm-password-input"
              />
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
});