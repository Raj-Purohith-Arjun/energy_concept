import site from "../../content/site.json";

// Typed access to /content. Zod validation is added in Phase 0 step 4;
// until then the typed assignment below is checked by the compiler.

export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  heading: string | null;
  links: NavLink[];
}

export interface Site {
  banner: string;
  description: string;
  skipLink: string;
  brand: { name: string; homeHref: string };
  nav: NavLink[];
  invest: NavLink;
  menu: { open: string; close: string; label: string };
  footer: {
    columns: FooterColumn[];
    contact: { email: string; addressLines: string[]; link: NavLink };
    notice: {
      heading: string;
      paragraphs: string[];
      official: { lead: string; label: string; href: string };
    };
    credit: string;
    copyright: string;
  };
  notFound: { title: string; heading: string; homeLabel: string };
}

const siteData: Site = site;

export function getSite(): Site {
  return siteData;
}

export const SITE_TITLE = "EnergyX (concept)";
export const TITLE_TEMPLATE = `%s — ${SITE_TITLE}`;

// The root layout's title.template does not apply to app/page.tsx (same
// segment), so the home page uses this with `title.absolute`.
export function pageTitle(page: string): string {
  return TITLE_TEMPLATE.replace("%s", page);
}
