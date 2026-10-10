import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, spacing, Tone, toneColors, TOUCH_MIN } from '../theme';

// ---------------- Layout ----------------
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  edges = ['left', 'right'],
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  /** Screens without a navigation header should also pass 'top' (and 'bottom' when there is no tab bar). */
  edges?: Edge[];
}) {
  const content = padded ? styles.padded : undefined;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={font.heading} accessibilityRole="header">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function KeyValue({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.kv}>
      <Text style={font.label}>{label}</Text>
      <Text style={[font.body, styles.kvValue]} selectable={false}>
        {value === undefined || value === null || value === '' ? '—' : String(value)}
      </Text>
    </View>
  );
}

// ---------------- Controls ----------------
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  large,
  testID,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  large?: boolean;
  testID?: string;
  accessibilityHint?: string;
}) {
  const isDisabled = disabled || loading;
  // A disabled primary/danger button is shown in a flat grey-blue rather than a washed-out brand colour.
  const muted = !!disabled && !loading && (variant === 'primary' || variant === 'danger');
  const v = muted
    ? { bg: colors.disabledFill, fg: colors.disabledText, border: colors.disabledFill }
    : buttonVariants[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && styles.pressed,
        isDisabled && !muted && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.buttonText, large && styles.buttonTextLarge, { color: v.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.textInverse, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  danger: { bg: colors.danger, fg: colors.textInverse, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function TextField({
  label,
  error,
  hint,
  secureToggle,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Adds a Show/Hide control for password fields. */
  secureToggle?: boolean;
}) {
  const [focused, setFocused] = React.useState(false);
  const [hidden, setHidden] = React.useState(true);
  const secure = secureToggle ? hidden : props.secureTextEntry;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputBox,
          focused && styles.inputBoxFocused,
          !!error && styles.inputError,
          props.multiline && styles.inputMultiline,
        ]}>
        <TextInput
          placeholderTextColor="#98A2B3"
          accessibilityLabel={label}
          {...props}
          secureTextEntry={secure}
          style={[styles.input, props.multiline && styles.inputTextMultiline]}
          onFocus={e => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}
            onPress={() => setHidden(h => !h)}
            style={styles.inputAccessory}>
            <Text style={styles.inputAccessoryText}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmented}>
      {options.map(o => (
        <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}

export function ListItem({
  title,
  subtitle,
  right,
  onPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const body = (
    <View style={styles.listItem}>
      <View style={styles.flex}>
        <Text style={font.body} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={font.caption} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) {
    return body;
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

// ---------------- Status ----------------
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = toneColors(tone);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Banner({ message, tone = 'info' }: { message: string; tone?: Tone }) {
  const c = toneColors(tone);
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]} accessibilityRole="alert">
      <Text style={{ color: c.fg }}>{message}</Text>
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.state} accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[font.caption, styles.stateText]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.state}>
      <Text style={font.heading}>{title}</Text>
      {message ? <Text style={[font.caption, styles.stateText]}>{message}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.state} accessibilityRole="alert">
      <Text style={[font.body, styles.errorTitle]}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  padded: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kv: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  kvValue: { marginTop: 2 },
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonLarge: { minHeight: 60 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextLarge: { fontSize: 18 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  field: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.inputFill,
  },
  inputBoxFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  inputTextMultiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputAccessory: { paddingHorizontal: spacing.md, height: 52, justifyContent: 'center' },
  inputAccessoryText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  hintText: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 12 },
  inputMultiline: { alignItems: 'stretch' },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, marginTop: spacing.xs, fontSize: 13 },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '500' },
  chipTextSelected: { color: colors.textInverse },
  segmented: { gap: spacing.sm, paddingVertical: spacing.sm },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  banner: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  state: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  stateText: { textAlign: 'center' },
  errorTitle: { textAlign: 'center', color: colors.danger },
});
