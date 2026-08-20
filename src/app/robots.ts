import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Crawling is allowed everywhere on purpose. Per-match deep links are kept out of search
 * with a `noindex` meta directive (see match/[matchId]/page.tsx), and a crawler has to be
 * able to fetch a page to read that directive -- disallowing /match/ here would hide the
 * very instruction that keeps those pages unindexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
