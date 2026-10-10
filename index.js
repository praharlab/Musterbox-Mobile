/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Background FCM messages must be handled outside React. The backend sends notification
// payloads (displayed by the OS); taps are routed in navigation/RootNavigator.
try {
  const messaging = require('@react-native-firebase/messaging');
  messaging.setBackgroundMessageHandler(messaging.getMessaging(), async () => undefined);
} catch {
  // Firebase not configured: push is disabled.
}

AppRegistry.registerComponent(appName, () => App);
