"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

import { NAV_GROUPS } from "./nav-config";
import { SignOutButton } from "./sign-out";

export function AdminSidebar({
  open,
  onClose,
  hotLeads,
  user,
}: {
  open: boolean;
  onClose: () => void;
  hotLeads: number;
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-line bg-white transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <Logo />
        </div>

        <nav className="scroll-slim flex-1 overflow-y-auto px-3 py-5" aria-label="Admin">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="px-3 pb-2 font-admin text-[11px] font-bold tracking-[0.08em] text-ink-900 uppercase">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 font-admin text-[14px] font-semibold transition-colors",
                          active
                            ? "bg-brand-50 text-brand-500"
                            : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                        )}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className={cn("size-[18px] shrink-0", active ? "text-brand-400" : "text-ink-400")}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge === "leads" && hotLeads > 0 && (
                          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-danger text-[10px] font-bold text-white">
                            {hotLeads > 99 ? "99" : hotLeads}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-canvas px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 font-admin text-[11px] font-bold text-white">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-admin text-[13px] font-bold text-ink-900">{user.name}</span>
              <span className="block truncate text-[11px] text-ink-400 capitalize">{user.role}</span>
            </span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-admin text-[14px] font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <svg viewBox="0 0 24 24" className="size-[18px] text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l-4 4 4 4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to site
          </Link>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
