import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

/** App mark generated from assets/brand/logo.svg (same image as the native splash). */
export function Logo({
  size = 88,
  inverse = false,
  subtitle,
}: {
  size?: number;
  inverse?: boolean;
  subtitle?: string;
}) {
  return (
    <View style={styles.wrap} accessible accessibilityLabel="MusterBox">
      <Image
        source={require('../../assets/bootsplash/logo.png')}
        style={[styles.mark, { width: size, height: size, borderRadius: size * 0.23 }]}
        accessibilityIgnoresInvertColors
      />
      <Text style={[styles.name, inverse && styles.inverse]}>MusterBox</Text>
      {subtitle ? <Text style={[styles.subtitle, inverse && styles.inverseMuted]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  mark: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  name: { fontSize: 28, fontWeight: '800', color: colors.primary, marginTop: spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  inverse: { color: colors.textInverse },
  inverseMuted: { color: 'rgba(255,255,255,0.8)' },
});
