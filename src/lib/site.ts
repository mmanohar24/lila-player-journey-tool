/**
 * Absolute origin for canonical URLs, Open Graph tags and the sitemap.
 *
 * Open Graph and sitemap entries both require absolute URLs -- `metadataBase` resolves
 * them for metadata, but sitemap entries are emitted verbatim, so they need the origin
 * applied explicitly.
 */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}`
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";
