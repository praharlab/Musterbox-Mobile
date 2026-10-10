import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing, TOUCH_MIN } from '../theme';
import { formatDate, monthLabel, shiftMonth } from '../utils/dates';
import { Button } from './ui';

/** Dependency-free month-grid date picker. Values are YYYY-MM-DD. */
export function DateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  maxDate?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const initial = value || minDate || new Date().toISOString().slice(0, 10);
  const [cursor, setCursor] = useState({ year: Number(initial.slice(0, 4)), month: Number(initial.slice(5, 7)) });

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
    const out: Array<string | null> = Array(first).fill(null);
    for (let d = 1; d <= days; d++) {
      out.push(`${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return out;
  }, [cursor]);

  const disabled = (d: string) => (!!minDate && d < minDate) || (!!maxDate && d > maxDate);

  return (
    <View style={styles.field}>
      <Text style={font.label}>{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : 'not selected'}`}
        style={styles.input}
        onPress={() => setOpen(true)}>
        <Text style={value ? font.body : styles.placeholder}>{value ? formatDate(value) : 'Select date'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Pressable
                accessibilityLabel="Previous month"
                style={styles.nav}
                onPress={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}>
                <Text style={styles.navText}>‹</Text>
              </Pressable>
              <Text style={font.heading}>{monthLabel(cursor.year, cursor.month)}</Text>
              <Pressable
                accessibilityLabel="Next month"
                style={styles.nav}
                onPress={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}>
                <Text style={styles.navText}>›</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={`h${i}`} style={[styles.cell, styles.weekday]}>
                  {d}
                </Text>
              ))}
              {cells.map((d, i) =>
                d ? (
                  <Pressable
                    key={d}
                    accessibilityLabel={formatDate(d)}
                    disabled={disabled(d)}
                    onPress={() => {
                      onChange(d);
                      setOpen(false);
                    }}
                    style={[styles.cell, d === value && styles.selected, disabled(d) && styles.cellDisabled]}>
                    <Text style={d === value ? styles.selectedText : font.body}>{Number(d.slice(8))}</Text>
                  </Pressable>
                ) : (
                  <View key={`e${i}`} style={styles.cell} />
                ),
              )}
            </View>
            <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md, flex: 1 },
  input: {
    minHeight: TOUCH_MIN,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  placeholder: { color: colors.textMuted, fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  nav: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 26, color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  weekday: { textAlign: 'center', textAlignVertical: 'center', color: colors.textMuted, fontWeight: '600' },
  selected: { backgroundColor: colors.primary },
  selectedText: { color: colors.textInverse, fontWeight: '700' },
  cellDisabled: { opacity: 0.3 },
});
