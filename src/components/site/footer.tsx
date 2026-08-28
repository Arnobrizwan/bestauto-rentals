import Link from "next/link";

import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "About",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Featured", href: "/cars" },
      { label: "Partnership", href: "/#register" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Events", href: "/#testimonials" },
      { label: "Blog", href: "/#how-it-works" },
      { label: "Podcast", href: "/#why-us" },
    ],
  },
  {
    title: "Socials",
    links: [
      { label: "Discord", href: "/#register" },
      { label: "Instagram", href: "/#register" },
      { label: "Twitter", href: "/#register" },
    ],
  },
];

const SOCIALS = [
  { label: "Facebook", d: "M13.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.2-1.4 1.4-1.4h1.5V5.5A20 20 0 0 0 14.2 5c-2.2 0-3.7 1.3-3.7 3.8v2.4H8v2.8h2.5v7z" },
  { label: "Twitter", d: "M21 6.5a7 7 0 0 1-2 .6 3.5 3.5 0 0 0 1.5-1.9c-.7.4-1.4.7-2.2.9a3.5 3.5 0 0 0-6 3.2A9.9 9.9 0 0 1 4.1 5.6a3.5 3.5 0 0 0 1.1 4.7c-.6 0-1.1-.2-1.6-.4a3.5 3.5 0 0 0 2.8 3.4c-.5.2-1.1.2-1.6.1a3.5 3.5 0 0 0 3.3 2.4A7 7 0 0 1 3 17.3 9.9 9.9 0 0 0 8.4 19c6.4 0 10-5.4 9.8-10.2A7 7 0 0 0 21 6.5" },
  { label: "Instagram", d: "M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6m0 6.3a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5M16 4H8a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4m2.7 12a2.7 2.7 0 0 1-2.7 2.7H8A2.7 2.7 0 0 1 5.3 16V8A2.7 2.7 0 0 1 8 5.3h8A2.7 2.7 0 0 1 18.7 8zm-1.9-8.3a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-ink-400">
              Our vision is to make renting a car in Bangladesh simple, priced honestly and available the moment you
              need it.
            </p>
            <div className="mt-6 flex gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="grid size-10 place-items-center rounded-full border border-ink-200 text-ink-500 transition-all hover:border-brand-400 hover:bg-brand-400 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                    <path d={s.d} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="font-display text-[15px] font-semibold text-ink-900">{col.title}</h4>
              <ul className="mt-5 space-y-3.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-ink-400 transition-colors hover:text-brand-500"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-400">&copy;2026 Best Auto. All rights reserved</p>
          <div className="flex gap-8">
            <Link href="/#why-us" className="text-sm text-ink-400 transition-colors hover:text-ink-900">
              Privacy &amp; Policy
            </Link>
            <Link href="/#why-us" className="text-sm text-ink-400 transition-colors hover:text-ink-900">
              Terms &amp; Condition
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
