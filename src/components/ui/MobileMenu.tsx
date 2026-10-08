"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavLink, Site } from "@/lib/content";

interface MobileMenuProps {
  links: NavLink[];
  labels: Site["menu"];
}

// Native <dialog> + showModal() gives the focus trap (rest of the page is
// inert), Escape-to-close and top-layer stacking without any dependency.
export function MobileMenu({ links, labels }: MobileMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on any route change, including back/forward while the menu is open.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  function openMenu() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    setOpen(true);
  }

  function closeMenu() {
    dialogRef.current?.close();
  }

  // Fires for close(), Escape and form-less dismissal alike, so state can't drift.
  function handleClose() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        aria-label={labels.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex size-11 items-center justify-center rounded-md"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <dialog
        id="mobile-menu"
        ref={dialogRef}
        aria-label={labels.label}
        onClose={handleClose}
        className="mobile-menu m-0 h-dvh max-h-none w-full max-w-none bg-neutral-950 p-0 text-white"
      >
        <div className="flex h-full flex-col px-4 pb-8">
          <div className="flex h-(--header-h) shrink-0 items-center justify-end">
            <button
              type="button"
              onClick={closeMenu}
              aria-label={labels.close}
              className="flex size-11 items-center justify-center rounded-md"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav aria-label="Primary" className="flex-1 overflow-y-auto">
            <ul className="flex flex-col">
              {links.map((item) => (
                <li key={item.label}>
                  {/* Close explicitly too: a link to the current page doesn't change the route. */}
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className="flex min-h-11 items-center border-b border-white/10 py-2 text-2xl font-medium"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
