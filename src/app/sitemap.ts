import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * Only the landing route is listed. The 796 per-match routes are deliberately absent:
 * they are noindex (PRD.md §10), and listing noindex URLs in a sitemap just asks a
 * crawler to fetch pages it is then told to discard.
 *
 * The URL is absolute because sitemap entries are emitted verbatim -- unlike metadata,
 * they are not resolved against `metadataBase`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl}/`, changeFrequency: "monthly", priority: 1 }];
}
