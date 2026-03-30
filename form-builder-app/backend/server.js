const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── JSON File Database ────────────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'db.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) return { forms: {}, submissions: {} };
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { forms: {}, submissions: {} }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Forms ─────────────────────────────────────────────────────────────────────

// List all forms
app.get('/api/forms', (req, res) => {
  const db = readDB();
  const forms = Object.values(db.forms)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      created_at: f.created_at,
      updated_at: f.updated_at,
      submissionCount: (db.submissions[f.id] || []).length,
    }));
  res.json(forms);
});

// Get single form
app.get('/api/forms/:id', (req, res) => {
  const db = readDB();
  const form = db.forms[req.params.id];
  if (!form) return res.status(404).json({ error: 'Form not found' });
  res.json(form);
});

// Create form
app.post('/api/forms', (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const db = readDB();
  const id = uuidv4();
  const now = new Date().toISOString();
  const form = {
    id, name: name.trim(),
    description: description || '',
    schema: { fields: [] },
    created_at: now, updated_at: now,
  };
  db.forms[id] = form;
  db.submissions[id] = [];
  writeDB(db);
  res.status(201).json(form);
});

// Update form
app.put('/api/forms/:id', (req, res) => {
  const db = readDB();
  const form = db.forms[req.params.id];
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const { name, description, schema } = req.body;
  if (name !== undefined) form.name = name.trim();
  if (description !== undefined) form.description = description;
  if (schema !== undefined) form.schema = schema;
  form.updated_at = new Date().toISOString();

  db.forms[req.params.id] = form;
  writeDB(db);
  res.json(form);
});

// Delete form
app.delete('/api/forms/:id', (req, res) => {
  const db = readDB();
  if (!db.forms[req.params.id]) return res.status(404).json({ error: 'Form not found' });
  delete db.forms[req.params.id];
  delete db.submissions[req.params.id];
  writeDB(db);
  res.json({ success: true });
});

// ── Submissions ───────────────────────────────────────────────────────────────

// Submit form (auto-generated REST endpoint per form)
app.post('/api/forms/:id/submit', (req, res) => {
  const db = readDB();
  const form = db.forms[req.params.id];
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const data = req.body;
  // Validate fields using validate object (falls back to top-level required)
  const errors = {};
  for (const field of (form.schema?.fields || [])) {
    if (!field.key) continue;
    const v = field.validate || {};
    const isRequired = v.required || field.required;
    const val = data[field.key];
    const isEmpty = val === undefined || val === null || val === '' || val === false;

    if (isRequired && isEmpty) {
      errors[field.key] = v.customMessage || `${field.label} is required`;
      continue;
    }
    if (!isEmpty) {
      const strVal = String(val);
      if (v.minLength && strVal.length < Number(v.minLength))
        errors[field.key] = v.customMessage || `${field.label} must be at least ${v.minLength} characters`;
      else if (v.maxLength && strVal.length > Number(v.maxLength))
        errors[field.key] = v.customMessage || `${field.label} must be at most ${v.maxLength} characters`;
      else if (v.min !== '' && v.min != null && Number(val) < Number(v.min))
        errors[field.key] = v.customMessage || `${field.label} must be at least ${v.min}`;
      else if (v.max !== '' && v.max != null && Number(val) > Number(v.max))
        errors[field.key] = v.customMessage || `${field.label} must be at most ${v.max}`;
      else if (v.pattern) {
        try { if (!new RegExp(v.pattern).test(strVal)) errors[field.key] = v.customMessage || `${field.label} has an invalid format`; }
        catch { /* bad regex — skip */ }
      }
    }
  }
  if (Object.keys(errors).length > 0) return res.status(422).json({ errors });

  const submission = {
    id: uuidv4(),
    form_id: req.params.id,
    data,
    submitted_at: new Date().toISOString(),
  };
  if (!db.submissions[req.params.id]) db.submissions[req.params.id] = [];
  db.submissions[req.params.id].unshift(submission);
  writeDB(db);
  res.status(201).json({ id: submission.id, submitted_at: submission.submitted_at, message: 'Submission received successfully' });
});

// List submissions
app.get('/api/forms/:id/submissions', (req, res) => {
  const db = readDB();
  if (!db.forms[req.params.id]) return res.status(404).json({ error: 'Form not found' });
  res.json(db.submissions[req.params.id] || []);
});

// Export CSV
app.get('/api/forms/:id/submissions/export', (req, res) => {
  const db = readDB();
  const form = db.forms[req.params.id];
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const dataFields = (form.schema?.fields || []).filter(f => f.key);
  const submissions = db.submissions[req.params.id] || [];

  const esc = (v) => {
    if (v === undefined || v === null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headers = ['id', 'submitted_at', ...dataFields.map(f => f.label || f.key)].join(',');
  const rows = submissions.map(s =>
    [s.id, s.submitted_at, ...dataFields.map(f => esc(s.data[f.key]))].join(',')
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${form.name.replace(/[^a-z0-9]/gi, '_')}-submissions.csv"`);
  res.send([headers, ...rows].join('\n'));
});

// Delete submission
app.delete('/api/forms/:formId/submissions/:subId', (req, res) => {
  const db = readDB();
  const list = db.submissions[req.params.formId];
  if (!list) return res.status(404).json({ error: 'Not found' });
  const idx = list.findIndex(s => s.id === req.params.subId);
  if (idx === -1) return res.status(404).json({ error: 'Submission not found' });
  list.splice(idx, 1);
  writeDB(db);
  res.json({ success: true });
});

// ── Serve React frontend (production build) ───────────────────────────────────
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // React Router catch-all — must come after all API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`\n  FormBuilder  →  ${url}`);
  console.log(`  API          →  ${url}/api/forms\n`);
});
