import { useInfiniteQuery } from '@tanstack/react-query';
import { getIdentity } from '../auth/identity';
import { nextPageParam, Page } from '../api/pagination';

/**
 * Query keys are prefixed with the signed-in user's ID so cached data can never be
 * shown to a different user on a shared device (the cache is also cleared on logout).
 */
export function qk(...parts: unknown[]): unknown[] {
  const id = getIdentity();
  return ['u', id?.userMasterID ?? 'anon', ...parts];
}

export function usePaginated<T>(key: unknown[], fetchPage: (page: number) => Promise<Page<T>>, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: qk(...key),
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => nextPageParam(last, all),
    enabled,
  });
  const items = query.data?.pages.flatMap(p => p.items) ?? [];
  return {
    ...query,
    items,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
  };
}
