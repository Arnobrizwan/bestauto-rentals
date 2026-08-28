"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for a failure in the root layout itself.
 *
 * This replaces the whole document, so it has to render its own `html` and
 * `body` — the layout that would normally provide them is what failed. For the
 * same reason it cannot use the design tokens from `globals.css` or any shared
 * component, so the styling is inline and deliberately minimal.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="en-BD">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "2rem 1.25rem",
          background: "#f7f8fa",
          color: "#092c4c",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, letterSpacing: "0.16em", color: "#ff9f43", textTransform: "uppercase" }}>
            Best Auto
          </p>
          <h1 style={{ margin: "1.25rem 0 0", fontSize: "1.75rem", lineHeight: 1.2 }}>The site failed to load</h1>
          <p style={{ margin: "0.75rem 0 0", color: "#5b6b7c", lineHeight: 1.6 }}>
            Something broke before the page could be built. Reloading usually clears it.
          </p>
          <div style={{ marginTop: "2rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{ border: 0, borderRadius: "9999px", background: "#ff9f43", color: "#fff", padding: "0.75rem 1.5rem", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            {/*
              A plain anchor on purpose. next/link navigates through the
              router, and this boundary exists precisely because the root
              layout failed — a hard document load is the only reliable way
              out of that.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ borderRadius: "9999px", background: "#092c4c", color: "#fff", padding: "0.75rem 1.5rem", fontSize: "0.9375rem", fontWeight: 600, textDecoration: "none" }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
