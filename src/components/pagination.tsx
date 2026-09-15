"use client";

// Shared pager (issue #255): "1–20 of 32" with Prev / Next. Realm-neutral
// (lives beside ui/button so admin, ops and pos may all import it). Hidden
// entirely when everything fits on one page.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Page, PAGE_SIZE, paginate } from "@/lib/pagination";

export interface Pager<T> extends Page<T> {
  setPage: (page: number) => void;
}

/**
 * Pages a whole in-memory list. `resetKey` is any value whose change means
 * "a different list" (search text, filter, category) - the pager returns to
 * page 1 when it changes; a page beyond the end is clamped, so a shrinking
 * list never strands the user on an empty page.
 */
export function usePagination<T>(all: readonly T[], resetKey: unknown = null, pageSize = PAGE_SIZE): Pager<T> {
  const [page, setPage] = useState(1);
  // ponytail: reset-on-key-change via effect; one render with the stale page is invisible because paginate clamps.
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  return { ...paginate(all, page, pageSize), setPage };
}

export function PaginationControls({ pager, testId }: Readonly<{ pager: Pager<unknown>; testId: string }>) {
  if (pager.pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" data-testid={testId} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 px-4 py-3 text-sm">
      <p className="text-muted-foreground" data-testid={`${testId}-range`}>
        {pager.from}–{pager.to} of {pager.total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" data-testid={`${testId}-prev`} disabled={pager.page <= 1} onClick={() => pager.setPage(pager.page - 1)}>
          <ChevronLeft aria-hidden="true" /> Prev
        </Button>
        <span className="tabular-nums text-muted-foreground" data-testid={`${testId}-page`}>
          Page {pager.page} of {pager.pageCount}
        </span>
        <Button variant="secondary" size="sm" data-testid={`${testId}-next`} disabled={pager.page >= pager.pageCount} onClick={() => pager.setPage(pager.page + 1)}>
          Next <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
