import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase, migrate } from '../src/db/database.js';
import { createDraft, getDraft, updateDraft } from '../src/repositories/drafts.js';
import { createEvent, listEventsForLead } from '../src/repositories/events.js';
import { createLead, getLead, updateLead } from '../src/repositories/leads.js';
import { createProduct, listProducts, updateProduct } from '../src/repositories/products.js';
import { getSetting, listSettings, setSetting } from '../src/repositories/settings.js';

function testDb() {
  const dir = mkdtempSync(join(tmpdir(), 'hengda-crm-'));
  const db = openDatabase(join(dir, 'test.sqlite'));
  migrate(db);
  return db;
}

test('database migration creates seeded product records', () => {
  const db = testDb();
  const products = listProducts(db);
  db.close();

  assert.deepEqual(products.map((row) => row.product_category), [
    'Fiberglass Fabric',
    'Fiberglass Yarn'
  ]);
});

test('product records accept blank optional fields', () => {
  const db = testDb();
  const product = createProduct(db, { product_category: 'Fiberglass Fabric' });
  const updated = updateProduct(db, product.id, { main_applications: 'Insulation' });
  db.close();

  assert.equal(product.product_name, '');
  assert.equal(updated.main_applications, 'Insulation');
});

test('lead, draft, and event roundtrip', () => {
  const db = testDb();
  const lead = createLead(db, {
    company_name: 'Example Insulation Ltd.',
    country_region: 'United States',
    market_region: 'USA',
    email: 'buyer@example.com',
    source_url: 'https://example.com/profile',
    industry: 'construction insulation'
  });
  const updatedLead = updateLead(db, lead.id, { status: 'Drafted' });
  const draft = createDraft(db, {
    lead_id: lead.id,
    subject: 'Fiberglass fabric for insulation',
    body: 'Please reply unsubscribe if this is not relevant.'
  });
  const updatedDraft = updateDraft(db, draft.id, { status: 'Ready' });
  const event = createEvent(db, {
    lead_id: lead.id,
    email_draft_id: draft.id,
    event_type: 'Draft Created',
    notes: 'Template draft created.'
  });
  const events = listEventsForLead(db, lead.id);
  const savedLead = getLead(db, lead.id);
  const savedDraft = getDraft(db, draft.id);
  db.close();

  assert.equal(updatedLead.status, 'Drafted');
  assert.equal(updatedDraft.status, 'Ready');
  assert.equal(event.email_draft_id, draft.id);
  assert.equal(events.length, 1);
  assert.equal(savedLead.company_name, 'Example Insulation Ltd.');
  assert.equal(savedDraft.subject, 'Fiberglass fabric for insulation');
});

test('settings hide secret values by default', () => {
  const db = testDb();
  setSetting(db, 'smtp_pass', 'secret-password', true);
  setSetting(db, 'smtp_host', 'smtp.zmail300.cn');
  const secret = getSetting(db, 'smtp_pass');
  const visible = listSettings(db);
  db.close();

  assert.equal(secret.value, 'secret-password');
  assert.equal(visible.find((row) => row.key === 'smtp_pass').value, '');
  assert.equal(visible.find((row) => row.key === 'smtp_host').value, 'smtp.zmail300.cn');
});
