"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      title={collapsed ? "Sign out" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg py-2.5 font-admin text-[14px] font-semibold text-ink-600 transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50",
        collapsed ? "px-3 lg:justify-center lg:px-0" : "px-3",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M17 8l4 4-4 4M21 12H11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cn(collapsed && "lg:hidden")}>{busy ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
