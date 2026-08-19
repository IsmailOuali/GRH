import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  devIndicators: false,
  // pdf-parse (built on pdfjs-dist) uses Node.js APIs and must not be bundled
  // for Server Components / Route Handlers. puppeteer is already auto-externalized.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
