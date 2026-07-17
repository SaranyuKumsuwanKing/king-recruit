'use strict';
// King Recruit — entry point. Boots the JSON store, seeds first-run data,
// serves the API and the single-page front end, and listens for connections.

const express = require('express');
const path = require('path');
const os = require('os');

const db = require('./src/db');
const auth = require('./src/auth');
const { seedIfNeeded, migrate, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD } = require('./src/seed');
const api = require('./src/api');

const PORT = parseInt(process.env.PORT, 10) || 3005;
const HOST = process.env.HOST || '0.0.0.0'; // listen on all interfaces so the office network can reach it

db.load();
auth.loadSessions();
seedIfNeeded();
migrate(); // bring an existing database up to date (new settings, official consent text)

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' })); // generous limit so a logo upload + bulk import fits

app.use('/api', api);
app.use(express.static(path.join(__dirname, 'public')));

// Public applicant portal (no login) lives under /apply — serve its own single-page app.
app.get(/^\/apply(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apply', 'index.html'));
});

// HR single-page-app fallback: any other non-API GET serves index.html so deep links work.
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  const ips = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const a of iface || []) {
      if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
    }
  }
  const line = '─'.repeat(54);
  console.log('\n' + line);
  console.log('  King Recruit is running');
  console.log(line);
  console.log(`  On this PC:        http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`  On the network:    http://${ip}:${PORT}`));
  console.log(line);
  console.log('  First sign-in (administrator / HR):');
  console.log(`     Username:  ${DEFAULT_ADMIN_USERNAME}`);
  console.log(`     Password:  ${DEFAULT_ADMIN_PASSWORD}`);
  console.log('  (You can change it any time from the sidebar.)');
  console.log(line);
  console.log('  Press Ctrl+C to stop.\n');
});
