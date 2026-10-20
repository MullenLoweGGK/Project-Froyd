import type { MetadataRoute } from "next";

/**
 * PPDZ courses site must stay out of search indexes.
 * Campaign indexing remains on the froyd.app (main) deployment.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
