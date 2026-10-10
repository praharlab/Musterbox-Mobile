/**
 * Two pagination styles exist (handover §1.2). Both `page` and `limit` must be sent
 * on legacy endpoints, otherwise most of them return every row.
 */
export const DEFAULT_PAGE_SIZE = 20;

export interface Page<T> {
  items: T[];
  page: number;
  total: number;
}

export function legacyPageParams(page: number, limit = DEFAULT_PAGE_SIZE) {
  return { page, limit };
}

export function restPageParams(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  return { page, pageSize };
}

/** Next page number, or undefined when everything has been loaded. */
export function nextPageParam<T>(last: Page<T>, all: Page<T>[]): number | undefined {
  const loaded = all.reduce((n, p) => n + p.items.length, 0);
  if (last.items.length === 0 || loaded >= last.total) {
    return undefined;
  }
  return last.page + 1;
}

export function toPage<T>(items: T[] | null | undefined, page: number, total: unknown): Page<T> {
  const list = Array.isArray(items) ? items : [];
  const n = Number(total);
  // Some endpoints omit totalcount; treat a short page as the last one.
  const fallbackTotal = list.length < DEFAULT_PAGE_SIZE ? (page - 1) * DEFAULT_PAGE_SIZE + list.length : Infinity;
  return { items: list, page, total: Number.isFinite(n) ? n : fallbackTotal };
}
