import type { MetadataRoute } from "next";

// CLAUDE.md §2.5: robots disallow everything. Served without basic auth (see
// src/proxy.ts) so crawlers can actually read it; it contains nothing private.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
