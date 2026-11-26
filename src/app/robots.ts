import type { MetadataRoute } from "next";

/** Only the public pages are indexed; agency pages are private. */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_MARKETING_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  // Preview deployments are never indexed.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: ["/$", "/ar$", "/en$", "/privacy", "/ar/privacy", "/en/privacy"], disallow: "/" },
    sitemap: `${site}/sitemap.xml`,
  };
}
