import React, { useState, useRef } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, Platform } from 'react-native';
import { Search, Mic, MicOff } from 'lucide-react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import colors from '@/constants/colors';
import useLanguage from '@/hooks/useLanguage';
import CustomAlert, { useCustomAlert } from '@/components/CustomAlert';

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  isPremium: boolean;
}

export default function SearchInput({ onSearch, placeholder, isPremium }: SearchInputProps) {
  const [query, setQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { t, currentLanguage } = useLanguage();
  const { alertState, showAlert, AlertComponent } = useCustomAlert();

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleVoiceInput = async () => {
    if (!isPremium) {
      showAlert('Premium Feature', t('voiceInputPremium'), [{ text: 'OK', onPress: () => {} }], '👑');
      return;
    }

    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      console.log('Starting voice recording...');
      setIsRecording(true);

      if (Platform.OS === 'web') {
        // Web implementation using MediaRecorder
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          } 
        });
        console.log('Got media stream:', stream.getAudioTracks().length, 'audio tracks');
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          console.log('Audio data available:', event.data.size, 'bytes');
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          console.log('MediaRecorder stopped, processing audio chunks:', audioChunks.length);
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          console.log('Created audio blob:', { size: audioBlob.size, type: audioBlob.type });
          await transcribeAudio(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
      } else {
        // Mobile implementation using expo-audio
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          showAlert('Berechtigung erforderlich', 'Mikrofonberechtigung wird für die Spracheingabe benötigt.', [{ text: 'OK', onPress: () => {} }], '🎤');
          setIsRecording(false);
          return;
        }

        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      showAlert('Fehler', 'Aufnahme konnte nicht gestartet werden. Bitte versuchen Sie es erneut.', [{ text: 'OK', onPress: () => {} }], '❌');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Stopping voice recording...');
      setIsRecording(false);
      setIsTranscribing(true);

      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
      } else {
        await audioRecorder.stop();
        
        if (audioRecorder.uri) {
          console.log('Recording URI:', audioRecorder.uri);
          const uriParts = audioRecorder.uri.split('.');
          const fileType = uriParts[uriParts.length - 1];
          const audioFile = {
            uri: audioRecorder.uri,
            name: "recording." + fileType,
            type: "audio/" + fileType
          };
          console.log('Created audio file object:', audioFile);
          await transcribeAudio(audioFile);
        } else {
          console.error('No recording URI available');
          showAlert('Fehler', 'Aufnahme konnte nicht gespeichert werden.', [{ text: 'OK', onPress: () => {} }], '❌');
        }
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      showAlert('Fehler', 'Aufnahme konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.', [{ text: 'OK', onPress: () => {} }], '❌');
      setIsTranscribing(false);
    }
  };

  const transcribeAudio = async (audioData: any) => {
    try {
      console.log('Transcribing audio...', { audioData: typeof audioData, platform: Platform.OS });
      
      // Validate audio data
      if (!audioData) {
        throw new Error('No audio data provided');
      }

      const formData = new FormData();
      
      // Handle different platforms differently
      if (Platform.OS === 'web') {
        // For web, audioData should be a Blob
        if (!(audioData instanceof Blob)) {
          throw new Error('Invalid audio data format for web');
        }
        formData.append('audio', audioData, 'recording.wav');
      } else {
        // For mobile, audioData should have uri, name, type
        if (!audioData.uri || !audioData.name || !audioData.type) {
          throw new Error('Invalid audio data format for mobile');
        }
        formData.append('audio', audioData as any);
      }
      
      // Add language preference
      formData.append('language', currentLanguage === 'de' ? 'de' : 'en');

      console.log('Sending transcription request...');
      const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription API error:', response.status, errorText);
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Transcription result:', result);
      
      // Validate the result
      if (!result || typeof result.text !== 'string') {
        throw new Error('Invalid transcription response format');
      }
      
      const transcribedText = result.text.trim();
      
      // Check for suspicious results that might indicate wrong audio source
      const suspiciousTexts = [
        'untertitel der amara.org-community',
        'amara.org',
        'subtitle',
        'untertitel'
      ];
      
      const isSuspicious = suspiciousTexts.some(suspicious => 
        transcribedText.toLowerCase().includes(suspicious.toLowerCase())
      );
      
      if (isSuspicious) {
        console.warn('Suspicious transcription result detected:', transcribedText);
        showAlert(
          'Aufnahme-Problem',
          'Die Spracherkennung hat ein unerwartetes Ergebnis geliefert. Bitte versuchen Sie es erneut und sprechen Sie deutlich.',
          [{ text: 'OK', onPress: () => {} }],
          '⚠️'
        );
        return;
      }
      
      if (transcribedText && transcribedText.length > 0) {
        console.log('Setting transcribed text:', transcribedText);
        setQuery(transcribedText);
        onSearch(transcribedText);
      } else {
        showAlert(
          'Keine Sprache erkannt',
          'Bitte sprechen Sie deutlicher und versuchen Sie es erneut.',
          [{ text: 'OK', onPress: () => {} }],
          '🎤'
        );
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      showAlert(
        'Fehler bei der Spracherkennung',
        'Die Spracherkennung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.',
        [{ text: 'OK', onPress: () => {} }],
        '❌'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Search size={20} color={colors.lightText} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder || t('searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          placeholderTextColor={colors.lightText}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity 
        style={[
          styles.voiceButton, 
          !isPremium && styles.disabledButton,
          isRecording && styles.recordingButton
        ]} 
        onPress={handleVoiceInput}
        disabled={!isPremium || isTranscribing}
      >
        {isTranscribing ? (
          <Text style={styles.transcribingText}>...</Text>
        ) : isRecording ? (
          <MicOff size={20} color="white" />
        ) : (
          <Mic size={20} color={!isPremium ? colors.lightText : 'white'} />
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.searchButton, !isPremium && styles.disabledButton]}
        onPress={handleSearch}
        disabled={!isPremium || query.length === 0}
      >
        <Text style={[styles.searchButtonText, !isPremium && styles.disabledButtonText]}>
          {t('searchButton')}
        </Text>
      </TouchableOpacity>
      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 10,
    minHeight: 40,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    color: colors.lightText,
    fontSize: 16,
  },
  voiceButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 10,
    marginLeft: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: colors.border,
  },
  disabledButtonText: {
    color: colors.lightText,
  },
  recordingButton: {
    backgroundColor: '#ff4444',
  },
  transcribingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});