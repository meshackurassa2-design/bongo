import { Alert } from 'react-native';

// Catch any unhandled JS errors and show them in a native alert before crashing
const originalHandler = global.ErrorUtils?.getGlobalHandler();
if (global.ErrorUtils) {
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      Alert.alert(
        'Fatal JS Error Caught!',
        `Error: ${error.message}\n\nPlease take a screenshot of this error.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.error('Failed to show error alert', e);
    }
    
    // Call the original handler after showing the alert
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

import 'expo-router/entry';
