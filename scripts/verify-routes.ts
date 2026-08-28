/**
 * Route coverage.
 *
 * Two properties, both of which are easy to break by adding a file:
 *
 * 1. The sidebar was deliberately kept shallow for a long time to avoid links
 *    that 404. Now that it mirrors the design's depth, this asserts what made
 *    the shallow version safe — every entry in NAV_GROUPS resolves to a page,
 *    and every admin page is reachable from the sidebar.
 * 2. The OpenAPI document calls itself the full spec, so it has to be. Every
 *    route on disk must appear in it, and it must not describe anything that
 *    does not exist.
 *
 * Run with: npm run test:routes
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

/* The OpenAPI document must describe exactly the routes that exist. */
const apiDir = join(APP, "api");
const routeFiles = (function walkRoutes(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkRoutes(full, out);
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
})(apiDir);

const actualApiPaths = new Set(
  routeFiles.map((file) =>
    `/${relative(APP, file).replace(/\/route\.ts$/, "").replace(/\\/g, "/")}`
      .replace(/\[([a-zA-Z]+)\]/g, "{$1}"),
  ),
);

const spec = readFileSync(join(apiDir, "openapi", "route.ts"), "utf8");
const documented = new Set(Array.from(spec.matchAll(/"(\/api\/[a-z0-9/{}._-]+)"/g), (m) => m[1]));

for (const path of actualApiPaths) {
  if (!documented.has(path)) {
    failures += 1;
    console.error(`  FAIL  ${path} is not described in /api/openapi`);
  }
}
for (const path of documented) {
  if (!actualApiPaths.has(path)) {
    failures += 1;
    console.error(`  FAIL  /api/openapi describes ${path}, which does not exist`);
  }
}

const groups = NAV_GROUPS.length;
console.log(`  ${NAV_HREFS.length} sidebar entries across ${groups} groups`);
console.log(`  ${adminPages.length} admin pages on disk`);
console.log(`  ${actualApiPaths.size} API routes, all described in /api/openapi`);

if (failures) {
  console.error(`\n${failures} route problem(s).`);
  process.exit(1);
}
console.log("\n  Every sidebar link resolves, every admin page is linked, and the spec matches the routes.");
