import type { Metadata } from "next";

import { StatusPage } from "@/components/site/status-page";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="That page isn't here"
      detail="The link may be old, or the car may have left the fleet. Everything we currently rent is one click away."
    />
  );
}
