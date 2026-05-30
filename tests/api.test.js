import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrate, openDatabase } from '../src/db/database.js';
import { createDraft } from '../src/repositories/drafts.js';
import { createLead } from '../src/repositories/leads.js';
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
  assert.ok(parse(response).templates.some((template) => template.key === 'followup'));
});

test('static server rejects paths outside public directory', () => {
  const response = new MockResponse();
  const served = serveStatic(response, '/../package.json');

  assert.equal(served, false);
  assert.equal(response.statusCode, 0);
});
