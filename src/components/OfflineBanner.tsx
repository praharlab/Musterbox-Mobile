import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors, spacing } from '../theme';

export function OfflineBanner() {
  const online = useNetworkStatus();
  const insets = useSafeAreaInsets();
  if (online) {
    return null;
  }
  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + spacing.sm }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <Text style={styles.text}>You are offline. Actions will not be sent until you reconnect.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.warning, padding: spacing.sm },
  text: { color: colors.textInverse, textAlign: 'center', fontSize: 13 },
});
