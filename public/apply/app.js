// King Recruit — public applicant portal (no login). Landing → PDPA consent → open
// positions → multi-section application form → confirmation. Reuses the shared King UI
// toolkit, stylesheet and i18n. Field labels are shown bilingually (Thai + English) to
// match the reference form; the chrome follows the language toggle.
import { api } from '../js/api.js';
import { h, mount, clear, field, input, select, textarea, toast, icon, spinner } from '../js/ui.js';
import { t, getLang, setLang } from '../js/i18n.js';
import { P as PROVINCES, D as DISTRICTS, S as SUBDISTRICTS } from '../js/thai-geo.js';

const root = document.getElementById('apply');

/* ---- Thai address lookup (subdistrict → district → province → postal) ---- */
const DIST_BY_CODE = new Map(DISTRICTS.map((d) => [d[0], d]));
const PROV_BY_CODE = new Map(PROVINCES.map((p) => [p[0], p]));
function searchSubdistrict(q) {
  q = String(q || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  for (let i = 0; i < SUBDISTRICTS.length && out.length < 15; i++) {
    const s = SUBDISTRICTS[i];
    if (s[1].toLowerCase().includes(q) || s[2].toLowerCase().includes(q)) {
      const d = DIST_BY_CODE.get(s[0]); const p = d ? PROV_BY_CODE.get(d[1]) : null;
      out.push({ subTh: s[1], subEn: s[2], distTh: d ? d[2] : '', distEn: d ? d[3] : '', provTh: p ? p[1] : '', provEn: p ? p[2] : '', zip: String(s[3]) });
    }
  }
  return out;
}

/* ------------------------------ theme ------------------------------ */
const THEMES = ['light', 'dark', 'futuristic'];
function ckGet(n) { return (document.cookie.split('; ').find((c) => c.indexOf(n + '=') === 0) || '').split('=')[1] || ''; }
function ckSet(n, v) { document.cookie = `${n}=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`; }
const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
function storedTheme() { return ckGet('kt_theme') || localStorage.getItem('kt-theme') || 'system'; }
function effectiveTheme() { const tt = storedTheme(); return tt === 'system' ? (prefersDark() ? 'dark' : 'light') : tt; }
function applyTheme() { const e = effectiveTheme(); if (e === 'light') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', e); }
function setTheme(v) { ckSet('kt_theme', v); try { localStorage.setItem('kt-theme', v); } catch {} applyTheme(); }
applyTheme();

/* ------------------------------ state ------------------------------ */
const S = {
  config: { appName: 'King Recruit', careers: {}, levels: [], sources: [] },
  jobs: [],
  selectedJob: null,
  consent: false,
  data: blankData(),
  documents: {},   // kind -> { fileId, originalName, size }
  screening: {},   // qid -> answer
};
function blankData() {
  return {
    personal: {}, positions: {}, skills: {}, other: {},
    education: {}, // keyed by level key
    training: [{}],
    work: [{}],
  };
}

/* bilingual label "ไทย (English)" */
const bl = (th, en) => (getLang() === 'th' ? `${th} (${en})` : `${en} (${th})`);
const careersText = (k) => { const c = S.config.careers || {}; return getLang() === 'th' ? (c[k + 'Th'] || c[k] || '') : (c[k] || ''); };

/* small binding helpers: an input/select/textarea wired to an object key */
function bind(obj, key, attrs = {}) { const el = input({ value: obj[key] ?? '', ...attrs }); el.addEventListener('input', () => (obj[key] = el.value)); return el; }
function bindArea(obj, key, attrs = {}) { const el = textarea({ ...attrs }); el.value = obj[key] ?? ''; el.addEventListener('input', () => (obj[key] = el.value)); return el; }
function bindSel(obj, key, options, attrs = {}) { const el = select(options, { value: obj[key] ?? '', ...attrs }); el.addEventListener('change', () => (obj[key] = el.value)); return el; }

const OPT = (arr) => arr.map((x) => (typeof x === 'string' ? { value: x, label: x } : x));
const blankOpt = () => ({ value: '', label: t('apply.choose') });

/* ------------------------------ chrome ----------------------------- */
function wordmark() {
  if (S.config.logoDataUrl) return h('div', { class: 'wordmark' }, h('img', { class: 'wordmark__logo', src: S.config.logoDataUrl, alt: S.config.appName }));
  return h('div', { class: 'wordmark' }, h('div', { class: 'wordmark__fallback' }, 'King Living', h('small', {}, 'Careers')));
}
function topBar() {
  const langBtn = h('button', { class: 'btn btn-sm btn-ghost' }, getLang() === 'th' ? 'EN' : 'ไทย');
  langBtn.addEventListener('click', () => { setLang(getLang() === 'th' ? 'en' : 'th'); render(); });
  const themeBtn = h('button', { class: 'btn btn-icon btn-ghost', title: 'Theme' }, icon(effectiveTheme() === 'light' ? 'moon' : 'sun', 'navlink__icon'));
  themeBtn.addEventListener('click', () => { setTheme(THEMES[(THEMES.indexOf(effectiveTheme()) + 1) % THEMES.length]); render(); });
  return h('div', { class: 'portal__bar' }, wordmark(), h('div', { class: 'topbar__spacer' }), langBtn, themeBtn);
}

const STEP_KEYS = ['consent', 'jobs', 'form', 'done'];
function stepBar(active) {
  return h('div', { class: 'steps' }, STEP_KEYS.map((k, i) => {
    const ai = STEP_KEYS.indexOf(active);
    const cls = i === ai ? 'active' : i < ai ? 'done' : '';
    return h('div', { class: 'steps__item ' + cls }, h('span', { class: 'steps__num' }, i < ai ? '✓' : String(i + 1)), t('apply.step.' + k));
  }));
}

/* ------------------------------ router ----------------------------- */
function go(hash) { location.hash = hash; }
async function boot() {
  try { S.config = await api.get('/public/config'); } catch {}
  document.title = 'Careers — ' + (S.config.appName || 'King Living');
  window.addEventListener('hashchange', render);
  render();
}
function render() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const route = parts[0];
  root.className = '';
  if (route === 'edit') return renderEditLoad(parts[1]);
  if (route === 'consent') return renderConsent();
  if (route === 'jobs') return renderJobs();
  if (route === 'form') return renderForm();
  if (route === 'done') return renderDone();
  return renderHome();
}

/* ---- applicant self-edit: load an existing application by its private token ---- */
async function renderEditLoad(token) {
  mount(root, topBar(), h('div', { class: 'portal' }, spinner(t('common.loading'))));
  try {
    if (!S.jobs.length) { try { S.jobs = await api.get('/public/jobs'); } catch {} }
    const data = await api.get('/public/application/' + encodeURIComponent(token));
    S.editToken = token;
    S.consent = true; // already consented on first submission
    S.data = applicationToForm(data.application || {});
    S.documents = {}; (data.documents || []).forEach((d) => { (S.documents[d.kind] = S.documents[d.kind] || []).push({ fileId: d.fileId, originalName: d.originalName, size: d.size }); });
    S.screening = {}; (data.screeningAnswers || []).forEach((a) => { if (a.qid) S.screening[a.qid] = a.answer; });
    S.selectedJob = data.requisitionId ? (S.jobs.find((j) => j.id === data.requisitionId) || null) : null;
    if (data.requisitionId) S.data.positions.rank1 = data.requisitionId;
    S.isEditing = true;
    go('#/form');
  } catch (e) {
    mount(root, topBar(), h('div', { class: 'portal' }, h('div', { class: 'card' }, h('div', { class: 'card__pad' },
      h('h3', {}, t('apply.edit.notFound')), h('p', { class: 'muted' }, e.message),
      h('button', { class: 'btn', onClick: () => go('#/') }, t('apply.back'))))));
  }
}
// Map a stored application (education as a level array) back to the form's data model.
function applicationToForm(app) {
  const d = blankData();
  d.personal = app.personal || {};
  d.positions = app.positions || {};
  d.skills = app.skills || {};
  d.other = app.other || {};
  d.education = {};
  (app.education || []).forEach((e) => { const lv = EDU_LEVELS.find((x) => x.en === e.level); if (lv) d.education[lv.key] = { institution: e.institution, major: e.major, gpa: e.gpa, from: e.from, to: e.to }; });
  d.training = (app.training && app.training.length) ? app.training.slice() : [{}];
  d.work = (app.work && app.work.length) ? app.work.slice() : [{}];
  return d;
}

/* ------------------------------ home ------------------------------- */
function renderHome() {
  const apply = h('button', { class: 'btn btn-primary', onClick: () => go('#/consent') }, t('apply.hero.apply'));
  const view = h('button', { class: 'btn', style: { background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }, onClick: () => { S.consent ? go('#/jobs') : go('#/consent'); } }, t('apply.hero.viewJobs'));
  mount(root, topBar(), h('div', { class: 'portal' },
    h('div', { class: 'hero' }, h('h1', {}, t('apply.hero.title')), h('p', {}, careersText('intro')), h('div', { class: 'btn-row' }, apply, view))
  ));
}

/* ----------------------------- consent ----------------------------- */
function renderConsent() {
  const chk = h('input', { type: 'checkbox' }); chk.checked = S.consent;
  const cont = h('button', { class: 'btn btn-primary', disabled: !S.consent }, t('apply.continue'));
  chk.addEventListener('change', () => { S.consent = chk.checked; cont.disabled = !S.consent; });
  cont.addEventListener('click', () => { if (S.consent) go('#/jobs'); });
  mount(root, topBar(), h('div', { class: 'portal' }, stepBar('consent'),
    h('div', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', {}, t('apply.consent.title'))),
      h('div', { class: 'card__pad' },
        h('p', { style: { whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--ink-soft)' } }, careersText('pdpa')),
        h('label', { class: 'certbox', style: { cursor: 'pointer' } }, chk, h('span', {}, t('apply.consent.accept'))),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => go('#/') }, t('apply.back')), cont))
    )));
}

/* ------------------------------ jobs ------------------------------- */
async function renderJobs() {
  if (!S.consent) return go('#/consent');
  mount(root, topBar(), h('div', { class: 'portal' }, stepBar('jobs'), spinner(t('common.loading'))));
  try { S.jobs = await api.get('/public/jobs'); } catch { S.jobs = []; }
  const cards = S.jobs.map((j) => {
    const btn = h('button', { class: 'btn btn-primary btn-sm', onClick: () => { S.selectedJob = j; go('#/form'); } }, t('apply.jobs.applyThis'));
    return h('div', { class: 'jobcard' },
      h('div', { class: 'jobcard__main' },
        h('div', { class: 'jobcard__title' }, j.title),
        h('div', { class: 'jobcard__meta' },
          j.level ? h('span', { class: 'chip' }, j.level) : null,
          j.department ? h('span', {}, j.department) : null,
          j.employmentType ? h('span', { class: 'chip muted' }, t('req.et.' + j.employmentType)) : null),
        j.description ? h('div', { class: 'jobcard__desc' }, j.description) : null),
      btn);
  });
  const general = h('div', { class: 'jobcard', style: { borderStyle: 'dashed' } },
    h('div', { class: 'jobcard__main' }, h('div', { class: 'jobcard__title' }, t('apply.jobs.general')), h('div', { class: 'jobcard__desc' }, t('apply.jobs.generalSub'))),
    h('button', { class: 'btn btn-sm', onClick: () => { S.selectedJob = null; go('#/form'); } }, t('apply.hero.apply')));
  mount(root, topBar(), h('div', { class: 'portal' }, stepBar('jobs'),
    h('h2', { style: { margin: '4px 0 16px' } }, t('apply.jobs.title')),
    S.jobs.length ? h('div', {}, cards) : h('p', { class: 'muted' }, t('apply.jobs.none')),
    general,
    h('div', { class: 'btn-row', style: { marginTop: '16px' } }, h('button', { class: 'btn', onClick: () => go('#/consent') }, t('apply.back')))
  ));
}

/* ------------------------------ form ------------------------------- */
const EDU_LEVELS = [
  { key: 'highschool', th: 'มัธยมศึกษา', en: 'High School' },
  { key: 'vocational', th: 'ปวช.', en: 'Vocational Certificate' },
  { key: 'highvocational', th: 'ปวส.', en: 'High Vocational Certificate' },
  { key: 'bachelor', th: 'ปริญญาตรี', en: "Bachelor's degree" },
  { key: 'master', th: 'ปริญญาโท', en: "Master's degree" },
  { key: 'other', th: 'อื่น ๆ', en: 'Other / Certificate' },
];
const SKILL_LEVELS = ['Basic', 'Fair', 'Good', 'Very good', 'Excellent'];
const sectionEl = (num, title, body) => h('div', { class: 'fsec' }, h('div', { class: 'fsec__head' }, h('span', { class: 'fsec__num' }, String(num)), title), h('div', { class: 'fsec__body' }, body));
const reqMark = () => h('span', { class: 'req-star' }, '*');

function ageFromDob(v) {
  if (!v) return null; const dob = new Date(v); if (isNaN(dob)) return null;
  const now = new Date(); let a = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth(); if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) a--;
  return (a >= 0 && a < 120) ? a : null;
}
// Structured Thai address with subdistrict autocomplete that fills district/province/postal.
function addressBlock(addr) {
  const houseNo = bind(addr, 'houseNo', { placeholder: 'e.g. 123/45 Moo 6' });
  const district = bind(addr, 'district');
  const province = bind(addr, 'province');
  const postal = bind(addr, 'postal', { maxlength: '5' });
  const sub = input({ value: addr.subdistrict || '', placeholder: bl('พิมพ์เพื่อค้นหา', 'type to search'), autocomplete: 'off' });
  const results = h('div', { class: 'addr-results', style: { display: 'none' } });
  const wrap = h('div', { style: { position: 'relative' } }, sub, results);
  const th = () => getLang() === 'th';
  function pick(r) {
    addr.subdistrict = r.subTh; addr.subdistrictEn = r.subEn; addr.district = r.distTh; addr.districtEn = r.distEn;
    addr.province = r.provTh; addr.provinceEn = r.provEn; addr.postal = r.zip;
    sub.value = th() ? r.subTh : r.subEn; district.value = th() ? r.distTh : r.distEn; province.value = th() ? r.provTh : r.provEn; postal.value = r.zip;
    results.style.display = 'none';
  }
  sub.addEventListener('input', () => {
    addr.subdistrict = sub.value;
    const list = searchSubdistrict(sub.value);
    if (!list.length) { results.style.display = 'none'; return; }
    clear(results);
    list.forEach((r) => {
      const item = h('div', { class: 'addr-item' }, `${th() ? r.subTh : r.subEn} » ${th() ? r.distTh : r.distEn} » ${th() ? r.provTh : r.provEn}  ${r.zip}`);
      item.addEventListener('mousedown', (e) => { e.preventDefault(); pick(r); });
      results.appendChild(item);
    });
    results.style.display = '';
  });
  sub.addEventListener('blur', () => setTimeout(() => { results.style.display = 'none'; }, 150));
  return h('div', {},
    field(bl('บ้านเลขที่ / หมู่ / ถนน', 'House no. / Moo / Road'), houseNo),
    field(h('span', {}, bl('ตำบล/แขวง', 'Subdistrict'), h('span', { class: 'small muted' }, '  — ' + bl('พิมพ์เพื่อค้นหา แล้วเลือก', 'search & select'))), wrap),
    h('div', { class: 'row' }, field(bl('อำเภอ/เขต', 'District'), district), field(bl('จังหวัด', 'Province'), province)),
    h('div', { class: 'row' }, field(bl('รหัสไปรษณีย์', 'Postal code'), postal), h('div', {})));
}
function composeAddr(a) {
  if (!a) return '';
  return [a.houseNo, a.subdistrict && ('ต.' + a.subdistrict), a.district && ('อ.' + a.district), a.province && ('จ.' + a.province), a.postal].filter(Boolean).join(' ');
}

function renderForm() {
  if (!S.consent) return go('#/consent');
  const d = S.data;
  const lvlOpts = [blankOpt(), ...OPT(S.config.levels || [])];

  /* 1 — personal */
  // birth date auto-fills age
  const ageInput = bind(d.personal, 'age', { type: 'number', min: '0', max: '99' });
  const birthInput = bind(d.personal, 'birthDate', { type: 'date' });
  birthInput.addEventListener('change', () => { const a = ageFromDob(birthInput.value); if (a != null) { ageInput.value = a; d.personal.age = a; } });
  d.personal.present = d.personal.present || {};
  d.personal.permanent = d.personal.permanent || {};
  const presentHost = h('div', {});
  const paintPresent = () => { clear(presentHost); if (!d.personal.sameAddress) presentHost.appendChild(addressBlock(d.personal.present)); };
  const sameChk = h('input', { type: 'checkbox' }); sameChk.checked = !!d.personal.sameAddress;
  sameChk.addEventListener('change', () => { d.personal.sameAddress = sameChk.checked; paintPresent(); });
  paintPresent();

  const personal = sectionEl(1, t('apply.sec.personal'), h('div', {},
    h('div', { class: 'row' },
      field(bl('คำนำหน้า', 'Title'), bindSel(d.personal, 'title', [blankOpt(), ...OPT(['Mr.', 'Mrs.', 'Ms.'])])),
      field(bl('เพศ', 'Gender'), bindSel(d.personal, 'gender', [blankOpt(), ...OPT(['Male', 'Female'])]))),
    h('div', { class: 'row' },
      field(h('span', {}, bl('ชื่อ', 'First name'), reqMark()), bind(d.personal, 'firstName')),
      field(h('span', {}, bl('นามสกุล', 'Last name'), reqMark()), bind(d.personal, 'lastName'))),
    h('div', { class: 'row' },
      field('Name (English)', bind(d.personal, 'firstNameEn')),
      field('Surname (English)', bind(d.personal, 'lastNameEn'))),
    h('div', { class: 'row' },
      field(bl('ชื่อเล่น', 'Nickname'), bind(d.personal, 'nickname')),
      field(bl('สัญชาติ', 'Nationality'), bind(d.personal, 'nationality'))),
    h('div', { class: 'row' },
      field(bl('วันเกิด', 'Birth date'), birthInput),
      field(bl('อายุ (ปี)', 'Age (years)'), ageInput)),
    h('div', { class: 'row' },
      field(bl('ส่วนสูง (ซม.)', 'Height (cm)'), bind(d.personal, 'height', { type: 'number', min: '0' })),
      field(bl('น้ำหนัก (กก.)', 'Weight (kg)'), bind(d.personal, 'weight', { type: 'number', min: '0' }))),
    h('div', { class: 'fsec__sub' }, bl('ที่อยู่ตามทะเบียนบ้าน', 'Permanent address (per house registration)')),
    addressBlock(d.personal.permanent),
    h('div', { class: 'fsec__sub' }, bl('ที่อยู่ปัจจุบัน', 'Present address')),
    h('label', { class: 'spread', style: { gap: '8px', cursor: 'pointer', marginBottom: '10px' } }, sameChk, h('span', { class: 'small muted' }, bl('เหมือนที่อยู่ตามทะเบียนบ้าน', 'Same as permanent address'))),
    presentHost,
    h('div', { class: 'row' },
      field(h('span', {}, bl('โทรศัพท์มือถือ', 'Mobile phone'), reqMark()), bind(d.personal, 'mobile')),
      field(bl('โทรศัพท์บ้าน', 'Phone'), bind(d.personal, 'phone'))),
    h('div', { class: 'row' },
      field(bl('อีเมล', 'E-mail'), bind(d.personal, 'email', { type: 'email' })),
      field(bl('สถานภาพทางทหาร', 'Military status'), bindSel(d.personal, 'militaryStatus', [blankOpt(), ...OPT(['Exempted', 'Completed', 'Not yet', 'Not applicable'])])))
  ));

  /* 2 — position applied */
  const reqOptions = [{ value: '', label: bl('สมัครทั่วไป — ยังไม่แน่ใจ (ให้ HR พิจารณา)', 'General application — not sure (let HR match me)') }, ...S.jobs.map((j) => ({ value: j.id, label: j.code + ' · ' + j.title }))];
  if (S.selectedJob) d.positions.rank1 = S.selectedJob.id;
  const position = sectionEl(2, t('apply.sec.position'), h('div', {},
    S.selectedJob ? h('p', { class: 'banner' }, t('apply.jobs.selected') + ': ', h('b', {}, S.selectedJob.title)) : null,
    h('div', { class: 'row' },
      field(bl('ตำแหน่งที่สมัคร อันดับ 1', 'Position applied — Rank 1'), bindSel(d.positions, 'rank1', reqOptions)),
      field(bl('ตำแหน่งที่สมัคร อันดับ 2', 'Position applied — Rank 2'), bindSel(d.positions, 'rank2', reqOptions))),
    h('div', { class: 'row' },
      field(bl('ระดับ', 'Level'), bindSel(d.personal, 'level', lvlOpts)),
      field(bl('สถานที่ทำงาน', 'Work location'), bind(d.positions, 'location'))),
    h('div', { class: 'row' },
      field(bl('เงินเดือนที่คาดหวัง', 'Expected salary'), bind(d.positions, 'expectedSalary', { type: 'number', min: '0' })),
      field(bl('วันที่เริ่มงานได้', 'Available start date'), bind(d.positions, 'startDate', { type: 'date' })))
  ));

  /* 3 — education */
  const eduRows = EDU_LEVELS.map((lv) => {
    d.education[lv.key] = d.education[lv.key] || {};
    const e = d.education[lv.key];
    return h('div', {}, h('div', { class: 'fsec__sub' }, bl(lv.th, lv.en)),
      field(bl('สถาบันการศึกษา', 'Institution'), bind(e, 'institution')),
      h('div', { class: 'row' }, field(bl('สาขาวิชา', 'Major'), bind(e, 'major')), field(bl('เกรดเฉลี่ย', 'GPA'), bind(e, 'gpa'))),
      h('div', { class: 'row' }, field(bl('ตั้งแต่ปี', 'From (year)'), bind(e, 'from')), field(bl('ถึงปี', 'To (year)'), bind(e, 'to'))));
  });
  const education = sectionEl(3, t('apply.sec.education'), h('div', {}, eduRows));

  /* 4 — training (repeatable) */
  const trainingHost = h('div', {});
  function paintTraining() {
    clear(trainingHost);
    d.training.forEach((row, i) => trainingHost.appendChild(h('div', { class: 'repeat-block' },
      h('div', { class: 'row' }, field(bl('กิจกรรม/ฝึกงาน', 'Activity / trainee'), bind(row, 'activity')), field(bl('สถาบัน', 'Institution'), bind(row, 'institution'))),
      h('div', { class: 'row' }, field(bl('ตั้งแต่', 'From'), bind(row, 'from')), field(bl('ถึง', 'To'), bind(row, 'to'))),
      d.training.length > 1 ? h('button', { class: 'btn btn-sm btn-danger', onClick: () => { d.training.splice(i, 1); paintTraining(); } }, t('apply.remove')) : null)));
    trainingHost.appendChild(h('button', { class: 'btn btn-sm', onClick: () => { d.training.push({}); paintTraining(); } }, t('apply.addRow')));
  }
  paintTraining();
  const training = sectionEl(4, t('apply.sec.training'), trainingHost);

  /* 5 — work history (repeatable) */
  const workHost = h('div', {});
  function paintWork() {
    clear(workHost);
    d.work.forEach((row, i) => workHost.appendChild(h('div', { class: 'repeat-block' },
      h('div', { class: 'row' }, field(bl('ชื่อบริษัท', 'Company'), bind(row, 'company')), field(bl('ตำแหน่งสุดท้าย', 'Last position'), bind(row, 'position'))),
      h('div', { class: 'row' }, field(bl('เงินเดือนเริ่มต้น', 'Start salary'), bind(row, 'startSalary', { type: 'number' })), field(bl('เงินเดือนสุดท้าย', 'Last salary'), bind(row, 'lastSalary', { type: 'number' }))),
      h('div', { class: 'row' }, field(bl('ตั้งแต่', 'From'), bind(row, 'from')), field(bl('ถึง', 'To'), bind(row, 'to'))),
      field(bl('เหตุผลที่ออก', 'Leaving reason'), bind(row, 'reason')),
      d.work.length > 1 ? h('button', { class: 'btn btn-sm btn-danger', onClick: () => { d.work.splice(i, 1); paintWork(); } }, t('apply.remove')) : null)));
    workHost.appendChild(h('button', { class: 'btn btn-sm', onClick: () => { d.work.push({}); paintWork(); } }, t('apply.addRow')));
  }
  paintWork();
  const work = sectionEl(5, t('apply.sec.work'), workHost);

  /* 6 — skills */
  const skills = sectionEl(6, t('apply.sec.skills'), h('div', {},
    h('div', { class: 'fsec__sub' }, bl('ความชำนาญด้านภาษา', 'Language skill')),
    h('div', { class: 'row' },
      field(bl('ภาษาอังกฤษ', 'English'), bindSel(d.skills, 'english', [blankOpt(), ...OPT(SKILL_LEVELS)])),
      field(bl('ภาษาอื่น', 'Other language'), bind(d.skills, 'otherLanguage'))),
    h('div', { class: 'fsec__sub' }, bl('ความชำนาญด้านโปรแกรม', 'Computer / program skill')),
    h('div', { class: 'row' },
      field(bl('โปรแกรม', 'Program / computer'), bind(d.skills, 'computer')),
      field(bl('ระดับ', 'Level'), bindSel(d.skills, 'computerLevel', [blankOpt(), ...OPT(SKILL_LEVELS)]))),
    h('div', { class: 'fsec__sub' }, bl('ความชำนาญด้านพาหนะ', 'Driving skill')),
    h('div', { class: 'row' },
      field(bl('การขับขี่', 'Driving'), bindSel(d.skills, 'driving', [blankOpt(), ...OPT(['Car', 'Motorcycle', 'Both', 'None'])])),
      field(bl('ใบขับขี่หมดอายุ', 'Licence expiry'), bind(d.skills, 'licenseExpiry', { type: 'date' }))),
    field(bl('การเป็นเจ้าของพาหนะ', 'Own a vehicle?'), bindSel(d.skills, 'owner', [blankOpt(), { value: 'yes', label: t('apply.yes') }, { value: 'no', label: t('apply.no') }]))
  ));

  /* 7 — other */
  const yn = [blankOpt(), { value: 'yes', label: t('apply.yes') }, { value: 'no', label: t('apply.no') }];
  const other = sectionEl(7, t('apply.sec.other'), h('div', {},
    h('div', { class: 'fsec__sub' }, bl('บุคคลที่ติดต่อกรณีฉุกเฉิน', 'Emergency contact')),
    h('div', { class: 'row' }, field(bl('ชื่อ-นามสกุล', 'Name'), bind(d.other, 'emergencyName')), field(bl('ความสัมพันธ์', 'Relationship'), bind(d.other, 'emergencyRelationship'))),
    field(bl('โทรศัพท์', 'Telephone'), bind(d.other, 'emergencyPhone')),
    h('div', { class: 'fsec__sub' }, bl('มีญาติ/คนรู้จักทำงานที่นี่หรือไม่', 'Relatives or friends working here?')),
    field('', bindSel(d.other, 'relativeWorking', yn)),
    h('div', { class: 'row' }, field(bl('ชื่อ-นามสกุล', 'Their name'), bind(d.other, 'relativeName')), field(bl('ความสัมพันธ์', 'Relationship'), bind(d.other, 'relativeRelationship'))),
    h('div', { class: 'fsec__sub' }, bl('ทราบข่าวการรับสมัครจาก', 'How did you hear about us?')),
    field(bl('โปรดระบุ (เช่น เว็บไซต์ / เพื่อนแนะนำ / ป้ายหน้าโรงงาน)', 'Please specify (e.g. website, referral, factory sign)'), bind(d.other, 'heardFrom')),
    h('div', { class: 'fsec__sub' }, bl('สามารถทำงานต่างจังหวัดได้หรือไม่', 'Can you work upcountry?')),
    field('', bindSel(d.other, 'canUpcountry', yn)),
    field(bl('แนะนำตัวเอง', 'Introduce yourself'), bindArea(d.other, 'selfIntro', { style: { minHeight: '110px' } }))
  ));

  /* 8 — screening (per job) */
  let screening = null;
  if (S.selectedJob && (S.selectedJob.screeningQuestions || []).length) {
    screening = sectionEl(8, t('apply.sec.screening'), h('div', {}, S.selectedJob.screeningQuestions.map((q) => {
      if (q.type === 'yesno') return field(q.text, bindSel(S.screening, q.id, [blankOpt(), { value: 'Yes', label: t('apply.yes') }, { value: 'No', label: t('apply.no') }]));
      return field(q.text, bind(S.screening, q.id));
    })));
  }

  /* 9 — documents */
  const docNum = screening ? 9 : 8;
  const DOCS = [
    { kind: 'photo', label: t('apply.doc.photo') }, { kind: 'resume', label: t('apply.doc.resume') },
    { kind: 'transcript', label: t('apply.doc.transcript') }, { kind: 'idcard', label: t('apply.doc.idcard') },
    { kind: 'housereg', label: t('apply.doc.housereg') }, { kind: 'other', label: t('apply.doc.other') },
  ];
  const documents = sectionEl(docNum, t('apply.sec.documents'), h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } }, t('apply.upload.hint')),
    DOCS.map((doc) => uploadRow(doc))
  ));

  /* 10 — online test placeholder */
  const testNum = docNum + 1;
  const test = sectionEl(testNum, t('apply.test.title'), h('div', { class: 'coming-soon' }, t('apply.test.coming')));

  /* certify + submit */
  const cert = h('input', { type: 'checkbox' }); cert.checked = !!S.isEditing; // already certified on first submit
  const err = h('div', { class: 'chip danger', style: { display: 'none', margin: '0 0 12px' } });
  const submit = h('button', { class: 'btn btn-primary' }, S.isEditing ? t('apply.saveChanges') : t('apply.submit'));
  submit.addEventListener('click', () => doSubmit(cert.checked, err, submit));
  const backBtn = h('button', { class: 'btn', onClick: () => go(S.isEditing ? '#/' : '#/jobs') }, t('apply.back'));

  mount(root, topBar(), h('div', { class: 'portal' }, S.isEditing ? h('div', { class: 'banner' }, t('apply.edit.banner')) : stepBar('form'),
    personal, position, education, training, work, skills, other, screening, documents, test,
    h('label', { class: 'certbox', style: { cursor: 'pointer' } }, cert, h('span', {}, t('apply.form.certify'))),
    err,
    h('div', { class: 'btn-row' }, backBtn, submit)
  ));
  window.scrollTo(0, 0);
}

// One document section — supports MULTIPLE files per section.
function uploadRow(doc) {
  S.documents[doc.kind] = S.documents[doc.kind] || [];
  const fileInput = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, style: { display: 'none' } });
  const status = h('span', { class: 'uprow__status muted' }, '');
  const fileList = h('div', { class: 'uprow__files' });
  const pick = h('button', { class: 'btn btn-sm', onClick: () => fileInput.click() }, t('apply.upload.choose'));
  function paintList() {
    clear(fileList);
    const arr = S.documents[doc.kind];
    arr.forEach((v, i) => {
      const rm = h('button', { class: 'chip-x', title: t('apply.remove'), onClick: () => { arr.splice(i, 1); paintList(); } }, '✕');
      fileList.appendChild(h('span', { class: 'file-chip' }, h('span', { class: 'file-chip__name' }, v.originalName || v.fileId), rm));
    });
    status.textContent = arr.length ? ('✓ ' + arr.length + ' ' + t('apply.upload.files')) : '';
    status.style.color = arr.length ? 'var(--ok)' : '';
  }
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files]; fileInput.value = '';
    for (const f of files) {
      if (f.size > 6 * 1024 * 1024) { toast(f.name + ': > 6 MB', 'error'); continue; }
      status.textContent = t('apply.upload.uploading'); status.style.color = '';
      try {
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const r = await api.post('/public/upload', { dataUrl, kind: doc.kind, originalName: f.name });
        S.documents[doc.kind].push({ fileId: r.fileId, originalName: r.originalName, size: r.size });
        paintList();
      } catch (e) { toast(e.message, 'error'); status.textContent = ''; }
    }
  });
  paintList();
  return h('div', { class: 'uprow' },
    h('div', { class: 'uprow__label' }, h('div', { class: 'uprow__name' }, doc.label), fileList),
    pick, status, fileInput);
}

function doSubmit(certified, err, btn) {
  err.style.display = 'none';
  const d = S.data;
  const name = (d.personal.firstName || '').trim() || (d.personal.firstNameEn || '').trim();
  if (!name) { showErr(err, getLang() === 'th' ? 'กรุณากรอกชื่อ' : 'Please enter your name.'); return; }
  if (!certified) { showErr(err, getLang() === 'th' ? 'กรุณายืนยันว่าข้อมูลเป็นจริง' : 'Please certify the information is true.'); return; }

  // compose address strings (for HR display + backward compatibility)
  if (d.personal.sameAddress) d.personal.present = { ...d.personal.permanent };
  d.personal.permanentAddress = composeAddr(d.personal.permanent);
  d.personal.presentAddress = composeAddr(d.personal.present);

  const education = EDU_LEVELS.map((lv) => ({ level: lv.en, ...(d.education[lv.key] || {}) })).filter((e) => e.institution || e.major);
  const training = (d.training || []).filter((r) => r.activity || r.institution);
  const work = (d.work || []).filter((r) => r.company || r.position);
  const documents = Object.entries(S.documents).flatMap(([kind, arr]) => (arr || []).map((v) => ({ kind, fileId: v.fileId, originalName: v.originalName, size: v.size })));
  const screeningAnswers = (S.selectedJob && S.selectedJob.screeningQuestions || []).map((q) => ({ qid: q.id, question: q.text, answer: S.screening[q.id] || '' }));

  const payload = {
    application: { personal: d.personal, positions: d.positions, education, training, work, skills: d.skills, other: d.other },
    documents, screeningAnswers,
    consent: { accepted: true }, certifiedTrue: true,
  };
  btn.disabled = true; btn.textContent = t('apply.upload.uploading');
  const req = S.isEditing
    ? api.put('/public/application/' + encodeURIComponent(S.editToken), payload)
    : api.post('/public/apply', payload);
  req
    .then((r) => { S.refCode = r.code; S.editLink = r.editLink || S.editLink; S.doneEditing = !!S.isEditing; go('#/done'); })
    .catch((e) => { showErr(err, e.message); btn.disabled = false; btn.textContent = S.isEditing ? t('apply.saveChanges') : t('apply.submit'); });
}
function showErr(err, msg) { err.textContent = msg; err.style.display = ''; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

/* ------------------------------ done ------------------------------- */
function renderDone() {
  const editLink = S.editLink || (S.editToken ? (location.origin + '/apply#/edit/' + S.editToken) : '');
  const linkBox = editLink ? h('div', { style: { marginTop: '20px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' } },
    h('div', { class: 'small muted' }, t('apply.done.editHint')),
    h('div', { class: 'banner', style: { wordBreak: 'break-all', marginTop: '6px' } }, h('a', { href: editLink }, editLink))) : null;
  mount(root, topBar(), h('div', { class: 'portal' }, stepBar('done'),
    h('div', { class: 'card' }, h('div', { class: 'donecard' },
      icon('check', 'navlink__icon'),
      h('h2', { style: { margin: '8px 0' } }, S.doneEditing ? t('apply.done.updated') : t('apply.done.title')),
      h('p', { class: 'muted', style: { maxWidth: '460px', margin: '0 auto' } }, t('apply.done.msg')),
      h('div', { style: { marginTop: '20px' } }, h('div', { class: 'small muted' }, t('apply.done.ref')), h('div', { class: 'big-ref' }, S.refCode || '—')),
      linkBox,
      h('button', { class: 'btn', style: { marginTop: '16px' }, onClick: () => { reset(); go('#/'); } }, t('apply.done.another'))
    ))));
}
function reset() { S.selectedJob = null; S.data = blankData(); S.documents = {}; S.screening = {}; S.refCode = null; S.editToken = null; S.editLink = null; S.isEditing = false; S.doneEditing = false; }

boot();
