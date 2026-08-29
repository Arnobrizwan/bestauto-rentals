"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { AdminSidebar } from "./sidebar";
import { AdminTopbar } from "./topbar";

export type AdminUserView = { id: string; email: string; name: string; role: string };

export function AdminShell({
  hotLeads,
  user,
  children,
}: {
  hotLeads: number;
  user: AdminUserView;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas font-admin">
      <AdminSidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        hotLeads={hotLeads}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />
      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")}>
        <AdminTopbar onMenu={() => setNavOpen(true)} notifications={hotLeads} user={user} />
        <main className="px-4 py-5 lg:px-6 lg:py-6">{children}</main>
        <footer className="border-t border-line px-4 py-4 text-[12px] text-ink-400 lg:px-6">
          <p>2026 &copy; Best Auto. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
