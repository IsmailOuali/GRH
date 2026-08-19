import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fair'Up OS",
  description: "Portail RH interne — congés, paie, demandes administratives",
};

// viewportFit: "cover" is required for env(safe-area-inset-*) to be non-zero
// on notched phones — the bottom tab bar and sheets pad with it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning tolerates attributes injected into <html>/<body>
    // by browser extensions (Grammarly, dark-mode, password managers, …) before
    // React hydrates — a benign mismatch that isn't caused by our own markup.
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
