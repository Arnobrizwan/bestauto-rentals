/**
 * Golden test for the QR encoder.
 *
 * The matrices below were produced by this encoder and then confirmed
 * scannable by an independent decoder (OpenCV's QRCodeDetector) — every string
 * round-tripped back byte-for-byte. Pinning their hashes here means a later
 * change to the placement, masking or Reed-Solomon code fails CI rather than
 * quietly shipping codes that no longer scan.
 *
 * Run with: npm run test:qr
 */
import { createHash } from "node:crypto";

import { encodeQr } from "../src/lib/qr";

const GOLDENS = [
  { text: "HELLO", size: 21, sha256: "b664c5ebcc2451fb6630e63f516abd72" },
  { text: "https://bestauto-rentals.vercel.app/cars/toyota-corolla", size: 33, sha256: "142ca6dd1e15b03793d4f52d2b577234" },
  {
    text: "https://bestauto-rentals.vercel.app/cars/toyota-corolla-axio-hybrid",
    size: 37,
    sha256: "23a55bb660685c218f4adacf0a3374a2",
  },
  { text: "DHAKA METRO GA 15-3421", size: 25, sha256: "a3fb7f82271682f409e6bd7a7a10a3ec" },
];

let failures = 0;

for (const golden of GOLDENS) {
  const matrix = encodeQr(golden.text);
  const rendered = matrix.map((row) => row.join("")).join("\n");
  const digest = createHash("sha256").update(rendered).digest("hex").slice(0, 32);

  const sizeOk = matrix.length === golden.size;
  const hashOk = digest === golden.sha256;

  if (sizeOk && hashOk) {
    console.log(`  PASS  ${golden.size}x${golden.size}  ${golden.text.slice(0, 52)}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${golden.text}`);
    if (!sizeOk) console.error(`        size ${matrix.length}, expected ${golden.size}`);
    if (!hashOk) console.error(`        sha256 ${digest}, expected ${golden.sha256}`);
  }
}

// The structural invariants a decoder relies on, checked directly so a
// regression reports what broke rather than only that a hash moved.
const m = encodeQr("HELLO");
const finderOk = [
  [0, 0],
  [0, m.length - 7],
  [m.length - 7, 0],
].every(([r, c]) => m[r][c] === 1 && m[r + 3][c + 3] === 1 && m[r + 1][c + 1] === 0);
if (!finderOk) {
  failures += 1;
  console.error("  FAIL  finder patterns are malformed");
}
if (m[m.length - 8][8] !== 1) {
  failures += 1;
  console.error("  FAIL  the dark module is missing");
}

console.log();
if (failures) {
  console.error(`${failures} QR check(s) failed.`);
  process.exit(1);
}
console.log(`  ${GOLDENS.length}/${GOLDENS.length} QR goldens matched, structure intact.`);
