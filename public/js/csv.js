// Tiny, dependency-free CSV reader for the people / org-structure upload. Handles quoted
// fields, commas/newlines inside quotes, and a header row. Maps friendly header names to
// the person fields the API expects, so HR can use natural column titles — and so the
// employee export from King Time imports here unchanged.

// header (lowercased, spaces/underscores stripped) -> person field
const ALIASES = {
  empcode: 'empCode', code: 'empCode', employeeid: 'empCode', id: 'empCode',
  name: 'name', fullname: 'name', employeename: 'name',
  department: 'department', dept: 'department',
  area: 'area', section: 'area',
  costcenter: 'costCenter',
  position: 'position', title: 'position', jobtitle: 'position',
  level: 'level', grade: 'level', band: 'level',
  email: 'email', mail: 'email', emailaddress: 'email',
  phone: 'phone', mobile: 'phone', tel: 'phone', telephone: 'phone',
  manager: 'managerId', managerid: 'managerId', supervisor: 'managerId',
};

function splitLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Split the whole text into logical rows, respecting quoted newlines.
function splitRows(text) {
  const rows = [];
  let cur = '', inQ = false;
  const t = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"') { inQ = !inQ; cur += c; }
    else if (c === '\n' && !inQ) { rows.push(cur); cur = ''; }
    else cur += c;
  }
  if (cur.trim() !== '') rows.push(cur);
  return rows.filter((r) => r.trim() !== '');
}

const normHeader = (s) => String(s || '').toLowerCase().replace(/[\s_-]+/g, '');

// Parse into employee-shaped objects. Unknown columns are ignored.
export function parseCsv(text) {
  const rows = splitRows(text);
  if (rows.length < 2) throw new Error('The file needs a header row and at least one data row.');
  const headers = splitLine(rows[0]).map((h) => ALIASES[normHeader(h)] || null);
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = splitLine(rows[i]);
    const obj = {};
    headers.forEach((field, idx) => { if (field) obj[field] = (cells[idx] || '').trim(); });
    // normalise the shift label ("day"/"night") and pay type
    if (obj.shiftId) obj.shiftId = obj.shiftId.toLowerCase();
    if (obj.payType) {
      const p = obj.payType.toLowerCase();
      obj.payType = p.startsWith('d') || p.includes('wage') ? 'daily' : 'monthly';
    }
    if (Object.keys(obj).length) out.push(obj);
  }
  return out;
}
