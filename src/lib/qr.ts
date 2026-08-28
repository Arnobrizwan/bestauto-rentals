/**
 * A minimal QR Code encoder — byte mode, error-correction level M, versions
 * 1 to 6.
 *
 * Written out rather than pulled in as a dependency for the same reason the
 * world map ships as path data: the output is a handful of rectangles, and a
 * package would put a full encoder, its polyfills and its canvas renderer in
 * the bundle to produce them. Everything here runs at request time on the
 * server and emits plain SVG.
 *
 * Reference: ISO/IEC 18004. The tables below are the standard ones.
 */

/** Data capacity in bytes at EC level M, indexed by version (1-based). */
const CAPACITY_M = [0, 14, 26, 42, 62, 84, 106];

/** EC codewords per block, and block structure, at level M by version. */
const EC_BLOCKS_M: [ecPerBlock: number, group1: number, group2: number][] = [
  [0, 0, 0],
  [10, 1, 0],
  [16, 1, 0],
  [26, 1, 0],
  [18, 2, 0],
  [24, 2, 0],
  [16, 4, 0],
];

/** Total codewords (data + EC) by version. */
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172];

/** Alignment-pattern centre coordinates by version. */
const ALIGNMENT = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

/* ------------------------------------------------------ Galois field GF(256) */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generatorPoly(degree: number) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function ecCodewords(data: Uint8Array, count: number) {
  const gen = generatorPoly(count);
  const remainder = new Uint8Array(data.length + count);
  remainder.set(data);
  for (let i = 0; i < data.length; i += 1) {
    const factor = remainder[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j += 1) remainder[i + j] ^= mul(gen[j], factor);
  }
  return remainder.slice(data.length);
}

/* ------------------------------------------------------------------ encoding */

function chooseVersion(byteLength: number) {
  for (let v = 1; v <= 6; v += 1) if (CAPACITY_M[v] >= byteLength) return v;
  // Version 7 and above carry an additional 18-bit version information block.
  // Nothing encoded here comes close to 106 bytes, so the encoder stops short
  // of needing it rather than shipping a path that is never exercised.
  throw new Error("QR payload too long: version 6 at EC level M holds 106 bytes");
}

function buildBitstream(bytes: Uint8Array, version: number) {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // versions 1-9 use an 8-bit byte-mode length
  for (const b of bytes) push(b, 8);

  const [ecPerBlock, g1, g2] = EC_BLOCKS_M[version];
  const totalData = TOTAL_CODEWORDS[version] - ecPerBlock * (g1 + g2);
  const capacityBits = totalData * 8;

  // Terminator, then pad to a byte boundary, then the standard pad bytes.
  for (let i = 0; i < 4 && bits.length < capacityBits; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(totalData);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    data[i / 8] = byte;
  }
  for (let i = bits.length / 8, alt = 0; i < totalData; i += 1, alt += 1) {
    data[i] = alt % 2 === 0 ? 0xec : 0x11;
  }
  return data;
}

/** Interleaves data and EC codewords across the version's block structure. */
function interleave(data: Uint8Array, version: number) {
  const [ecPerBlock, g1, g2] = EC_BLOCKS_M[version];
  const blockCount = g1 + g2;
  const totalData = data.length;
  const shortLen = Math.floor(totalData / blockCount);

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < blockCount; b += 1) {
    const len = b < g1 ? shortLen : shortLen + 1;
    const block = data.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(ecCodewords(block, ecPerBlock));
  }

  const out: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i += 1) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return Uint8Array.from(out);
}

/* ------------------------------------------------------------------ matrix */

type Matrix = { size: number; modules: Int8Array };

const at = (m: Matrix, r: number, c: number) => m.modules[r * m.size + c];
const set = (m: Matrix, r: number, c: number, v: number) => {
  m.modules[r * m.size + c] = v;
};

function placeFunctionPatterns(m: Matrix, version: number, reserved: Uint8Array) {
  const reserve = (r: number, c: number) => {
    reserved[r * m.size + c] = 1;
  };

  const finder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= m.size || cc < 0 || cc >= m.size) continue;
        const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(m, rr, cc, inRing || inCore ? 1 : 0);
        reserve(rr, cc);
      }
    }
  };

  finder(0, 0);
  finder(0, m.size - 7);
  finder(m.size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < m.size - 8; i += 1) {
    set(m, 6, i, i % 2 === 0 ? 1 : 0);
    set(m, i, 6, i % 2 === 0 ? 1 : 0);
    reserve(6, i);
    reserve(i, 6);
  }

  // Alignment patterns, skipping those that collide with a finder.
  const centres = ALIGNMENT[version];
  for (const r of centres) {
    for (const c of centres) {
      const nearFinder =
        (r <= 8 && c <= 8) || (r <= 8 && c >= m.size - 9) || (r >= m.size - 9 && c <= 8);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          set(m, r + dr, c + dc, on ? 1 : 0);
          reserve(r + dr, c + dc);
        }
      }
    }
  }

  // Dark module and the format-information areas.
  set(m, m.size - 8, 8, 1);
  reserve(m.size - 8, 8);
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      reserve(8, i);
      reserve(i, 8);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    reserve(8, m.size - 1 - i);
    reserve(m.size - 1 - i, 8);
  }
}

/** Mask 0: (row + column) mod 2 == 0. Fixed, so the output is deterministic. */
const MASK = (r: number, c: number) => (r + c) % 2 === 0;

function placeData(m: Matrix, reserved: Uint8Array, codewords: Uint8Array) {
  let bitIndex = 0;
  let upward = true;

  let col = m.size - 1;
  while (col > 0) {
    // Column 6 is the vertical timing pattern: step over it entirely rather
    // than pairing against it, or the next pair revisits a column.
    if (col === 6) col = 5;

    for (let i = 0; i < m.size; i += 1) {
      const row = upward ? m.size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (reserved[row * m.size + c]) continue;
        const byte = codewords[bitIndex >> 3];
        const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1;
        set(m, row, c, MASK(row, c) ? bit ^ 1 : bit);
        bitIndex += 1;
      }
    }

    col -= 2;
    upward = !upward;
  }
}

/** Format information for EC level M with mask 0, BCH-encoded and XOR-masked. */
function placeFormatInfo(m: Matrix) {
  const FORMAT_M_MASK0 = 0b101010000010010;
  const bit = (k: number) => (FORMAT_M_MASK0 >> k) & 1;

  // First copy, around the top-left finder.
  for (let j = 0; j <= 5; j += 1) set(m, 8, j, bit(14 - j));
  set(m, 8, 7, bit(8));
  set(m, 8, 8, bit(7));
  set(m, 7, 8, bit(6));
  for (let k = 0; k <= 5; k += 1) set(m, k, 8, bit(k));

  // Second copy, split between the bottom-left and top-right finders.
  for (let j = 0; j <= 6; j += 1) set(m, m.size - 1 - j, 8, bit(14 - j));
  for (let j = 0; j <= 7; j += 1) set(m, 8, m.size - 8 + j, bit(7 - j));
}

/** Encodes `text` and returns the module matrix as rows of 0/1. */
export function encodeQr(text: string): number[][] {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length);
  const size = 17 + version * 4;

  const matrix: Matrix = { size, modules: new Int8Array(size * size) };
  const reserved = new Uint8Array(size * size);

  placeFunctionPatterns(matrix, version, reserved);
  placeData(matrix, reserved, interleave(buildBitstream(bytes, version), version));
  placeFormatInfo(matrix);

  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (at(matrix, r, c) ? 1 : 0)),
  );
}

/**
 * Renders the matrix as an SVG path string plus its viewBox size, including
 * the four-module quiet zone the specification requires.
 */
export function qrSvgPath(text: string, quietZone = 4) {
  const matrix = encodeQr(text);
  const size = matrix.length + quietZone * 2;
  let d = "";
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix.length; c += 1) {
      if (matrix[r][c]) d += `M${c + quietZone},${r + quietZone}h1v1h-1z`;
    }
  }
  return { d, size };
}
