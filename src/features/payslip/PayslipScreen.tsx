import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../../api/errors';
import { payslipApi } from '../../api/payslip.api';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  ErrorState,
  KeyValue,
  ListItem,
  LoadingState,
  Screen,
  Section,
} from '../../components/ui';
import { qk } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { font, spacing } from '../../theme';
import { currentYearMonth, formatDate, monthLabel, shiftMonth, yyyymm, yyyymmLabel } from '../../utils/dates';
import { fetchMainPayslip, MainPayslipResult, openGeneratorPayslip, openMainPayslip } from './payslipService';

const MONTHS_BACK = 12;

function recentMonths() {
  const now = currentYearMonth();
  // Current month is usually not processed yet; start from the previous one.
  return Array.from({ length: MONTHS_BACK }, (_, i) => shiftMonth(now.year, now.month, -(i + 1)));
}

export function PayslipScreen() {
  const { run, busy } = useSubmitGuard();
  const generator = useQuery({
    queryKey: qk('payslip', 'generator'),
    queryFn: async () => (await payslipApi.generatorList()).data ?? [],
  });

  const months = recentMonths();
  const [month, setMonth] = useState(yyyymm(months[0].year, months[0].month));
  const [result, setResult] = useState<MainPayslipResult | null>(null);
  const [error, setError] = useState<string>();

  const open = (fn: () => Promise<void>) =>
    run(async () => {
      try {
        await fn();
      } catch (e) {
        Alert.alert('Could not open payslip', errorMessage(e));
      }
    });

  const findMonth = () =>
    run(async () => {
      setError(undefined);
      setResult(null);
      try {
        setResult(await fetchMainPayslip(month));
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  return (
    <Screen refreshing={generator.isRefetching} onRefresh={() => generator.refetch()}>
      <Banner
        tone="neutral"
        message="Payslips open in your device's PDF viewer. Copies are kept on this device for 15 minutes and removed when you sign out."
      />

      <Section title="Published payslips">
        <Card>
          {generator.isLoading ? (
            <LoadingState />
          ) : generator.isError ? (
            <ErrorState message={errorMessage(generator.error)} onRetry={() => generator.refetch()} />
          ) : generator.data && generator.data.length > 0 ? (
            generator.data.map(slip => (
              <ListItem
                key={`${slip.yearMonth}-${slip.path}`}
                title={yyyymmLabel(slip.yearMonth)}
                subtitle={`${slip.payrollFrequency ?? ''} ${
                  slip.startDate ? `· ${formatDate(slip.startDate)} – ${formatDate(slip.endDate)}` : ''
                }`}
                right={<Text style={styles.link}>Open</Text>}
                onPress={() => open(() => openGeneratorPayslip(slip))}
              />
            ))
          ) : (
            <Text style={font.caption}>
              No published payslips. If your company uses payroll payslips, find them by month below.
            </Text>
          )}
        </Card>
      </Section>

      <Section title="Payslip by month">
        <View style={styles.chips}>
          {months.map(m => {
            const v = yyyymm(m.year, m.month);
            return (
              <Chip
                key={v}
                label={monthLabel(m.year, m.month)}
                selected={v === month}
                onPress={() => {
                  setMonth(v);
                  setResult(null);
                }}
              />
            );
          })}
        </View>
        <Button title={`Find ${yyyymmLabel(month)} payslip`} onPress={findMonth} loading={busy} />
        {error ? <Banner message={error} tone="danger" /> : null}
        {result && !result.issued ? (
          <Card style={styles.result}>
            <Text style={font.body}>No payslip has been issued for {yyyymmLabel(month)}.</Text>
          </Card>
        ) : null}
        {result && result.issued ? (
          <Card style={styles.result}>
            <KeyValue label="Month" value={yyyymmLabel(result.slip.salaryYYYYMM)} />
            <View style={styles.paid}>
              <Badge
                label={result.slip.paid ? 'Paid' : 'Not paid yet'}
                tone={result.slip.paid ? 'success' : 'warning'}
              />
            </View>
            <Button title="Open PDF" onPress={() => open(() => openMainPayslip(result.slip))} loading={busy} />
          </Card>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  link: { color: '#1B4F9C', fontWeight: '600' },
  result: { marginTop: spacing.md },
  paid: { marginVertical: spacing.md },
});
