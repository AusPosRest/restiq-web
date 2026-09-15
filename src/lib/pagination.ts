// Client-side pagination (issue #255) for lists that arrive whole from the
// API. Pure slicing here; the hook in components/pagination.tsx owns state.
export const PAGE_SIZE = 20;

export interface Page<T> {
  items: T[];
  /** 1-based, clamped into [1, pageCount]. */
  page: number;
  pageCount: number;
  /** 1-based display bounds; both 0 when there are no items. */
  from: number;
  to: number;
  total: number;
}

export function paginate<T>(all: readonly T[], requestedPage: number, pageSize = PAGE_SIZE): Page<T> {
  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), pageCount);
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return { items, page, pageCount, from: total === 0 ? 0 : start + 1, to: start + items.length, total };
}
