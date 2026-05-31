import type { MetadataRoute } from "next";

// Public canonical origin — kept in sync with sitemap.ts. The production
// deployment is at https://13f.mapperlab.co. If we ever move, update both.
const SITE_URL = "https://13f.mapperlab.co";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Internal API routes don't need to be crawled — they're consumed by
      // our own server components, not by humans.
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
