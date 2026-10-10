import React from 'react';
import { ActivityIndicator, FlatList, ListRenderItem, RefreshControl, StyleSheet, View } from 'react-native';
import { errorMessage } from '../api/errors';
import { colors, spacing } from '../theme';
import { EmptyState, ErrorState, LoadingState } from './ui';

/** FlatList wired to usePaginated(): loading / error / empty / pull-to-refresh / infinite scroll. */
export function PagedList<T>({
  query,
  renderItem,
  keyOf,
  emptyTitle,
  emptyMessage,
  header,
}: {
  query: {
    items: T[];
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    isRefetching: boolean;
    isFetchingNextPage: boolean;
    refetch: () => unknown;
    loadMore: () => void;
  };
  renderItem: ListRenderItem<T>;
  keyOf: (item: T, index: number) => string;
  emptyTitle: string;
  emptyMessage?: string;
  header?: React.ReactElement;
}) {
  if (query.isLoading) {
    return (
      <View>
        {header}
        <LoadingState />
      </View>
    );
  }
  if (query.isError && query.items.length === 0) {
    return (
      <View>
        {header}
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      </View>
    );
  }
  return (
    <FlatList
      data={query.items}
      renderItem={renderItem}
      keyExtractor={keyOf}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      onEndReachedThreshold={0.4}
      onEndReached={query.loadMore}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => {
            query.refetch();
          }}
        />
      }
      ListEmptyComponent={<EmptyState title={emptyTitle} message={emptyMessage} />}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
