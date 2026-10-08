import type { Metadata } from "next";
import { ConceptBanner } from "@/components/ui/ConceptBanner";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { getSite, SITE_TITLE, TITLE_TEMPLATE } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: TITLE_TEMPLATE,
    default: SITE_TITLE,
  },
  description: getSite().description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { skipLink } = getSite();
  return (
    // System fonts only: no web font files to download before text can paint.
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-neutral-950"
        >
          {skipLink}
        </a>
        <ConceptBanner />
        <SiteHeader />
        <main id="main-content" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
