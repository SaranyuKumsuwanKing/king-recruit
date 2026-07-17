// Dependency-free data export: Excel (.xlsx), CSV (UTF-8 BOM so Thai opens correctly),
// and JSON. The .xlsx is a real (store-only) zip built by hand — no libraries, works offline.
import { h } from './ui.js';
import { t } from './i18n.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* --------------------------------- CSV --------------------------------- */
function toCsv(headers, rows) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [headers.map(esc).join(',')];
  rows.forEach((r) => lines.push(r.map(esc).join(',')));
  return '﻿' + lines.join('\r\n'); // BOM for Excel/Thai
}

/* -------------------------------- XLSX --------------------------------- */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const enc = (s) => new TextEncoder().encode(s);
function xmlEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function sheetXml(headers, rows) {
  const colLetter = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const cell = (val, col, r) => {
    const ref = colLetter(col) + r;
    if (typeof val === 'number' && isFinite(val)) return `<c r="${ref}"><v>${val}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(val)}</t></is></c>`;
  };
  const all = [headers, ...rows];
  const body = all.map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => cell(v, ci, ri + 1)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function buildXlsx(headers, rows, sheetName) {
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc((sheetName || 'Sheet1').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ['xl/worksheets/sheet1.xml', sheetXml(headers, rows)],
  ];

  // store-only ZIP
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  for (const [name, content] of files) {
    const nameB = enc(name), dataB = enc(content), crc = crc32(dataB);
    const local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(dataB.length), u32(dataB.length), u16(nameB.length), u16(0));
    chunks.push(new Uint8Array(local), nameB, dataB);
    central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(dataB.length), u32(dataB.length), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)), nameB);
    offset += local.length + nameB.length + dataB.length;
  }
  const cdStart = offset;
  const centralChunks = [];
  let cdSize = 0;
  for (let i = 0; i < central.length; i += 2) { const head = new Uint8Array(central[i]); centralChunks.push(head, central[i + 1]); cdSize += head.length + central[i + 1].length; }
  const eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(cdStart), u16(0)));
  return new Blob([...chunks, ...centralChunks, eocd], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ------------------------------- menu UI ------------------------------- */
// columns: [{ key, label }]; data: array of objects. baseName: file name without extension.
export function exportMenu(baseName, columns, getData, sheetName) {
  const headers = columns.map((c) => c.label);
  const collect = () => { const data = getData(); return { rows: data.map((d) => columns.map((c) => d[c.key])), objs: data }; };
  const pop = h('div', { class: 'menu-pop', style: { display: 'none' } },
    h('button', { onClick: () => { const { rows } = collect(); download(buildXlsx(headers, rows, sheetName || baseName), baseName + '.xlsx'); close(); } }, 'Excel (.xlsx)'),
    h('button', { onClick: () => { const { rows } = collect(); download(new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), baseName + '.csv'); close(); } }, 'CSV (.csv)'),
    h('button', { onClick: () => { const { objs } = collect(); download(new Blob([JSON.stringify(objs, null, 2)], { type: 'application/json' }), baseName + '.json'); close(); } }, 'JSON (.json)')
  );
  const btn = h('button', { class: 'btn btn-sm' }, t('common.export') + ' ▾');
  function close() { pop.style.display = 'none'; document.removeEventListener('click', onDoc); }
  function onDoc(e) { if (!wrap.contains(e.target)) close(); }
  btn.addEventListener('click', (e) => { e.stopPropagation(); const open = pop.style.display === 'none'; pop.style.display = open ? '' : 'none'; if (open) setTimeout(() => document.addEventListener('click', onDoc), 0); });
  const wrap = h('div', { class: 'menu-wrap' }, btn, pop);
  return wrap;
}
