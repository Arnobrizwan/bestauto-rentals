"use client";

import { useEffect } from "react";

import { Button, Card } from "@/components/ui";

/**
 * Admin error boundary.
 *
 * Kept inside the dashboard chrome rather than replacing it: an operator whose
 * report failed to load should still have the sidebar and be able to move to
 * another board, instead of being thrown out to a marketing page.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("admin route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <p className="font-admin text-[13px] font-bold tracking-[0.16em] text-danger uppercase">Error</p>
      <h1 className="mt-3 font-admin text-xl font-bold text-ink-900">This board didn&rsquo;t load</h1>
      <p className="mt-2 text-[14px] text-ink-400">
        The query behind it failed. Every other page in the sidebar is unaffected.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[12px] text-ink-400">reference {error.digest}</p>
      )}
      <div className="mt-6 flex justify-center">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </Card>
  );
}
