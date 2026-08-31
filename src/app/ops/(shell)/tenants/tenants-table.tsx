"use client";

// O3 tenant directory: server-side sort/filter/pagination DataTable with the
// full five-state pattern. All view state round-trips through the URL.
import { ArrowDown, ArrowUp, Plus, Store, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TenantListResult } from "../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { StatusBadge } from "../status-badge";
import { useOpsLoad } from "../use-ops-load";
import {
  clearFilters,
  COUNTRY_OPTIONS,
  filterChips,
  FilterKey,
  hasFilters,
  HEALTH_OPTIONS,
  parseTableQuery,
  PLAN_OPTIONS,
  STATUS_OPTIONS,
  TableQuery,
  toApiParams,
  toUrlParams,
  withFilter,
  withSort,
} from "./table-state";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

const SELECT_CLASSES =
  "h-9 rounded-lg border border-border bg-input px-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}>) {
  return (
    <select
      id={id}
      data-testid={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={SELECT_CLASSES}
    >
      <option value="">{label}: All</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function SortHeader({
  label,
  column,
  query,
  onSort,
  testId,
}: Readonly<{
  label: string;
  column: TableQuery["sort"];
  query: TableQuery;
  onSort: (column: TableQuery["sort"]) => void;
  testId: string;
}>) {
  const active = query.sort === column;
  const Icon = query.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={active ? (query.order === "asc" ? "ascending" : "descending") : "none"} className="px-4 text-left">
      <button
        type="button"
        data-testid={testId}
        onClick={() => onSort(column)}
        className="font-label inline-flex items-center gap-1 rounded-md py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        {active && <Icon className="size-3" aria-hidden="true" />}
      </button>
    </th>
  );
}

export function TenantsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = parseTableQuery(new URLSearchParams(searchParams.toString()));

  const [searchDraft, setSearchDraft] = useState(query.q);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { loading, failed, data, retry } = useOpsLoad<TenantListResult>(`tenants?${toApiParams(query, PAGE_SIZE)}`);

  function navigate(next: TableQuery) {
    const params = toUrlParams(next).toString();
    router.replace(params ? `${pathname}?${params}` : pathname);
  }

  // The search box edits a draft and pushes it into the URL debounced, so
  // typing does not fire a request per keystroke.
  function onSearchChange(value: string) {
    setSearchDraft(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => navigate(withFilter(query, "q", value.trim())), SEARCH_DEBOUNCE_MS);
  }

  function removeChip(key: FilterKey) {
    if (key === "q") setSearchDraft("");
    navigate(withFilter(query, key, ""));
  }

  function onClearFilters() {
    setSearchDraft("");
    navigate(clearFilters(query));
  }

  const chips = filterChips(query);
  const filtered = hasFilters(query);

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Tenants</h1>
          {data && (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="tenants-count">
              {data.total} tenant{data.total === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <Button asChild data-testid="ops-tenants-new">
          <Link href="/ops/tenants/new">
            <Plus aria-hidden="true" /> New tenant
          </Link>
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-border/40 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            data-testid="tenants-filter-q"
            aria-label="Search by name"
            placeholder="Search by name..."
            value={searchDraft}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-9 w-64 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <FilterSelect
            id="tenants-filter-status"
            label="Status"
            value={query.status}
            options={STATUS_OPTIONS}
            onChange={(value) => navigate(withFilter(query, "status", value))}
          />
          <FilterSelect
            id="tenants-filter-country"
            label="Country"
            value={query.country}
            options={COUNTRY_OPTIONS}
            onChange={(value) => navigate(withFilter(query, "country", value))}
          />
          <FilterSelect
            id="tenants-filter-plan"
            label="Plan"
            value={query.plan}
            options={PLAN_OPTIONS}
            onChange={(value) => navigate(withFilter(query, "plan", value))}
          />
          <FilterSelect
            id="tenants-filter-health"
            label="Health"
            value={query.health}
            options={HEALTH_OPTIONS}
            onChange={(value) => navigate(withFilter(query, "health", value))}
          />
        </div>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="tenants-filter-chips">
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-[6px] border border-primary/40 bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove filter ${chip.label}`}
                  data-testid={`tenants-chip-remove-${chip.key}`}
                  onClick={() => removeChip(chip.key)}
                  className="rounded-sm p-0.5 hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
            <button
              type="button"
              data-testid="tenants-clear-filters"
              onClick={onClearFilters}
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-card">
        {failed ? (
          <div className="p-4">
            <LoadErrorPanel message="The tenant list could not be loaded." onRetry={retry} testId="tenants-error" />
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="tenants-table">
            <thead>
              <tr className="h-12 border-b border-border/40">
                <SortHeader label="Tenant" column="name" query={query} onSort={(column) => navigate(withSort(query, column))} testId="tenants-sort-name" />
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Country</th>
                <th className="font-label px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outlets</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Health</th>
                <SortHeader label="Created" column="createdAt" query={query} onSort={(column) => navigate(withSort(query, column))} testId="tenants-sort-created" />
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }, (_, row) => (
                  <tr key={row} className="h-12 border-b border-border/20" data-testid={row === 0 ? "tenants-loading" : undefined}>
                    {Array.from({ length: 7 }, (_, col) => (
                      <td key={col} className="px-4">
                        <Skeleton className="h-4" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                data?.tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    data-testid={`tenants-row-${tenant.id}`}
                    tabIndex={0}
                    onClick={() => router.push(`/ops/tenants/${tenant.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") router.push(`/ops/tenants/${tenant.id}`);
                    }}
                    className="h-12 cursor-pointer border-b border-border/20 transition-colors last:border-b-0 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <td className="px-4 font-medium">{tenant.name}</td>
                    <td className="px-4 text-muted-foreground">{tenant.country}</td>
                    <td className="px-4 text-right tabular-nums">{tenant.outletCount}</td>
                    <td className="px-4 text-muted-foreground">{tenant.plan}</td>
                    <td className="px-4">
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td className="px-4">
                      <StatusBadge status={tenant.health} />
                    </td>
                    <td className="px-4 tabular-nums text-muted-foreground">
                      {new Date(tenant.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {!loading && data && data.tenants.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <Store className="size-8 text-muted-foreground" aria-hidden="true" />
            {filtered ? (
              <div data-testid="tenants-filtered-empty">
                <p className="font-headline text-lg font-medium">No results for these filters</p>
                <Button variant="secondary" size="sm" className="mt-3" data-testid="tenants-filtered-empty-clear" onClick={onClearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div data-testid="tenants-empty">
                <p className="font-headline text-lg font-medium">No tenants yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Provision the first tenant to see it here.</p>
                <Button asChild size="sm" className="mt-3" data-testid="tenants-empty-new">
                  <Link href="/ops/tenants/new">
                    <Plus aria-hidden="true" /> New tenant
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && data && (data.nextCursor || query.cursor) && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {query.cursor && (
            <Button variant="secondary" size="sm" data-testid="tenants-first-page" onClick={() => navigate({ ...query, cursor: "" })}>
              First page
            </Button>
          )}
          {data.nextCursor && (
            <Button
              variant="secondary"
              size="sm"
              data-testid="tenants-next-page"
              onClick={() => navigate({ ...query, cursor: data.nextCursor ?? "" })}
            >
              Next
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
