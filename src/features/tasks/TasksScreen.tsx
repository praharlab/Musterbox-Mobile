import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../../api/errors';
import { TASK_STATUS_LABEL, tasksApi } from '../../api/tasks.api';
import { PagedList } from '../../components/PagedList';
import { Badge, Button, Card, Row, Segmented } from '../../components/ui';
import { qk, usePaginated } from '../../hooks/queries';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';
import { colors, font, spacing } from '../../theme';
import { currentYearMonth, formatDate, monthRange } from '../../utils/dates';
import type { TaskRow } from '../../types/api';

type Filter = 'all' | '0' | '1' | '3';

export function TasksScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('0');
  const { year, month } = currentYearMonth();
  const range = monthRange(year, month);
  const counts = useQuery({
    queryKey: qk('tasks', 'counts', range.start),
    queryFn: async () => (await tasksApi.counts(range.start, range.end)).data,
  });
  const list = usePaginated(['tasks', 'mine', filter], page =>
    tasksApi.mine(page, filter === 'all' ? undefined : Number(filter)),
  );
  const { run, busy } = useSubmitGuard();

  const respond = (task: TaskRow, accept: boolean) =>
    Alert.alert(accept ? 'Accept task?' : 'Reject task?', task.TaskName ?? '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: accept ? 'Accept' : 'Reject',
        style: accept ? 'default' : 'destructive',
        onPress: () =>
          run(async () => {
            try {
              await tasksApi.respond(task.user_TasksID, accept);
            } catch (e) {
              Alert.alert('Could not update task', errorMessage(e));
            } finally {
              await queryClient.invalidateQueries({ queryKey: qk('tasks') });
            }
          }),
      },
    ]);

  return (
    <View style={styles.flex}>
      <PagedList
        query={list}
        keyOf={t => String(t.user_TasksID)}
        emptyTitle="No tasks"
        header={
          <View>
            <Card>
              <Row style={styles.counts}>
                {(['pending', 'accepted', 'rejected', 'completed'] as const).map(k => (
                  <View key={k} style={styles.count}>
                    <Text style={styles.countValue}>{counts.data?.[k] ?? '—'}</Text>
                    <Text style={font.caption}>{k[0].toUpperCase() + k.slice(1)}</Text>
                  </View>
                ))}
              </Row>
            </Card>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: '0', label: 'Pending' },
                { value: '1', label: 'Accepted' },
                { value: '3', label: 'Completed' },
                { value: 'all', label: 'All' },
              ]}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <Row style={styles.between}>
              <Text style={[font.body, styles.flex]} numberOfLines={2}>
                {item.TaskName ?? 'Task'}
              </Text>
              <Badge
                label={TASK_STATUS_LABEL[Number(item.taskStatus)] ?? '—'}
                tone={Number(item.taskStatus) === 3 ? 'success' : 'info'}
              />
            </Row>
            {item.TaskDesc ? (
              <Text style={font.caption} numberOfLines={3}>
                {item.TaskDesc}
              </Text>
            ) : null}
            {item.endDate ? <Text style={font.caption}>Due {formatDate(item.endDate)}</Text> : null}
            {Number(item.taskStatus) === 0 ? (
              <Row style={styles.actions}>
                <View style={styles.flex}>
                  <Button title="Reject" variant="secondary" loading={busy} onPress={() => respond(item, false)} />
                </View>
                <View style={styles.flex}>
                  <Button title="Accept" loading={busy} onPress={() => respond(item, true)} />
                </View>
              </Row>
            ) : null}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  counts: { justifyContent: 'space-around' },
  count: { alignItems: 'center' },
  countValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  between: { justifyContent: 'space-between' },
  actions: { marginTop: spacing.md },
});
