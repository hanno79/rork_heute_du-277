import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import colors from '@/constants/colors';
import typography from '@/constants/typography';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress: () => void;
}

export interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
  buttons: AlertButton[];
  onClose?: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  icon,
  buttons,
  onClose,
}: CustomAlertProps) {
  const handleOverlayPress = () => {
    // Find cancel button and call its onPress, or use onClose
    const cancelButton = buttons.find((b) => b.style === 'cancel');
    if (cancelButton) {
      cancelButton.onPress();
    } else if (onClose) {
      onClose();
    }
  };

  const getButtonStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return styles.buttonDestructive;
      case 'cancel':
        return styles.buttonCancel;
      default:
        return styles.buttonDefault;
    }
  };

  const getButtonTextStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return styles.buttonTextDestructive;
      case 'cancel':
        return styles.buttonTextCancel;
      default:
        return styles.buttonTextDefault;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleOverlayPress}
    >
      <Pressable style={styles.overlay} onPress={handleOverlayPress}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {icon && <Text style={styles.icon}>{icon}</Text>}

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  getButtonStyle(button.style),
                  buttons.length === 1 && styles.buttonFull,
                ]}
                onPress={button.onPress}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, getButtonTextStyle(button.style)]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: colors.text,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    color: colors.lightText,
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonFull: {
    flex: 1,
  },
  buttonDefault: {
    backgroundColor: colors.primary,
  },
  buttonCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDestructive: {
    backgroundColor: colors.error,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDefault: {
    color: colors.white,
  },
  buttonTextCancel: {
    color: colors.text,
  },
  buttonTextDestructive: {
    color: colors.white,
  },
});

// Helper hook for managing alert state
export function useCustomAlert() {
  const [alertState, setAlertState] = React.useState<{
    visible: boolean;
    title: string;
    message: string;
    icon?: string;
    buttons: AlertButton[];
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  const showAlert = (
    title: string,
    message: string,
    buttons: AlertButton[],
    icon?: string
  ) => {
    setAlertState({
      visible: true,
      title,
      message,
      icon,
      buttons: buttons.map((btn) => ({
        ...btn,
        onPress: () => {
          btn.onPress();
          hideAlert();
        },
      })),
    });
  };

  const hideAlert = () => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  };

  return {
    alertState,
    showAlert,
    hideAlert,
    AlertComponent: () => (
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        icon={alertState.icon}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    ),
  };
}
