// Tiny, dependency-free QR code generator — just enough for a short careers URL.
// Byte mode, error-correction level L, versions 1–5 (single data block, so no
// interleaving), automatic version selection, best-mask selection. Returns a boolean
// module matrix, plus an SVG helper. Not a general QR library — scoped to short ASCII/UTF-8
// strings (≤ 106 bytes), which covers any application URL.

/* ---- Galois field GF(256), primitive 0x11d ---- */
const EXP = new Array(512), LOG = new Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// Reed–Solomon generator polynomial of given degree.
function rsGenPoly(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= mul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}
function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift(); res.push(0);
    if (factor !== 0) for (let j = 0; j < gen.length; j++) res[j] ^= mul(gen[j], factor);
  }
  return res;
}

// Per-version (index = version-1) for ECC level L, single block: [dataCodewords, ecCodewords].
const VERS_L = [[19, 7], [34, 10], [55, 15], [80, 20], [108, 26]];
const capacityBytes = (v) => VERS_L[v - 1][0] - 2; // header (mode+count) overhead ≈ 2 codewords

function chooseVersion(nBytes) {
  for (let v = 1; v <= 5; v++) if (nBytes <= capacityBytes(v)) return v;
  throw new Error('Text too long for this QR generator');
}

/* ---- bit buffer ---- */
function encodeData(bytes, version) {
  const dataCw = VERS_L[version - 1][0];
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(0b0100, 4);           // byte mode
  put(bytes.length, 8);     // char count (8-bit for versions 1–9)
  for (const b of bytes) put(b, 8);
  // terminator
  const cap = dataCw * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  // to codewords + pad bytes
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
  const pads = [0xec, 0x11];
  let pi = 0;
  while (cw.length < dataCw) cw.push(pads[pi++ % 2]);
  return cw;
}

/* ---- matrix construction ---- */
function newMatrix(size) { return Array.from({ length: size }, () => new Array(size).fill(null)); }

function placeFinder(m, r, c) {
  for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
    const rr = r + i, cc = c + j;
    if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
    const inRing = i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6);
    const inCore = i >= 2 && i <= 4 && j >= 2 && j <= 4;
    m[rr][cc] = inRing || inCore;
  }
}
function placeAlignment(m, cx, cy) {
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const ring = Math.max(Math.abs(i), Math.abs(j));
    m[cx + i][cy + j] = ring !== 1;
  }
}

function reserveFormat(m) {
  const size = m.length;
  const mark = (r, c) => { if (m[r][c] === null) m[r][c] = 'F'; };
  for (let i = 0; i <= 8; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
}

function buildFunctionMatrix(version) {
  const size = 17 + 4 * version;
  const m = newMatrix(size);
  placeFinder(m, 0, 0); placeFinder(m, 0, size - 7); placeFinder(m, size - 7, 0);
  // timing patterns
  for (let i = 8; i < size - 8; i++) { if (m[6][i] === null) m[6][i] = (i % 2 === 0); if (m[i][6] === null) m[i][6] = (i % 2 === 0); }
  // alignment (single, versions 2–5)
  if (version >= 2) { const c = 4 * version + 10; placeAlignment(m, c, c); }
  // dark module
  m[size - 8][8] = true;
  reserveFormat(m);
  return m;
}

function placeData(m, codewords) {
  const size = m.length;
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  let bi = 0, upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip the vertical timing column
    for (let t = 0; t < size; t++) {
      const row = upward ? size - 1 - t : t;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (m[row][c] !== null) continue;
        m[row][c] = bi < bits.length ? bits[bi++] === 1 : false;
      }
    }
    upward = !upward;
  }
}

const MASK = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(m, fnMask, maskIdx) {
  const size = m.length;
  const out = m.map((row) => row.slice());
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (fnMask[r][c] !== null) continue; // function/format modules untouched
    if (MASK[maskIdx](r, c)) out[r][c] = out[r][c] ? false : true;
  }
  return out;
}

// BCH(15,5) format info; ECC level L = 0b01.
function formatBits(maskIdx) {
  let data = (0b01 << 3) | maskIdx;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) ? 0x537 : 0);
  return ((data << 10) | rem) ^ 0x5412;
}
function placeFormat(m, maskIdx) {
  const size = m.length;
  const bits = formatBits(maskIdx);
  const bit = (i) => (bits >> i) & 1;
  // top-left
  for (let i = 0; i <= 5; i++) m[8][i] = bit(i) === 1;
  m[8][7] = bit(6) === 1; m[8][8] = bit(7) === 1; m[7][8] = bit(8) === 1;
  for (let i = 9; i <= 14; i++) m[14 - i][8] = bit(i) === 1;
  // bottom-left: bits 0..6 (rows size-1 up to size-7); the dark module at size-8 is left intact
  for (let i = 0; i < 7; i++) m[size - 1 - i][8] = bit(i) === 1;
  // top-right: bits 7..14 (cols size-8 to size-1)
  for (let i = 7; i < 15; i++) m[8][size - 15 + i] = bit(i) === 1;
}

function penalty(m) {
  const size = m.length; let p = 0;
  const at = (r, c) => (m[r][c] ? 1 : 0);
  // rule 1: runs of 5+
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) { if (at(r, c) === at(r, c - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) { if (at(r, c) === at(r - 1, c)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
  }
  // rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const v = at(r, c);
    if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) p += 3;
  }
  // rule 3: finder-like patterns 1:1:3:1:1
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (arr) => arr.join('') === pat1.join('') || arr.join('') === pat2.join('');
  for (let r = 0; r < size; r++) for (let c = 0; c <= size - 11; c++) { const s = []; for (let k = 0; k < 11; k++) s.push(at(r, c + k)); if (match(s)) p += 40; }
  for (let c = 0; c < size; c++) for (let r = 0; r <= size - 11; r++) { const s = []; for (let k = 0; k < 11; k++) s.push(at(r + k, c)); if (match(s)) p += 40; }
  // rule 4: dark ratio
  let dark = 0; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += at(r, c);
  const ratio = (dark * 100) / (size * size);
  p += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return p;
}

export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const version = chooseVersion(bytes.length);
  const dataCw = encodeData(bytes, version);
  const ecCw = rsEncode(dataCw, VERS_L[version - 1][1]);
  const all = dataCw.concat(ecCw);
  const fn = buildFunctionMatrix(version);
  const base = fn.map((row) => row.slice());
  placeData(base, all);

  let best = null, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(base, fn, mask);
    placeFormat(masked, mask);
    const score = penalty(masked);
    if (score < bestScore) { bestScore = score; best = masked; }
  }
  return { size: best.length, modules: best.map((row) => row.map((v) => v === true)) };
}

// Render to a crisp SVG string (quiet zone of 4 modules).
export function qrSvg(text, { scale = 6, quiet = 4 } = {}) {
  const { size, modules } = qrMatrix(text);
  const dim = (size + quiet * 2) * scale;
  let rects = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (modules[r][c]) rects += `<rect x="${(c + quiet) * scale}" y="${(r + quiet) * scale}" width="${scale}" height="${scale}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
