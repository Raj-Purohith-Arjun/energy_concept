import Link from "next/link";
import { getSite } from "@/lib/content";
import { MobileMenu } from "./MobileMenu";

export function SiteHeader() {
  const { brand, nav, menu } = getSite();
  return (
    <header className="site-header sticky top-0 z-40 text-white">
      <div className="mx-auto flex h-(--header-h) max-w-7xl items-center justify-between gap-6 px-4 lg:px-8">
        <Link
          href={brand.homeHref}
          className="flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight"
        >
          {brand.name}
          <span className="rounded border border-white/40 px-1.5 text-xs font-medium tracking-wide uppercase">
            {brand.tag}
          </span>
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

        <div className="lg:hidden">
          <MobileMenu links={nav} labels={menu} />
        </div>
      </div>
    </header>
  );
}
