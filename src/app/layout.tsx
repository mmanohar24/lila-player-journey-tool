import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LILA BLACK Player Journey Visualization Tool",
    // Deep links supply their own match-specific title.
    template: "%s · LILA Player Journey Tool",
  },
  description:
    "Player movement, combat, and death patterns from LILA BLACK gameplay telemetry.",
  applicationName: "LILA Player Journey Tool",
  openGraph: {
    siteName: "LILA Player Journey Tool",
    type: "website",
    locale: "en",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="text-ui min-h-full flex flex-col">{children}</body>
    </html>
  );
}
