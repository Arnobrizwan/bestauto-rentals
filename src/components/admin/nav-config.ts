export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: "leads";
  /** Renders the Figma's right-hand chevron on rows that lead somewhere deeper. */
  expandable?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

/* ---------------------------------------------------------------------------
   Icons. Single-path 24×24 outlines so the sidebar stays one <svg> per row.
--------------------------------------------------------------------------- */
const I = {
  grid: "M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM14 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z",
  shield: "M12 3.5 19 6v5.5c0 4-2.9 7.4-7 8.5-4.1-1.1-7-4.5-7-8.5V6zM9.5 12l1.8 1.8L15 10",
  car: "M4 15h16v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM5.5 15 7 9.6A2 2 0 0 1 8.9 8h6.2a2 2 0 0 1 1.9 1.6L18.5 15",
  plus: "M12 5v14M5 12h14",
  plate: "M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM6.5 11v2M10 11v2M14 11v2M17.5 11v2",
  calendarWarn: "M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8 3v4M16 3v4M3 11h18M12 14v3M12 19.5v.01",
  gauge: "M12 20a8 8 0 1 1 8-8M12 12l4.5-3.5",
  layers: "M12 3.5 21 8l-9 4.5L3 8zM3 12.5 12 17l9-4.5M3 16.5 12 21l9-4.5",
  tag: "M11 3.5H19a1.5 1.5 0 0 1 1.5 1.5v8L11.6 21.9a1.5 1.5 0 0 1-2.1 0L2.6 15a1.5 1.5 0 0 1 0-2.1zM16.5 8.5v.01",
  badge: "M12 3 4.5 6v6c0 4 3 7.5 7.5 9 4.5-1.5 7.5-5 7.5-9V6z",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5",
  wrench: "M14.5 4a5 5 0 0 0-4.6 7L4 16.9 7.1 20l5.9-5.9A5 5 0 1 0 14.5 4z",
  clipboard: "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2M9 11h6M9 15h4",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  calendarCheck: "M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8 3v4M16 3v4M3 11h18M9.5 15.5l1.8 1.8 3.2-3.6",
  transfer: "M4 8h13M13.5 4.5 17 8l-3.5 3.5M20 16H7M10.5 12.5 7 16l3.5 3.5",
  receipt: "M5 4h14a1 1 0 0 1 1 1v15l-4-2-4 2-4-2-4 2V5a1 1 0 0 1 1-1zM8.5 9h7M8.5 13h4",
  invoice: "M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.5 13h7M8.5 17h4",
  undo: "M4 9h10a5 5 0 0 1 0 10h-3M4 9l4-4M4 9l4 4",
  quote: "M6 4h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 9h7M8.5 13h7M8.5 17h3",
  counter: "M3 10h18M4 10V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3M5 10v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M9 14h6",
  users: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15 4.2a3.5 3.5 0 0 1 0 6.6",
  mail: "M3 7.5 12 13l9-5.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  ticket: "M4 7h16a1 1 0 0 1 1 1v2.5a1.5 1.5 0 0 0 0 3V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a1.5 1.5 0 0 0 0-3V8a1 1 0 0 1 1-1zM10 9v6",
  brain: "M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1 0 8v1a4 4 0 0 1-8 0v-1a4 4 0 0 1 0-8V7a4 4 0 0 1 4-4zM12 3v18M8 8h8M8 16h8",
  bolt: "M13 3 4 14h6l-1 7 9-11h-6z",
} as const;

/**
 * The sidebar, grouped the way the Figma groups it.
 *
 * The source design is a retail/POS template — its Inventory group runs
 * Products, Create Product, Expired Products, Low Stocks, Category, Sub
 * Category, Brands, Units, Variant Attributes, Warranties, Print Barcode,
 * Print QR Code. Reproducing those labels verbatim would describe a shop
 * selling goods rather than a fleet on hire, so each one is carried over at
 * its rental meaning instead: Products becomes Vehicles, Expired Products
 * becomes the statutory document board, Stock Transfer becomes branch
 * repositioning, POS becomes the counter desk. The structure, grouping and
 * depth are the design's; the vocabulary is the business's.
 *
 * Every entry resolves to a route that exists and renders real data.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      { href: "/admin", label: "Dashboard", icon: I.grid, expandable: true },
      { href: "/admin/team", label: "Team & roles", icon: I.shield, expandable: true },
    ],
  },
  {
    title: "Fleet",
    items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: I.car, expandable: true },
      { href: "/admin/fleet/new", label: "Add vehicle", icon: I.plus },
      { href: "/admin/fleet/units", label: "Units", icon: I.plate },
      { href: "/admin/fleet/documents", label: "Document expiry", icon: I.calendarWarn },
      { href: "/admin/fleet/low-availability", label: "Low availability", icon: I.gauge },
      { href: "/admin/fleet/segments", label: "Segments", icon: I.layers },
      { href: "/admin/fleet/body-types", label: "Body types", icon: I.tag },
      { href: "/admin/fleet/brands", label: "Brands", icon: I.badge },
      { href: "/admin/fleet/specs", label: "Specs", icon: I.sliders },
      { href: "/admin/fleet/service", label: "Service history", icon: I.wrench },
      { href: "/admin/fleet/handover", label: "Handover sheet", icon: I.clipboard },
      { href: "/admin/fleet/qr", label: "Vehicle QR", icon: I.qr },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/operations/availability", label: "Availability", icon: I.calendarCheck, expandable: true },
      { href: "/admin/operations/maintenance", label: "Off-road & maintenance", icon: I.wrench },
      { href: "/admin/operations/transfers", label: "Branch transfers", icon: I.transfer },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/admin/bookings", label: "Bookings", icon: I.receipt, expandable: true },
      { href: "/admin/sales/invoices", label: "Invoices", icon: I.invoice },
      { href: "/admin/sales/cancellations", label: "Cancellations", icon: I.undo },
      { href: "/admin/sales/quotes", label: "Quotes", icon: I.quote },
      { href: "/admin/sales/counter", label: "Counter booking", icon: I.counter },
      { href: "/admin/customers", label: "Customers", icon: I.users },
      { href: "/admin/leads", label: "Leads", icon: I.mail, badge: "leads" },
    ],
  },
  {
    title: "Promo",
    items: [{ href: "/admin/promo", label: "Offers & coupons", icon: I.ticket }],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/admin/ai", label: "AI console", icon: I.brain },
      { href: "/admin/automations", label: "Automations", icon: I.bolt },
    ],
  },
];

/** Flat list of every admin route, used by the route-coverage test. */
export const NAV_HREFS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
