import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

export default function TestScreen() {
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Test Screen</Text>
        <Text style={styles.text}>App is working!</Text>
        <Text style={styles.text}>Platform: {Constants.platform?.ios ? 'iOS' : 'Android'}</Text>
        <Text style={styles.text}>Expo Go: {isExpoGo ? 'Yes' : 'No'}</Text>
        <Text style={styles.text}>Execution Environment: {Constants.executionEnvironment}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
});
