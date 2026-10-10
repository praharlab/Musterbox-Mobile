import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { APPROVAL_ADAPTERS, APPROVAL_MODULE_ORDER, ApprovalModule } from '../../api/approvals';
import { useSession } from '../../auth/AuthProvider';
import { PagedList } from '../../components/PagedList';
import { Badge, Banner, ListItem, Segmented } from '../../components/ui';
import { usePaginated } from '../../hooks/queries';
import { useAppNavigation } from '../../navigation/types';
import { colors, spacing } from '../../theme';

export function ApprovalsScreen() {
  const nav = useAppNavigation();
  const route = useRoute();
  const { capabilities } = useSession();
  const requested = (route.params as { module?: ApprovalModule } | undefined)?.module;
  const [module, setModule] = useState<ApprovalModule>(requested ?? 'leave');
  useEffect(() => {
    if (requested) {
      setModule(requested);
    }
  }, [requested]);

  const adapter = APPROVAL_ADAPTERS[module];
  const list = usePaginated(['approvals', module], page => adapter.list(page));

  return (
    <View style={styles.flex}>
      <View style={styles.bar}>
        <Segmented
          value={module}
          onChange={setModule}
          options={APPROVAL_MODULE_ORDER.map(m => ({ value: m, label: APPROVAL_ADAPTERS[m].label }))}
        />
      </View>
      <PagedList
        query={list}
        keyOf={i => i.key}
        emptyTitle="Nothing to approve"
        emptyMessage={`No pending ${adapter.label.toLowerCase()} requests.`}
        header={
          capabilities.approvalDecisions ? undefined : (
            <Banner
              tone="warning"
              message="Approving from the app is turned off until the server verifies approvers. Review here and decide on the web portal."
            />
          )
        }
        renderItem={({ item }) => (
          <ListItem
            title={`${item.requesterName} · ${item.title}`}
            subtitle={item.subtitle}
            right={<Badge label="Pending" tone="info" />}
            onPress={() => nav.navigate('ApprovalDetail', { item })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  bar: { paddingHorizontal: spacing.lg, backgroundColor: colors.surface },
});
