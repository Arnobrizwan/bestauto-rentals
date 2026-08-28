"use client";

import { useEffect } from "react";

import { StatusPage } from "@/components/site/status-page";
import { Button } from "@/components/ui";

/**
 * Route-level error boundary.
 *
 * Reached when a server component throws — a database blip is the realistic
 * cause. `reset()` re-renders the segment, which is usually all a transient
 * failure needs, so the retry is offered before the way out.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this screen to the server log entry.
    console.error("route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <StatusPage
      code="500"
      title="Something went wrong at our end"
      detail="That is on us, not you. It is usually momentary — trying again often works."
    >
      <Button type="button" onClick={reset} variant="dark">
        Try again
      </Button>
    </StatusPage>
  );
}
