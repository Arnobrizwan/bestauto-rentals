import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/site/logo";
import { countAdmins } from "@/server/repositories/admin-users";

import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Set up", robots: { index: false, follow: false } };

/**
 * First-run setup. Once an administrator exists this page is gone for good —
 * it redirects to the sign-in screen rather than offering a public way to mint
 * another privileged account.
 */
export default async function SetupPage() {
  if ((await countAdmins()) > 0) redirect("/login");

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-14">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-white p-7 shadow-card sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
            Create the administrator
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-400">
            No staff account exists yet. This sets up the first one and signs you in. It can only be
            used once.
          </p>

          <div className="mt-6">
            <SetupForm />
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-ink-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-500 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
