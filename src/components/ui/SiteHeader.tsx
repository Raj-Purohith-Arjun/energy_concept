import Link from "next/link";
import { getSite } from "@/lib/content";
import { MobileMenu } from "./MobileMenu";

// Transparent-to-blurred behaviour is pure CSS (scroll-driven animation on
// .site-header::before, see globals.css), so this stays a server component.
export function SiteHeader() {
  const { brand, nav, invest, menu } = getSite();
  return (
    <header className="site-header sticky top-0 z-40 text-white">
      <div className="mx-auto flex h-(--header-h) max-w-7xl items-center justify-between gap-6 px-4 lg:px-8">
        <Link
          href={brand.homeHref}
          className="flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight"
        >
          {/* Placeholder logo mark until brand assets land. */}
          <span aria-hidden="true" className="size-5 rotate-45 rounded-sm bg-white" />
          {brand.name}
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm text-white/85 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={invest.href}
            className="hidden min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-neutral-950 hover:bg-white/90 lg:flex"
          >
            {invest.label}
          </Link>
          <div className="lg:hidden">
            <MobileMenu links={nav} invest={invest} labels={menu} />
          </div>
        </div>
      </div>
    </header>
  );
}
