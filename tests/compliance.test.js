import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnsubscribeLanguage, validateDraftForSend } from '../src/services/compliance.js';

const completeSmtp = {
  host: 'smtp.zmail300.cn',
  port: 465,
  secure: true,
  user: 'sales@example.com',
  pass: 'secret',
  from: 'sales@example.com'
};

const lead = {
  company_name: 'Example Ltd.',
  email: 'buyer@example.com',
  source_url: 'https://example.com/source',
  status: 'New',
  market_region: 'USA'
};

const draft = {
  subject: 'Fiberglass materials',
  body: 'Please reply unsubscribe if this is not relevant.'
};

test('unsubscribe language detection is case-insensitive', () => {
  assert.equal(hasUnsubscribeLanguage('Reply UNSUBSCRIBE to stop contact.'), true);
  assert.equal(hasUnsubscribeLanguage('No opt-out wording here.'), false);
});

test('send guard passes complete compliant data', () => {
  const result = validateDraftForSend(lead, draft, completeSmtp);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('send guard blocks unsubscribed leads', () => {
  const result = validateDraftForSend({ ...lead, status: 'Unsubscribed' }, draft, completeSmtp);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unsubscribed/i);
});

test('send guard blocks missing source URL and unsubscribe language', () => {
  const result = validateDraftForSend(
    { ...lead, source_url: '' },
    { ...draft, body: 'Hello from Hengda.' },
    completeSmtp
  );

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /source URL/i);
  assert.match(result.errors.join('\n'), /unsubscribe/i);
});

test('send guard blocks incomplete SMTP settings', () => {
  const result = validateDraftForSend(lead, draft, { ...completeSmtp, pass: '' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /SMTP password/i);
});

test('send guard warns for Europe-region leads', () => {
  const result = validateDraftForSend(
    { ...lead, market_region: 'Europe', country_region: 'Germany' },
    draft,
    completeSmtp
  );

  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
});

test('send guard blocks unconfirmed risky claims', () => {
  const result = validateDraftForSend(
    lead,
    { ...draft, subject: 'ISO certified best quality fiberglass materials' },
    completeSmtp
  );

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unconfirmed claims/i);
});
