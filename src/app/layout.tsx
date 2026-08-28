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
      className={`${outfit.variable} ${inter.variable} ${nunito.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
