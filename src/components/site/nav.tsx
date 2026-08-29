"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { Logo } from "./logo";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How it Works" },
  { href: "/cars", label: "Rental Deals" },
  { href: "/#why-us", label: "Why Choose Us" },
  { href: "/#testimonials", label: "Testimonial" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-line/80 bg-white/85 backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
        <Logo />

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <span aria-hidden className="h-5 w-px bg-line" />
          <Link
            href="/#register"
            className="text-sm font-medium text-ink-500 underline underline-offset-4 transition-colors hover:text-ink-900"
          >
            Register
          </Link>
          {/*
            "Staff login", not "Log In". There is no customer account in this
            product — /login is the operations dashboard's sign-in and says
            "Staff accounts only" on arrival, so an unqualified "Log In" in a
            customer nav promises an account that does not exist and walks the
            only audience this nav has into a wall. Same rule the rest of the
            build follows: the design owns the structure, the business owns the
            words.
          */}
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-full border border-ink-200 bg-white px-5 text-sm font-medium text-ink-900 transition-colors hover:border-ink-900"
          >
            Staff login
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-10 place-items-center rounded-xl border border-ink-200 bg-white text-ink-700 lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-white px-5 pb-6 lg:hidden">
          <div className="flex flex-col gap-1 pt-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-[15px] font-medium text-ink-700 hover:bg-ink-50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/#register"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-[15px] font-medium text-ink-700 hover:bg-ink-50"
            >
              Register
            </Link>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-xl border border-ink-200 text-[15px] font-medium text-ink-900"
            >
              Staff login
            </Link>
            <Link
              href="/cars"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-ink-900 text-[15px] font-medium text-white"
            >
              Book a car
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
