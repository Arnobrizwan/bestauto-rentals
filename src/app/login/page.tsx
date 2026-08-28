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

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-14">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-white p-7 shadow-card sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">Sign in</h1>
          <p className="mt-1.5 text-[14px] text-ink-400">
            The Best Auto operations dashboard. Staff accounts only.
          </p>

          <div className="mt-6">
            <LoginForm next={next} />
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-ink-400">
          Looking to rent a car?{" "}
          <Link href="/" className="font-semibold text-brand-500 hover:underline">
            Back to the site
          </Link>
        </p>
      </div>
    </main>
  );
}
