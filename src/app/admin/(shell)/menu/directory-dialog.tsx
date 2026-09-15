"use client";

// Browse the platform product directory (issue #245) and copy a selection
// into this tenant's menu. Everything imported becomes an ordinary menu item
// the owner edits like any other; the directory is never written from here.
import { Dialog } from "radix-ui";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { AdminApiError, DirectoryProduct, directoryPath, importDirectoryProducts } from "../../api";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useAdminLoad } from "../use-admin-load";
import { formatPriceMinor } from "./menu-state";

export interface DirectoryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful import so the menu reloads. */
  onImported: (count: number) => void;
}

export function DirectoryDialog(props: Readonly<DirectoryDialogProps>) {
  // Remount per open so search, tag and selection never leak between visits.
  return props.open ? <DialogBody key="open" {...props} /> : null;
}

function DialogBody({ onClose, onImported }: Readonly<DirectoryDialogProps>) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const products = useAdminLoad<{ products: DirectoryProduct[] }>(directoryPath(deferredSearch, tag));
  const tags = useAdminLoad<{ tags: string[] }>("menu/directory/tags");

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected() {
    setBusy(true);
    try {
      const result = await importDirectoryProducts([...selected]);
      toast({ kind: "success", message: `${result.items.length} item${result.items.length === 1 ? "" : "s"} added to your menu.` });
      onImported(result.items.length);
    } catch (error) {
      toast({ kind: "error", message: error instanceof AdminApiError ? error.message : "The items could not be imported." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/60" />
        <Dialog.Content
          data-testid="directory-dialog"
          className="admin-theme fixed left-1/2 top-1/2 z-40 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border/60 bg-card text-foreground shadow-2xl"
        >
          <div className="border-b border-border/40 px-6 py-4">
            <Dialog.Title className="font-headline text-lg font-semibold">Browse the product directory</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Pick products to copy into your menu. You can rename, reprice or remove them afterwards without affecting the directory.
            </Dialog.Description>
            <div className="relative mt-3 w-full sm:w-80">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                data-testid="directory-search"
                aria-label="Search the directory"
                placeholder="Search by name, category or tag..."
                value={search}
                autoFocus
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-input py-1 pl-8 pr-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {tags.data && tags.data.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by tag" data-testid="directory-tags">
                {tags.data.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    data-testid={`directory-tag-${t}`}
                    aria-pressed={tag === t}
                    onClick={() => setTag(tag === t ? "" : t)}
                    className={`rounded-full border px-3 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      tag === t ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {products.failed ? (
              <LoadErrorPanel message="The directory couldn't be loaded." onRetry={products.retry} testId="directory-error" />
            ) : products.loading ? (
              <div className="space-y-3" data-testid="directory-loading">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : products.data?.products.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground" data-testid="directory-empty">
                {search || tag ? "No products match these filters." : "The directory is empty right now."}
              </p>
            ) : (
              <ul className="divide-y divide-border/30" data-testid="directory-list">
                {products.data?.products.map((product) => (
                  <li key={product.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-3" data-testid={`directory-row-${product.id}`}>
                      <input
                        type="checkbox"
                        data-testid={`directory-select-${product.id}`}
                        checked={selected.has(product.id)}
                        onChange={() => toggle(product.id)}
                        className="size-4 accent-primary"
                      />
                      {product.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- operator-supplied https URL on any host
                        <img src={product.photoUrl} alt="" className="size-10 rounded-md object-cover" />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground" aria-hidden="true">
                          {product.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-xs text-muted-foreground">{product.category}</span>
                          {product.vegMarker && (
                            <span className={`text-xs ${product.vegMarker === "veg" ? "text-status-active" : "text-status-error"}`}>
                              {product.vegMarker === "veg" ? "Veg" : "Non-veg"}
                            </span>
                          )}
                        </div>
                        {product.tags.length > 0 && <div className="mt-0.5 truncate text-xs text-muted-foreground">{product.tags.join(" · ")}</div>}
                      </div>
                      <span className="tabular-nums">{formatPriceMinor(product.suggestedPriceMinor, product.currency)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/40 px-6 py-4">
            <span className="text-sm text-muted-foreground" data-testid="directory-selected-count">
              {selected.size} selected
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" data-testid="directory-cancel" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" data-testid="directory-import" disabled={busy || selected.size === 0} onClick={() => void importSelected()}>
                Import {selected.size > 0 ? `${selected.size} item${selected.size === 1 ? "" : "s"}` : "items"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
