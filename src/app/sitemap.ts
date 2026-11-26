import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_MARKETING_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const alt = (path: string) => ({ languages: { fr: `${site}${path}`, ar: `${site}/ar${path === "/" ? "" : path}`, en: `${site}/en${path === "/" ? "" : path}` } });
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1, alternates: alt("/") },
    { url: `${site}/privacy`, changeFrequency: "yearly", priority: 0.3, alternates: alt("/privacy") },
  ];
}
