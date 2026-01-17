import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import colors from '@/constants/colors';
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';
import useLanguage from '@/hooks/useLanguage';

export default function SecurityQuestionScreen() {
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [securityAnswer, setSecurityAnswer] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { user, isAuthenticated } = useAuth();
  const setSecurityQuestionMutation = useMutation(api.auth.setSecurityQuestion);
  const { showAlert, AlertComponent } = useCustomAlert();
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

  // Query current security question
  const currentQuestion = useQuery(
    api.auth.getSecurityQuestion,
    user?.email ? { email: user.email } : 'skip'
  );

  useEffect(() => {
    if (currentQuestion?.found && currentQuestion.question) {
      // Find the index of the current question in the list
      const index = securityQuestions.findIndex(q => q === currentQuestion.question);
      if (index !== -1) {
        setSelectedQuestionIndex(index);
      }
    }
  }, [currentQuestion, securityQuestions]);

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('profileNotLoggedIn')}</Text>
          <Text style={styles.subtitle}>
            {t('securityQuestionLoginRequired')}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.buttonText}>{t('authGoToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleSave = async () => {
    if (!securityAnswer.trim()) {
      showAlert(t('error'), t('securityQuestionEnterAnswer'), [{ text: t('ok'), onPress: () => {} }], '⚠️');
      return;
    }

    setIsLoading(true);
    try {
      await setSecurityQuestionMutation({
        userId: user.id,
        question: selectedQuestion,
        answer: securityAnswer.trim(),
      });

      showAlert(
        t('securityQuestionSaveSuccess'),
        t('securityQuestionSaveSuccessMessage'),
        [{ text: t('ok'), onPress: () => router.back() }],
        '✅'
      );
      setSecurityAnswer('');
    } catch (error) {
      showAlert(
        t('error'),
        t('securityQuestionSaveFailed'),
        [{ text: t('ok'), onPress: () => {} }],
        '❌'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('securityQuestionTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('securityQuestionDescription')}
          </Text>

          {currentQuestion?.found && (
            <View style={styles.currentQuestionBox}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={styles.currentQuestionText}>
                {t('securityQuestionCurrent')} {currentQuestion.question}
              </Text>
            </View>
          )}

          <Text style={styles.label}>{t('securityQuestionSelectNew')}</Text>
          <View style={styles.questionsList}>
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
          </View>

          <Text style={styles.label}>{t('securityQuestionAnswerLabel')}</Text>
          <TextInput
            style={styles.input}
            value={securityAnswer}
            onChangeText={setSecurityAnswer}
            placeholder={t('securityQuestionAnswerPlaceholder')}
            placeholderTextColor={colors.lightText}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          <Text style={styles.hint}>
            {t('securityQuestionHint')}
          </Text>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {currentQuestion?.found ? t('securityQuestionUpdate') : t('securityQuestionSave')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.lightText,
    marginBottom: 24,
  },
  currentQuestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  currentQuestionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  questionsList: {
    marginBottom: 20,
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#F8F9FA',
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    color: colors.lightText,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
