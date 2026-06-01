import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrate, openDatabase } from '../src/db/database.js';
import { createDraft } from '../src/repositories/drafts.js';
import { createLead } from '../src/repositories/leads.js';
import { createProduct } from '../src/repositories/products.js';
import { handleApi } from '../src/server/api.js';
import { serveStatic } from '../src/server/static.js';

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
    this.body = body || '';
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

function parse(response) {
  return JSON.parse(response.body);
}

function testDb() {
  const dir = mkdtempSync(join(tmpdir(), 'hengda-crm-'));
  const db = openDatabase(join(dir, 'test.sqlite'));
  migrate(db);
  return db;
}

const runtimeConfig = {
  company: {
    name: 'Qinhuangdao Hengda Fiberglass Co., Ltd.',
    website: 'https://www.hengdaboxian.com/',
    address: 'Qinhuangdao, Hebei, China'
  },
  ai: {
    provider: '',
    apiKey: '',
    model: ''
  },
  smtp: {
    host: 'smtp.zmail300.cn',
    port: 465,
    secure: true,
    user: 'sales@example.com',
    pass: '',
    from: 'sales@example.com'
  }
};

test('API creates and updates a lead', async () => {
  const db = testDb();
  const createdResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', {
      company_name: 'Example Co.',
      email: 'buyer@example.com',
      source_url: 'https://example.com'
    }),
    createdResponse,
    db,
    new URL('http://localhost/api/leads'),
    runtimeConfig
  );

  const created = parse(createdResponse).lead;
  const updatedResponse = new MockResponse();
  await handleApi(
    mockRequest('PUT', { status: 'Replied', notes: 'Asked for fabric samples.' }),
    updatedResponse,
    db,
    new URL(`http://localhost/api/leads/${created.id}`),
    runtimeConfig
  );
  const updated = parse(updatedResponse).lead;
  db.close();

  assert.equal(createdResponse.statusCode, 201);
  assert.equal(created.company_name, 'Example Co.');
  assert.equal(updatedResponse.statusCode, 200);
  assert.equal(updated.status, 'Replied');
});

test('API creates and updates products', async () => {
  const db = testDb();
  const createdResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', { product_category: 'Fiberglass Fabric' }),
    createdResponse,
    db,
    new URL('http://localhost/api/products'),
    runtimeConfig
  );

  const product = parse(createdResponse).product;
  const updatedResponse = new MockResponse();
  await handleApi(
    mockRequest('PUT', { main_applications: 'Construction insulation' }),
    updatedResponse,
    db,
    new URL(`http://localhost/api/products/${product.id}`),
    runtimeConfig
  );
  db.close();

  assert.equal(createdResponse.statusCode, 201);
  assert.equal(product.product_name, '');
  assert.equal(parse(updatedResponse).product.main_applications, 'Construction insulation');
});

test('API deletes products', async () => {
  const db = testDb();
  const createdResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', { product_category: 'Fiberglass Fabric', product_name: 'Delete me' }),
    createdResponse,
    db,
    new URL('http://localhost/api/products'),
    runtimeConfig
  );
  const product = parse(createdResponse).product;

  const deletedResponse = new MockResponse();
  await handleApi(
    mockRequest('DELETE'),
    deletedResponse,
    db,
    new URL(`http://localhost/api/products/${product.id}`),
    runtimeConfig
  );
  db.close();

  assert.equal(deletedResponse.statusCode, 200);
  assert.equal(parse(deletedResponse).ok, true);
});

test('API generates a fallback draft and records a lead event', async () => {
  const db = testDb();
  const lead = createLead(db, {
    company_name: 'Example Insulation Ltd.',
    email: 'buyer@example.com',
    source_url: 'https://example.com/source',
    industry: 'construction insulation',
    product_fit: 'Fiberglass Fabric'
  });

  const draftResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', { lead_id: lead.id }),
    draftResponse,
    db,
    new URL('http://localhost/api/drafts/generate'),
    runtimeConfig
  );
  const eventResponse = new MockResponse();
  await handleApi(
    mockRequest('GET'),
    eventResponse,
    db,
    new URL(`http://localhost/api/leads/${lead.id}/events`),
    runtimeConfig
  );
  db.close();

  assert.equal(draftResponse.statusCode, 201);
  assert.equal(parse(draftResponse).draft.draft_mode, 'template');
  assert.match(parse(draftResponse).draft.body, /unsubscribe/i);
  assert.equal(parse(eventResponse).events[0].event_type, 'Draft Created');
});

test('API draft generation can reference a selected product safely', async () => {
  const db = testDb();
  const lead = createLead(db, {
    company_name: 'Example Insulation Ltd.',
    email: 'buyer@example.com',
    source_url: 'https://example.com/source',
    industry: 'construction insulation',
    product_fit: 'Fiberglass Fabric'
  });
  const product = createProduct(db, {
    product_category: 'Fiberglass Fabric',
    product_name: 'E-glass woven fabric',
    packaging: 'Carton and pallet',
    internal_notes: 'Internal margin approval required.'
  });

  const draftResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', { lead_id: lead.id, product_id: product.id }),
    draftResponse,
    db,
    new URL('http://localhost/api/drafts/generate'),
    runtimeConfig
  );
  db.close();

  const draftBody = parse(draftResponse).draft.body;
  assert.equal(draftResponse.statusCode, 201);
  assert.match(draftBody, /Product name: E-glass woven fabric/);
  assert.match(draftBody, /Packaging: Carton and pallet/);
  assert.doesNotMatch(draftBody, /Product type:/);
  assert.doesNotMatch(draftBody, /Internal margin/);
});

test('API draft generation can use a selected email template', async () => {
  const db = testDb();
  const lead = createLead(db, {
    company_name: 'Example Distributor',
    email: 'buyer@example.com',
    source_url: 'https://example.com/source',
    industry: 'import distributor'
  });
  const templateResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', {
      template_key: 'custom-intro',
      label: 'Custom intro',
      subject: 'Custom subject for {{company_name}}',
      body: 'Dear {{contact_name}}, custom body for {{company_name}}. Please reply unsubscribe.'
    }),
    templateResponse,
    db,
    new URL('http://localhost/api/templates'),
    runtimeConfig
  );
  const template = parse(templateResponse).template;

  const draftResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', {
      lead_id: lead.id,
      generation_mode: 'template',
      template_id: template.id
    }),
    draftResponse,
    db,
    new URL('http://localhost/api/drafts/generate'),
    runtimeConfig
  );
  db.close();

  const draft = parse(draftResponse).draft;
  assert.equal(draftResponse.statusCode, 201);
  assert.equal(draft.template_name, 'custom-intro');
  assert.equal(draft.subject, 'Custom subject for Example Distributor');
  assert.match(draft.body, /custom body for Example Distributor/);
});

test('API imports CSV sourced leads and sends one to CRM', async () => {
  const db = testDb();
  const importResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', {
      source_type: 'Trade Show',
      source_name: 'Test Expo',
      market_region: 'USA',
      csv_text: 'company_name,website,email,industry\nExample Expo Buyer,https://expo.example,buyer@expo.example,fiberglass insulation'
    }),
    importResponse,
    db,
    new URL('http://localhost/api/sourced-leads/import-csv'),
    runtimeConfig
  );
  const sourced = parse(importResponse).created[0];

  const crmResponse = new MockResponse();
  await handleApi(
    mockRequest('POST'),
    crmResponse,
    db,
    new URL(`http://localhost/api/sourced-leads/${sourced.id}/import`),
    runtimeConfig
  );
  db.close();

  assert.equal(importResponse.statusCode, 201);
  assert.equal(sourced.source_type, 'Trade Show');
  assert.ok(sourced.match_score > 0);
  assert.equal(crmResponse.statusCode, 201);
  assert.equal(parse(crmResponse).lead.company_name, 'Example Expo Buyer');
  assert.equal(parse(crmResponse).sourced_lead.status, 'Imported');
});

test('API lists and deletes sourced leads', async () => {
  const db = testDb();
  const importResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', {
      csv_text: 'company_name,website\nDelete Source,https://delete.example'
    }),
    importResponse,
    db,
    new URL('http://localhost/api/sourced-leads/import-csv'),
    runtimeConfig
  );
  const sourced = parse(importResponse).created[0];

  const listResponse = new MockResponse();
  await handleApi(
    mockRequest('GET'),
    listResponse,
    db,
    new URL('http://localhost/api/sourced-leads'),
    runtimeConfig
  );
  const deleteResponse = new MockResponse();
  await handleApi(
    mockRequest('DELETE'),
    deleteResponse,
    db,
    new URL(`http://localhost/api/sourced-leads/${sourced.id}`),
    runtimeConfig
  );
  db.close();

  assert.equal(parse(listResponse).sourced_leads.length, 1);
  assert.equal(deleteResponse.statusCode, 200);
});

test('API send route blocks before SMTP when settings are incomplete', async () => {
  const db = testDb();
  const lead = createLead(db, {
    company_name: 'Example Co.',
    email: 'buyer@example.com',
    source_url: 'https://example.com/source'
  });
  const draft = createDraft(db, {
    lead_id: lead.id,
    subject: 'Fiberglass materials',
    body: 'Please reply unsubscribe if this is not relevant.'
  });

  const response = new MockResponse();
  await handleApi(
    mockRequest('POST'),
    response,
    db,
    new URL(`http://localhost/api/drafts/${draft.id}/send`),
    runtimeConfig
  );
  db.close();

  assert.equal(response.statusCode, 400);
  assert.match(parse(response).errors.join('\n'), /SMTP password/i);
});

test('API settings update masks secret values', async () => {
  const db = testDb();
  const response = new MockResponse();
  await handleApi(
    mockRequest('PUT', {
      settings: {
        SMTP_PASS: { value: 'secret-password', is_secret: true },
        SMTP_HOST: { value: 'smtp.zmail300.cn', is_secret: false }
      }
    }),
    response,
    db,
    new URL('http://localhost/api/settings'),
    runtimeConfig
  );
  db.close();

  const settings = parse(response).settings;
  assert.equal(response.statusCode, 200);
  assert.equal(settings.find((setting) => setting.key === 'SMTP_PASS').value, '');
  assert.equal(settings.find((setting) => setting.key === 'SMTP_HOST').value, 'smtp.zmail300.cn');
});

test('API settings masks known secret keys even without client flag', async () => {
  const db = testDb();
  const response = new MockResponse();
  await handleApi(
    mockRequest('PUT', {
      settings: {
        SMTP_PASS: 'secret-password',
        AI_API_KEY: 'secret-key'
      }
    }),
    response,
    db,
    new URL('http://localhost/api/settings'),
    runtimeConfig
  );
  db.close();

  const settings = parse(response).settings;
  assert.equal(response.statusCode, 200);
  assert.equal(settings.find((setting) => setting.key === 'SMTP_PASS').value, '');
  assert.equal(settings.find((setting) => setting.key === 'AI_API_KEY').value, '');
});

test('API lists due followups and creates follow-up drafts', async () => {
  const db = testDb();
  const lead = createLead(db, {
    company_name: 'Follow Up Co.',
    email: 'buyer@example.com',
    source_url: 'https://example.com/source',
    next_follow_up_at: '2026-01-01T00:00:00.000Z'
  });

  const listResponse = new MockResponse();
  await handleApi(
    mockRequest('GET'),
    listResponse,
    db,
    new URL('http://localhost/api/followups'),
    runtimeConfig
  );
  const draftResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', { lead_id: lead.id, template_name: 'finalFollowup' }),
    draftResponse,
    db,
    new URL('http://localhost/api/followups/draft'),
    runtimeConfig
  );
  db.close();

  assert.equal(parse(listResponse).leads[0].company_name, 'Follow Up Co.');
  assert.equal(parse(draftResponse).draft.template_name, 'finalFollowup');
  assert.match(parse(draftResponse).draft.body, /final follow-up/i);
});

test('API lists template categories', async () => {
  const db = testDb();
  const response = new MockResponse();
  await handleApi(
    mockRequest('GET'),
    response,
    db,
    new URL('http://localhost/api/templates'),
    runtimeConfig
  );
  db.close();

  assert.equal(response.statusCode, 200);
  assert.ok(parse(response).templates.some((template) => template.template_key === 'followup'));
});

test('API creates, updates, and deletes custom templates but not built-ins', async () => {
  const db = testDb();
  const createdResponse = new MockResponse();
  await handleApi(
    mockRequest('POST', {
      template_key: 'temporary-template',
      label: 'Temporary template',
      subject: 'Temporary subject',
      body: 'Temporary body with unsubscribe.'
    }),
    createdResponse,
    db,
    new URL('http://localhost/api/templates'),
    runtimeConfig
  );
  const created = parse(createdResponse).template;

  const updatedResponse = new MockResponse();
  await handleApi(
    mockRequest('PUT', { label: 'Updated template' }),
    updatedResponse,
    db,
    new URL(`http://localhost/api/templates/${created.id}`),
    runtimeConfig
  );
  const deleteBuiltInResponse = new MockResponse();
  await handleApi(
    mockRequest('DELETE'),
    deleteBuiltInResponse,
    db,
    new URL('http://localhost/api/templates/1'),
    runtimeConfig
  );
  const deletedResponse = new MockResponse();
  await handleApi(
    mockRequest('DELETE'),
    deletedResponse,
    db,
    new URL(`http://localhost/api/templates/${created.id}`),
    runtimeConfig
  );
  db.close();

  assert.equal(createdResponse.statusCode, 201);
  assert.equal(parse(updatedResponse).template.label, 'Updated template');
  assert.equal(deleteBuiltInResponse.statusCode, 400);
  assert.equal(deletedResponse.statusCode, 200);
});

test('static server rejects paths outside public directory', () => {
  const response = new MockResponse();
  const served = serveStatic(response, '/../package.json');

  assert.equal(served, false);
  assert.equal(response.statusCode, 0);
});
