"use client";

import { useState } from "react";

import { AdminSidebar } from "./sidebar";
import { AdminTopbar } from "./topbar";

export function AdminShell({
  engine,
  hotLeads,
  children,
}: {
  engine: { engine: string; model: string; hosted: boolean };
  hotLeads: number;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas font-admin">
      <AdminSidebar open={navOpen} onClose={() => setNavOpen(false)} hotLeads={hotLeads} />
      <div className="lg:pl-[248px]">
        <AdminTopbar onMenu={() => setNavOpen(true)} engine={engine} notifications={hotLeads} />
        <main className="px-4 py-5 lg:px-6 lg:py-6">{children}</main>
        <footer className="flex flex-col gap-1 border-t border-line px-4 py-4 text-[12px] text-ink-400 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <p>2026 &copy; Best Auto. All rights reserved.</p>
          <p>
            Designed &amp; developed for the Digital Pylot technical assessment
          </p>
        </footer>
      </div>
    </div>
  );
}
