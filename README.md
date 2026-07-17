# King Recruit

Recruitment & applicant-tracking app for the King Living factory — built on the same
software concept, layout and visual system as **King Time** and **King People**.

It manages hiring at **every level** (Management, Manager, Supervisor, Leader, Staff,
Operator…): post job openings, track candidates through a configurable pipeline, run the
board, schedule interviews and score them, all in English or Thai, in three themes.

---

## Run it

Double-click **`start-king-recruit.bat`**, or from a terminal:

```bash
npm install      # first time only — installs Express
npm start        # then open http://localhost:3200
```

First sign-in (administrator / HR):

| | |
|---|---|
| Username | `admin` |
| Password | `admin1234` |

You'll be asked to set your own password on first login. Change it any time from the sidebar.

> Runs on **port 3200** so it can sit alongside King Time (3100) and King People on the same PC.

---

## What's inside

Same dependency-free stack as the other King apps — Node + Express, a single-file JSON
store (`data/db.json`, atomic writes + `.bak`), no build step, no native modules.

**Sections (left sidebar)**

- **Dashboard** — open requisitions, pipeline funnel, hires this month, interviews due, and breakdowns by level & source. Filter by department / level.
- **Requisitions** — the job openings to fill. Level, department, hiring manager, headcount, priority, status, salary range.
- **Candidates** — everyone applying. Filter by requisition / stage / level / source, rate them, move them through the pipeline, import from CSV.
- **Pipeline** — the Kanban board. Drag a candidate from stage to stage, or use the ◀ ▶ arrows. Filter to one requisition.
- **Interviews** — schedule interviews and fill in a scorecard (the King competency set; management criteria for leadership roles) with a recommendation.
- **People** — the org / hiring managers & interviewers. *Import the list straight from King Time* (export employees to CSV there, import here).
- **Org Chart** — the reporting structure, same view as the other apps.
- **Recruitment Setup** — edit the pipeline stages, job levels, candidate sources and the interview scorecard.
- **Settings** — branding (name + logo), currency, data backup.
- **User Logins** — accounts for HR (admins) and hiring managers (scoped to their own requisitions).

---

## Bringing in your org / employee list

No personal data is bundled with the app. To load the King Living people you already
uploaded to **King Time**:

1. In King Time → **Employees** → **Export** → CSV.
2. In King Recruit → **People** → **Import** → choose that CSV.

The columns line up automatically (staff code, name, department, area, position, level,
email, phone, manager), so the org structure and the people who act as hiring managers /
interviewers come across in one step.

---

## Sample data

To make this first draft easy to look at, a few **clearly-fictional** sample requisitions
and candidates are seeded (names like *"Somchai Demo"*, *"Naree Sample"*). Delete them on
the Requisitions / Candidates pages once you start entering real openings.

---

## Public applicant portal (`/apply`)

A separate, no-login **careers page** where applicants apply online — open it at
**http://localhost:3200/apply** (linked from the HR sidebar → *Careers Page*).

Flow (modelled on the attached e-Recruitment document, bilingual EN/TH):

1. **Landing** — branded hero + intro.
2. **PDPA consent** — privacy notice (Thai PDPA) + accept checkbox.
3. **Open positions** — the requisitions HR has marked *Published*, or a general application.
4. **Application form** — one page, ten sections: personal background, position applied
   (rank 1 & 2), education by level, training, work history, special skills
   (language/computer/driving), other info (emergency contact, relatives here, how they
   heard, upcountry), per-job **screening questions**, **document uploads** (photo, résumé,
   transcript, ID card, house registration, others), and a truth certification.
5. **Confirmation** — a reference number (e.g. `CAND-0042`).
6. *Online test* — shown as **coming soon** (to be designed together later).

**What HR gets automatically:**
- Each submission becomes a **candidate in the pipeline** (first stage, source *Online application*).
- Open the candidate to see the **full application**, **screening answers**, and **download the documents**.
- Uploaded files are stored on disk in `data/uploads/` (not in the JSON DB), and only downloadable by signed-in HR users.

**HR controls (on each requisition):** a *Publish to careers portal* toggle and a
*Screening questions* editor (Yes/No or short text, with an optional "knockout" flag).
The careers intro and PDPA consent text are editable in **Settings → Careers portal**.

## Roles

- **Administrator (HR):** sees and edits everything.
- **Hiring manager:** link a login to their person record on the User Logins page — they
  then see only their own requisitions, candidates and interviews.

---

## Update — 2026-07-01 (from team testing feedback)

- **Fixed:** job description / requirements / notes (incl. Thai) now reappear correctly when you reopen a record to edit it.
- **Requisitions:** hiring manager is now a free-text field (with People suggestions) so it works even before you import staff; added an editable **Open date** alongside the target start date.
- **Interviews:** interviewer is now free-text too (type a name, or pick from People).
- **Candidates:** **Print profile** button produces a formatted "Job Application" sheet (PDF/print). **Compare** — tick candidates and view them side by side.
- **Careers portal:** built-in **QR code** on Settings → Careers (print a poster for the factory gate / job boards); the application form is now **mobile-friendly** so candidates can apply from a phone.
- **Pipeline / Candidates:** moving a candidate to the next stage keeps your place on the page.
- Clearer explanations on the **People** and **Org Chart** pages (they're for your own staff / interviewers and are optional).

**This is a code-only update** — unzip over the existing `king-recruit` folder, keeping your `data/` folder (your requisitions, candidates and users are preserved). Then restart the app.

## Update — 2026-07-04 (b)

- **Candidates can edit their own application** without an account: after submitting they get a private edit link (also shown on the confirmation page and included in the confirmation email). Opening it reloads their application to correct and resave — HR sees the update.
- **Email notifications:** configure your mail server in **Settings → Email notifications** (works with Microsoft 365: `smtp.office365.com`, port 587). Applicants get a confirmation email (with their reference and edit link); HR can optionally be notified of each new application. Includes a **Send test** button. The SMTP password is stored securely and never shown again.

> ⚠️ **This update adds a dependency (`nodemailer`).** After unzipping, **run `npm install`** in the `king-recruit` folder (or just re-run `start-king-recruit.bat`, which installs it) and restart. Until then the app still runs, but email stays off and Settings shows a reminder.

## Update — 2026-07-09 (team comments R.1)

- **Consent** replaced with your official **FRM-HR-024** statement (all 7 data categories, Thai + English). It auto-applies to your existing database on restart (no re-typing).
- **Personal background:** added **Nickname** and **Age** (age auto-calculates from the birth date).
- **Address (personal):** now structured — House no., **Subdistrict → auto-fills District, Province and Postal code** from the official Thai dataset (type the subdistrict and pick it). Includes a "present = permanent" shortcut.
- **Position:** added a **"General application — not sure"** option inside the position dropdown.
- **"How did you hear about us"** is now a **single field** to type in.
- **Documents:** you can now upload **multiple files per section**.
- **Org Chart** page removed (People stays).
- **People list:** import the 19 supervisors/managers from **`king-recruit-people-import.csv`** (delivered next to this app) via **People → Import**.

> This update adds a Thai address dataset (`public/js/thai-geo.js`). It's included in the code zip — just unzip over the folder as usual, keep your `data/`, run `npm install`, and restart.

---

*King Living · Internal use only.*
