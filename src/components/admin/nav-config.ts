export type NavItem = { href: string; label: string; icon: string; badge?: "leads" };

export type NavGroup = { title: string; items: NavItem[] };

/** Grouped exactly like the Figma sidebar; every entry is a route that exists. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        icon: "M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM14 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z",
      },
    ],
  },
  {
    title: "Fleet",
    items: [
      {
        href: "/admin/vehicles",
        label: "Vehicles",
        icon: "M4 15h16v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM5.5 15 7 9.6A2 2 0 0 1 8.9 8h6.2a2 2 0 0 1 1.9 1.6L18.5 15",
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        href: "/admin/bookings",
        label: "Bookings",
        icon: "M5 4h14a1 1 0 0 1 1 1v15l-4-2-4 2-4-2-4 2V5a1 1 0 0 1 1-1zM8.5 9h7M8.5 13h4",
      },
      {
        href: "/admin/customers",
        label: "Customers",
        icon: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15 4.2a3.5 3.5 0 0 1 0 6.6",
      },
      {
        href: "/admin/leads",
        label: "Leads",
        icon: "M3 7.5 12 13l9-5.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
        badge: "leads",
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        href: "/admin/ai",
        label: "AI console",
        icon: "M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1 0 8v1a4 4 0 0 1-8 0v-1a4 4 0 0 1 0-8V7a4 4 0 0 1 4-4zM12 3v18M8 8h8M8 16h8",
      },
      {
        href: "/admin/automations",
        label: "Automations",
        icon: "M13 3 4 14h6l-1 7 9-11h-6z",
      },
    ],
  },
];
