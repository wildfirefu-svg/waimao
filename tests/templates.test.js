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

test('template drafts include only filled public product fields', () => {
  const draft = renderDraftFromTemplate({
    contact_name: 'Alex',
    industry: 'construction insulation',
    product_fit: 'Fiberglass Fabric'
  }, company, undefined, {
    product_category: 'Fiberglass Fabric',
    product_name: 'E-glass woven fabric',
    product_type: '',
    packaging: 'Carton and pallet',
    internal_notes: 'Offer lower price only after approval.'
  });

  assert.match(draft.body, /Selected product information/);
  assert.match(draft.body, /Product name: E-glass woven fabric/);
  assert.match(draft.body, /Packaging: Carton and pallet/);
  assert.doesNotMatch(draft.body, /Product type:/);
  assert.doesNotMatch(draft.body, /Offer lower price/);
});

test('template renderer applies custom template placeholders', () => {
  const draft = renderDraftFromTemplate({
    company_name: 'Example Buyer',
    contact_name: 'Alex',
    product_fit: 'Fiberglass Yarn'
  }, company, {
    template_key: 'custom',
    subject: 'Materials for {{company_name}}',
    body: 'Dear {{contact_name}}, we can discuss {{product_line}}. {{signature}}'
  });

  assert.equal(draft.template_name, 'custom');
  assert.equal(draft.subject, 'Materials for Example Buyer');
  assert.match(draft.body, /Dear Alex/);
  assert.match(draft.body, /fiberglass yarn/);
  assert.match(draft.body, /Qinhuangdao Hengda Fiberglass/);
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

test('DeepSeek provider uses DeepSeek chat completions endpoint and default model', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestBody = {};
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  subject: 'Fiberglass fabric for insulation applications',
                  body: 'We supply fiberglass fabric. Please reply unsubscribe if this is not relevant.'
                })
              }
            }
          ]
        };
      }
    };
  };

  try {
    const draft = await generateDraft(
      { company_name: 'Example Buyer', industry: 'insulation', product_fit: 'Fiberglass Fabric' },
      company,
      { provider: 'deepseek', apiKey: 'test-key', model: '' }
    );

    assert.equal(requestUrl, 'https://api.deepseek.com/chat/completions');
    assert.equal(requestBody.model, 'deepseek-flash');
    assert.equal(draft.draft_mode, 'ai');
    assert.equal(draft.ai_provider, 'deepseek');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
