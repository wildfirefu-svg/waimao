import { productReferenceLines, renderDraftFromTemplate } from './templates.js';

const PROVIDERS = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4.1-mini'
  },
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-flash'
  }
};

function productPrompt(product) {
  const lines = productReferenceLines(product);
  if (!lines.length) return '';
  return `Selected product information:
${lines.map((line) => `- ${line}`).join('\n')}

`;
}

function buildPrompt(lead, company, product = null) {
  return `Write a concise English first-contact sales email.

Company sending: ${company.name}
Company website: ${company.website}
Company address: ${company.address}

Lead company: ${lead.company_name}
Contact name: ${lead.contact_name || 'Purchasing Team'}
Country/region: ${lead.country_region || lead.market_region || ''}
Website: ${lead.website || ''}
Industry: ${lead.industry || ''}
Product fit: ${lead.product_fit || 'Both'}
Fit reason: ${lead.fit_reason || ''}
Notes: ${lead.notes || ''}

${productPrompt(product)}
Rules:
- Use only the facts above.
- Do not invent certifications, production capacity, export countries, famous customers, technical parameters, lowest price, or best quality claims.
- If product specifications are blank, ask the customer for requirements instead of providing numbers.
- Include clear unsubscribe language using the word "unsubscribe".
- Return JSON with "subject" and "body" strings only.`;
}

function fallbackDraft(lead, company, provider = '', requestedTemplate, product = null) {
  return {
    ...renderDraftFromTemplate(lead, company, requestedTemplate, product),
    fallback_reason: provider ? 'ai_unavailable' : 'ai_not_configured'
  };
}

export async function generateDraft(lead, company, aiConfig = {}, requestedTemplate, product = null) {
  const provider = (aiConfig.provider || '').toLowerCase();
  const providerConfig = PROVIDERS[provider];
  if (!provider || !aiConfig.apiKey || !providerConfig) {
    return fallbackDraft(lead, company, provider, requestedTemplate, product);
  }

  try {
    const response = await fetch(providerConfig.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.model || providerConfig.defaultModel,
        messages: [
          {
            role: 'system',
            content: 'You draft compliant B2B cold outreach emails. Return strict JSON only.'
          },
          {
            role: 'user',
            content: buildPrompt(lead, company, product)
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    });

    if (!response.ok) return fallbackDraft(lead, company, provider, requestedTemplate, product);

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');
    if (!parsed.subject || !parsed.body || !/unsubscribe/i.test(parsed.body)) {
      return fallbackDraft(lead, company, provider, requestedTemplate, product);
    }

    return {
      subject: parsed.subject,
      body: parsed.body,
      draft_mode: 'ai',
      template_name: '',
      ai_provider: provider
    };
  } catch {
    return fallbackDraft(lead, company, provider, requestedTemplate, product);
  }
}
