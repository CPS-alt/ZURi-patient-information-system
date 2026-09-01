const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const appRoot = __dirname;
const dataDir = path.join(appRoot, 'data');
const dbPath = path.join(dataDir, 'zuri.db');
const csvSeedPath = path.join(__dirname, '..', 'prototype-data', 'mtwara_iringa_patient_seed.csv');
const duplicateCandidatesPath = path.join(__dirname, '..', 'prototype-data', 'duplicate_patient_candidates.csv');
const publicDir = path.join(appRoot, 'public');

const USER_ROLES = {
  admin: { username: 'admin', password: 'zuri2026', displayName: 'Josh (NOVA CEO)', role: 'admin' },
  clinician: { username: 'clinician', password: 'clinician123', displayName: 'Dr. Amina', role: 'clinician' },
  campaign_manager: { username: 'campaign', password: 'campaign123', displayName: 'Campaign Lead', role: 'campaign_manager' }
};

const VALID_ROLES = ['admin', 'clinician', 'country_manager', 'non_surgical_staff', 'clinical_coordinator', 'campaign_manager'];

function normalizeRole(role) {
  if (!role) return role;
  if (role === 'administrator') return 'admin';
  if (role === 'campaign-manager') return 'campaign_manager';
  if (role === 'campaign_manager') return 'campaign_manager';
  if (role === 'countryManager') return 'country_manager';
  if (role === 'country-manager') return 'country_manager';
  if (role === 'nonSurgicalStaff') return 'non_surgical_staff';
  if (role === 'non-surgical-staff') return 'non_surgical_staff';
  if (role === 'clinicalCoordinator') return 'clinical_coordinator';
  if (role === 'clinical-coordinator') return 'clinical_coordinator';
  return role;
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: 'text/csv' }));
app.use(session({
  secret: 'zuri-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(publicDir));

let db;

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizePhone = (value) => normalizeText(value).replace(/[^\d+]/g, '').replace(/^\+?255/, '255');

function loadDuplicateCandidatePairs() {
  try {
    if (!fs.existsSync(duplicateCandidatesPath)) return [];
    const content = fs.readFileSync(duplicateCandidatesPath, 'utf8');
    const rows = content.split(/\r?\n/).filter(Boolean);
    if (rows.length < 2) return [];
    const headers = rows[0].split(',');
    const pairs = [];
    for (let i = 1; i < rows.length; i += 1) {
      const values = rows[i].split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] ? values[index].trim() : '';
      });
      if (row.phone || row.patient_uid_1 || row.patient_uid_2) {
        pairs.push(row);
      }
    }
    return pairs;
  } catch (error) {
    console.error('Duplicate candidate import failed:', error.message);
    return [];
  }
}

const normalizeRow = (row) => ({
  region: normalizeText(row.region),
  source_file: normalizeText(row.source_file),
  patient_id: normalizeText(row.OSI_Mission_ID) ? `OS-TZ-${String(normalizeText(row.OSI_Mission_ID)).padStart(8, '0')}` : normalizeText(row.patient_id),
  patient_uid: normalizeText(row.Patient_UID),
  first_name: normalizeText(row.First_Name),
  last_name: normalizeText(row.Last_Name),
  full_name: normalizeText(row.Full_Name),
  gender: normalizeText(row.Gender),
  date_of_birth: normalizeText(row.Date_of_Birth).split(' ')[0],
  country_of_birth: normalizeText(row.Country_of_Birth),
  unique_record: normalizeText(row.Unique_Record),
  phone: normalizePhone(row.Phone),
  age_yr_mth: normalizeText(row.Age_yr_mth),
  age_yr: Number.parseInt(normalizeText(row.Age_yr), 10) || null,
  age_mth: Number.parseInt(normalizeText(row.Age_mth), 10) || null,
  travel_duration_hours: normalizeText(row.Travel_duration_hours),
  cleared_for_surgery: normalizeText(row.Cleared_for_surgery),
  allergies: normalizeText(row.Allergies),
  hb: normalizeText(row.Hb),
  hct: normalizeText(row.Hct),
  weight_kg: normalizeText(row.Weight_KG),
  recommended_surgery_1: normalizeText(row.Recommended_surgery_1),
  recommended_surgery_2: normalizeText(row.Recommended_surgery_2),
  surgery_priority: normalizeText(row.Surgery_priority),
  surgery_status: normalizeText(row.Surgery_Status),
  procedure: normalizeText(row.Procedure),
  procedure_1: normalizeText(row.Procedure_1),
  procedure_2: normalizeText(row.Procedure_2),
  surgery_outcome: normalizeText(row.Surgery_Outcome),
  follow_up_date: normalizeText(row.Follow_up_date),
  follow_up_status: normalizeText(row.Follow_up_status)
});

function ensureAuthenticated(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

function ensureRole(roles) {
  return (req, res, next) => {
    const role = normalizeRole(req.session.user && req.session.user.role);
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: 'Access denied for this role.' });
    }
    next();
  };
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function logActivity(actor, action, details = {}) {
  if (!db) return;
  try {
    await dbRun('INSERT INTO audit_logs (actor, action, details, created_at) VALUES (?, ?, ?, ?)', [
      actor,
      action,
      JSON.stringify(details),
      new Date().toISOString()
    ]);
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
}

function normalizeContinuityStage(rawValue, stage) {
  const value = normalizeText(rawValue).toLowerCase();
  if (!value) {
    return stage === 'before' ? 'screened' : 'surgery performed';
  }

  if (value === 'yes' || value === 'y') {
    return stage === 'before' ? 'screened' : 'surgery performed';
  }

  if (/(screened|eligible|awaiting|pending|deferred|follow-up|not eligible|review)/i.test(value)) {
    return 'screened';
  }

  if (/(surgery|operation|operated|performed|completed|post-op|discharge|done)/i.test(value)) {
    return 'surgery performed';
  }

  return stage === 'before' ? 'screened' : 'surgery performed';
}

function hasSurgeryBeenPerformed(rawValue) {
  const value = normalizeText(rawValue).toLowerCase();
  if (!value || value === 'no' || value === 'n') {
    return false;
  }
  if (value === 'yes' || value === 'y') {
    return true;
  }
  return /(surgery|operation|operated|performed|completed|post-op|discharge|done)/i.test(value);
}

function computeContinuityMatches(rows) {
  const normalized = rows.map((row) => ({
    ...row,
    normalizedPhone: normalizePhone(row.phone),
    normalizedName: normalizeText(row.full_name || `${row.first_name || ''} ${row.last_name || ''}`).toLowerCase()
  }));

  const duplicatePairs = loadDuplicateCandidatePairs();
  const matches = [];

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i];
      const b = normalized[j];
      let score = 0;
      const reasons = [];

      if (a.normalizedPhone && a.normalizedPhone === b.normalizedPhone) {
        score += 70;
        reasons.push('same phone');
      }
      if (a.normalizedName && b.normalizedName && a.normalizedName === b.normalizedName) {
        score += 35;
        reasons.push('same name');
      }
      if (a.date_of_birth && b.date_of_birth && a.date_of_birth === b.date_of_birth) {
        score += 25;
        reasons.push('same DOB');
      }
      if (a.region && b.region && a.region !== b.region) {
        score += 10;
        reasons.push('cross-region movement');
      }
      if (a.patient_uid && b.patient_uid && a.patient_uid === b.patient_uid) {
        score += 30;
        reasons.push('same UID');
      }

      if (score >= 50) {
        const aSurgeryDone = hasSurgeryBeenPerformed(a.surgery_status || a.follow_up_status || a.cleared_for_surgery);
        const bSurgeryDone = hasSurgeryBeenPerformed(b.surgery_status || b.follow_up_status || b.cleared_for_surgery);

        const beforeStatus = normalizeContinuityStage(a.surgery_status || a.follow_up_status || a.cleared_for_surgery || 'screened', 'before');
        const afterStatus = normalizeContinuityStage(b.surgery_status || b.follow_up_status || b.cleared_for_surgery || 'screened', 'after');

        matches.push({
          id: `${a.id}-${b.id}`,
          patientA: {
            id: a.id,
            patient_id: a.patient_id,
            full_name: a.full_name,
            region: a.region,
            phone: a.phone,
            surgery_status: a.surgery_status,
            follow_up_status: a.follow_up_status,
            cleared_for_surgery: a.cleared_for_surgery
          },
          patientB: {
            id: b.id,
            patient_id: b.patient_id,
            full_name: b.full_name,
            region: b.region,
            phone: b.phone,
            surgery_status: b.surgery_status,
            follow_up_status: b.follow_up_status,
            cleared_for_surgery: b.cleared_for_surgery
          },
          statusBefore: beforeStatus || 'screened',
          statusAfter: bSurgeryDone ? 'surgery performed' : (afterStatus || 'screened'),
          score: `${Math.min(score, 99)}%`,
          reasons: reasons.slice(0, 3),
          note: a.region !== b.region ? 'Likely same patient across regions' : 'Potential duplicate within region',
          isResolved: aSurgeryDone || bSurgeryDone
        });
      }
    }
  }

  duplicatePairs.forEach((pair) => {
    const first = normalized.find((patient) => patient.region && patient.patient_uid && patient.region.toUpperCase() === normalizeText(pair.region_1).toUpperCase() && patient.patient_uid.toUpperCase() === normalizeText(pair.patient_uid_1).toUpperCase());
    const second = normalized.find((patient) => patient.region && patient.patient_uid && patient.region.toUpperCase() === normalizeText(pair.region_2).toUpperCase() && patient.patient_uid.toUpperCase() === normalizeText(pair.patient_uid_2).toUpperCase());
    if (!first || !second) return;

    const firstDone = hasSurgeryBeenPerformed(first.surgery_status || first.follow_up_status || first.cleared_for_surgery);
    const secondDone = hasSurgeryBeenPerformed(second.surgery_status || second.follow_up_status || second.cleared_for_surgery);
    matches.push({
      id: `duplicate-${first.id}-${second.id}`,
      patientA: {
        id: first.id,
        patient_id: first.patient_id,
        full_name: first.full_name,
        region: first.region,
        phone: first.phone,
        surgery_status: first.surgery_status,
        follow_up_status: first.follow_up_status,
        cleared_for_surgery: first.cleared_for_surgery
      },
      patientB: {
        id: second.id,
        patient_id: second.patient_id,
        full_name: second.full_name,
        region: second.region,
        phone: second.phone,
        surgery_status: second.surgery_status,
        follow_up_status: second.follow_up_status,
        cleared_for_surgery: second.cleared_for_surgery
      },
      statusBefore: normalizeContinuityStage(first.surgery_status || first.follow_up_status || first.cleared_for_surgery || 'screened', 'before'),
      statusAfter: secondDone ? 'surgery performed' : normalizeContinuityStage(second.surgery_status || second.follow_up_status || second.cleared_for_surgery || 'screened', 'after'),
      score: '96%',
      reasons: ['same UID', 'cross-region movement'],
      note: 'Duplicate patient candidate from supplied continuity spreadsheet',
      isResolved: firstDone || secondDone
    });
  });

  return matches.slice(0, 20);
}

function buildDashboardSnapshot(patients, continuityMatches = []) {
  const activeContinuityMatches = continuityMatches.filter((match) => !match.isResolved);
  const byRegion = {};
  const byStatus = {};
  const regionBreakdown = {};
  let eligible = 0;
  let followUpDue = 0;

  patients.forEach((patient) => {
    const region = normalizeText(patient.region || 'Unknown');
    const regionKey = region || 'Unknown';
    byRegion[regionKey] = (byRegion[regionKey] || 0) + 1;

    if (!regionBreakdown[regionKey]) {
      regionBreakdown[regionKey] = { registered: 0, screened: 0, eligible: 0, operated: 0, deferred: 0, followUpDue: 0 };
    }
    regionBreakdown[regionKey].registered += 1;

    const status = normalizeText(patient.surgery_status || patient.follow_up_status || 'Pending');
    byStatus[status] = (byStatus[status] || 0) + 1;

    const statusLower = status.toLowerCase();
    const cleared = normalizeText(patient.cleared_for_surgery).toLowerCase();
    const surgeryDone = hasSurgeryBeenPerformed(patient.surgery_status || patient.follow_up_status || patient.cleared_for_surgery || patient.surgery_outcome || '');

    if (cleared === 'yes' || cleared === 'y' || /eligible|screened/.test(statusLower) || (patient.recommended_surgery_1 && !/not eligible|deferred|not operated/.test(statusLower))) {
      regionBreakdown[regionKey].screened += 1;
    }

    if (/eligible|cleared|ready/.test(statusLower) || /yes|y/.test(cleared) || (patient.recommended_surgery_1 && /yes|y/.test(cleared))) {
      eligible += 1;
      regionBreakdown[regionKey].eligible += 1;
    }

    if (surgeryDone || /operated|surgery performed|completed|done/.test(statusLower) || /surgery/.test(normalizeText(patient.surgery_outcome || ''))) {
      regionBreakdown[regionKey].operated += 1;
    }

    if (/defer|decline|not eligible|not eligible|pending/.test(statusLower) || /defer|decline/.test(normalizeText(patient.follow_up_status || ''))) {
      regionBreakdown[regionKey].deferred += 1;
    }

    if (/follow|pending|review|overdue|defer|not eligible/.test(statusLower) || /follow-up|pending|review/.test(normalizeText(patient.follow_up_status || ''))) {
      followUpDue += 1;
      regionBreakdown[regionKey].followUpDue += 1;
    }
  });

  const aiInsights = [
    {
      title: 'Continuity alert',
      detail: `${activeContinuityMatches.length} likely patient continuity matches are active across regions.`,
      severity: 'high'
    },
    {
      title: 'Regional demand',
      detail: `Highest volume is currently ${Object.entries(byRegion).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'} with ${Object.entries(byRegion).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} records.`,
      severity: 'medium'
    },
    {
      title: 'Follow-up focus',
      detail: `${followUpDue} patients require review for follow-up or pending surgical status.`,
      severity: 'medium'
    }
  ];

  const campaigns = Object.entries(byRegion).map(([label, value]) => ({
    name: label,
    patients: value,
    status: `${Math.min(Math.round((value / Math.max(patients.length, 1)) * 100), 100)}% of total flow`
  }));

  return {
    total: patients.length,
    regions: Object.entries(byRegion).map(([label, value]) => ({ label, value })),
    regionBreakdown,
    statuses: Object.entries(byStatus).map(([label, value]) => ({ label, value })),
    recent: patients.slice(0, 5).map((patient) => ({
      patient_id: patient.patient_id,
      full_name: patient.full_name,
      region: patient.region,
      status: patient.surgery_status || patient.follow_up_status || 'Pending'
    })),
    summary: {
      eligible,
      followUpDue,
      continuityAlerts: activeContinuityMatches.length
    },
    campaigns,
    alerts: activeContinuityMatches.slice(0, 3),
    aiInsights
  };
}

async function initializeDatabase() {
  await fs.promises.mkdir(dataDir, { recursive: true });
  if (!db) {
    db = new sqlite3.Database(dbPath);
  }

  await new Promise((resolve, reject) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region TEXT,
        source_file TEXT,
        patient_id TEXT,
        patient_uid TEXT,
        first_name TEXT,
        last_name TEXT,
        full_name TEXT,
        gender TEXT,
        date_of_birth TEXT,
        country_of_birth TEXT,
        unique_record TEXT,
        phone TEXT,
        age_yr_mth TEXT,
        age_yr INTEGER,
        age_mth INTEGER,
        travel_duration_hours TEXT,
        cleared_for_surgery TEXT,
        allergies TEXT,
        hb TEXT,
        hct TEXT,
        weight_kg TEXT,
        recommended_surgery_1 TEXT,
        recommended_surgery_2 TEXT,
        surgery_priority TEXT,
        surgery_status TEXT,
        procedure TEXT,
        procedure_1 TEXT,
        procedure_2 TEXT,
        surgery_outcome TEXT,
        follow_up_date TEXT,
        follow_up_status TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT,
        action TEXT,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        email TEXT UNIQUE,
        role TEXT DEFAULT 'clinician',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `, (err) => err ? reject(err) : resolve());
  });

  const existingCount = await dbGet('SELECT COUNT(*) AS total FROM patients');
  const csvRowCount = await new Promise((resolve, reject) => {
    let count = 0;
    fs.createReadStream(csvSeedPath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', () => {
        count += 1;
      })
      .on('end', () => resolve(count))
      .on('error', (error) => reject(error));
  });

  if (!existingCount || existingCount.total !== csvRowCount) {
    await dbRun('DELETE FROM patients');
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvSeedPath)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('data', (row) => {
          if (Object.keys(row).length > 0) rows.push(normalizeRow(row));
        })
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });

    for (const row of rows) {
      if (!row.patient_id && !row.full_name) continue;
      await dbRun(`
        INSERT INTO patients (
          region, source_file, patient_id, patient_uid, first_name, last_name, full_name,
          gender, date_of_birth, country_of_birth, unique_record, phone, age_yr_mth,
          age_yr, age_mth, travel_duration_hours, cleared_for_surgery, allergies,
          hb, hct, weight_kg, recommended_surgery_1, recommended_surgery_2,
          surgery_priority, surgery_status, procedure, procedure_1, procedure_2,
          surgery_outcome, follow_up_date, follow_up_status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        row.region,
        row.source_file,
        row.patient_id,
        row.patient_uid,
        row.first_name,
        row.last_name,
        row.full_name,
        row.gender,
        row.date_of_birth,
        row.country_of_birth,
        row.unique_record,
        row.phone,
        row.age_yr_mth,
        row.age_yr,
        row.age_mth,
        row.travel_duration_hours,
        row.cleared_for_surgery,
        row.allergies,
        row.hb,
        row.hct,
        row.weight_kg,
        row.recommended_surgery_1,
        row.recommended_surgery_2,
        row.surgery_priority,
        row.surgery_status,
        row.procedure,
        row.procedure_1,
        row.procedure_2,
        row.surgery_outcome,
        row.follow_up_date,
        row.follow_up_status,
        new Date().toISOString()
      ]);
    }
  }
}

app.get('/api/session', (req, res) => {
  res.json({ authenticated: !!req.session.user, user: req.session.user || null });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  
  // Check hardcoded USER_ROLES first
  const entry = Object.values(USER_ROLES).find((user) => user.username === username && user.password === password);
  if (entry) {
    const normalizedRole = normalizeRole(entry.role);
    req.session.user = { username: entry.username, role: normalizedRole, displayName: entry.displayName || entry.username };
    await logActivity(entry.username, 'login', { role: normalizedRole, at: new Date().toISOString() });
    return res.json({ ok: true, user: req.session.user });
  }

  // Check database users
  try {
    const dbUser = await dbGet('SELECT id, username, password, full_name, role FROM users WHERE username = ?', [username]);
    if (dbUser && dbUser.password === password) {
      const displayName = dbUser.full_name || dbUser.username;
      const normalizedRole = normalizeRole(dbUser.role);
      req.session.user = { username: dbUser.username, role: normalizedRole, displayName };
      await logActivity(dbUser.username, 'login', { role: normalizedRole, at: new Date().toISOString() });
      return res.json({ ok: true, user: req.session.user });
    }
  } catch (dbError) {
    console.error('Database login error:', dbError);
  }

  return res.status(401).json({ error: 'Invalid credentials.' });
});

app.post('/api/signup', async (req, res) => {
  const { fullName, email, username, password, role } = req.body || {};

  if (!fullName || !email || !username || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected.' });
  }

  try {
    // Check if username already exists
    const existing = await dbGet('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    // Insert new user
    const result = await dbRun(
      'INSERT INTO users (username, password, full_name, email, role) VALUES (?, ?, ?, ?, ?)',
      [username, password, fullName, email, role]
    );

    await logActivity(username, 'signup', { role, email, at: new Date().toISOString() });
    return res.json({ ok: true, id: result.id, message: 'Account created successfully.' });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

app.post('/api/logout', (req, res) => {
  const actor = req.session.user ? req.session.user.username : 'guest';
  req.session.destroy(() => {
    logActivity(actor, 'logout', { at: new Date().toISOString() }).finally(() => {
      res.json({ ok: true });
    });
  });
});

app.get('/api/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const patients = await dbAll('SELECT * FROM patients ORDER BY full_name');
    const continuityMatches = computeContinuityMatches(patients);
    const snapshot = buildDashboardSnapshot(patients, continuityMatches);
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/continuity', ensureAuthenticated, async (req, res) => {
  try {
    const patients = await dbAll('SELECT * FROM patients');
    res.json(computeContinuityMatches(patients));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit', ensureAuthenticated, ensureRole(['admin', 'clinician']), async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients', ensureAuthenticated, async (req, res) => {
  const query = (req.query.q || '').trim();
  let sql = 'SELECT * FROM patients ORDER BY full_name ASC LIMIT 200';
  const params = [];

  if (query) {
    sql = `
      SELECT * FROM patients
      WHERE lower(full_name) LIKE ?
         OR lower(patient_id) LIKE ?
         OR lower(patient_uid) LIKE ?
         OR lower(phone) LIKE ?
      ORDER BY full_name ASC
      LIMIT 50
    `;
    const likeQuery = `%${query.toLowerCase()}%`;
    params.push(likeQuery, likeQuery, likeQuery, likeQuery);
  }

  try {
    const rows = await dbAll(sql, params);
    res.json(rows.map((row) => ({
      ...row,
      displayStatus: row.surgery_status || row.follow_up_status || 'Pending'
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/:id', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const patient = await dbGet('SELECT * FROM patients WHERE id = ? OR patient_id = ?', [Number(id), id]);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/patients/:id', ensureAuthenticated, ensureRole(['admin', 'clinician']), async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};

  const fields = [
    'region', 'source_file', 'patient_id', 'patient_uid', 'first_name', 'last_name', 'full_name',
    'gender', 'date_of_birth', 'country_of_birth', 'unique_record', 'phone', 'age_yr_mth',
    'age_yr', 'age_mth', 'travel_duration_hours', 'cleared_for_surgery', 'allergies', 'hb',
    'hct', 'weight_kg', 'recommended_surgery_1', 'recommended_surgery_2', 'surgery_priority',
    'surgery_status', 'procedure', 'procedure_1', 'procedure_2', 'surgery_outcome', 'follow_up_date', 'follow_up_status'
  ];

  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  const values = fields.map((field) => payload[field] ?? null);
  values.push(new Date().toISOString(), Number(id));

  try {
    const result = await dbRun(`UPDATE patients SET ${assignments}, updated_at = ? WHERE id = ?`, values);
    const patient = await dbGet('SELECT * FROM patients WHERE id = ?', [Number(id)]);
    await logActivity(req.session.user.username, 'update_patient', { patient_id: patient && patient.patient_id, changes: result.changes, at: new Date().toISOString() });
    res.json({ ok: true, patient, changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/patients/export', ensureAuthenticated, ensureRole(['admin', 'clinician', 'campaign_manager']), async (req, res) => {
  const rows = await dbAll('SELECT * FROM patients ORDER BY full_name ASC');
  const headers = [
    'id', 'region', 'patient_id', 'patient_uid', 'first_name', 'last_name', 'full_name', 'gender',
    'date_of_birth', 'country_of_birth', 'phone', 'age_yr_mth', 'weight_kg', 'allergies',
    'cleared_for_surgery', 'procedure', 'surgery_status', 'follow_up_status', 'follow_up_date'
  ];

  const content = [headers.join(',')].concat(rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(','))).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="zuri-patient-export.csv"');
  res.send(content);
});

app.post('/api/patients/import', ensureAuthenticated, ensureRole(['admin', 'clinician']), async (req, res) => {
  const csvText = typeof req.body === 'string' ? req.body : '';

  if (!csvText || !csvText.trim()) {
    return res.status(400).json({ error: 'No CSV content supplied.' });
  }

  try {
    const items = [];
    await new Promise((resolve, reject) => {
      Readable.from([csvText])
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('data', (row) => items.push(normalizeRow(row)))
        .on('end', resolve)
        .on('error', reject);
    });

    let count = 0;
    for (const row of items) {
      if (!row.patient_id && !row.full_name) continue;
      const existing = await dbGet('SELECT id FROM patients WHERE patient_id = ? OR patient_uid = ?', [row.patient_id || '', row.patient_uid || '']);
      if (existing) {
        await dbRun(`UPDATE patients SET region=?, source_file=?, patient_id=?, patient_uid=?, first_name=?, last_name=?, full_name=?, gender=?, date_of_birth=?, country_of_birth=?, unique_record=?, phone=?, age_yr_mth=?, age_yr=?, age_mth=?, travel_duration_hours=?, cleared_for_surgery=?, allergies=?, hb=?, hct=?, weight_kg=?, recommended_surgery_1=?, recommended_surgery_2=?, surgery_priority=?, surgery_status=?, procedure=?, procedure_1=?, procedure_2=?, surgery_outcome=?, follow_up_date=?, follow_up_status=?, updated_at=? WHERE id=?`, [
          row.region,
          row.source_file,
          row.patient_id,
          row.patient_uid,
          row.first_name,
          row.last_name,
          row.full_name,
          row.gender,
          row.date_of_birth,
          row.country_of_birth,
          row.unique_record,
          row.phone,
          row.age_yr_mth,
          row.age_yr,
          row.age_mth,
          row.travel_duration_hours,
          row.cleared_for_surgery,
          row.allergies,
          row.hb,
          row.hct,
          row.weight_kg,
          row.recommended_surgery_1,
          row.recommended_surgery_2,
          row.surgery_priority,
          row.surgery_status,
          row.procedure,
          row.procedure_1,
          row.procedure_2,
          row.surgery_outcome,
          row.follow_up_date,
          row.follow_up_status,
          new Date().toISOString(),
          existing.id
        ]);
      } else {
        await dbRun(`
          INSERT INTO patients (
            region, source_file, patient_id, patient_uid, first_name, last_name, full_name,
            gender, date_of_birth, country_of_birth, unique_record, phone, age_yr_mth,
            age_yr, age_mth, travel_duration_hours, cleared_for_surgery, allergies,
            hb, hct, weight_kg, recommended_surgery_1, recommended_surgery_2,
            surgery_priority, surgery_status, procedure, procedure_1, procedure_2,
            surgery_outcome, follow_up_date, follow_up_status, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          row.region,
          row.source_file,
          row.patient_id,
          row.patient_uid,
          row.first_name,
          row.last_name,
          row.full_name,
          row.gender,
          row.date_of_birth,
          row.country_of_birth,
          row.unique_record,
          row.phone,
          row.age_yr_mth,
          row.age_yr,
          row.age_mth,
          row.travel_duration_hours,
          row.cleared_for_surgery,
          row.allergies,
          row.hb,
          row.hct,
          row.weight_kg,
          row.recommended_surgery_1,
          row.recommended_surgery_2,
          row.surgery_priority,
          row.surgery_status,
          row.procedure,
          row.procedure_1,
          row.procedure_2,
          row.surgery_outcome,
          row.follow_up_date,
          row.follow_up_status,
          new Date().toISOString()
        ]);
      }
      count += 1;
    }

    await logActivity(req.session.user.username, 'import_csv', { imported_count: count, at: new Date().toISOString() });
    res.json({ ok: true, imported: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(['/','/ZURi.patient-information-system'], (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function start() {
  try {
    await initializeDatabase();
  app.listen(PORT, '0.0.0.0', () => {
      console.log(`ZURi system running on http://localhost:${PORT}`);
    console.log(`ZURi system network access: http://0.0.0.0:${PORT}`);
  });
} catch (error) {
  console.error('Failed to initialize ZURi database:', error);
  process.exit(1);
}
}

start();
