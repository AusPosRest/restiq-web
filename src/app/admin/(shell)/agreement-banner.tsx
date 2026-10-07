"use client";

// Walkthrough fix: ops publishes the platform agreement and says owners are
// asked to sign it, but nothing asked - it sat in Settings > Agreement. This
// strip shows on every console page until the current version is signed.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OwnerAgreementView } from "../api";
import { useAdminLoad } from "./use-admin-load";

export function needsSignature(view: OwnerAgreementView | null): boolean {
  return Boolean(view?.current && view.signature?.agreementVersionId !== view.current.id);
}

export function AgreementBanner() {
  const pathname = usePathname();
  const { data } = useAdminLoad<OwnerAgreementView>("agreement");
  if (pathname.startsWith("/admin/settings/agreement") || !needsSignature(data)) return null;
  return (
    <div role="status" data-testid="agreement-banner" className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/30 bg-primary/10 px-4 py-2.5 text-sm sm:px-6 print:hidden">
      <span>Please read and sign the RESTIQ platform agreement (version {data?.current?.version}).</span>
      <Link href="/admin/settings/agreement" data-testid="agreement-banner-link" className="font-semibold text-primary underline-offset-4 hover:underline">
        Read and sign
      </Link>
    </div>
  );
}
