import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // The dev-only overlay badge sits bottom-left, on top of the map legend.
  devIndicators: false,

  /**
   * `/match/[matchId]` is server-rendered on demand and reads its JSON from
   * `public/data/` through `fs` at request time. The path is built at runtime, so
   * Next's file tracing cannot see it statically and would ship a function bundle
   * without the data -- fine locally (where the whole project is on disk) and broken
   * once deployed. These globs put the data in the trace explicitly.
   *
   * The brackets are escaped because route keys are matched with picomatch, where a
   * bare `[matchId]` would be parsed as a character class rather than a literal.
   * Verified against the emitted trace: 796 match files, maps.json, the index and the
   * heatmap grids are all listed in page.js.nft.json.
   */
  outputFileTracingIncludes: {
    "/match/\\[matchId\\]": ["./public/data/**/*"],
  },
};

export default nextConfig;
