import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  devIndicators: false,
  // pdf-parse (built on pdfjs-dist) uses Node.js APIs and must not be bundled
  // for Server Components / Route Handlers. puppeteer is already auto-externalized.
  // pdfjs-dist (bulk payslip splitting) loads its worker at runtime the same way.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
