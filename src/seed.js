'use strict';
// First-run setup. Creates the settings, the default hiring pipeline, the job levels,
// candidate sources, the interview scorecard, and the HR administrator login.
// No real employee data is seeded — the org/people list is imported on the People page
// (it accepts the same CSV that King Time exports). A handful of clearly-fictional sample
// requisitions and candidates are seeded so the board and dashboard are not empty; delete
// them on the Requisitions / Candidates pages once you start entering real openings.

const crypto = require('crypto');
const { getDb, setDb, save } = require('./db');
const { hashPassword } = require('./auth');

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin1234';

// The hiring pipeline. `type`: 'active' = in progress, 'won' = hired, 'lost' = closed-out.
// Stages are fully editable on the Setup page; the board shows them in this order.
function defaultStages() {
  return [
    { id: 'applied', name: 'Applied', type: 'active' },
    { id: 'screening', name: 'HR Screening', type: 'active' },
    { id: 'interview', name: 'Interview', type: 'active' },
    { id: 'assessment', name: 'Assessment / Trade test', type: 'active' },
    { id: 'offer', name: 'Offer', type: 'active' },
    { id: 'hired', name: 'Hired', type: 'won' },
    { id: 'rejected', name: 'Rejected', type: 'lost' },
    { id: 'withdrawn', name: 'Withdrawn', type: 'lost' },
  ];
}

// Job levels — the bands the GM asked to recruit across, top to bottom. Editable in Setup.
function defaultLevels() {
  return ['Management', 'Manager', 'Supervisor', 'Leader', 'Staff', 'Operator'];
}

// Where candidates come from. Drives the source filter and the dashboard breakdown.
function defaultSources() {
  return [
    { id: 'online', name: 'Online application' },
    { id: 'walk-in', name: 'Walk-in' },
    { id: 'referral', name: 'Employee referral' },
    { id: 'jobboard', name: 'Online job board' },
    { id: 'agency', name: 'Recruitment agency' },
    { id: 'social', name: 'Social media' },
    { id: 'internal', name: 'Internal transfer' },
    { id: 'school', name: 'University / School' },
  ];
}

// Bump when the official consent wording changes — migrate() re-applies it to existing DBs.
const CONSENT_VERSION = 'frm-hr-024-r0';

// Official consent statement FRM-HR-024 (Rev.00), English + Thai.
function officialConsentEn() {
  return [
    'Consent Form for Personal Data Processing',
    '(In accordance with the Personal Data Protection Act B.E. 2562 (2019))',
    '',
    'By this document, I acknowledge and hereby consent to King Furniture Thai Co., Ltd. collecting, using, and disclosing my personal data — including personal information, contact details, and employment-related information — for the purposes of recruitment and employment, as follows:',
    '',
    '1) Personal Data — I consent to the Company collecting, using, and disclosing my personal data such as identification card, official documents, photographs, or other related information to business partners, financial institutions, government authorities, or relevant organizations solely for recruitment and employment purposes.',
    '',
    '2) Contact Information — I consent to the Company collecting, using, and disclosing my contact information such as telephone number, email, social media accounts, and emergency contact details for communication, coordination, and notifications related to recruitment and employment purposes only.',
    '',
    '3) Employment Information — I consent to the Company collecting, using, and disclosing employment-related information such as job position, work history, salary, time attendance records, social security information, and other relevant employment data to business partners, financial institutions, government authorities, or related organizations for recruitment and employment purposes only.',
    '',
    '4) Sensitive Personal Data — I consent to the Company collecting, using, and disclosing sensitive personal data such as health information, medical history, medical examination results, or criminal records to business partners, financial institutions, government authorities, or relevant organizations solely for recruitment and employment purposes.',
    '',
    '5) Use of Photographs — I consent to the Company using my photographs taken within the workplace, whether in uniform or casual attire, during company activities for public relations or recruitment purposes only.',
    '',
    '6) Data Retention Period — The Company will collect, use, and disclose personal data for an appropriate period. For applicants who are not selected, their personal data will be retained for no longer than 6 months for future employment consideration.',
    '',
    '7) Drug Testing — I consent to the Company conducting drug testing in cases where the job involves safety risks or operating machinery, in order to reduce the risk of accidents that may cause harm to persons and property.',
    '',
    'I confirm that I have read and understood this document. I voluntarily give or refuse my consent without any coercion or undue influence, except where required by law or contractual obligations between myself and King Furniture Thai Co., Ltd. that provide benefits to me.',
    '',
    'I have read and understood the above statement and hereby consent to the collection, use, and disclosure of my personal data by the Company for the purposes stated above.',
  ].join('\n');
}
function officialConsentTh() {
  return [
    'หนังสือยินยอมให้เปิดเผยข้อมูลส่วนบุคคล',
    '(ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)',
    '',
    'โดยหนังสือฉบับนี้ ข้าพเจ้ารับทราบและยินยอมให้ บริษัท คิง เฟอร์นิเจอร์ ไทย จำกัด ดำเนินการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้า ซึ่งรวมถึงข้อมูลส่วนบุคคล ข้อมูลการติดต่อสื่อสาร และข้อมูลเกี่ยวกับการทำงาน เพื่อประโยชน์ในการสมัครงานหรือการทำงานกับบริษัทฯ โดยข้าพเจ้าให้ความยินยอมดังต่อไปนี้',
    '',
    '1) ข้อมูลส่วนบุคคล — ข้าพเจ้ายินยอมให้บริษัทฯ เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล เช่น บัตรประจำตัวประชาชน เอกสารทางราชการต่าง ๆ รูปภาพ หรือข้อมูลอื่นใดที่เกี่ยวข้อง ให้แก่คู่สัญญา สถาบันการเงิน ส่วนราชการอื่น ๆ หรือหน่วยงานที่เกี่ยวข้อง ทั้งนี้เพื่อประโยชน์ในการสมัครงานและการทำงานเท่านั้น',
    '',
    '2) ข้อมูลการติดต่อสื่อสาร — ข้าพเจ้ายินยอมให้บริษัทฯ เก็บรวบรวม ใช้ และเปิดเผยข้อมูลการติดต่อ เช่น หมายเลขโทรศัพท์ อีเมล Social Media และข้อมูลผู้ติดต่อกรณีฉุกเฉิน เพื่อการประสานงานและแจ้งข่าวสาร และหรือประโยชน์ในการสมัครงานและการทำงานเท่านั้น',
    '',
    '3) ข้อมูลเกี่ยวกับการทำงาน — ข้าพเจ้ายินยอมให้บริษัทฯ เก็บรวบรวม ใช้ และเปิดเผยข้อมูลเกี่ยวกับตำแหน่งงาน ประวัติการทำงาน เงินเดือน การบันทึกเวลา ประกันสังคม และข้อมูลอื่นที่เกี่ยวข้องกับการทำงาน ให้แก่คู่สัญญา สถาบันการเงิน ส่วนราชการอื่น ๆ หรือหน่วยงานที่เกี่ยวข้อง ทั้งนี้เพื่อประโยชน์ในการสมัครงานและการทำงานเท่านั้น',
    '',
    '4) ข้อมูลส่วนบุคคลที่มีความอ่อนไหว — ข้าพเจ้ายินยอมให้บริษัทฯ เก็บรวบรวม ใช้ และเปิดเผยข้อมูลอ่อนไหว เช่น ข้อมูลสุขภาพ ประวัติการรักษา ผลตรวจสุขภาพ หรือประวัติอาชญากรรม ให้แก่คู่สัญญา สถาบันการเงิน ส่วนราชการอื่น ๆ หรือหน่วยงานที่เกี่ยวข้อง ทั้งนี้เพื่อประโยชน์ในการสมัครงานและการทำงานเท่านั้น',
    '',
    '5) การใช้ภาพถ่าย — ข้าพเจ้ายินยอมให้บริษัทฯ ใช้ภาพถ่ายของข้าพเจ้าในพื้นที่ทำงาน ไม่ว่าจะเป็นชุดยูนิฟอร์มหรือชุดไปรเวท ในกิจกรรมบริษัท เพื่อการประชาสัมพันธ์หรือการสรรหาบุคลากรของบริษัทฯ เท่านั้น',
    '',
    '6) ระยะการจัดเก็บข้อมูล — บริษัทฯ จะจัดเก็บ รวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลตามระยะเวลาที่เหมาะสม สำหรับข้อมูลส่วนบุคคลของผู้สมัครที่ไม่ผ่านการคัดเลือก จะถูกจัดเก็บไม่เกิน 6 เดือน เพื่อใช้เป็นข้อมูลอ้างอิงในการพิจารณาการจ้างงานในอนาคต',
    '',
    '7) การตรวจสารเสพติด — ข้าพเจ้ายินยอมให้บริษัทฯ ตรวจสารเสพติดในกรณีที่ลักษณะงานเกี่ยวข้องกับความปลอดภัยหรือการควบคุมเครื่องจักร เพื่อลดความเสี่ยงในการเกิดอุบัติเหตุ อันจะนำมาซึ่งความเสียหายต่อร่างกายและทรัพย์สินโดยรวม',
    '',
    'ตามหนังสือฉบับนี้ ข้าพเจ้าได้อ่านและทำความเข้าใจแล้ว โดยข้าพเจ้าให้ความยินยอมหรือปฏิเสธไม่ให้ความยินยอมในเอกสารนี้ด้วยความสมัครใจ ปราศจากการบังคับหรือชักจูง เว้นแต่ในกรณีมีข้อจำกัดสิทธิตามกฎหมาย หรือยังมีสัญญาระหว่างข้าพเจ้ากับบริษัท คิง เฟอร์นิเจอร์ ไทย จำกัด ที่ให้ประโยชน์แก่ข้าพเจ้า',
    '',
    'ข้าพเจ้าได้อ่านและเข้าใจข้อความข้างต้นแล้ว และยินยอมให้บริษัทเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลตามวัตถุประสงค์ดังกล่าว',
  ].join('\n');
}

// Default text for the public careers / application portal (editable in Settings).
function defaultCareers() {
  return {
    intro: 'King Living is a family-owned Australian furniture maker. At our Thailand factory we craft sofas, mattresses and fine furniture to the highest standard. We are always looking for committed, quality-focused people at every level — from production operators to managers. Apply online below and our HR team will be in touch.',
    introTh: 'King Living เป็นผู้ผลิตเฟอร์นิเจอร์สัญชาติออสเตรเลีย ที่โรงงานในประเทศไทยเราผลิตโซฟา ที่นอน และเฟอร์นิเจอร์คุณภาพสูง เรากำลังมองหาบุคลากรที่มุ่งมั่นและใส่ใจคุณภาพในทุกระดับ ตั้งแต่พนักงานฝ่ายผลิตจนถึงระดับผู้จัดการ สมัครออนไลน์ด้านล่างแล้วทีม HR จะติดต่อกลับ',
    pdpa: officialConsentEn(),
    pdpaTh: officialConsentTh(),
  };
}

// SMTP / email defaults. Disabled until HR fills in the mail server on the Settings page.
// Works with Microsoft 365 (host smtp.office365.com, port 587, STARTTLS).
function defaultEmail() {
  return {
    enabled: false,
    host: '', port: 587, secure: false, // secure=false = STARTTLS on 587; true = SSL on 465
    user: '', password: '',
    fromName: 'King Living Careers', fromEmail: '',
    hrNotify: '',                 // optional address(es) to notify of each new application
    confirmSubject: 'We received your application — King Living',
    confirmBody: 'Dear {name},\n\nThank you for applying to King Living{position}. We have received your application (reference {code}) and our HR team will review it.\n\nIf you need to correct any details, you can update your application here:\n{editLink}\n\nKind regards,\nKing Living HR',
  };
}

// Interview scorecard. "general" applies to every candidate; "management" criteria are for
// supervisor/manager roles (leave blank where not applicable). Mirrors the King competency set.
function defaultScorecard() {
  return [
    ...['Skills & experience', 'Communication', 'Teamwork & attitude', 'Reliability & commitment', 'Quality & safety focus', 'Cultural fit (King values)'].map((name, i) => ({ id: 'g' + (i + 1), name, group: 'general' })),
    ...['Leadership', 'Planning & organising', 'Decision making', 'Strategic thinking'].map((name, i) => ({ id: 'm' + (i + 1), name, group: 'management' })),
  ];
}

// ---- clearly-fictional sample data (safe to delete) ----------------------
function sampleData(now) {
  const reqs = [
    { id: 'req-sample-1', code: 'REQ-0001', title: 'Sewing Operator', department: 'MANU Production', area: 'Sewing', level: 'Operator', costCenter: 'MFR SEW Sewing', headcount: 5, employmentType: 'daily', priority: 'high', status: 'open', shift: 'Day', salaryMin: 0, salaryMax: 0, hiringManagerId: null, published: true, screeningQuestions: [{ id: 'q1', text: 'Do you have previous sewing experience?', type: 'yesno', knockout: false }, { id: 'q2', text: 'Are you able to work the day shift (08:00–17:00)?', type: 'yesno', knockout: true }], description: 'Operate industrial sewing machines for upholstery covers.', requirements: 'Sewing experience preferred; will train. Good eyesight and attention to detail.', openedAt: now - 18 * 864e5, targetDate: '', createdAt: now - 18 * 864e5 },
    { id: 'req-sample-2', code: 'REQ-0002', title: 'Welding Supervisor', department: 'MANU Production', area: 'Welding', level: 'Supervisor', costCenter: 'MFR WEL Welding', headcount: 1, employmentType: 'full-time', priority: 'urgent', status: 'open', shift: 'Day', salaryMin: 25000, salaryMax: 35000, hiringManagerId: null, published: true, screeningQuestions: [{ id: 'q1', text: 'How many years have you worked in welding?', type: 'text', knockout: false }, { id: 'q2', text: 'Are you willing to work upcountry if required?', type: 'yesno', knockout: false }], description: 'Lead the welding line and a team of 12 welders.', requirements: '5+ years welding, 2+ years leading a team. MIG/TIG.', openedAt: now - 9 * 864e5, targetDate: '', createdAt: now - 9 * 864e5 },
    { id: 'req-sample-3', code: 'REQ-0003', title: 'Production Manager', department: 'MANU Production', area: 'Assembly', level: 'Manager', costCenter: 'MFR ASS Assembly', headcount: 1, employmentType: 'full-time', priority: 'normal', status: 'open', shift: 'Day', salaryMin: 60000, salaryMax: 90000, hiringManagerId: null, published: true, screeningQuestions: [], description: 'Own factory production output, quality and safety.', requirements: 'Degree in engineering or related; 8+ years manufacturing, 3+ in management.', openedAt: now - 30 * 864e5, targetDate: '', createdAt: now - 30 * 864e5 },
  ];
  const mk = (id, name, reqId, level, source, stageId, rating, phone, expected, days) => ({
    id, code: id.toUpperCase().replace('CAND-SAMPLE-', 'CAND-000'),
    name, requisitionId: reqId, level, source, currentStageId: stageId,
    phone, email: '', expectedSalary: expected, rating, resumeUrl: '', notes: 'Sample candidate — safe to delete.',
    appliedAt: now - days * 864e5, createdAt: now - days * 864e5,
    history: [{ stageId: 'applied', at: now - days * 864e5, note: 'Applied' }, ...(stageId !== 'applied' ? [{ stageId, at: now - (days - 2) * 864e5, note: 'Moved' }] : [])],
  });
  const candidates = [
    mk('cand-sample-1', 'Somchai Demo', 'req-sample-1', 'Operator', 'walk-in', 'applied', 0, '08x-xxx-xxxx', 0, 5),
    mk('cand-sample-2', 'Naree Sample', 'req-sample-1', 'Operator', 'referral', 'screening', 4, '08x-xxx-xxxx', 0, 6),
    mk('cand-sample-3', 'Anan Example', 'req-sample-1', 'Operator', 'walk-in', 'assessment', 3, '08x-xxx-xxxx', 0, 7),
    mk('cand-sample-4', 'Pranee Test', 'req-sample-2', 'Supervisor', 'jobboard', 'interview', 5, '08x-xxx-xxxx', 30000, 4),
    mk('cand-sample-5', 'Wichai Demo', 'req-sample-2', 'Supervisor', 'agency', 'offer', 4, '08x-xxx-xxxx', 32000, 8),
    mk('cand-sample-6', 'Suda Placeholder', 'req-sample-3', 'Manager', 'agency', 'interview', 4, '08x-xxx-xxxx', 75000, 12),
    mk('cand-sample-7', 'Krit Sample', 'req-sample-3', 'Manager', 'referral', 'hired', 5, '08x-xxx-xxxx', 80000, 25),
  ];
  return { reqs, candidates };
}

function seedIfNeeded() {
  const existing = getDb();
  if (existing && existing.settings && existing.settings.initialized) return existing;

  const now = Date.now();
  const { reqs, candidates } = sampleData(now);

  const db = {
    settings: {
      appName: 'King Recruit',
      logoDataUrl: null,
      initialized: true,
      currency: 'THB',
      tzOffsetMinutes: 420, // factory local time = Thailand (UTC+7)
      seqReq: reqs.length, // running counter for REQ-#### codes
      seqCand: candidates.length, // running counter for CAND-#### codes
      careers: defaultCareers(), // public portal intro + PDPA consent text
      consentVersion: CONSENT_VERSION,
      email: defaultEmail(), // SMTP settings for applicant confirmation / HR notification
    },
    stages: defaultStages(),
    levels: defaultLevels(),
    sources: defaultSources(),
    scorecard: defaultScorecard(),
    employees: [], // the org / people — hiring managers & interviewers, imported on the People page
    requisitions: reqs,
    candidates,
    interviews: [],
    users: [],
  };

  const admin = {
    id: crypto.randomUUID(),
    username: DEFAULT_ADMIN_USERNAME,
    name: 'HR Administrator',
    title: 'HR Administrator',
    role: 'admin',
    admin: true,
    employeeId: null,
    passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
    mustChangePassword: false,
    active: true,
    createdAt: now,
  };
  db.users.push(admin);

  setDb(db);
  return db;
}

// Runs on every boot (after load) to bring an existing database up to date without wiping
// data: backfills new settings blocks and re-applies the official consent text when its
// version changes. Safe to run repeatedly.
function migrate() {
  const db = getDb();
  if (!db || !db.settings) return; // fresh DB — seedIfNeeded handles it
  const s = db.settings;
  let changed = false;
  if (!s.email) { s.email = defaultEmail(); changed = true; }
  if (!s.careers) { s.careers = defaultCareers(); changed = true; }
  // (re)apply the official consent whenever the shipped version differs
  if (s.consentVersion !== CONSENT_VERSION) {
    s.careers = s.careers || {};
    s.careers.pdpa = officialConsentEn();
    s.careers.pdpaTh = officialConsentTh();
    s.consentVersion = CONSENT_VERSION;
    changed = true;
  }
  if (changed) save();
}

module.exports = {
  seedIfNeeded,
  migrate,
  defaultStages,
  defaultLevels,
  defaultSources,
  defaultScorecard,
  defaultStages,
  defaultLevels,
  defaultSources,
  defaultScorecard,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
};
