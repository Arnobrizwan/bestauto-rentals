import { Concierge } from "@/components/site/concierge";
import { SiteFooter } from "@/components/site/footer";
import { HashScroll } from "@/components/site/hash-scroll";
import { SiteNav } from "@/components/site/nav";
import { RevealOnScroll } from "@/components/site/reveal";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-70 focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <Concierge />
      <RevealOnScroll />
      <HashScroll />
    </div>
  );
}
