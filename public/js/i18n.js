// Bilingual support (English + Thai). Locale is kept in a cookie so it survives reloads
// (shared with the other King apps via the kt_lang cookie). t(key, vars) returns the string
// for the current language, falling back to English then the key itself.

function readCookie(name) {
  return (document.cookie.split('; ').find((c) => c.startsWith(name + '=')) || '').split('=')[1] || '';
}
function writeCookie(name, value) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

let lang = readCookie('kt_lang') === 'th' ? 'th' : 'en';
export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'th' ? 'th' : 'en';
  writeCookie('kt_lang', lang);
  document.documentElement.setAttribute('lang', lang);
}
document.documentElement.setAttribute('lang', lang);

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) ?? (DICT.en[key] ?? key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll('{' + k + '}', v);
  return s;
}

const DICT = {
  en: {
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.add': 'Add', 'common.edit': 'Edit',
    'common.delete': 'Delete', 'common.close': 'Close', 'common.back': '← Back', 'common.loading': 'Loading…',
    'common.saved': 'Saved', 'common.deleted': 'Deleted', 'common.none': '—', 'common.name': 'Name',
    'common.status': 'Status', 'common.actions': 'Actions', 'common.active': 'Active', 'common.inactive': 'Inactive',
    'common.export': 'Export', 'common.print': 'Print', 'common.all': 'All', 'common.total': 'Total',
    'common.search': 'Search', 'common.clear': 'Clear', 'common.optional': 'optional', 'common.move': 'Move',
    'role.administrator': 'Administrator', 'role.member': 'Hiring manager',

    'nav.dashboard': 'Dashboard', 'nav.requisitions': 'Requisitions', 'nav.candidates': 'Candidates',
    'nav.pipeline': 'Pipeline', 'nav.interviews': 'Interviews', 'nav.people': 'People', 'nav.orgchart': 'Org Chart',
    'nav.setup': 'Recruitment Setup', 'nav.settings': 'Settings', 'nav.users': 'User Logins', 'nav.preferences': 'Preferences', 'nav.careersPage': 'Careers Page',
    'nav.sec.overview': 'Overview', 'nav.sec.hiring': 'Hiring', 'nav.sec.org': 'Organisation',
    'nav.sec.setup': 'Setup', 'nav.sec.me': 'Me',

    'login.welcome': 'Welcome', 'login.signInTo': 'Sign in to {app}', 'login.username': 'Username', 'login.password': 'Password',
    'login.signIn': 'Sign in', 'login.signingIn': 'Signing in…', 'login.internalOnly': 'King Living · Internal use only',
    'login.tagTitle': 'Hire the right people, faster.', 'login.tagSub': 'Post openings, track candidates through every stage, schedule interviews and score them — all in one place.',
    'pw.title': 'Set your password', 'pw.sub': 'You were given a temporary password.', 'pw.oneStep': 'One quick step.',
    'pw.oneStepSub': 'For security, please choose your own password before continuing.',
    'pw.current': 'Current password', 'pw.new': 'New password', 'pw.newHint': 'At least 8 characters', 'pw.confirm': 'Confirm new password',
    'pw.set': 'Set new password', 'pw.mismatch': 'The new passwords do not match.', 'pw.change': 'Change password', 'pw.update': 'Update password', 'pw.updated': 'Password updated',

    'prefs.title': 'Preferences', 'prefs.intro': 'Personalise how King Recruit looks and reads.',
    'prefs.appearance': 'Appearance', 'prefs.theme': 'Theme', 'prefs.light': 'Light', 'prefs.dark': 'Dark', 'prefs.futuristic': 'Futuristic',
    'prefs.themeHint': 'Light is the default. Dark is easier at night. Futuristic adds a deep-space look with neon accents.',
    'prefs.language': 'Language', 'prefs.langHint': 'Switches the whole interface immediately.', 'prefs.english': 'English', 'prefs.thai': 'ไทย (Thai)',
    'prefs.account': 'Your account',

    'dash.intro': 'Your hiring at a glance — open roles, candidates in the pipeline and interviews coming up.',
    'dash.openReqs': 'Open requisitions', 'dash.openings': 'Total openings', 'dash.openingsSub': 'positions to fill',
    'dash.inPipeline': 'In pipeline', 'dash.inPipelineSub': 'active candidates', 'dash.hires': 'Hires this month',
    'dash.interviews': 'Interviews scheduled', 'dash.funnel': 'Pipeline funnel', 'dash.byLevel': 'Active candidates by level',
    'dash.bySource': 'Candidates by source', 'dash.openRoles': 'Open roles', 'dash.allDepts': 'All departments', 'dash.allLevels': 'All levels',
    'dash.noFunnel': 'No candidates yet. Add candidates or open the Pipeline to get started.',
    'dash.getStarted': 'Getting started', 'dash.s1': 'Import your people / org structure on the People page', 'dash.s2': 'Open requisitions for the roles you need to fill', 'dash.s3': 'Add candidates and move them across the Pipeline board', 'dash.s4': 'Schedule interviews and score them',

    'req.intro': 'Job openings to fill. Each requisition has a level, a department and a hiring manager. Open one to see and move its candidates.',
    'req.add': '+ New requisition', 'req.title': 'Job title', 'req.dept': 'Department', 'req.area': 'Area / section', 'req.level': 'Level',
    'req.costCenter': 'Cost centre', 'req.headcount': 'Headcount', 'req.filled': 'Filled', 'req.priority': 'Priority', 'req.hiringMgr': 'Hiring manager',
    'req.empType': 'Employment type', 'req.shift': 'Shift', 'req.salaryRange': 'Salary range', 'req.salaryMin': 'Salary from', 'req.salaryMax': 'Salary to',
    'req.targetDate': 'Target start date', 'req.openDate': 'Open date', 'req.description': 'Role description', 'req.requirements': 'Requirements',
    'req.code': 'Ref', 'req.candidates': 'Candidates', 'req.none': 'No requisitions yet', 'req.searchPlaceholder': 'Search title or ref…',
    'req.allStatus': 'All statuses', 'req.opened': 'Opened', 'req.viewCands': 'View candidates',
    'req.st.draft': 'Draft', 'req.st.open': 'Open', 'req.st.on-hold': 'On hold', 'req.st.filled': 'Filled', 'req.st.closed': 'Closed',
    'req.pri.low': 'Low', 'req.pri.normal': 'Normal', 'req.pri.high': 'High', 'req.pri.urgent': 'Urgent',
    'req.et.full-time': 'Full-time', 'req.et.contract': 'Contract', 'req.et.daily': 'Daily', 'req.et.intern': 'Intern',
    'req.publish': 'Publish to careers portal', 'req.publishHint': 'Show this opening on the public application page (/apply).', 'req.published': 'Published',
    'req.screening': 'Screening questions', 'req.screeningHint': 'Asked during online apply. Tick KO to mark a knockout question.',

    'cand.intro': 'Everyone applying across all roles. Filter by requisition, stage or level, rate them, and move them through the pipeline.',
    'cand.add': '+ Add candidate', 'cand.import': 'Import', 'cand.name': 'Candidate', 'cand.appliedFor': 'Applied for', 'cand.stage': 'Stage',
    'cand.source': 'Source', 'cand.phone': 'Phone', 'cand.email': 'Email', 'cand.expected': 'Expected salary', 'cand.rating': 'Rating',
    'cand.resume': 'Résumé link', 'cand.notes': 'Notes', 'cand.none': 'No candidates yet', 'cand.searchPlaceholder': 'Search name, phone or ref…',
    'cand.allReqs': 'All requisitions', 'cand.allStages': 'All stages', 'cand.allLevels': 'All levels', 'cand.allSources': 'All sources',
    'cand.code': 'Ref', 'cand.applied': 'Applied', 'cand.history': 'Stage history', 'cand.openReq': 'For requisition',
    'cand.noReq': 'General application (no requisition)', 'cand.printProfile': 'Print profile', 'cand.compare': 'Compare', 'cand.compareSel': 'Compare', 'cand.compareNeed': 'Tick at least two candidates to compare.', 'cand.importHint': 'Upload a CSV with a header row. Recognised columns: name, phone, email, level, source, expectedSalary, notes. Each becomes a new candidate in the first stage.',
    'cand.importBtn': 'Choose CSV file', 'cand.importDone': '{created} added, {skipped} skipped.', 'cand.scheduleInterview': '+ Interview',

    'pipe.intro': 'Drag candidates from stage to stage, or use the arrows. Filter to one requisition to focus a single hire.',
    'pipe.allReqs': 'All requisitions', 'pipe.empty': 'No candidates here', 'pipe.moved': 'Moved to {stage}',
    'pipe.toWon': 'Move to a “hired” stage?', 'pipe.openCard': 'Open',

    'intv.intro': 'Schedule interviews and capture a scorecard for each. The scorecard mirrors the King competency set; management criteria apply to leadership roles.',
    'intv.add': '+ Schedule interview', 'intv.candidate': 'Candidate', 'intv.interviewer': 'Interviewer', 'intv.when': 'Date & time',
    'intv.type': 'Type', 'intv.location': 'Location / link', 'intv.upcoming': 'Upcoming', 'intv.past': 'Completed & past',
    'intv.none': 'No interviews scheduled', 'intv.score': 'Score', 'intv.scorecard': 'Scorecard', 'intv.recommendation': 'Recommendation',
    'intv.overall': 'Overall', 'intv.complete': 'Save scorecard', 'intv.markDone': 'Mark completed',
    'intv.t.phone': 'Phone', 'intv.t.onsite': 'On-site', 'intv.t.panel': 'Panel', 'intv.t.trade-test': 'Trade test', 'intv.t.video': 'Video',
    'intv.st.scheduled': 'Scheduled', 'intv.st.completed': 'Completed', 'intv.st.cancelled': 'Cancelled',
    'intv.rec.strong-yes': 'Strong yes', 'intv.rec.yes': 'Yes', 'intv.rec.maybe': 'Maybe', 'intv.rec.no': 'No',
    'intv.general': 'General', 'intv.management': 'Management',

    'people.intro': 'Your own staff — the hiring managers and interviewers (not the applicants). Adding people here lets you pick them from a list when setting a requisition’s hiring manager or an interview’s interviewer. It is optional — you can also just type a name in those fields. Import the list straight from King Time (export employees to CSV there, import here), or add people one at a time.',
    'people.add': '+ Add person', 'people.import': 'Import', 'people.code': 'Staff code', 'people.position': 'Position',
    'people.dept': 'Department', 'people.area': 'Area', 'people.level': 'Level', 'people.email': 'Email', 'people.phone': 'Phone',
    'people.manager': 'Reports to', 'people.none': 'No people yet — import from King Time or add one.',
    'people.searchPlaceholder': 'Search name or code…', 'people.allDepts': 'All departments', 'people.allLevels': 'All levels',
    'people.importTitle': 'Import people', 'people.importHint': 'Upload a CSV with a header row. Recognised columns: empCode, name, department, area, position, level, email, phone, manager. The employee export from King Time works as-is. Matched by staff code.',
    'people.importBtn': 'Choose CSV file', 'people.importDone': '{created} added, {updated} updated, {skipped} skipped.',

    'org.intro': 'An optional chart of how the staff you added on the People page report to each other. It’s just for visualising your team structure — you don’t need to fill it in to use the recruitment features.',
    'org.people': 'People', 'org.managers': 'Managers', 'org.supervisors': 'Supervisors', 'org.unassigned': 'No manager',
    'org.findPerson': 'Find a person…', 'org.expandAll': 'Expand all', 'org.collapseAll': 'Collapse all',
    'org.reports': '{n} direct', 'org.teamTotal': '{n} in total team', 'org.reportsTo': 'Reports to',
    'org.noManager': '— none (top of chart) —', 'org.editHint': 'You can’t move someone under their own subordinate.',
    'emp.area': 'Area', 'emp.position': 'Position',

    'setup.intro': 'Define your hiring pipeline, the job levels you recruit for, where candidates come from, and the interview scorecard. These drive the board, the filters and the dashboard.',
    'setup.stages': 'Pipeline stages', 'setup.stagesIntro': 'The columns of the board, in order. Type “Active” = in progress, “Hired” = a successful close, “Lost” = rejected / withdrawn.',
    'setup.stageName': 'Stage name', 'setup.stageType': 'Type', 'setup.addStage': '+ Add stage', 'setup.saveStages': 'Save stages',
    'setup.type.active': 'Active', 'setup.type.won': 'Hired', 'setup.type.lost': 'Lost',
    'setup.levels': 'Job levels', 'setup.levelsIntro': 'The bands you recruit across, from top to bottom.', 'setup.saveLevels': 'Save levels', 'setup.levelsPlaceholder': 'One level per line, e.g. Management, Manager, Supervisor, Leader, Staff, Operator',
    'setup.sources': 'Candidate sources', 'setup.sourcesIntro': 'Where applicants come from — used for the source filter and the dashboard.', 'setup.addSource': '+ Add source', 'setup.saveSources': 'Save sources',
    'setup.scorecard': 'Interview scorecard', 'setup.scorecardIntro': 'The criteria interviewers rate (1–5). “General” applies to everyone; “Management” is for leadership roles.',
    'setup.criterion': 'Criterion', 'setup.group': 'Group', 'setup.addCriterion': '+ Add criterion', 'setup.saveScorecard': 'Save scorecard',

    'settings.intro': 'Brand the app, set the currency, and keep a backup of your data.',
    'settings.branding': 'Branding', 'settings.appName': 'App name', 'settings.saveName': 'Save name', 'settings.logo': 'Logo',
    'settings.general': 'General', 'settings.currency': 'Currency', 'settings.save': 'Save settings',
    'settings.data': 'Data & backup', 'settings.download': 'Download backup',
    'settings.careers': 'Careers portal', 'settings.careersIntro': 'The public application page applicants see at /apply. Edit the intro and the privacy (PDPA) consent text, in English and Thai.',
    'settings.portalLink': 'Public application link', 'settings.introEn': 'Intro (English)', 'settings.introTh': 'Intro (Thai)', 'settings.pdpaEn': 'Privacy / PDPA consent (English)', 'settings.pdpaTh': 'Privacy / PDPA consent (Thai)',
    'settings.qr': 'QR code', 'settings.qrHint': 'Candidates scan this with a phone camera to open the application page. Print it for job boards, the factory gate, or flyers.', 'settings.qrPrint': 'Print QR poster', 'settings.qrCaption': 'Scan to apply — King Living Careers',
    'settings.email': 'Email notifications', 'settings.emailIntro': 'Send applicants a confirmation email when they apply, and optionally notify HR. Works with Microsoft 365 (host smtp.office365.com, port 587).',
    'settings.emailNotInstalled': 'Email library not installed yet — run "npm install" on the server, then restart.',
    'settings.emailEnabled': 'Send emails on new applications', 'settings.emailHost': 'SMTP server', 'settings.emailPort': 'Port / security', 'settings.emailUser': 'Username', 'settings.emailPass': 'Password',
    'settings.emailFromName': 'From name', 'settings.emailFromEmail': 'From address', 'settings.emailHrNotify': 'Notify HR at (optional)',
    'settings.emailTemplateHint': 'Applicant confirmation email. Placeholders: {name}, {position}, {code}, {editLink}.', 'settings.emailSubject': 'Confirmation subject', 'settings.emailBody': 'Confirmation message',
    'settings.emailTestLabel': 'Send a test email to', 'settings.emailTest': 'Send test', 'settings.emailTesting': 'Sending…', 'settings.emailTestOk': 'Test email sent',

    'users.intro': 'App logins for HR and hiring managers. Link a hiring manager to their person record so they only see their own requisitions and candidates.',
    'users.add': '+ Add login', 'users.linkedTo': 'Linked person', 'users.admin': 'Administrator', 'users.setPw': 'Set password', 'users.resetPw': 'Reset password', 'users.none': 'No logins yet',
    'users.role': 'Role / title', 'users.adminHint': 'Administrator — full access',

    'apply.hero.title': 'Work with King Living', 'apply.hero.apply': 'Apply now', 'apply.hero.viewJobs': 'View open positions',
    'apply.back': '← Back', 'apply.next': 'Next', 'apply.continue': 'Continue', 'apply.cancel': 'Cancel', 'apply.submit': 'Submit application',
    'apply.step.consent': 'Consent', 'apply.step.jobs': 'Positions', 'apply.step.form': 'Application', 'apply.step.done': 'Done',
    'apply.consent.title': 'Privacy notice & consent', 'apply.consent.accept': 'I have read and accept the privacy notice above.',
    'apply.jobs.title': 'Open positions', 'apply.jobs.none': 'There are no open positions right now. You may still submit a general application.',
    'apply.jobs.general': 'General application', 'apply.jobs.generalSub': 'Not sure which role? Apply generally and HR will match you.', 'apply.jobs.applyThis': 'Apply for this role', 'apply.jobs.selected': 'Applying for',
    'apply.form.certify': 'I hereby certify that the information in this application is true. If any statement is untrue, the company may terminate my employment immediately without compensation.',
    'apply.done.title': 'Application received', 'apply.done.msg': 'Thank you. Your application has been submitted to our HR team. Please keep your reference number.', 'apply.done.ref': 'Your reference number', 'apply.done.another': 'Submit another application',
    'apply.saveChanges': 'Save changes', 'apply.edit.banner': 'You are editing an application you already submitted. Make your changes and save.', 'apply.edit.notFound': 'Application link not valid', 'apply.done.updated': 'Application updated', 'apply.done.editHint': 'Need to change something later? Bookmark this private link to edit your application:', 'apply.upload.replace': 'Replace file', 'apply.upload.files': 'file(s)',
    'apply.required': 'required', 'apply.upload.choose': 'Choose file', 'apply.upload.uploading': 'Uploading…', 'apply.upload.uploaded': 'Uploaded', 'apply.upload.hint': 'Image (PNG/JPG) or PDF, up to 6 MB.',
    'apply.addRow': '+ Add another', 'apply.remove': 'Remove', 'apply.yes': 'Yes', 'apply.no': 'No', 'apply.choose': '— choose —',
    'apply.test.title': 'Online test', 'apply.test.coming': 'An online assessment will be part of the process. This step is coming soon — HR will contact you about it.',
    'apply.sec.personal': 'Personal background', 'apply.sec.position': 'Position applied for', 'apply.sec.education': 'Education', 'apply.sec.training': 'Training / internship',
    'apply.sec.work': 'Work history', 'apply.sec.skills': 'Special skills', 'apply.sec.other': 'Other information', 'apply.sec.screening': 'A few quick questions', 'apply.sec.documents': 'Attach documents',
    'apply.doc.photo': 'Profile photo (2×2)', 'apply.doc.resume': 'Résumé / CV', 'apply.doc.transcript': 'Education documents (transcript)', 'apply.doc.idcard': 'Copy of ID card', 'apply.doc.housereg': 'Copy of house registration', 'apply.doc.other': 'Others (TOEIC, licence, certificates)',
  },

  th: {
    'common.save': 'บันทึก', 'common.cancel': 'ยกเลิก', 'common.add': 'เพิ่ม', 'common.edit': 'แก้ไข',
    'common.delete': 'ลบ', 'common.close': 'ปิด', 'common.back': '← กลับ', 'common.loading': 'กำลังโหลด…',
    'common.saved': 'บันทึกแล้ว', 'common.deleted': 'ลบแล้ว', 'common.none': '—', 'common.name': 'ชื่อ',
    'common.status': 'สถานะ', 'common.actions': 'การทำงาน', 'common.active': 'ใช้งาน', 'common.inactive': 'ไม่ได้ใช้งาน',
    'common.export': 'ส่งออก', 'common.print': 'พิมพ์', 'common.all': 'ทั้งหมด', 'common.total': 'รวม',
    'common.search': 'ค้นหา', 'common.clear': 'ล้าง', 'common.optional': 'ไม่บังคับ', 'common.move': 'ย้าย',
    'role.administrator': 'ผู้ดูแลระบบ', 'role.member': 'ผู้จัดการที่รับสมัคร',

    'nav.dashboard': 'แดชบอร์ด', 'nav.requisitions': 'ตำแหน่งที่เปิดรับ', 'nav.candidates': 'ผู้สมัคร',
    'nav.pipeline': 'ขั้นตอนการคัดเลือก', 'nav.interviews': 'การสัมภาษณ์', 'nav.people': 'บุคลากร', 'nav.orgchart': 'ผังองค์กร',
    'nav.setup': 'ตั้งค่าการสรรหา', 'nav.settings': 'ตั้งค่าระบบ', 'nav.users': 'บัญชีผู้ใช้', 'nav.preferences': 'การตั้งค่า', 'nav.careersPage': 'หน้าสมัครงาน',
    'nav.sec.overview': 'ภาพรวม', 'nav.sec.hiring': 'การสรรหา', 'nav.sec.org': 'องค์กร',
    'nav.sec.setup': 'ตั้งค่า', 'nav.sec.me': 'ของฉัน',

    'login.welcome': 'ยินดีต้อนรับ', 'login.signInTo': 'เข้าสู่ระบบ {app}', 'login.username': 'ชื่อผู้ใช้', 'login.password': 'รหัสผ่าน',
    'login.signIn': 'เข้าสู่ระบบ', 'login.signingIn': 'กำลังเข้าสู่ระบบ…', 'login.internalOnly': 'King Living · ใช้ภายในองค์กรเท่านั้น',
    'login.tagTitle': 'สรรหาคนที่ใช่ ได้เร็วขึ้น', 'login.tagSub': 'ประกาศตำแหน่ง ติดตามผู้สมัครทุกขั้นตอน นัดสัมภาษณ์และให้คะแนน — ในที่เดียว',
    'pw.title': 'ตั้งรหัสผ่านของคุณ', 'pw.sub': 'คุณได้รับรหัสผ่านชั่วคราว', 'pw.oneStep': 'อีกขั้นตอนเดียว',
    'pw.oneStepSub': 'เพื่อความปลอดภัย กรุณาตั้งรหัสผ่านของคุณเองก่อนดำเนินการต่อ',
    'pw.current': 'รหัสผ่านปัจจุบัน', 'pw.new': 'รหัสผ่านใหม่', 'pw.newHint': 'อย่างน้อย 8 ตัวอักษร', 'pw.confirm': 'ยืนยันรหัสผ่านใหม่',
    'pw.set': 'ตั้งรหัสผ่านใหม่', 'pw.mismatch': 'รหัสผ่านใหม่ไม่ตรงกัน', 'pw.change': 'เปลี่ยนรหัสผ่าน', 'pw.update': 'อัปเดตรหัสผ่าน', 'pw.updated': 'อัปเดตรหัสผ่านแล้ว',

    'prefs.title': 'การตั้งค่า', 'prefs.intro': 'ปรับแต่งรูปลักษณ์และภาษาของ King Recruit',
    'prefs.appearance': 'รูปลักษณ์', 'prefs.theme': 'ธีม', 'prefs.light': 'สว่าง', 'prefs.dark': 'มืด', 'prefs.futuristic': 'ล้ำสมัย',
    'prefs.themeHint': 'ธีมสว่างเป็นค่าเริ่มต้น ธีมมืดสบายตาเวลากลางคืน ธีมล้ำสมัยให้บรรยากาศอวกาศพร้อมสีนีออน',
    'prefs.language': 'ภาษา', 'prefs.langHint': 'เปลี่ยนทั้งหน้าจอทันที', 'prefs.english': 'English', 'prefs.thai': 'ไทย',
    'prefs.account': 'บัญชีของคุณ',

    'dash.intro': 'ภาพรวมการสรรหา — ตำแหน่งที่เปิดรับ ผู้สมัครในระบบ และการสัมภาษณ์ที่กำลังจะมาถึง',
    'dash.openReqs': 'ตำแหน่งที่เปิดรับ', 'dash.openings': 'อัตราที่ต้องรับ', 'dash.openingsSub': 'ตำแหน่งที่ต้องเติม',
    'dash.inPipeline': 'อยู่ในกระบวนการ', 'dash.inPipelineSub': 'ผู้สมัครที่ดำเนินการอยู่', 'dash.hires': 'รับเข้าทำงานเดือนนี้',
    'dash.interviews': 'นัดสัมภาษณ์แล้ว', 'dash.funnel': 'ช่องทางการคัดเลือก', 'dash.byLevel': 'ผู้สมัครตามระดับ',
    'dash.bySource': 'ผู้สมัครตามแหล่งที่มา', 'dash.openRoles': 'ตำแหน่งที่เปิดรับ', 'dash.allDepts': 'ทุกแผนก', 'dash.allLevels': 'ทุกระดับ',
    'dash.noFunnel': 'ยังไม่มีผู้สมัคร เพิ่มผู้สมัครหรือเปิดหน้าขั้นตอนการคัดเลือกเพื่อเริ่มต้น',
    'dash.getStarted': 'เริ่มต้นใช้งาน', 'dash.s1': 'นำเข้าบุคลากร/ผังองค์กรในหน้าบุคลากร', 'dash.s2': 'เปิดตำแหน่งที่ต้องการรับ', 'dash.s3': 'เพิ่มผู้สมัครและย้ายผ่านกระดานคัดเลือก', 'dash.s4': 'นัดสัมภาษณ์และให้คะแนน',

    'req.intro': 'ตำแหน่งงานที่ต้องเติม แต่ละตำแหน่งมีระดับ แผนก และผู้จัดการที่รับสมัคร เปิดเพื่อดูและย้ายผู้สมัคร',
    'req.add': '+ เปิดตำแหน่งใหม่', 'req.title': 'ชื่อตำแหน่ง', 'req.dept': 'แผนก', 'req.area': 'พื้นที่/สายงาน', 'req.level': 'ระดับ',
    'req.costCenter': 'ศูนย์ต้นทุน', 'req.headcount': 'จำนวนที่รับ', 'req.filled': 'รับแล้ว', 'req.priority': 'ความเร่งด่วน', 'req.hiringMgr': 'ผู้จัดการที่รับสมัคร',
    'req.empType': 'ประเภทการจ้าง', 'req.shift': 'กะ', 'req.salaryRange': 'ช่วงเงินเดือน', 'req.salaryMin': 'เงินเดือนตั้งแต่', 'req.salaryMax': 'ถึง',
    'req.targetDate': 'วันที่ต้องการเริ่มงาน', 'req.openDate': 'วันที่เปิดรับ', 'req.description': 'รายละเอียดงาน', 'req.requirements': 'คุณสมบัติ',
    'req.code': 'รหัส', 'req.candidates': 'ผู้สมัคร', 'req.none': 'ยังไม่มีตำแหน่ง', 'req.searchPlaceholder': 'ค้นหาชื่อหรือรหัส…',
    'req.allStatus': 'ทุกสถานะ', 'req.opened': 'เปิดเมื่อ', 'req.viewCands': 'ดูผู้สมัคร',
    'req.st.draft': 'ร่าง', 'req.st.open': 'เปิดรับ', 'req.st.on-hold': 'ระงับชั่วคราว', 'req.st.filled': 'รับครบแล้ว', 'req.st.closed': 'ปิดแล้ว',
    'req.pri.low': 'ต่ำ', 'req.pri.normal': 'ปกติ', 'req.pri.high': 'สูง', 'req.pri.urgent': 'เร่งด่วน',
    'req.et.full-time': 'เต็มเวลา', 'req.et.contract': 'สัญญาจ้าง', 'req.et.daily': 'รายวัน', 'req.et.intern': 'ฝึกงาน',
    'req.publish': 'เผยแพร่บนหน้าสมัครงาน', 'req.publishHint': 'แสดงตำแหน่งนี้บนหน้าสมัครงานสาธารณะ (/apply)', 'req.published': 'เผยแพร่แล้ว',
    'req.screening': 'คำถามคัดกรอง', 'req.screeningHint': 'ถามระหว่างสมัครออนไลน์ ติ๊ก KO เพื่อกำหนดเป็นคำถามตัดสิทธิ์',

    'cand.intro': 'ผู้สมัครทั้งหมดทุกตำแหน่ง กรองตามตำแหน่ง ขั้นตอน หรือระดับ ให้คะแนน และเลื่อนผ่านกระบวนการ',
    'cand.add': '+ เพิ่มผู้สมัคร', 'cand.import': 'นำเข้า', 'cand.name': 'ผู้สมัคร', 'cand.appliedFor': 'สมัครตำแหน่ง', 'cand.stage': 'ขั้นตอน',
    'cand.source': 'แหล่งที่มา', 'cand.phone': 'โทรศัพท์', 'cand.email': 'อีเมล', 'cand.expected': 'เงินเดือนที่คาดหวัง', 'cand.rating': 'คะแนน',
    'cand.resume': 'ลิงก์เรซูเม่', 'cand.notes': 'บันทึก', 'cand.none': 'ยังไม่มีผู้สมัคร', 'cand.searchPlaceholder': 'ค้นหาชื่อ โทรศัพท์ หรือรหัส…',
    'cand.allReqs': 'ทุกตำแหน่ง', 'cand.allStages': 'ทุกขั้นตอน', 'cand.allLevels': 'ทุกระดับ', 'cand.allSources': 'ทุกแหล่งที่มา',
    'cand.code': 'รหัส', 'cand.applied': 'สมัครเมื่อ', 'cand.history': 'ประวัติขั้นตอน', 'cand.openReq': 'สำหรับตำแหน่ง',
    'cand.noReq': 'ใบสมัครทั่วไป (ไม่ระบุตำแหน่ง)', 'cand.printProfile': 'พิมพ์โปรไฟล์', 'cand.compare': 'เปรียบเทียบ', 'cand.compareSel': 'เปรียบเทียบ', 'cand.compareNeed': 'เลือกผู้สมัครอย่างน้อย 2 คนเพื่อเปรียบเทียบ', 'cand.importHint': 'อัปโหลดไฟล์ CSV ที่มีแถวหัวตาราง คอลัมน์ที่รองรับ: name, phone, email, level, source, expectedSalary, notes แต่ละแถวจะเป็นผู้สมัครใหม่ในขั้นแรก',
    'cand.importBtn': 'เลือกไฟล์ CSV', 'cand.importDone': 'เพิ่ม {created} ข้าม {skipped}', 'cand.scheduleInterview': '+ สัมภาษณ์',

    'pipe.intro': 'ลากผู้สมัครจากขั้นหนึ่งไปอีกขั้น หรือใช้ลูกศร กรองเฉพาะตำแหน่งเดียวเพื่อโฟกัสการรับคนเดียว',
    'pipe.allReqs': 'ทุกตำแหน่ง', 'pipe.empty': 'ไม่มีผู้สมัครที่นี่', 'pipe.moved': 'ย้ายไปยัง {stage}',
    'pipe.toWon': 'ย้ายไปขั้น “รับเข้าทำงาน”?', 'pipe.openCard': 'เปิด',

    'intv.intro': 'นัดสัมภาษณ์และบันทึกแบบประเมินสำหรับแต่ละครั้ง แบบประเมินอ้างอิงชุดสมรรถนะของ King เกณฑ์ระดับบริหารใช้กับตำแหน่งผู้นำ',
    'intv.add': '+ นัดสัมภาษณ์', 'intv.candidate': 'ผู้สมัคร', 'intv.interviewer': 'ผู้สัมภาษณ์', 'intv.when': 'วันและเวลา',
    'intv.type': 'ประเภท', 'intv.location': 'สถานที่/ลิงก์', 'intv.upcoming': 'กำลังจะมาถึง', 'intv.past': 'เสร็จสิ้นแล้ว',
    'intv.none': 'ยังไม่มีการนัดสัมภาษณ์', 'intv.score': 'คะแนน', 'intv.scorecard': 'แบบประเมิน', 'intv.recommendation': 'ข้อเสนอแนะ',
    'intv.overall': 'รวม', 'intv.complete': 'บันทึกแบบประเมิน', 'intv.markDone': 'ทำเครื่องหมายเสร็จสิ้น',
    'intv.t.phone': 'โทรศัพท์', 'intv.t.onsite': 'ที่สำนักงาน', 'intv.t.panel': 'คณะกรรมการ', 'intv.t.trade-test': 'ทดสอบฝีมือ', 'intv.t.video': 'วิดีโอ',
    'intv.st.scheduled': 'นัดแล้ว', 'intv.st.completed': 'เสร็จสิ้น', 'intv.st.cancelled': 'ยกเลิก',
    'intv.rec.strong-yes': 'แนะนำอย่างยิ่ง', 'intv.rec.yes': 'แนะนำ', 'intv.rec.maybe': 'อาจจะ', 'intv.rec.no': 'ไม่แนะนำ',
    'intv.general': 'ทั่วไป', 'intv.management': 'ระดับบริหาร',

    'people.intro': 'พนักงานของคุณเอง — ผู้จัดการที่รับสมัครและผู้สัมภาษณ์ (ไม่ใช่ผู้สมัคร) การเพิ่มบุคคลที่นี่ช่วยให้เลือกจากรายการได้เมื่อกำหนดผู้จัดการที่รับสมัครในตำแหน่ง หรือผู้สัมภาษณ์ในการนัดสัมภาษณ์ ไม่บังคับ — จะพิมพ์ชื่อในช่องเหล่านั้นเองก็ได้ นำเข้ารายชื่อจาก King Time ได้โดยตรง (ส่งออกพนักงานเป็น CSV แล้วนำเข้าที่นี่) หรือเพิ่มทีละคน',
    'people.add': '+ เพิ่มบุคคล', 'people.import': 'นำเข้า', 'people.code': 'รหัสพนักงาน', 'people.position': 'ตำแหน่ง',
    'people.dept': 'แผนก', 'people.area': 'พื้นที่', 'people.level': 'ระดับ', 'people.email': 'อีเมล', 'people.phone': 'โทรศัพท์',
    'people.manager': 'รายงานต่อ', 'people.none': 'ยังไม่มีบุคลากร — นำเข้าจาก King Time หรือเพิ่มทีละคน',
    'people.searchPlaceholder': 'ค้นหาชื่อหรือรหัส…', 'people.allDepts': 'ทุกแผนก', 'people.allLevels': 'ทุกระดับ',
    'people.importTitle': 'นำเข้าบุคลากร', 'people.importHint': 'อัปโหลดไฟล์ CSV ที่มีแถวหัวตาราง คอลัมน์ที่รองรับ: empCode, name, department, area, position, level, email, phone, manager ไฟล์ส่งออกพนักงานจาก King Time ใช้ได้ทันที จับคู่ด้วยรหัสพนักงาน',
    'people.importBtn': 'เลือกไฟล์ CSV', 'people.importDone': 'เพิ่ม {created} อัปเดต {updated} ข้าม {skipped}',

    'org.intro': 'แผนผังเสริม (ไม่บังคับ) แสดงสายการรายงานของพนักงานที่เพิ่มไว้ในหน้าบุคลากร ใช้เพื่อดูโครงสร้างทีมเท่านั้น ไม่จำเป็นต้องกรอกเพื่อใช้งานฟังก์ชันการสรรหา',
    'org.people': 'บุคลากร', 'org.managers': 'ผู้จัดการ', 'org.supervisors': 'หัวหน้างาน', 'org.unassigned': 'ไม่มีหัวหน้า',
    'org.findPerson': 'ค้นหาบุคคล…', 'org.expandAll': 'ขยายทั้งหมด', 'org.collapseAll': 'ย่อทั้งหมด',
    'org.reports': 'ใต้บังคับบัญชา {n}', 'org.teamTotal': 'รวมทั้งทีม {n}', 'org.reportsTo': 'รายงานต่อ',
    'org.noManager': '— ไม่มี (สูงสุดของผัง) —', 'org.editHint': 'ไม่สามารถย้ายไปอยู่ใต้ผู้ใต้บังคับบัญชาของตนเองได้',
    'emp.area': 'พื้นที่', 'emp.position': 'ตำแหน่ง',

    'setup.intro': 'กำหนดกระบวนการคัดเลือก ระดับตำแหน่งที่รับ แหล่งที่มาของผู้สมัคร และแบบประเมินการสัมภาษณ์ ค่าเหล่านี้ขับเคลื่อนกระดาน ตัวกรอง และแดชบอร์ด',
    'setup.stages': 'ขั้นตอนการคัดเลือก', 'setup.stagesIntro': 'คอลัมน์ของกระดานตามลำดับ ประเภท “ดำเนินการ” = กำลังดำเนินการ “รับเข้า” = ปิดสำเร็จ “ยุติ” = ปฏิเสธ/ถอนตัว',
    'setup.stageName': 'ชื่อขั้นตอน', 'setup.stageType': 'ประเภท', 'setup.addStage': '+ เพิ่มขั้นตอน', 'setup.saveStages': 'บันทึกขั้นตอน',
    'setup.type.active': 'ดำเนินการ', 'setup.type.won': 'รับเข้า', 'setup.type.lost': 'ยุติ',
    'setup.levels': 'ระดับตำแหน่ง', 'setup.levelsIntro': 'ระดับที่คุณรับสมัคร จากสูงไปต่ำ', 'setup.saveLevels': 'บันทึกระดับ', 'setup.levelsPlaceholder': 'หนึ่งระดับต่อบรรทัด เช่น Management, Manager, Supervisor, Leader, Staff, Operator',
    'setup.sources': 'แหล่งที่มาของผู้สมัคร', 'setup.sourcesIntro': 'ที่มาของผู้สมัคร — ใช้สำหรับตัวกรองและแดชบอร์ด', 'setup.addSource': '+ เพิ่มแหล่งที่มา', 'setup.saveSources': 'บันทึกแหล่งที่มา',
    'setup.scorecard': 'แบบประเมินการสัมภาษณ์', 'setup.scorecardIntro': 'เกณฑ์ที่ผู้สัมภาษณ์ให้คะแนน (1–5) “ทั่วไป” ใช้กับทุกคน “ระดับบริหาร” ใช้กับตำแหน่งผู้นำ',
    'setup.criterion': 'เกณฑ์', 'setup.group': 'กลุ่ม', 'setup.addCriterion': '+ เพิ่มเกณฑ์', 'setup.saveScorecard': 'บันทึกแบบประเมิน',

    'settings.intro': 'ตั้งแบรนด์แอป กำหนดสกุลเงิน และสำรองข้อมูล',
    'settings.branding': 'แบรนด์', 'settings.appName': 'ชื่อแอป', 'settings.saveName': 'บันทึกชื่อ', 'settings.logo': 'โลโก้',
    'settings.general': 'ทั่วไป', 'settings.currency': 'สกุลเงิน', 'settings.save': 'บันทึกการตั้งค่า',
    'settings.data': 'ข้อมูล & สำรอง', 'settings.download': 'ดาวน์โหลดข้อมูลสำรอง',
    'settings.careers': 'หน้าสมัครงาน', 'settings.careersIntro': 'หน้าสมัครงานสาธารณะที่ผู้สมัครเห็นที่ /apply แก้ไขข้อความแนะนำและข้อความยินยอม (PDPA) ทั้งภาษาอังกฤษและไทย',
    'settings.portalLink': 'ลิงก์หน้าสมัครงาน', 'settings.introEn': 'ข้อความแนะนำ (อังกฤษ)', 'settings.introTh': 'ข้อความแนะนำ (ไทย)', 'settings.pdpaEn': 'ข้อความยินยอม PDPA (อังกฤษ)', 'settings.pdpaTh': 'ข้อความยินยอม PDPA (ไทย)',
    'settings.qr': 'คิวอาร์โค้ด', 'settings.qrHint': 'ผู้สมัครสแกนด้วยกล้องมือถือเพื่อเปิดหน้าสมัครงาน พิมพ์ออกมาติดที่บอร์ดรับสมัคร ประตูโรงงาน หรือใบปลิว', 'settings.qrPrint': 'พิมพ์โปสเตอร์ QR', 'settings.qrCaption': 'สแกนเพื่อสมัครงาน — King Living Careers',
    'settings.email': 'การแจ้งเตือนทางอีเมล', 'settings.emailIntro': 'ส่งอีเมลยืนยันให้ผู้สมัครเมื่อสมัคร และแจ้ง HR (ไม่บังคับ) ใช้ได้กับ Microsoft 365 (host smtp.office365.com พอร์ต 587)',
    'settings.emailNotInstalled': 'ยังไม่ได้ติดตั้งไลบรารีอีเมล — รัน "npm install" บนเซิร์ฟเวอร์แล้วรีสตาร์ท',
    'settings.emailEnabled': 'ส่งอีเมลเมื่อมีใบสมัครใหม่', 'settings.emailHost': 'เซิร์ฟเวอร์ SMTP', 'settings.emailPort': 'พอร์ต / ความปลอดภัย', 'settings.emailUser': 'ชื่อผู้ใช้', 'settings.emailPass': 'รหัสผ่าน',
    'settings.emailFromName': 'ชื่อผู้ส่ง', 'settings.emailFromEmail': 'อีเมลผู้ส่ง', 'settings.emailHrNotify': 'แจ้ง HR ที่ (ไม่บังคับ)',
    'settings.emailTemplateHint': 'อีเมลยืนยันถึงผู้สมัคร ตัวแปร: {name}, {position}, {code}, {editLink}', 'settings.emailSubject': 'หัวข้ออีเมลยืนยัน', 'settings.emailBody': 'ข้อความยืนยัน',
    'settings.emailTestLabel': 'ส่งอีเมลทดสอบไปที่', 'settings.emailTest': 'ส่งทดสอบ', 'settings.emailTesting': 'กำลังส่ง…', 'settings.emailTestOk': 'ส่งอีเมลทดสอบแล้ว',

    'users.intro': 'บัญชีเข้าใช้งานสำหรับ HR และผู้จัดการที่รับสมัคร เชื่อมผู้จัดการกับข้อมูลบุคคลเพื่อให้เห็นเฉพาะตำแหน่งและผู้สมัครของตน',
    'users.add': '+ เพิ่มบัญชี', 'users.linkedTo': 'เชื่อมกับบุคคล', 'users.admin': 'ผู้ดูแลระบบ', 'users.setPw': 'ตั้งรหัสผ่าน', 'users.resetPw': 'รีเซ็ตรหัสผ่าน', 'users.none': 'ยังไม่มีบัญชี',
    'users.role': 'บทบาท / ตำแหน่ง', 'users.adminHint': 'ผู้ดูแลระบบ — เข้าถึงทั้งหมด',

    'apply.hero.title': 'ร่วมงานกับ King Living', 'apply.hero.apply': 'สมัครเลย', 'apply.hero.viewJobs': 'ดูตำแหน่งที่เปิดรับ',
    'apply.back': '← ย้อนกลับ', 'apply.next': 'ถัดไป', 'apply.continue': 'ดำเนินการต่อ', 'apply.cancel': 'ยกเลิก', 'apply.submit': 'ส่งใบสมัคร',
    'apply.step.consent': 'ยินยอม', 'apply.step.jobs': 'ตำแหน่ง', 'apply.step.form': 'ใบสมัคร', 'apply.step.done': 'เสร็จสิ้น',
    'apply.consent.title': 'ประกาศความเป็นส่วนตัวและการให้ความยินยอม', 'apply.consent.accept': 'ข้าพเจ้าได้อ่านและยอมรับประกาศความเป็นส่วนตัวข้างต้น',
    'apply.jobs.title': 'ตำแหน่งที่เปิดรับ', 'apply.jobs.none': 'ขณะนี้ยังไม่มีตำแหน่งที่เปิดรับ ท่านสามารถส่งใบสมัครทั่วไปได้',
    'apply.jobs.general': 'ใบสมัครทั่วไป', 'apply.jobs.generalSub': 'ยังไม่แน่ใจว่าตำแหน่งใด? สมัครแบบทั่วไปแล้ว HR จะพิจารณาให้', 'apply.jobs.applyThis': 'สมัครตำแหน่งนี้', 'apply.jobs.selected': 'สมัครตำแหน่ง',
    'apply.form.certify': 'ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ หากปรากฏภายหลังว่าไม่เป็นความจริง ข้าพเจ้ายินยอมให้บริษัทเลิกจ้างได้ทันทีโดยไม่ต้องจ่ายค่าชดเชย',
    'apply.done.title': 'ได้รับใบสมัครแล้ว', 'apply.done.msg': 'ขอบคุณค่ะ ใบสมัครของท่านถูกส่งไปยังทีม HR แล้ว กรุณาเก็บหมายเลขอ้างอิงไว้', 'apply.done.ref': 'หมายเลขอ้างอิงของท่าน', 'apply.done.another': 'ส่งใบสมัครอีกใบ',
    'apply.saveChanges': 'บันทึกการแก้ไข', 'apply.edit.banner': 'ท่านกำลังแก้ไขใบสมัครที่ส่งไปแล้ว แก้ไขข้อมูลแล้วกดบันทึก', 'apply.edit.notFound': 'ลิงก์ใบสมัครไม่ถูกต้อง', 'apply.done.updated': 'อัปเดตใบสมัครแล้ว', 'apply.done.editHint': 'ต้องการแก้ไขภายหลัง? บันทึกลิงก์ส่วนตัวนี้ไว้เพื่อแก้ไขใบสมัครของท่าน:', 'apply.upload.replace': 'เปลี่ยนไฟล์', 'apply.upload.files': 'ไฟล์',
    'apply.required': 'จำเป็น', 'apply.upload.choose': 'เลือกไฟล์', 'apply.upload.uploading': 'กำลังอัปโหลด…', 'apply.upload.uploaded': 'อัปโหลดแล้ว', 'apply.upload.hint': 'รูปภาพ (PNG/JPG) หรือ PDF ขนาดไม่เกิน 6 MB',
    'apply.addRow': '+ เพิ่มอีกรายการ', 'apply.remove': 'ลบ', 'apply.yes': 'ใช่', 'apply.no': 'ไม่', 'apply.choose': '— เลือก —',
    'apply.test.title': 'แบบทดสอบออนไลน์', 'apply.test.coming': 'จะมีแบบทดสอบออนไลน์เป็นส่วนหนึ่งของกระบวนการ ขั้นตอนนี้กำลังจะเปิดให้บริการ — HR จะติดต่อท่านเกี่ยวกับเรื่องนี้',
    'apply.sec.personal': 'ข้อมูลส่วนบุคคล', 'apply.sec.position': 'ตำแหน่งที่สมัคร', 'apply.sec.education': 'ประวัติการศึกษา', 'apply.sec.training': 'การฝึกงาน/ฝึกอบรม',
    'apply.sec.work': 'ประวัติการทำงาน', 'apply.sec.skills': 'ความชำนาญพิเศษ', 'apply.sec.other': 'ข้อมูลอื่น ๆ', 'apply.sec.screening': 'คำถามสั้น ๆ', 'apply.sec.documents': 'แนบเอกสาร',
    'apply.doc.photo': 'รูปถ่าย (2×2)', 'apply.doc.resume': 'เรซูเม่ / CV', 'apply.doc.transcript': 'เอกสารการศึกษา (ทรานสคริปต์)', 'apply.doc.idcard': 'สำเนาบัตรประชาชน', 'apply.doc.housereg': 'สำเนาทะเบียนบ้าน', 'apply.doc.other': 'อื่น ๆ (TOEIC, ใบอนุญาต, ใบรับรอง)',
  },
};
