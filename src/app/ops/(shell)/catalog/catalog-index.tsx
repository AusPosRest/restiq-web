"use client";

// Product directory (issue #245): the platform-wide list of products that
// tenant owners can copy into their own menu. Operators add, edit and delete
// here; a tenant's copy never links back, so edits here don't touch any
// tenant. Deletes go through the shared reason dialog like every other
// audited console mutation.
import { Dialog } from "radix-ui";
import { Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { opsApi, OpsApiError } from "../api";
import { ConfirmReasonDialog } from "../confirm-reason-dialog";
import { LoadErrorPanel, Skeleton } from "../data-states";
import { useToast } from "../toast";
import { useOpsLoad } from "../use-ops-load";
import {
  CatalogCurrency,
  CatalogProduct,
  CURRENCY_LABEL,
  EMPTY_FORM,
  formatPrice,
  formFromProduct,
  ProductForm,
  productsQuery,
  validateProductForm,
} from "./catalog-state";

const FIELD_CLASSES =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASSES = "font-label mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const TH_CLASSES = "font-label px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function CatalogIndex() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [currency, setCurrency] = useState("");
  const deferredSearch = useDeferredValue(search);
  const products = useOpsLoad<{ products: CatalogProduct[] }>(productsQuery(deferredSearch, tag, currency));
  const tags = useOpsLoad<{ tags: string[] }>(currency ? `catalog/products/tags?currency=${currency}` : "catalog/products/tags");
  const [editing, setEditing] = useState<CatalogProduct | null | "closed">("closed");
  const [deleting, setDeleting] = useState<CatalogProduct | null>(null);
  const [busy, setBusy] = useState(false);

  function reload() {
    products.retry();
    tags.retry();
  }

  async function remove(product: CatalogProduct, reason: string) {
    setBusy(true);
    try {
      await opsApi<void>(`catalog/products/${product.id}?reason=${encodeURIComponent(reason)}`, { method: "DELETE" });
      setDeleting(null);
      toast({ kind: "success", message: `${product.name} removed from the directory.` });
      reload();
    } catch (error) {
      toast({ kind: "error", message: error instanceof OpsApiError ? error.message : "The product could not be removed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-semibold">Product directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Products every tenant can search and copy into their own menu. A tenant edits its copy; nothing here changes for them afterwards.
          </p>
        </div>
        <Button data-testid="catalog-add" onClick={() => setEditing(null)}>
          <Plus aria-hidden="true" /> Add product
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            data-testid="catalog-search"
            aria-label="Search products"
            placeholder="Search by name, category or tag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${FIELD_CLASSES} h-9 py-1 pl-8`}
          />
        </div>
        <div className="w-full sm:w-44">
          <select
            data-testid="catalog-currency"
            aria-label="Market"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              setTag("");
            }}
            className={`${FIELD_CLASSES} h-9 py-1`}
          >
            <option value="">All markets</option>
            <option value="INR">{CURRENCY_LABEL.INR}</option>
            <option value="AUD">{CURRENCY_LABEL.AUD}</option>
          </select>
        </div>
      </div>

      {tags.data && tags.data.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by tag" data-testid="catalog-tags">
          {tags.data.tags.map((t) => (
            <TagChip key={t} tag={t} active={tag === t} onClick={() => setTag(tag === t ? "" : t)} testId={`catalog-tag-${t}`} />
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-card">
        {products.failed ? (
          <div className="p-4">
            <LoadErrorPanel message="The product directory could not be loaded." onRetry={reload} testId="catalog-error" />
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="catalog-table">
            <thead>
              <tr className="h-12 border-b border-border/40">
                <th className={TH_CLASSES}>Product</th>
                <th className={TH_CLASSES}>Category</th>
                <th className={`${TH_CLASSES} text-right`}>Suggested price</th>
                <th className={TH_CLASSES}>Tags</th>
                <th className={TH_CLASSES}>Market</th>
                <th className={TH_CLASSES}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.loading &&
                Array.from({ length: 3 }, (_, row) => (
                  <tr key={row} className="h-12 border-b border-border/20" data-testid={row === 0 ? "catalog-loading" : undefined}>
                    {Array.from({ length: 6 }, (_, col) => (
                      <td key={col} className="px-4">
                        <Skeleton className="h-4" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!products.loading && products.data?.products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground" data-testid="catalog-empty">
                    {search || tag || currency ? "No products match these filters." : "No products yet. Add the first one."}
                  </td>
                </tr>
              )}
              {!products.loading &&
                products.data?.products.map((product) => (
                  <tr key={product.id} className="h-12 border-b border-border/20" data-testid={`catalog-row-${product.id}`}>
                    <td className="px-4">
                      <div className="flex items-center gap-3">
                        <ProductThumb product={product} />
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {product.shortName}
                            {product.vegMarker && ` · ${product.vegMarker === "veg" ? "Veg" : "Non-veg"}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4">{product.category}</td>
                    <td className="px-4 text-right tabular-nums">{formatPrice(product.suggestedPriceMinor, product.currency)}</td>
                    <td className="px-4">
                      <div className="flex flex-wrap gap-1">
                        {product.tags.map((t) => (
                          <span key={t} className="rounded-md border border-border/60 px-1.5 py-0.5 text-xs text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 text-muted-foreground">{product.currency}</td>
                    <td className="px-4 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" data-testid={`catalog-edit-${product.id}`} onClick={() => setEditing(product)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-status-critical" data-testid={`catalog-delete-${product.id}`} onClick={() => setDeleting(product)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== "closed" && (
        <ProductDialog
          product={editing}
          onClose={() => setEditing("closed")}
          onSaved={(saved, created) => {
            setEditing("closed");
            toast({ kind: "success", message: `${saved.name} ${created ? "added to" : "updated in"} the directory.` });
            reload();
          }}
        />
      )}

      <ConfirmReasonDialog
        open={deleting !== null}
        title={`Remove ${deleting?.name ?? "product"} from the directory`}
        description="Tenants that already imported it keep their copy. New tenants will no longer find it."
        verb="Remove"
        destructive
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={(reason) => deleting && void remove(deleting, reason)}
      />
    </section>
  );
}

function TagChip({ tag, active, onClick, testId }: Readonly<{ tag: string; active: boolean; onClick: () => void; testId: string }>) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {tag}
    </button>
  );
}

function ProductThumb({ product }: Readonly<{ product: CatalogProduct }>) {
  return product.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- operator-supplied https URL on any host
    <img src={product.photoUrl} alt="" className="size-9 rounded-md object-cover" />
  ) : (
    <div className="flex size-9 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground" aria-hidden="true">
      {product.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ProductDialog({
  product,
  onClose,
  onSaved,
}: Readonly<{ product: CatalogProduct | null; onClose: () => void; onSaved: (saved: CatalogProduct, created: boolean) => void }>) {
  const [form, setForm] = useState<ProductForm>(product ? formFromProduct(product) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isCreate = product === null;

  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = validateProductForm(form);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { product: saved } = await opsApi<{ product: CatalogProduct }>(isCreate ? "catalog/products" : `catalog/products/${product.id}`, {
        method: isCreate ? "POST" : "PATCH",
        body: JSON.stringify(result.payload),
      });
      onSaved(saved, isCreate);
    } catch (caught) {
      setError(caught instanceof OpsApiError ? caught.message : "The product could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          data-testid="catalog-product-dialog"
          className="ops-theme fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border/60 bg-popover p-6 text-foreground shadow-xl"
        >
          <Dialog.Title className="font-headline text-lg font-semibold">{isCreate ? "Add product" : `Edit ${product.name}`}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Tenants import a copy of these details and set their own final price.
          </Dialog.Description>
          <form className="mt-4 grid gap-4" onSubmit={(event) => void submit(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="catalog-name" label="Name">
                <input id="catalog-name" data-testid="catalog-name" value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} className={FIELD_CLASSES} />
              </Field>
              <Field id="catalog-short-name" label="Short name (kitchen ticket)">
                <input id="catalog-short-name" data-testid="catalog-short-name" value={form.shortName} maxLength={40} onChange={(e) => set("shortName", e.target.value)} className={FIELD_CLASSES} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="catalog-category" label="Category">
                <input id="catalog-category" data-testid="catalog-category" value={form.category} maxLength={60} placeholder="e.g. Starters" onChange={(e) => set("category", e.target.value)} className={FIELD_CLASSES} />
              </Field>
              <Field id="catalog-name-hindi" label="Hindi name (optional)">
                <input id="catalog-name-hindi" data-testid="catalog-name-hindi" value={form.nameHindi} maxLength={120} onChange={(e) => set("nameHindi", e.target.value)} className={FIELD_CLASSES} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="catalog-market" label="Market">
                <select id="catalog-market" data-testid="catalog-market" value={form.currency} onChange={(e) => set("currency", e.target.value as CatalogCurrency)} className={FIELD_CLASSES}>
                  <option value="INR">{CURRENCY_LABEL.INR}</option>
                  <option value="AUD">{CURRENCY_LABEL.AUD}</option>
                </select>
              </Field>
              <Field id="catalog-price" label="Suggested price">
                <input id="catalog-price" data-testid="catalog-price" inputMode="decimal" value={form.price} placeholder="0" onChange={(e) => set("price", e.target.value)} className={FIELD_CLASSES} />
              </Field>
              <Field id="catalog-veg" label="Veg marker">
                <select id="catalog-veg" data-testid="catalog-veg" value={form.vegMarker} onChange={(e) => set("vegMarker", e.target.value as ProductForm["vegMarker"])} className={FIELD_CLASSES}>
                  <option value="">Not set</option>
                  <option value="veg">Veg</option>
                  <option value="non_veg">Non-veg</option>
                </select>
              </Field>
            </div>
            <Field id="catalog-tags" label="Tags (comma-separated)">
              <input id="catalog-tags" data-testid="catalog-tags-input" value={form.tags} placeholder="veg, north-indian, grill" onChange={(e) => set("tags", e.target.value)} className={FIELD_CLASSES} />
            </Field>
            <Field id="catalog-photo" label="Photo URL (optional, https)">
              <input id="catalog-photo" data-testid="catalog-photo" value={form.photoUrl} maxLength={2048} placeholder="https://..." onChange={(e) => set("photoUrl", e.target.value)} className={FIELD_CLASSES} />
            </Field>
            {error && (
              <p role="alert" data-testid="catalog-form-error" className="text-sm text-status-critical">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" data-testid="catalog-cancel" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" data-testid="catalog-save" disabled={busy}>
                {isCreate ? "Add product" : "Save changes"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ id, label, children }: Readonly<{ id: string; label: string; children: React.ReactNode }>) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASSES}>
        {label}
      </label>
      {children}
    </div>
  );
}
