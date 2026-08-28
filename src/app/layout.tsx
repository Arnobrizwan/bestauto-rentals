import type { Metadata, Viewport } from "next";
import { Inter, Nunito, Outfit } from "next/font/google";

import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bestauto-rentals.vercel.app"),
  title: {
    default: "Best Auto — Fast and easy way to rent a car",
    template: "%s · Best Auto",
  },
  description:
    "A Bangladeshi car rental platform with an AI concierge that finds the right car, quotes it honestly in taka, and hands warm leads straight to the team.",
  openGraph: {
    title: "Best Auto — Fast and easy way to rent a car",
    description: "Chauffeur-driven cars across Bangladesh, 11 branches, and an AI concierge that actually checks availability before it answers.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#092c4c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-BD"
      // globals.css sets scroll-behavior: smooth; declaring it here lets Next
      // suppress it during route transitions instead of animating every jump.
      data-scroll-behavior="smooth"
      // Browser extensions write their own attributes onto <html> before React
      // hydrates — a grammar checker adding `data-qb-installed` is what surfaced
      // this — and React then reports a mismatch the page did not cause and
      // cannot prevent. This suppresses the comparison for this element's own
      // attributes only; a genuine mismatch anywhere inside still reports.
      suppressHydrationWarning
      className={`${outfit.variable} ${inter.variable} ${nunito.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {/*
          The reveal animation starts every [data-reveal] section at opacity 0
          and relies on JavaScript to show it. With scripting unavailable that
          is not a missing animation, it is a blank page, so scripting off
          means no hiding at all.

          This lives in <body> rather than a hand-written <head>: the App
          Router builds the head itself, and rendering a second one alongside
          it is asking for exactly the kind of mismatch above. A style element
          applies to the whole document wherever it sits.
        */}
        <noscript>
          <style>{"[data-reveal]{opacity:1 !important;transform:none !important}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
