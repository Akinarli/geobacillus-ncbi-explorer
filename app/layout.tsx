import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import CompareBar from "@/components/CompareBar";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Koeus — bacterial genome & protein explorer",
  description:
    "Explore bacterial genomes and protein records on NCBI: read any GenPept record as a clean, citable card with domains, 3D structure, gene neighborhood and comparison.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body suppressHydrationWarning>
        <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6">
          <header className="border-b border-rule py-5">
            <a href="/" className="inline-block no-underline">
              <span className="display text-[19px] font-semibold text-ink">
                Koeus
              </span>
            </a>
            <p className="eyebrow mt-1.5">
              NCBI bacterial genomes &amp; protein records
            </p>
          </header>

          <main className="flex-1 py-8">{children}</main>

          <footer className="border-t border-rule py-5 text-xs text-muted">
            Data from{" "}
            <a
              href="https://www.ncbi.nlm.nih.gov/datasets/"
              target="_blank"
              rel="noreferrer"
              className="text-petrol underline decoration-rule underline-offset-2 hover:decoration-current"
            >
              NCBI Datasets
            </a>{" "}
            and E-utilities. An independent tool, not affiliated with NCBI.
          </footer>
        </div>
        <CompareBar />
        <Analytics />
      </body>
    </html>
  );
}
