import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Do not generate AGENTS.md / CLAUDE.md into the repo on every dev run.
  agentRules: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const dev = process.env.NODE_ENV !== "production";

    /**
     * Content Security Policy.
     *
     * `script-src` carries `'unsafe-inline'` and that is a deliberate trade,
     * not an oversight. Next inlines the hydration payload, so the strict
     * alternative is a per-request nonce — which requires rendering every page
     * dynamically and would undo the prerendering that took the home page from
     * ~470ms to ~165ms. What remains still blocks the attacks that matter for
     * a site with no user-generated HTML: a script cannot be loaded from
     * another origin, the page cannot be framed, a form cannot be retargeted
     * off-site, and plugins are refused outright.
     *
     * Development additionally needs `'unsafe-eval'` for React Fast Refresh
     * and a websocket for HMR; neither is present in production.
     */
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      // Tailwind and Next both inject style elements at runtime.
      "style-src 'self' 'unsafe-inline'",
      // Fleet photography is remote; data: and blob: cover the optimiser.
      "img-src 'self' data: blob: https://images.unsplash.com",
      "font-src 'self' data:",
      `connect-src 'self'${dev ? " ws: wss:" : ""}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // `geolocation=(self)`, not `()`. The empty allowlist denies the
          // API to everyone including this origin, so "Use my location" was
          // rejected by the browser before any permission prompt could appear
          // — the visitor saw it fail with no way to grant anything, and the
          // console said only "disabled by permissions policy". `self` lets
          // this origin ask; the visitor still has to agree, and camera and
          // microphone stay denied outright because nothing here needs them.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
