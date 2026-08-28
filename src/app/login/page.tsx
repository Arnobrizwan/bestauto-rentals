import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/site/logo";
import { getSessionClaims } from "@/lib/auth/server";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only ever bounce back to a path on this origin.
  const next = raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";

  const claims = await getSessionClaims();
  if (claims) redirect(next);

  // The demo credentials panel only renders when the deployment explicitly opts
  // in. It is off by default, so a real deployment never advertises a login.
  const demo =
    process.env.SHOW_DEMO_CREDENTIALS === "true" &&
    process.env.DEMO_ADMIN_EMAIL &&
    process.env.DEMO_ADMIN_PASSWORD
      ? { email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD }
      : null;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo />

          <h1 className="mt-10 font-display text-3xl font-bold tracking-tight text-ink-900">Sign in</h1>
          <p className="mt-2 text-[15px] text-ink-400">
            The Best Auto operations dashboard. Staff accounts only.
          </p>

          <div className="mt-8">
            <LoginForm next={next} demo={demo} />
          </div>

          <p className="mt-8 text-[13px] text-ink-400">
            Looking to rent a car?{" "}
            <Link href="/" className="font-semibold text-brand-500 hover:underline">
              Back to the site
            </Link>
          </p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(50rem 30rem at 20% 10%, rgba(255,159,67,0.22), transparent 60%), radial-gradient(40rem 26rem at 90% 90%, rgba(46,155,245,0.16), transparent 60%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-14">
          <blockquote className="max-w-md">
            <p className="font-display text-2xl leading-snug font-semibold text-white">
              Every figure on the dashboard is computed from the bookings table at request time. Nothing is cached,
              nothing is hard-coded.
            </p>
            <footer className="mt-6 text-[14px] text-white/50">
              Best Auto operations &mdash; chauffeur-driven across 11 branches, one source of truth
            </footer>
          </blockquote>
        </div>
      </aside>
    </main>
  );
}
