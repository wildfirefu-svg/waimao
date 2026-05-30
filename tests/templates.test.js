import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDraft } from '../src/services/aiDraft.js';
import { chooseTemplate, renderDraftFromTemplate } from '../src/services/templates.js';

const company = {
  name: 'Qinhuangdao Hengda Fiberglass Co., Ltd.',
  website: 'https://www.hengdaboxian.com/',
  address: 'Qinhuangdao, Hebei, China'
};

test('template selection uses lead industry context', () => {
  assert.equal(chooseTemplate({ industry: 'construction insulation' }), 'construction');
  assert.equal(chooseTemplate({ industry: 'manufacturer of composites' }), 'manufacturer');
  assert.equal(chooseTemplate({ industry: 'import distributor' }), 'distributor');
});

test('template fallback generates an English draft with unsubscribe language', () => {
  const draft = renderDraftFromTemplate({
    contact_name: 'Alex',
    industry: 'construction insulation',
    product_fit: 'Fiberglass Fabric'
  }, company);

  assert.equal(draft.draft_mode, 'template');
  assert.equal(draft.template_name, 'construction');
  assert.match(draft.subject, /Fiberglass/i);
  assert.match(draft.body, /Dear Alex/);
  assert.match(draft.body, /unsubscribe/i);
  assert.doesNotMatch(draft.body, /\bISO\b|lowest price|best quality/i);
});

test('AI drafting falls back to templates when provider or API key is missing', async () => {
  const missingProvider = await generateDraft({ industry: 'construction' }, company, {
    provider: '',
    apiKey: ''
  });
  const unsupportedProvider = await generateDraft({ industry: 'manufacturer' }, company, {
    provider: 'unsupported',
    apiKey: 'secret'
  });

  assert.equal(missingProvider.draft_mode, 'template');
  assert.equal(missingProvider.fallback_reason, 'ai_not_configured');
  assert.equal(unsupportedProvider.draft_mode, 'template');
  assert.equal(unsupportedProvider.fallback_reason, 'ai_unavailable');
});
