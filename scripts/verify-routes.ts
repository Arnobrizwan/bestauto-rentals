/**
 * Route coverage for the admin sidebar.
 *
 * The sidebar was deliberately kept shallow for a long time to avoid links
 * that 404. Now that it mirrors the design's depth, this asserts the property
 * that made the shallow version safe: every entry in NAV_GROUPS resolves to a
 * page on disk, and every admin page is reachable from the sidebar.
 *
 * Run with: npm run test:routes
 */
import { existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { NAV_GROUPS, NAV_HREFS } from "../src/components/admin/nav-config";

const APP = join(process.cwd(), "src", "app");

const pageFor = (href: string) => join(APP, href, "page.tsx");

let failures = 0;

/* Every sidebar link must have a page. */
for (const href of NAV_HREFS) {
  if (!existsSync(pageFor(href))) {
    failures += 1;
    console.error(`  FAIL  ${href} has no page.tsx`);
  }
}

/* Every admin page must be reachable from the sidebar. */
function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

const adminPages = walk(join(APP, "admin")).map((file) => {
  const rel = relative(APP, file).replace(/\/page\.tsx$/, "").replace(/\\/g, "/");
  return `/${rel}`;
});

const linked = new Set(NAV_HREFS);
for (const page of adminPages) {
  if (!linked.has(page)) {
    failures += 1;
    console.error(`  FAIL  ${page} exists but nothing in the sidebar links to it`);
  }
}

const groups = NAV_GROUPS.length;
console.log(`  ${NAV_HREFS.length} sidebar entries across ${groups} groups`);
console.log(`  ${adminPages.length} admin pages on disk`);

if (failures) {
  console.error(`\n${failures} route problem(s).`);
  process.exit(1);
}
console.log("\n  Every sidebar link resolves, and every admin page is linked.");
