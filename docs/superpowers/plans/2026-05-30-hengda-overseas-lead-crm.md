# Hengda Overseas Lead CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Chinese web MVP for managing overseas fiberglass yarn and fiberglass fabric leads, generating English outreach drafts, and sending one reviewed email at a time through SMTP.

**Architecture:** Use a small Node.js local server with built-in HTTP routing, built-in SQLite persistence, and a static browser UI. Keep the business logic in focused service modules so SMTP, AI drafting, compliance checks, and lead management can be tested independently.

**Tech Stack:** Node.js 26, npm, `node:sqlite`, `node:test`, static HTML/CSS/JS, Node built-in `tls`/`net` for SMTP, built-in `fetch` for optional AI API calls.

---

## Repository State

The workspace currently contains documentation and templates only. It is not a git repository. Do not claim commits were made unless a git repository is initialized later.

Existing files to preserve:

- `docs/hengda-templates/*.md`
- `docs/hengda-product-email-templates.md`
- `docs/hengda-mvp-wireframe.html`
- `docs/superpowers/specs/2026-05-30-hengda-overseas-lead-crm-design.md`

## File Structure

Create these files:

- `package.json`: npm scripts and dependency declaration.
- `.gitignore`: local database, secrets, dependencies, logs.
- `.env.example`: documented local configuration without secrets.
- `src/config.js`: read environment variables and provide safe defaults.
- `src/db/schema.sql`: SQLite tables and seed records.
- `src/db/database.js`: database open, migration, transaction helpers.
- `src/repositories/leads.js`: CRUD and status updates for leads.
- `src/repositories/products.js`: CRUD for product records.
- `src/repositories/drafts.js`: CRUD and status updates for email drafts.
- `src/repositories/events.js`: contact event creation and listing.
- `src/repositories/settings.js`: app setting storage excluding raw SMTP password by default.
- `src/services/compliance.js`: send guard checks.
- `src/services/templates.js`: English email template selection and rendering.
- `src/services/aiDraft.js`: optional AI draft generation with template fallback.
- `src/services/smtpMailer.js`: single-email SMTP send using Node built-ins.
- `src/services/followups.js`: follow-up date calculation and listing.
- `src/server/router.js`: minimal JSON/static route dispatcher.
- `src/server/api.js`: API handlers.
- `src/server/static.js`: static file serving.
- `src/server/index.js`: app entrypoint.
- `public/index.html`: Chinese CRM shell.
- `public/styles.css`: approved dashboard visual style adapted from `docs/hengda-mvp-wireframe.html`.
- `public/app.js`: browser-side state, form handling, API calls.
- `tests/compliance.test.js`: send guard coverage.
- `tests/templates.test.js`: fallback draft generation coverage.
- `tests/repositories.test.js`: database CRUD coverage.
- `tests/api.test.js`: local API behavior coverage.
- `README.md`: local setup, run, test, SMTP and AI configuration.

Modify these files:

- None required.

## Implementation Tasks

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Create `package.json`**

Use this exact content:

```json
{
  "name": "hengda-overseas-lead-crm",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node src/server/index.js",
    "start": "node src/server/index.js",
    "test": "node --test tests/*.test.js",
    "init-db": "node src/db/database.js --init"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

- [ ] **Step 2: Create `.gitignore`**

Use this exact content:

```gitignore
node_modules/
.env
data/
*.log
.DS_Store
Thumbs.db
.superpowers/
```

- [ ] **Step 3: Create `.env.example`**

Use this exact content:

```env
PORT=5173
DATABASE_PATH=data/hengda-crm.sqlite

COMPANY_NAME=Qinhuangdao Hengda Fiberglass Co., Ltd.
COMPANY_WEBSITE=https://www.hengdaboxian.com/
COMPANY_ADDRESS=No. 16 Jingbohu Road, Economic and Technological Development Zone, Qinhuangdao, Hebei, China

SMTP_HOST=smtp.zmail300.cn
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=sales@hengdaboxian.com
SMTP_PASS=
SMTP_FROM=sales@hengdaboxian.com

AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
```

- [ ] **Step 4: Create initial `README.md`**

Use this exact content:

```markdown
# Hengda Overseas Lead CRM

Local MVP for managing overseas fiberglass yarn and fiberglass fabric leads.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
copy .env.example .env
```

3. Edit `.env` and fill SMTP credentials.

4. Initialize the database:

```bash
npm run init-db
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Test

```bash
npm test
```

## Email Rules

The MVP sends one reviewed email at a time. It blocks sending to unsubscribed leads and blocks drafts that do not include unsubscribe language.

## AI Drafting

If `AI_API_KEY` is blank, the app uses template-based drafts. AI must not invent certifications, capacity, technical parameters, famous customers, or lowest-price claims.
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm --version
node --version
```

Expected:

- npm prints a version.
- Node prints `v26.2.0` or another Node version with `node:sqlite` available.

### Task 2: Configuration and Database

**Files:**
- Create: `src/config.js`
- Create: `src/db/schema.sql`
- Create: `src/db/database.js`
- Test: `tests/repositories.test.js`

- [ ] **Step 1: Create `src/config.js`**

```js
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=');
  }
}

loadDotEnv(resolve('.env'));

export const config = {
  port: Number(process.env.PORT || 5173),
  databasePath: process.env.DATABASE_PATH || 'data/hengda-crm.sqlite',
  company: {
    name: process.env.COMPANY_NAME || 'Qinhuangdao Hengda Fiberglass Co., Ltd.',
    website: process.env.COMPANY_WEBSITE || 'https://www.hengdaboxian.com/',
    address: process.env.COMPANY_ADDRESS || 'No. 16 Jingbohu Road, Economic and Technological Development Zone, Qinhuangdao, Hebei, China'
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.zmail300.cn',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || 'sales@hengdaboxian.com',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'sales@hengdaboxian.com'
  },
  ai: {
    provider: process.env.AI_PROVIDER || '',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || ''
  }
};
```

- [ ] **Step 2: Create `src/db/schema.sql`**

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  country_region TEXT NOT NULL DEFAULT '',
  market_region TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  product_fit TEXT NOT NULL DEFAULT 'Both',
  fit_reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New',
  owner_name TEXT NOT NULL DEFAULT 'Default',
  last_contacted_at TEXT,
  next_follow_up_at TEXT,
  unsubscribed_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_category TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  product_type TEXT NOT NULL DEFAULT '',
  material_or_glass_type TEXT NOT NULL DEFAULT '',
  model_specification TEXT NOT NULL DEFAULT '',
  linear_density_tex TEXT NOT NULL DEFAULT '',
  weight TEXT NOT NULL DEFAULT '',
  width TEXT NOT NULL DEFAULT '',
  roll_length TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  temperature_resistance TEXT NOT NULL DEFAULT '',
  surface_treatment TEXT NOT NULL DEFAULT '',
  packaging TEXT NOT NULL DEFAULT '',
  moq TEXT NOT NULL DEFAULT '',
  customization_options TEXT NOT NULL DEFAULT '',
  main_applications TEXT NOT NULL DEFAULT '',
  available_documents TEXT NOT NULL DEFAULT 'TDS / COA / sample / quotation',
  internal_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  draft_mode TEXT NOT NULL DEFAULT 'template',
  template_name TEXT NOT NULL DEFAULT '',
  ai_provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by TEXT NOT NULL DEFAULT 'Default',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  email_draft_id INTEGER,
  event_type TEXT NOT NULL,
  event_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'Default',
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (email_draft_id) REFERENCES email_drafts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  is_secret INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (product_category, product_type, available_documents)
SELECT 'Fiberglass Yarn', 'Fiberglass yarn / direct roving / plied yarn', 'TDS / COA / sample / quotation'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_category = 'Fiberglass Yarn');

INSERT INTO products (product_category, product_type, available_documents)
SELECT 'Fiberglass Fabric', 'Fiberglass cloth / mesh fabric / woven fabric', 'TDS / COA / sample / quotation'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_category = 'Fiberglass Fabric');
```

- [ ] **Step 3: Create `src/db/database.js`**

```js
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

export function openDatabase(databasePath = config.databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function migrate(db) {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  db.exec(schema);
}

export function withDatabase(callback, databasePath = config.databasePath) {
  const db = openDatabase(databasePath);
  try {
    migrate(db);
    return callback(db);
  } finally {
    db.close();
  }
}

if (process.argv.includes('--init')) {
  withDatabase(() => undefined);
  console.log(`Database initialized at ${config.databasePath}`);
}
```

- [ ] **Step 4: Create repository test skeleton**

Create `tests/repositories.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase, migrate } from '../src/db/database.js';

test('database migration creates seeded product records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hengda-crm-'));
  const db = openDatabase(join(dir, 'test.sqlite'));
  migrate(db);
  const products = db.prepare('SELECT product_category FROM products ORDER BY product_category').all();
  db.close();

  assert.deepEqual(products.map((row) => row.product_category), [
    'Fiberglass Fabric',
    'Fiberglass Yarn'
  ]);
});
```

- [ ] **Step 5: Run the database test**

Run:

```bash
npm test
```

Expected before `npm install`:

- No external dependencies are required for this test.
- This test passes and confirms `node:sqlite` works.

### Task 3: Repositories

**Files:**
- Create: `src/repositories/leads.js`
- Create: `src/repositories/products.js`
- Create: `src/repositories/drafts.js`
- Create: `src/repositories/events.js`
- Create: `src/repositories/settings.js`
- Modify: `tests/repositories.test.js`

- [ ] **Step 1: Create `src/repositories/leads.js`**

```js
export function listLeads(db) {
  return db.prepare('SELECT * FROM leads ORDER BY updated_at DESC, id DESC').all();
}

export function getLead(db, id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

export function createLead(db, input) {
  const stmt = db.prepare(`
    INSERT INTO leads (
      company_name, country_region, market_region, website, source_url,
      contact_name, email, industry, product_fit, fit_reason, status,
      owner_name, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    input.company_name,
    input.country_region || '',
    input.market_region || '',
    input.website || '',
    input.source_url || '',
    input.contact_name || '',
    input.email || '',
    input.industry || '',
    input.product_fit || 'Both',
    input.fit_reason || '',
    input.status || 'New',
    input.owner_name || 'Default',
    input.notes || ''
  );
  return getLead(db, Number(result.lastInsertRowid));
}

export function updateLead(db, id, input) {
  const current = getLead(db, id);
  if (!current) return undefined;
  const next = { ...current, ...input };
  db.prepare(`
    UPDATE leads SET
      company_name = ?, country_region = ?, market_region = ?, website = ?,
      source_url = ?, contact_name = ?, email = ?, industry = ?,
      product_fit = ?, fit_reason = ?, status = ?, owner_name = ?,
      last_contacted_at = ?, next_follow_up_at = ?, unsubscribed_at = ?,
      notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.company_name,
    next.country_region,
    next.market_region,
    next.website,
    next.source_url,
    next.contact_name,
    next.email,
    next.industry,
    next.product_fit,
    next.fit_reason,
    next.status,
    next.owner_name,
    next.last_contacted_at,
    next.next_follow_up_at,
    next.unsubscribed_at,
    next.notes,
    id
  );
  return getLead(db, id);
}

export function markLeadUnsubscribed(db, id) {
  return updateLead(db, id, {
    status: 'Unsubscribed',
    unsubscribed_at: new Date().toISOString()
  });
}
```

- [ ] **Step 2: Create remaining repositories**

Create `src/repositories/products.js`:

```js
export function listProducts(db) {
  return db.prepare('SELECT * FROM products ORDER BY product_category, id').all();
}

export function getProduct(db, id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

export function createProduct(db, input) {
  const result = db.prepare(`
    INSERT INTO products (
      product_category, product_name, product_type, material_or_glass_type,
      model_specification, linear_density_tex, weight, width, roll_length,
      color, temperature_resistance, surface_treatment, packaging, moq,
      customization_options, main_applications, available_documents, internal_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.product_category,
    input.product_name || '',
    input.product_type || '',
    input.material_or_glass_type || '',
    input.model_specification || '',
    input.linear_density_tex || '',
    input.weight || '',
    input.width || '',
    input.roll_length || '',
    input.color || '',
    input.temperature_resistance || '',
    input.surface_treatment || '',
    input.packaging || '',
    input.moq || '',
    input.customization_options || '',
    input.main_applications || '',
    input.available_documents || 'TDS / COA / sample / quotation',
    input.internal_notes || ''
  );
  return getProduct(db, Number(result.lastInsertRowid));
}

export function updateProduct(db, id, input) {
  const current = getProduct(db, id);
  if (!current) return undefined;
  const next = { ...current, ...input };
  db.prepare(`
    UPDATE products SET
      product_category = ?, product_name = ?, product_type = ?,
      material_or_glass_type = ?, model_specification = ?,
      linear_density_tex = ?, weight = ?, width = ?, roll_length = ?,
      color = ?, temperature_resistance = ?, surface_treatment = ?,
      packaging = ?, moq = ?, customization_options = ?,
      main_applications = ?, available_documents = ?, internal_notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.product_category,
    next.product_name,
    next.product_type,
    next.material_or_glass_type,
    next.model_specification,
    next.linear_density_tex,
    next.weight,
    next.width,
    next.roll_length,
    next.color,
    next.temperature_resistance,
    next.surface_treatment,
    next.packaging,
    next.moq,
    next.customization_options,
    next.main_applications,
    next.available_documents,
    next.internal_notes,
    id
  );
  return getProduct(db, id);
}
```

Create `src/repositories/drafts.js`:

```js
export function getDraft(db, id) {
  return db.prepare('SELECT * FROM email_drafts WHERE id = ?').get(id);
}

export function listDrafts(db) {
  return db.prepare('SELECT * FROM email_drafts ORDER BY updated_at DESC, id DESC').all();
}

export function createDraft(db, input) {
  const result = db.prepare(`
    INSERT INTO email_drafts (
      lead_id, subject, body, draft_mode, template_name, ai_provider, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.lead_id,
    input.subject,
    input.body,
    input.draft_mode || 'template',
    input.template_name || '',
    input.ai_provider || '',
    input.status || 'Draft',
    input.created_by || 'Default'
  );
  return getDraft(db, Number(result.lastInsertRowid));
}

export function updateDraft(db, id, input) {
  const current = getDraft(db, id);
  if (!current) return undefined;
  const next = { ...current, ...input };
  db.prepare(`
    UPDATE email_drafts SET
      subject = ?, body = ?, draft_mode = ?, template_name = ?, ai_provider = ?,
      status = ?, sent_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.subject,
    next.body,
    next.draft_mode,
    next.template_name,
    next.ai_provider,
    next.status,
    next.sent_at,
    id
  );
  return getDraft(db, id);
}
```

Create `src/repositories/events.js`:

```js
export function createEvent(db, input) {
  const result = db.prepare(`
    INSERT INTO contact_events (lead_id, email_draft_id, event_type, notes, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    input.lead_id,
    input.email_draft_id || null,
    input.event_type,
    input.notes || '',
    input.created_by || 'Default'
  );
  return db.prepare('SELECT * FROM contact_events WHERE id = ?').get(Number(result.lastInsertRowid));
}

export function listEventsForLead(db, leadId) {
  return db.prepare('SELECT * FROM contact_events WHERE lead_id = ? ORDER BY event_time DESC, id DESC').all(leadId);
}
```

Create `src/repositories/settings.js`:

```js
export function getSetting(db, key) {
  return db.prepare('SELECT * FROM app_settings WHERE key = ?').get(key);
}

export function setSetting(db, key, value, isSecret = false) {
  db.prepare(`
    INSERT INTO app_settings (key, value, is_secret, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, is_secret = excluded.is_secret, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, isSecret ? 1 : 0);
  return getSetting(db, key);
}
```

- [ ] **Step 3: Extend repository tests**

Add this to `tests/repositories.test.js`:

```js
import { createLead, markLeadUnsubscribed } from '../src/repositories/leads.js';
import { createDraft, updateDraft } from '../src/repositories/drafts.js';
import { createEvent, listEventsForLead } from '../src/repositories/events.js';
import { createProduct, updateProduct } from '../src/repositories/products.js';

test('lead, draft, and event records round-trip through sqlite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hengda-crm-'));
  const db = openDatabase(join(dir, 'test.sqlite'));
  migrate(db);

  const lead = createLead(db, {
    company_name: 'Example Insulation Ltd.',
    country_region: 'Germany',
    market_region: 'Europe',
    email: 'info@example.eu',
    source_url: 'https://example.eu',
    industry: 'Insulation',
    product_fit: 'Fiberglass Fabric'
  });
  const draft = createDraft(db, {
    lead_id: lead.id,
    subject: 'Fiberglass fabric for insulation applications',
    body: 'If this is not relevant, please reply "unsubscribe".'
  });
  const sentDraft = updateDraft(db, draft.id, {
    status: 'Sent',
    sent_at: '2026-05-30T00:00:00.000Z'
  });
  createEvent(db, {
    lead_id: lead.id,
    email_draft_id: draft.id,
    event_type: 'Email Sent',
    notes: 'SMTP accepted message'
  });
  const unsubscribed = markLeadUnsubscribed(db, lead.id);
  const events = listEventsForLead(db, lead.id);
  const product = createProduct(db, {
    product_category: 'Fiberglass Fabric',
    product_name: 'Internal fabric sample'
  });
  const updatedProduct = updateProduct(db, product.id, {
    width: 'blank until confirmed'
  });
  db.close();

  assert.equal(lead.company_name, 'Example Insulation Ltd.');
  assert.equal(sentDraft.status, 'Sent');
  assert.equal(unsubscribed.status, 'Unsubscribed');
  assert.equal(events.length, 1);
  assert.equal(updatedProduct.product_name, 'Internal fabric sample');
});
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
npm test
```

Expected:

- Both repository tests pass.

### Task 4: Template and Compliance Services

**Files:**
- Create: `src/services/templates.js`
- Create: `src/services/compliance.js`
- Create: `tests/templates.test.js`
- Create: `tests/compliance.test.js`

- [ ] **Step 1: Create `src/services/templates.js`**

```js
const SUBJECTS = {
  distributor: 'Fiberglass yarn and fabric supplier from China',
  manufacturer: 'Fiberglass materials for manufacturing applications',
  construction: 'Fiberglass fabric for construction and insulation applications',
  followup: 'Follow-up - fiberglass yarn and fabric',
  finalFollowup: 'Final follow-up - fiberglass materials'
};

export function chooseTemplate(lead) {
  const text = `${lead.industry || ''} ${lead.notes || ''}`.toLowerCase();
  if (text.includes('construction') || text.includes('insulation') || text.includes('building')) return 'construction';
  if (text.includes('manufacturer') || text.includes('production') || text.includes('factory')) return 'manufacturer';
  return 'distributor';
}

export function renderDraftFromTemplate(lead, company) {
  const template = chooseTemplate(lead);
  const name = lead.contact_name || 'Purchasing Team';
  const companyName = company.name;
  const website = company.website;
  const productLine = lead.product_fit === 'Fiberglass Yarn'
    ? 'fiberglass yarn'
    : lead.product_fit === 'Fiberglass Fabric'
      ? 'fiberglass fabric'
      : 'fiberglass yarn and fiberglass fabric';

  const context = lead.industry
    ? `I noticed that your company works in ${lead.industry}.`
    : 'I noticed that your business may be related to industrial fiberglass materials.';

  const body = `Dear ${name},

I am contacting you from ${companyName}, a China-based manufacturer of fiberglass materials.

We supply ${productLine} for industrial, construction, insulation, fire protection, transportation, and composite material applications. Specifications can be customized based on customer requirements.

${context} May I know if you currently purchase ${productLine}?

If relevant, we can provide product information, samples, and quotations for your review.

Best regards,

[Your Name]
${companyName}
Email: sales@hengdaboxian.com
Website: ${website}
Address: ${company.address}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`;

  return {
    subject: SUBJECTS[template],
    body,
    draft_mode: 'template',
    template_name: template
  };
}
```

- [ ] **Step 2: Create `src/services/compliance.js`**

```js
export function hasUnsubscribeLanguage(body) {
  return /unsubscribe/i.test(body || '');
}

export function validateDraftForSend(lead, draft, smtpConfig) {
  const errors = [];
  const warnings = [];

  if (!lead) errors.push('客户不存在。');
  if (lead && !lead.email) errors.push('客户邮箱为空。');
  if (lead && !lead.source_url) errors.push('客户来源链接为空。');
  if (lead && (lead.status === 'Unsubscribed' || lead.unsubscribed_at)) errors.push('客户已退订，禁止发送。');
  if (!draft || !draft.subject || !draft.body) errors.push('邮件草稿不完整。');
  if (draft && !hasUnsubscribeLanguage(draft.body)) errors.push('邮件正文缺少退订说明。');
  if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) errors.push('SMTP设置不完整。');
  if (lead && lead.market_region === 'Europe') warnings.push('欧洲客户需谨慎联系，并保留来源记录。');

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
```

- [ ] **Step 3: Create `tests/templates.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDraftFromTemplate, chooseTemplate } from '../src/services/templates.js';

test('template fallback generates English outreach without technical numbers', () => {
  const lead = {
    contact_name: '',
    industry: 'Insulation',
    product_fit: 'Fiberglass Fabric'
  };
  const company = {
    name: 'Qinhuangdao Hengda Fiberglass Co., Ltd.',
    website: 'https://www.hengdaboxian.com/',
    address: 'No. 16 Jingbohu Road, Economic and Technological Development Zone, Qinhuangdao, Hebei, China'
  };

  const draft = renderDraftFromTemplate(lead, company);

  assert.equal(chooseTemplate(lead), 'construction');
  assert.equal(draft.draft_mode, 'template');
  assert.match(draft.body, /fiberglass fabric/i);
  assert.match(draft.body, /unsubscribe/i);
  assert.doesNotMatch(draft.body, /ISO|CE|lowest price|best quality/i);
});
```

- [ ] **Step 4: Create `tests/compliance.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraftForSend } from '../src/services/compliance.js';

const smtp = {
  host: 'smtp.zmail300.cn',
  user: 'sales@hengdaboxian.com',
  pass: 'secret'
};

test('send guard blocks unsubscribed leads', () => {
  const result = validateDraftForSend(
    { email: 'buyer@example.com', source_url: 'https://example.com', status: 'Unsubscribed' },
    { subject: 'Hello', body: 'Please reply unsubscribe if not relevant.' },
    smtp
  );

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /已退订/);
});

test('send guard blocks missing unsubscribe language', () => {
  const result = validateDraftForSend(
    { email: 'buyer@example.com', source_url: 'https://example.com', status: 'New' },
    { subject: 'Hello', body: 'We supply fiberglass fabric.' },
    smtp
  );

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /退订说明/);
});

test('send guard warns for Europe leads', () => {
  const result = validateDraftForSend(
    { email: 'buyer@example.eu', source_url: 'https://example.eu', status: 'New', market_region: 'Europe' },
    { subject: 'Hello', body: 'Please reply unsubscribe if not relevant.' },
    smtp
  );

  assert.equal(result.ok, true);
  assert.match(result.warnings.join('\n'), /欧洲客户/);
});
```

- [ ] **Step 5: Run service tests**

Run:

```bash
npm test
```

Expected:

- Template and compliance tests pass.

### Task 5: AI Draft and SMTP Services

**Files:**
- Create: `src/services/aiDraft.js`
- Create: `src/services/smtpMailer.js`
- Modify: `tests/templates.test.js`

- [ ] **Step 1: Create `src/services/aiDraft.js`**

```js
import { renderDraftFromTemplate } from './templates.js';

const FORBIDDEN_CLAIMS = [
  'certifications',
  'production capacity',
  'export countries',
  'famous customers',
  'technical parameters',
  'lowest price',
  'best quality'
];

export function buildAiPrompt(lead, company) {
  return [
    'Write one concise English B2B outreach email for a fiberglass manufacturer.',
    `Company: ${company.name}`,
    `Website: ${company.website}`,
    `Address: ${company.address}`,
    `Lead company: ${lead.company_name}`,
    `Lead industry: ${lead.industry}`,
    `Product fit: ${lead.product_fit}`,
    'The email must include unsubscribe language.',
    `Do not invent or mention: ${FORBIDDEN_CLAIMS.join(', ')}.`,
    'If specifications are missing, ask the customer for requirements instead of giving numbers.',
    'Return JSON with keys subject and body.'
  ].join('\n');
}

export async function generateDraft(lead, company, aiConfig) {
  if (!aiConfig || !aiConfig.apiKey || !aiConfig.provider) {
    return renderDraftFromTemplate(lead, company);
  }

  if (aiConfig.provider !== 'openai-compatible') {
    return renderDraftFromTemplate(lead, company);
  }

  const response = await fetch(aiConfig.baseUrl || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: aiConfig.model || 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'You write accurate, compliant B2B sales emails. Never invent facts.' },
        { role: 'user', content: buildAiPrompt(lead, company) }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    return renderDraftFromTemplate(lead, company);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(content);
    if (!parsed.subject || !parsed.body) return renderDraftFromTemplate(lead, company);
    return {
      subject: parsed.subject,
      body: parsed.body,
      draft_mode: 'ai',
      template_name: 'ai-generated',
      ai_provider: aiConfig.provider
    };
  } catch {
    return renderDraftFromTemplate(lead, company);
  }
}
```

- [ ] **Step 2: Create `src/services/smtpMailer.js`**

```js
import { connect as tlsConnect } from 'node:tls';
import { connect as netConnect } from 'node:net';
import { once } from 'node:events';

export async function sendSingleEmail(smtpConfig, message) {
  const socket = smtpConfig.secure
    ? tlsConnect({ host: smtpConfig.host, port: smtpConfig.port, servername: smtpConfig.host })
    : netConnect({ host: smtpConfig.host, port: smtpConfig.port });
  socket.setEncoding('utf8');

  let buffer = '';
  socket.on('data', (chunk) => {
    buffer += chunk;
  });

  if (smtpConfig.secure) await once(socket, 'secureConnect');
  else await once(socket, 'connect');

  async function readResponse() {
    while (!/\r?\n/.test(buffer)) await once(socket, 'data');
    const value = buffer;
    buffer = '';
    if (!/^[23]/.test(value)) throw new Error(value.trim());
    return value;
  }

  async function command(line) {
    socket.write(`${line}\r\n`);
    return readResponse();
  }

  await readResponse();
  await command('EHLO localhost');
  await command('AUTH LOGIN');
  await command(Buffer.from(smtpConfig.user).toString('base64'));
  await command(Buffer.from(smtpConfig.pass).toString('base64'));
  await command(`MAIL FROM:<${smtpConfig.from}>`);
  await command(`RCPT TO:<${message.to}>`);
  await command('DATA');
  socket.write([
    `From: ${smtpConfig.from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    message.body,
    '.'
  ].join('\r\n') + '\r\n');
  await readResponse();
  await command('QUIT');
  socket.end();
  return { messageId: `smtp-${Date.now()}` };
}
```

- [ ] **Step 3: Add AI fallback test**

Add this to `tests/templates.test.js`:

```js
import { generateDraft } from '../src/services/aiDraft.js';

test('AI draft falls back to template when API key is missing', async () => {
  const lead = {
    company_name: 'Example Trading LLC',
    industry: 'Distributor',
    product_fit: 'Both'
  };
  const company = {
    name: 'Qinhuangdao Hengda Fiberglass Co., Ltd.',
    website: 'https://www.hengdaboxian.com/',
    address: 'No. 16 Jingbohu Road, Economic and Technological Development Zone, Qinhuangdao, Hebei, China'
  };

  const draft = await generateDraft(lead, company, { provider: '', apiKey: '' });

  assert.equal(draft.draft_mode, 'template');
  assert.match(draft.body, /unsubscribe/i);
});
```

- [ ] **Step 4: Create npm lockfile**

Run:

```bash
npm install
```

Expected:

- `package-lock.json` is created.
- No package download is required; SMTP uses Node built-ins.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
```

Expected:

- All tests pass.

### Task 6: HTTP API

**Files:**
- Create: `src/server/router.js`
- Create: `src/server/api.js`
- Create: `src/server/static.js`
- Create: `src/server/index.js`
- Create: `tests/api.test.js`

- [ ] **Step 1: Create `src/server/router.js`**

```js
export async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function notFound(response) {
  sendJson(response, 404, { error: 'Not Found' });
}
```

- [ ] **Step 2: Create `src/server/api.js`**

```js
import { config } from '../config.js';
import { createLead, getLead, listLeads, updateLead } from '../repositories/leads.js';
import { createDraft, getDraft, listDrafts, updateDraft } from '../repositories/drafts.js';
import { createEvent, listEventsForLead } from '../repositories/events.js';
import { createProduct, listProducts, updateProduct } from '../repositories/products.js';
import { generateDraft } from '../services/aiDraft.js';
import { validateDraftForSend } from '../services/compliance.js';
import { sendSingleEmail } from '../services/smtpMailer.js';
import { readJson, sendJson } from './router.js';

export async function handleApi(request, response, db, url) {
  if (request.method === 'GET' && url.pathname === '/api/leads') {
    return sendJson(response, 200, { leads: listLeads(db) });
  }

  if (request.method === 'POST' && url.pathname === '/api/leads') {
    const body = await readJson(request);
    if (!body.company_name) return sendJson(response, 400, { error: '公司名称不能为空。' });
    return sendJson(response, 201, { lead: createLead(db, body) });
  }

  const leadMatch = url.pathname.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch && request.method === 'PUT') {
    const body = await readJson(request);
    const lead = updateLead(db, Number(leadMatch[1]), body);
    if (!lead) return sendJson(response, 404, { error: '客户不存在。' });
    return sendJson(response, 200, { lead });
  }

  if (request.method === 'GET' && url.pathname === '/api/products') {
    return sendJson(response, 200, { products: listProducts(db) });
  }

  if (request.method === 'POST' && url.pathname === '/api/products') {
    const body = await readJson(request);
    if (!body.product_category) return sendJson(response, 400, { error: '产品类别不能为空。' });
    return sendJson(response, 201, { product: createProduct(db, body) });
  }

  const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);
  if (productMatch && request.method === 'PUT') {
    const body = await readJson(request);
    const product = updateProduct(db, Number(productMatch[1]), body);
    if (!product) return sendJson(response, 404, { error: '产品不存在。' });
    return sendJson(response, 200, { product });
  }

  if (request.method === 'POST' && url.pathname === '/api/drafts/generate') {
    const body = await readJson(request);
    const lead = getLead(db, Number(body.lead_id));
    if (!lead) return sendJson(response, 404, { error: '客户不存在。' });
    const generated = await generateDraft(lead, config.company, config.ai);
    const draft = createDraft(db, { lead_id: lead.id, ...generated });
    createEvent(db, { lead_id: lead.id, email_draft_id: draft.id, event_type: 'Draft Created' });
    updateLead(db, lead.id, { status: 'Drafted' });
    return sendJson(response, 201, { draft });
  }

  if (request.method === 'GET' && url.pathname === '/api/drafts') {
    return sendJson(response, 200, { drafts: listDrafts(db) });
  }

  const draftMatch = url.pathname.match(/^\/api\/drafts\/(\d+)$/);
  if (draftMatch && request.method === 'PUT') {
    const body = await readJson(request);
    const draft = updateDraft(db, Number(draftMatch[1]), {
      subject: body.subject,
      body: body.body,
      status: body.status || 'Draft'
    });
    if (!draft) return sendJson(response, 404, { error: '草稿不存在。' });
    return sendJson(response, 200, { draft });
  }

  const sendMatch = url.pathname.match(/^\/api\/drafts\/(\d+)\/send$/);
  if (sendMatch && request.method === 'POST') {
    const draft = getDraft(db, Number(sendMatch[1]));
    if (!draft) return sendJson(response, 404, { error: '草稿不存在。' });
    const lead = getLead(db, draft.lead_id);
    const check = validateDraftForSend(lead, draft, config.smtp);
    if (!check.ok) return sendJson(response, 400, { errors: check.errors, warnings: check.warnings });

    try {
      const result = await sendSingleEmail(config.smtp, {
        to: lead.email,
        subject: draft.subject,
        body: draft.body
      });
      const sentAt = new Date().toISOString();
      const updatedDraft = updateDraft(db, draft.id, { status: 'Sent', sent_at: sentAt });
      updateLead(db, lead.id, {
        status: 'Sent',
        last_contacted_at: sentAt,
        next_follow_up_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      });
      createEvent(db, {
        lead_id: lead.id,
        email_draft_id: draft.id,
        event_type: 'Email Sent',
        notes: result.messageId || 'SMTP accepted message'
      });
      return sendJson(response, 200, { draft: updatedDraft, warnings: check.warnings });
    } catch (error) {
      updateDraft(db, draft.id, { status: 'Failed' });
      return sendJson(response, 502, { error: error.message });
    }
  }

  const eventsMatch = url.pathname.match(/^\/api\/leads\/(\d+)\/events$/);
  if (eventsMatch && request.method === 'GET') {
    return sendJson(response, 200, { events: listEventsForLead(db, Number(eventsMatch[1])) });
  }

  return false;
}
```

- [ ] **Step 3: Create static server and entrypoint**

Create `src/server/static.js`:

```js
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

export function serveStatic(response, pathname) {
  const safePath = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = join('public', safePath);
  if (!existsSync(filePath)) return false;
  response.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
  return true;
}
```

Create `src/server/index.js`:

```js
import { createServer } from 'node:http';
import { config } from '../config.js';
import { openDatabase, migrate } from '../db/database.js';
import { handleApi } from './api.js';
import { notFound, sendJson } from './router.js';
import { serveStatic } from './static.js';

const db = openDatabase(config.databasePath);
migrate(db);

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(request, response, db, url);
      if (handled === false) notFound(response);
      return;
    }
    if (serveStatic(response, url.pathname)) return;
    notFound(response);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(config.port, () => {
  console.log(`Hengda CRM running at http://localhost:${config.port}`);
});
```

- [ ] **Step 4: Create API test for lead creation and draft generation**

Create `tests/api.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase, migrate } from '../src/db/database.js';
import { handleApi } from '../src/server/api.js';

class MockResponse {
  constructor() {
    this.statusCode = 0;
    this.headers = {};
    this.body = '';
  }
  writeHead(status, headers) {
    this.statusCode = status;
    this.headers = headers;
  }
  end(body) {
    this.body = body;
  }
}

function mockRequest(method, body) {
  const data = body ? Buffer.from(JSON.stringify(body)) : Buffer.from('');
  return {
    method,
    async *[Symbol.asyncIterator]() {
      if (data.length) yield data;
    }
  };
}

test('API creates a lead', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hengda-crm-'));
  const db = openDatabase(join(dir, 'test.sqlite'));
  migrate(db);
  const response = new MockResponse();

  await handleApi(
    mockRequest('POST', { company_name: 'Example Co.', email: 'buyer@example.com', source_url: 'https://example.com' }),
    response,
    db,
    new URL('http://localhost/api/leads')
  );

  const payload = JSON.parse(response.body);
  db.close();

  assert.equal(response.statusCode, 201);
  assert.equal(payload.lead.company_name, 'Example Co.');
});
```

- [ ] **Step 5: Run API tests**

Run:

```bash
npm test
```

Expected:

- API test passes.

### Task 7: Chinese Frontend

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] **Step 1: Create `public/index.html`**

Use the approved layout from `docs/hengda-mvp-wireframe.html` and replace mock-only content with real containers:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>恒达海外客户开发CRM</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">HD</div>
        <h1>恒达海外客户开发CRM</h1>
        <p>玻纤纱与玻纤布客户线索、邮件草稿、跟进状态统一管理。</p>
      </div>
      <nav class="nav-group">
        <div class="nav-title">工作台</div>
        <button class="nav-item active" data-view="leads"><span>01</span>客户线索</button>
        <button class="nav-item" data-view="drafts"><span>02</span>邮件草稿</button>
        <button class="nav-item" data-view="followups"><span>03</span>跟进任务</button>
      </nav>
      <nav class="nav-group">
        <div class="nav-title">基础资料</div>
        <button class="nav-item" data-view="products"><span>04</span>产品资料</button>
        <button class="nav-item" data-view="templates"><span>05</span>邮件模板</button>
        <button class="nav-item" data-view="settings"><span>06</span>系统设置</button>
      </nav>
      <div class="sidebar-foot">
        <strong>发信策略</strong>
        <p>第一版只允许单封发送。每封邮件发送前检查来源、退订状态与退订说明。</p>
      </div>
    </aside>
    <section class="main">
      <header class="topbar">
        <div class="page-title">
          <h2>客户线索工作台</h2>
          <p>美国、欧洲、中东、东南亚市场 · 本地MVP · 预留多人字段</p>
        </div>
        <div class="top-actions">
          <input id="search" class="search" placeholder="搜索公司、国家、邮箱或行业">
          <button id="addLeadButton" class="btn primary">新增线索</button>
        </div>
      </header>
      <main class="workspace">
        <section class="metrics" id="metrics"></section>
        <section class="work-grid">
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>客户线索列表</h3>
                <p>先记录来源，再生成草稿；欧洲客户默认进入谨慎联系流程。</p>
              </div>
              <button id="generateDraftButton" class="btn">生成草稿</button>
            </div>
            <div id="leadTable"></div>
          </div>
          <div class="detail">
            <section class="panel">
              <div class="panel-head">
                <div>
                  <h3>英文邮件草稿</h3>
                  <p>有API Key时用AI生成；没有时使用固定模板。</p>
                </div>
              </div>
              <div id="draftPanel" class="draft-body"></div>
            </section>
            <section class="panel">
              <div class="panel-head">
                <div>
                  <h3>跟进记录</h3>
                  <p>围绕单个客户记录沟通状态。</p>
                </div>
              </div>
              <div id="eventList" class="activity"></div>
            </section>
          </div>
        </section>
        <section class="panel secondary-panel">
          <div class="panel-head">
            <div>
              <h3>产品资料</h3>
              <p>规格允许为空；未确认的参数不会进入客户邮件。</p>
            </div>
            <button id="addProductButton" class="btn">新增产品资料</button>
          </div>
          <div id="productList"></div>
        </section>
      </main>
    </section>
  </div>
  <script src="/app.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/styles.css`**

Copy the CSS from `docs/hengda-mvp-wireframe.html`, then change `a.nav-item` selectors to `.nav-item` because the implemented UI uses buttons.

Add this exact button reset:

```css
.nav-item {
  width: 100%;
  border: 1px solid transparent;
  cursor: default;
}
```

- [ ] **Step 3: Create `public/app.js`**

```js
const state = {
  leads: [],
  drafts: [],
  events: [],
  products: [],
  selectedLeadId: null,
  selectedDraftId: null
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || (payload.errors || []).join('\n') || '请求失败');
  return payload;
}

function renderMetrics() {
  const newCount = state.leads.filter((lead) => lead.status === 'New').length;
  const draftedCount = state.leads.filter((lead) => lead.status === 'Drafted').length;
  const dueCount = state.leads.filter((lead) => lead.next_follow_up_at).length;
  const unsubscribedCount = state.leads.filter((lead) => lead.status === 'Unsubscribed').length;
  document.querySelector('#metrics').innerHTML = [
    ['新客户线索', newCount, '等待判断产品匹配'],
    ['待发送草稿', draftedCount, '人工审核后单封发送'],
    ['今日需跟进', dueCount, '按跟进日期提醒'],
    ['已退订客户', unsubscribedCount, '系统禁止再次发送']
  ].map(([label, value, note]) => `
    <div class="metric">
      <div class="metric-top"><span>${label}</span><span>MVP</span></div>
      <div class="metric-value">${value}</div>
      <div class="metric-note">${note}</div>
      <div class="metric-accent"></div>
    </div>
  `).join('');
}

function renderLeadTable() {
  const rows = state.leads.map((lead) => `
    <tr class="${lead.id === state.selectedLeadId ? 'selected' : ''}" data-lead-id="${lead.id}">
      <td><div class="company">${lead.company_name}</div><div class="sub">${lead.email || '邮箱待补充'}</div></td>
      <td>${lead.market_region || lead.country_region || ''}</td>
      <td>${lead.industry || ''}</td>
      <td><span class="tag teal">${lead.product_fit || 'Both'}</span></td>
      <td><span class="tag blue">${lead.status}</span></td>
      <td>${lead.source_url ? '已记录' : '缺少来源'}</td>
    </tr>
  `).join('');

  document.querySelector('#leadTable').innerHTML = `
    <table>
      <thead>
        <tr><th>公司</th><th>区域</th><th>行业</th><th>匹配产品</th><th>状态</th><th>来源</th></tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6">暂无客户线索。</td></tr>'}</tbody>
    </table>
  `;

  document.querySelectorAll('[data-lead-id]').forEach((row) => {
    row.addEventListener('click', async () => {
      state.selectedLeadId = Number(row.dataset.leadId);
      await loadEvents();
      render();
    });
  });
}

function renderDraftPanel() {
  const draft = state.drafts.find((item) => item.id === state.selectedDraftId) || state.drafts[0];
  if (!draft) {
    document.querySelector('#draftPanel').innerHTML = '<p class="empty">请选择客户并生成邮件草稿。</p>';
    return;
  }
  state.selectedDraftId = draft.id;
  document.querySelector('#draftPanel').innerHTML = `
    <div class="field"><label>英文邮件标题</label><input class="input" id="draftSubject" value="${escapeHtml(draft.subject)}"></div>
    <div class="field"><label>英文邮件正文</label><textarea id="draftBody">${escapeHtml(draft.body)}</textarea></div>
    <div class="checklist">
      <div class="check-row"><span class="check-box">✓</span><span>发送前检查客户来源、退订状态和退订说明。</span></div>
    </div>
    <div class="send-actions">
      <button class="btn" id="saveDraftButton">保存草稿</button>
      <button class="btn" id="copyDraftButton">复制邮件</button>
      <button class="btn primary" id="sendDraftButton">发送单封邮件</button>
    </div>
  `;
  document.querySelector('#saveDraftButton').addEventListener('click', saveDraft);
  document.querySelector('#copyDraftButton').addEventListener('click', copyDraft);
  document.querySelector('#sendDraftButton').addEventListener('click', sendDraft);
}

function renderEvents() {
  document.querySelector('#eventList').innerHTML = state.events.map((event) => `
    <div class="timeline-item">
      <div class="time">${new Date(event.event_time).toLocaleDateString()}</div>
      <div><strong>${event.event_type}</strong><p>${event.notes || ''}</p></div>
    </div>
  `).join('') || '<p class="empty">暂无跟进记录。</p>';
}

function renderProducts() {
  document.querySelector('#productList').innerHTML = `
    <table>
      <thead>
        <tr><th>产品类别</th><th>产品名称</th><th>产品类型</th><th>主要用途</th><th>内部备注</th></tr>
      </thead>
      <tbody>
        ${state.products.map((product) => `
          <tr>
            <td>${escapeHtml(product.product_category)}</td>
            <td>${escapeHtml(product.product_name || '待补充')}</td>
            <td>${escapeHtml(product.product_type || '')}</td>
            <td>${escapeHtml(product.main_applications || '')}</td>
            <td>${escapeHtml(product.internal_notes || '')}</td>
          </tr>
        `).join('') || '<tr><td colspan="5">暂无产品资料。</td></tr>'}
      </tbody>
    </table>
  `;
}

function render() {
  renderMetrics();
  renderLeadTable();
  renderDraftPanel();
  renderEvents();
  renderProducts();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

async function loadData() {
  const [leadPayload, draftPayload, productPayload] = await Promise.all([
    api('/api/leads'),
    api('/api/drafts'),
    api('/api/products')
  ]);
  state.leads = leadPayload.leads;
  state.drafts = draftPayload.drafts;
  state.products = productPayload.products;
  state.selectedLeadId = state.selectedLeadId || state.leads[0]?.id || null;
  await loadEvents();
  render();
}

async function loadEvents() {
  if (!state.selectedLeadId) {
    state.events = [];
    return;
  }
  const payload = await api(`/api/leads/${state.selectedLeadId}/events`);
  state.events = payload.events;
}

async function addLead() {
  const companyName = window.prompt('请输入公司名称');
  if (!companyName) return;
  await api('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      company_name: companyName,
      market_region: 'USA',
      product_fit: 'Both',
      status: 'New'
    })
  });
  await loadData();
}

async function generateDraft() {
  if (!state.selectedLeadId) return window.alert('请先选择客户。');
  const payload = await api('/api/drafts/generate', {
    method: 'POST',
    body: JSON.stringify({ lead_id: state.selectedLeadId })
  });
  state.selectedDraftId = payload.draft.id;
  await loadData();
}

async function copyDraft() {
  const subject = document.querySelector('#draftSubject').value;
  const body = document.querySelector('#draftBody').value;
  await navigator.clipboard.writeText(`${subject}\n\n${body}`);
  window.alert('已复制邮件内容。');
}

async function saveDraft() {
  if (!state.selectedDraftId) return;
  const subject = document.querySelector('#draftSubject').value;
  const body = document.querySelector('#draftBody').value;
  const payload = await api(`/api/drafts/${state.selectedDraftId}`, {
    method: 'PUT',
    body: JSON.stringify({ subject, body, status: 'Draft' })
  });
  state.selectedDraftId = payload.draft.id;
  await loadData();
}

async function sendDraft() {
  if (!state.selectedDraftId) return;
  try {
    await saveDraft();
    await api(`/api/drafts/${state.selectedDraftId}/send`, { method: 'POST' });
    window.alert('发送成功。');
    await loadData();
  } catch (error) {
    window.alert(error.message);
  }
}

async function addProduct() {
  const category = window.prompt('请输入产品类别，例如 Fiberglass Yarn 或 Fiberglass Fabric');
  if (!category) return;
  await api('/api/products', {
    method: 'POST',
    body: JSON.stringify({ product_category: category })
  });
  await loadData();
}

document.querySelector('#addLeadButton').addEventListener('click', addLead);
document.querySelector('#addProductButton').addEventListener('click', addProduct);
document.querySelector('#generateDraftButton').addEventListener('click', generateDraft);
loadData().catch((error) => window.alert(error.message));
```

- [ ] **Step 4: Run the app**

Run:

```bash
npm run init-db
npm run dev
```

Expected:

- Terminal prints `Hengda CRM running at http://localhost:5173`.
- Browser can open `http://localhost:5173`.
- Chinese dashboard loads.

### Task 8: Manual Verification and Browser QA

**Files:**
- Modify only files with verified defects from this task.

- [ ] **Step 1: Verify local app loads**

Open:

```text
http://localhost:5173
```

Expected:

- Chinese CRM UI appears.
- No visible text overlap at desktop width.
- Left navigation, metrics, lead table, draft panel, and follow-up panel are visible.

- [ ] **Step 2: Create a test lead**

Click `新增线索`, enter:

```text
Example Insulation Ltd.
```

Expected:

- Lead appears in the table.
- Metrics update.

- [ ] **Step 3: Generate a draft**

Select the lead and click `生成草稿`.

Expected:

- Draft panel shows English subject and body.
- Draft includes `unsubscribe`.
- Draft does not include ISO, CE, production capacity, famous customers, exact specs, lowest price, or best quality.

- [ ] **Step 4: Save an edited draft**

Edit the email body by adding:

```text
Please share your required specification and application.
```

Click `保存草稿`.

Expected:

- The edited text remains after reload.
- The draft still includes `unsubscribe`.

- [ ] **Step 5: Add a product record**

Click `新增产品资料`, enter:

```text
Fiberglass Fabric
```

Expected:

- A new product row appears.
- Blank specification fields are accepted.

- [ ] **Step 6: Verify send guard without SMTP password**

Click `发送单封邮件` with blank `SMTP_PASS`.

Expected:

- App shows an SMTP settings error.
- Draft remains unsent.

- [ ] **Step 7: Run final tests**

Run:

```bash
npm test
```

Expected:

- All tests pass.

## Self-Review

Spec coverage:

- Local web app: Tasks 1, 6, 7, 8.
- Future multi-user fields: Task 2 `owner_name`, `created_by`.
- Target markets and product scope: Tasks 2, 4, 7.
- SMTP single send: Tasks 5, 6, 8.
- No bulk send: Tasks 5 and 6 only expose one draft send endpoint.
- AI/template fallback: Tasks 4 and 5.
- Chinese operation UI and English customer email: Task 7.
- Compliance guards: Tasks 4, 6, 8.
- Follow-up records: Tasks 2, 3, 6, 7.
- Product records with blank optional specifications: Tasks 2, 3, 6, 7, 8.

Completion marker scan:

- No unfinished implementation markers or unspecified implementation steps are intentionally left.
- SMTP password remains a runtime secret and is not hard-coded.

Type consistency:

- `lead_id`, `email_draft_id`, `product_fit`, `market_region`, and status names match across schema, repositories, services, API, and frontend.
