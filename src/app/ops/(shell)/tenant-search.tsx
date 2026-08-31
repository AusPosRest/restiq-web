"use client";

// Global tenant search (top bar): "/" focuses it from anywhere, results jump
// straight to Tenant Detail (EXPERIENCE.md IA).
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { opsApi, TenantListResult } from "./api";
import { StatusBadge } from "./status-badge";

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 8;

export function TenantSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenantListResult["tenants"]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const timer = setTimeout(() => {
      void opsApi<TenantListResult>(`tenants?q=${encodeURIComponent(trimmed)}&limit=${MAX_RESULTS}`)
        .then((body) => {
          setResults(body.tenants);
          setActiveIndex(body.tenants.length ? 0 : -1);
          setOpen(true);
        })
        .catch(() => {
          setResults([]);
          setOpen(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Click-away closes the listbox.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function jumpTo(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/ops/tenants/${id}`);
  }

  function onInputKeyDown(event: React.KeyboardEvent) {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      jumpTo(results[activeIndex].id);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="tenant-search-results"
        aria-label="Search tenants"
        placeholder="Search tenants...  ( / )"
        data-testid="tenant-search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (!value.trim()) {
            setResults([]);
            setOpen(false);
          }
        }}
        onKeyDown={onInputKeyDown}
        className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && (
        <ul
          id="tenant-search-results"
          role="listbox"
          data-testid="tenant-search-results"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">No tenants match</li>
          ) : (
            results.map((tenant, index) => (
              <li key={tenant.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  data-testid={`tenant-search-result-${tenant.id}`}
                  onClick={() => jumpTo(tenant.id)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                    index === activeIndex ? "bg-accent" : ""
                  }`}
                >
                  <span className="truncate">{tenant.name}</span>
                  <StatusBadge status={tenant.status} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
