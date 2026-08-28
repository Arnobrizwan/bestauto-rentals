import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/site/logo";
import { ButtonLink } from "@/components/ui";

/**
 * The shell every error and not-found screen shares.
 *
 * A reviewer mistyping a URL, or a database hiccup mid-render, should still
 * land somewhere that looks like the product and offers a way onward. Next's
 * stock screens are black text on white with no logo, no navigation and no
 * exit — accurate, but they read as an unfinished site.
 */
export function StatusPage({
  code,
  title,
  detail,
  children,
}: {
  code: string;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-16">
      <div className="w-full max-w-lg text-center">
        <Link href="/" className="inline-flex" aria-label="Best Auto home">
          <Logo />
        </Link>

        <p className="mt-10 font-display text-6xl font-bold tracking-tight text-brand-400 lg:text-7xl">{code}</p>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink-900 lg:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-400">{detail}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/cars" variant="dark">
            Browse the fleet
          </ButtonLink>
          {children}
        </div>

        <p className="mt-10 text-[13px] text-ink-400">
          Still stuck? The concierge is on every page, or call us on{" "}
          <span className="font-semibold text-ink-600">+880 1700 000000</span>.
        </p>
      </div>
    </main>
  );
}
