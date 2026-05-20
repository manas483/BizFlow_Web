import type { MetadataRoute } from "next";

/**
 * Dynamic sitemap — exposes only public-facing pages to search engines.
 * Authenticated dashboard routes are excluded (they're blocked in robots.txt too).
 *
 * Next.js auto-serves this at /sitemap.xml on each build.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://bizflow.app";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.8,
    },
  ];
}
