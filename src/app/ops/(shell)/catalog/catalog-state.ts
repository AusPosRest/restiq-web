// Product directory (issue #245): the platform-wide catalog operators curate.
// Pure form <-> API shaping so the page component stays about rendering.
export type VegMarker = "veg" | "non_veg";
export type CatalogCurrency = "INR" | "AUD";

export interface CatalogProduct {
  id: string;
  name: string;
  shortName: string;
  nameHindi: string | null;
  vegMarker: VegMarker | null;
  photoUrl: string | null;
  category: string;
  suggestedPriceMinor: number;
  currency: string;
  tags: string[];
  updatedAt: string;
}

export interface ProductForm {
  name: string;
  shortName: string;
  nameHindi: string;
  vegMarker: VegMarker | "";
  photoUrl: string;
  category: string;
  /** Major units as typed, e.g. "249" or "12.50". */
  price: string;
  currency: CatalogCurrency;
  /** Comma-separated as typed; split and trimmed on submit. */
  tags: string;
}

export interface ProductPayload {
  name: string;
  shortName: string;
  nameHindi: string | null;
  vegMarker: VegMarker | null;
  photoUrl: string | null;
  category: string;
  suggestedPriceMinor: number;
  currency: CatalogCurrency;
  tags: string[];
}

export const EMPTY_FORM: ProductForm = { name: "", shortName: "", nameHindi: "", vegMarker: "", photoUrl: "", category: "", price: "", currency: "INR", tags: "" };

export const CURRENCY_LABEL: Record<CatalogCurrency, string> = { INR: "India (₹)", AUD: "Australia ($)" };

export function formFromProduct(product: CatalogProduct): ProductForm {
  return {
    name: product.name,
    shortName: product.shortName,
    nameHindi: product.nameHindi ?? "",
    vegMarker: product.vegMarker ?? "",
    photoUrl: product.photoUrl ?? "",
    category: product.category,
    price: (product.suggestedPriceMinor / 100).toFixed(2).replace(/\.00$/, ""),
    currency: product.currency === "AUD" ? "AUD" : "INR",
    tags: product.tags.join(", "),
  };
}

export function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

export function validateProductForm(form: ProductForm): { payload: ProductPayload } | { error: string } {
  const name = form.name.trim();
  const shortName = form.shortName.trim();
  const category = form.category.trim();
  if (!name) return { error: "Name is required." };
  if (!shortName) return { error: "Short name is required." };
  if (!category) return { error: "Category is required." };
  const major = Number.parseFloat(form.price);
  if (!Number.isFinite(major) || major < 0) return { error: "Enter a price of 0 or more." };
  const photoUrl = form.photoUrl.trim();
  if (photoUrl && !/^https:\/\//.test(photoUrl)) return { error: "Photo must be an https URL." };
  return {
    payload: {
      name,
      shortName,
      nameHindi: form.nameHindi.trim() || null,
      vegMarker: form.vegMarker || null,
      photoUrl: photoUrl || null,
      category,
      suggestedPriceMinor: Math.round(major * 100),
      currency: form.currency,
      tags: parseTags(form.tags),
    },
  };
}

export function formatPrice(priceMinor: number, currency: string): string {
  return `${currency === "INR" ? "₹" : "$"}${(priceMinor / 100).toFixed(currency === "INR" ? 0 : 2)}`;
}

export function productsQuery(q: string, tag: string, currency: string): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (tag) params.set("tag", tag);
  if (currency) params.set("currency", currency);
  const search = params.toString();
  return `catalog/products${search ? `?${search}` : ""}`;
}
