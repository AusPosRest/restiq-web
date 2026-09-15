"use client";

// Phone / tablet navigation for the owner console and Platform Console
// (issue #228). Below `md` the fixed sidebar is hidden; this ☰ button opens
// the same nav in a left drawer. Shared here rather than per route tree
// because it knows nothing about either console - the layout hands it the
// nav and sign-out as children. Tapping any link closes it.
import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";

export function MobileNav({
  title,
  subtitle,
  themeClass,
  children,
}: Readonly<{ title: string; subtitle: string; themeClass: string; children: React.ReactNode }>) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open menu"
        data-testid="mobile-nav-open"
        className="-ml-2 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 md:hidden" />
        <Dialog.Content
          data-testid="mobile-nav"
          aria-describedby={undefined}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
          className={`${themeClass} fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-border/40 bg-card text-foreground shadow-xl md:hidden`}
        >
          <div className="flex items-start justify-between px-6 py-6">
            <div>
              <Dialog.Title className="font-headline text-2xl font-bold tracking-tight text-primary">{title}</Dialog.Title>
              <p className="font-label mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{subtitle}</p>
            </div>
            <Dialog.Close
              aria-label="Close menu"
              data-testid="mobile-nav-close"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
