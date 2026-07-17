'use strict';
// Tiny, dependency-free JSON document store.
// The whole database is a single JSON file. Writes are atomic (temp file + rename)
// and a .bak copy of the last good file is kept, so a crash mid-write cannot lose data.
// This keeps `npm install` bulletproof on Windows (no native modules to compile) and
// makes the data trivially easy to back up — the file syncs cleanly via OneDrive.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const TMP_PATH = path.join(DATA_DIR, 'db.json.tmp');
const BAK_PATH = path.join(DATA_DIR, 'db.json.bak');

let db = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (fs.existsSync(DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
      // Primary file corrupt — fall back to the last good backup.
      if (fs.existsSync(BAK_PATH)) {
        console.warn('[db] db.json unreadable, recovering from db.json.bak');
        db = JSON.parse(fs.readFileSync(BAK_PATH, 'utf8'));
      } else {
        throw e;
      }
    }
  } else {
    db = null;
  }
  return db;
}

function save() {
  ensureDir();
  const data = JSON.stringify(db, null, 2);
  if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, BAK_PATH);
  fs.writeFileSync(TMP_PATH, data);
  fs.renameSync(TMP_PATH, DB_PATH); // libuv renames atomically and overwrites on Windows too
}

function getDb() {
  if (db === null) load();
  return db;
}

function setDb(newDb) {
  db = newDb;
  save();
}

module.exports = { load, save, getDb, setDb, DB_PATH, BAK_PATH, DATA_DIR };
