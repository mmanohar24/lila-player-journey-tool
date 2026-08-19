import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // The dev-only overlay badge sits bottom-left, on top of the map legend.
  devIndicators: false,
};

export default nextConfig;
