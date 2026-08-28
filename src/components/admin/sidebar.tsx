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
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  hotLeads: number;
  user: { name: string; email: string; role: string };
  collapsed: boolean;
  onToggleCollapse: () => void;
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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-white transition-all duration-300 lg:translate-x-0",
          // Collapsing is a desktop affordance; on mobile the drawer is either
          // open at full width or off-canvas.
          collapsed ? "w-[248px] lg:w-[76px]" : "w-[248px]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("relative flex h-16 shrink-0 items-center border-b border-line", collapsed ? "lg:justify-center lg:px-0 px-5" : "px-5")}>
          <span className={cn(collapsed && "lg:hidden")}>
            <Logo />
          </span>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
            aria-expanded={!collapsed}
            className="absolute top-1/2 -right-3.5 z-10 hidden size-7 -translate-y-1/2 place-items-center rounded-full bg-brand-400 text-white shadow-[0_2px_8px_-2px_rgba(9,44,76,0.35)] transition-colors hover:bg-brand-500 lg:grid"
          >
            <svg
              viewBox="0 0 20 20"
              className={cn("size-3.5 transition-transform", collapsed && "rotate-180")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
            >
              <path d="m12 5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <nav className="scroll-slim flex-1 overflow-y-auto px-3 py-5" aria-label="Admin">
          {NAV_GROUPS.map((group, index) => (
            <div
              key={group.title}
              className={cn(
                "pb-4",
                // A hairline between groups, exactly as the design separates them.
                index > 0 && "mt-1 border-t border-line pt-4",
              )}
            >
              <p
                className={cn(
                  "px-3 pb-1.5 font-admin text-[13px] font-bold text-ink-900",
                  collapsed && "lg:sr-only",
                )}
              >
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
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg py-2.5 font-admin text-[14px] font-semibold transition-colors",
                          collapsed ? "px-3 lg:justify-center lg:px-0" : "px-3",
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
                        <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>{item.label}</span>
                        {item.expandable && (
                          <svg
                            viewBox="0 0 20 20"
                            aria-hidden
                            className={cn(
                              "size-4 shrink-0 rounded-full bg-ink-50 p-0.5 text-ink-400",
                              active && "bg-brand-100 text-brand-500",
                              collapsed && "lg:hidden",
                            )}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d={active ? "m6 8 4 4 4-4" : "m8 6 4 4-4 4"} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {item.badge === "leads" && hotLeads > 0 && (
                          <span className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-full bg-danger text-[10px] font-bold text-white",
                            collapsed && "lg:hidden",
                          )}>
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
          <div className={cn("mb-2 flex items-center gap-2.5 rounded-lg bg-canvas px-3 py-2.5", collapsed && "lg:justify-center lg:px-0")}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 font-admin text-[11px] font-bold text-white">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <span className="block truncate font-admin text-[13px] font-bold text-ink-900">{user.name}</span>
              <span className="block truncate text-[11px] text-ink-400 capitalize">{user.role}</span>
            </span>
          </div>
          <Link
            href="/"
            title={collapsed ? "Back to site" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg py-2.5 font-admin text-[14px] font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900",
              collapsed ? "px-3 lg:justify-center lg:px-0" : "px-3",
            )}
          >
            <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l-4 4 4 4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={cn(collapsed && "lg:hidden")}>Back to site</span>
          </Link>
          <SignOutButton collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
