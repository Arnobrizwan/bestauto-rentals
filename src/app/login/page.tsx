import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/site/logo";
import { getCurrentAdmin } from "@/lib/auth/server";
import { countAdmins } from "@/server/repositories/admin-users";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only ever bounce back to a path on this origin.
  const next = raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";

  // This has to ask the same question the admin layout asks. It used to check
  // only the cookie's signature: a correctly signed cookie whose account had
  // since been deleted or deactivated was bounced to /admin, which bounced it
  // straight back here, and the browser gave up with ERR_TOO_MANY_REDIRECTS —
  // unrecoverable without clearing cookies by hand. Checking the account
  // itself means a stale session lands on the form instead of in a loop.
  const admin = await getCurrentAdmin();
  if (admin) redirect(next);

  const stale = params.stale === "1";

  // A fresh deployment has no staff account yet; send the first person to setup.
  if ((await countAdmins()) === 0) redirect("/setup");

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

          {stale && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13px] font-medium text-brand-600"
            >
              That session is no longer valid — the account was deactivated or removed. Signing in again will replace it.
            </p>
          )}

          <div className="mt-6">
            <LoginForm next={next} />
          </div>
        </div>

        <p className="mt-6 text-center text-[13px]">
          <Link href="/" className="font-semibold text-brand-500 hover:underline">
            Back to the site
          </Link>
        </p>
      </div>
    </main>
  );
}
