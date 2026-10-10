import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { teamApi } from '../../api/team.api';
import { PagedList } from '../../components/PagedList';
import { Badge, Chip, ListItem, TextField } from '../../components/ui';
import { usePaginated } from '../../hooks/queries';
import { colors, spacing } from '../../theme';
import { formatTime, isoDate, todayIso } from '../../utils/dates';
import type { TeamMember } from '../../types/api';
import type { Tone } from '../../theme';

export function memberAttendance(m: TeamMember): { label: string; tone: Tone } {
  const t = m.employee?.attendanceTransactions?.[0];
  if (!t?.InDatetime) {
    return { label: 'Not checked in', tone: 'neutral' };
  }
  if (!t.OutDateTime) {
    return { label: `In ${formatTime(t.InDatetime)}`, tone: 'success' };
  }
  return { label: `Out ${formatTime(t.OutDateTime)}`, tone: 'info' };
}

export function TeamScreen() {
  const [date, setDate] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const yesterday = isoDate(new Date(Date.now() - 86400000));
  const team = usePaginated(['team', date, debounced], page =>
    teamApi.directReports({ page, date, search: debounced }),
  );

  return (
    <View style={styles.flex}>
      <PagedList
        query={team}
        keyOf={m => String(m.userMasterID)}
        emptyTitle={debounced ? 'No matching team members' : 'No direct reports'}
        header={
          <View>
            <View style={styles.chips}>
              <Chip label="Today" selected={date === todayIso()} onPress={() => setDate(todayIso())} />
              <Chip label="Yesterday" selected={date === yesterday} onPress={() => setDate(yesterday)} />
            </View>
            <TextField
              label="Search"
              value={search}
              onChangeText={setSearch}
              placeholder="Name or mobile"
              autoCorrect={false}
            />
          </View>
        }
        renderItem={({ item }) => {
          const a = memberAttendance(item);
          const e = item.employee;
          return (
            <ListItem
              title={e?.displayName ?? 'Employee'}
              subtitle={[
                e?.employeeDesignations?.[0]?.designation?.designationName,
                e?.employeeBranches?.[0]?.branchMaster?.branchName,
              ]
                .filter(Boolean)
                .join(' · ')}
              right={<Badge label={a.label} tone={a.tone} />}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
});
