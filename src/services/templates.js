const DEFAULT_TEMPLATES = [
  {
    template_key: 'distributor',
    label: 'General importer or distributor',
    subject: 'Fiberglass yarn and fabric supplier from China',
    body: `Dear {{contact_name}},

I am contacting you from {{sender_company}}, a China-based manufacturer of fiberglass materials.

We supply {{product_line}} for industrial, construction, insulation, fire protection, transportation, and composite material applications. Specifications can be customized based on customer requirements.

{{product_reference}}{{lead_context}} May I know if you currently purchase {{product_line}}?

If relevant, we can provide product information, samples, and quotations for your review. Please share your required specification and application so we can check the suitable product information.

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`
  },
  {
    template_key: 'manufacturer',
    label: 'Manufacturer',
    subject: 'Fiberglass materials for manufacturing applications',
    body: `Dear {{contact_name}},

I am contacting you from {{sender_company}}, a China-based manufacturer of fiberglass materials.

We supply {{product_line}} for manufacturing, composite material, insulation, fire protection, transportation, and industrial applications. Specifications can be customized based on customer requirements.

{{product_reference}}{{lead_context}} May I know if you currently purchase {{product_line}}?

If relevant, we can provide product information, samples, and quotations for your review. Please share your required specification and application so we can check the suitable product information.

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`
  },
  {
    template_key: 'construction',
    label: 'Construction or insulation market',
    subject: 'Fiberglass fabric for construction and insulation applications',
    body: `Dear {{contact_name}},

I am contacting you from {{sender_company}}, a China-based manufacturer of fiberglass materials.

We supply {{product_line}} for construction, insulation, fire protection, transportation, and industrial applications. Specifications can be customized based on customer requirements.

{{product_reference}}{{lead_context}} May I know if you currently purchase {{product_line}}?

If relevant, we can provide product information, samples, and quotations for your review. Please share your required specification and application so we can check the suitable product information.

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`
  },
  {
    template_key: 'interestedReply',
    label: 'Customer interested reply',
    subject: 'Fiberglass material information for your review',
    body: `Dear {{contact_name}},

Thank you for your reply.

To recommend the right product, could you please share the following information?

{{product_reference}}1. Product type: fiberglass yarn or fiberglass fabric
2. Application
3. Required specification or sample photo
4. Estimated quantity
5. Destination country or port
6. Any packaging or certification requirements

After receiving these details, we will check internally and send suitable product information and quotation.

{{signature}}`
  },
  {
    template_key: 'followup',
    label: 'No-response follow-up',
    subject: 'Follow-up - fiberglass yarn and fabric',
    body: `Dear {{contact_name}},

I wanted to follow up on my previous email about {{product_line}}.

If your company is purchasing these materials, we would be glad to learn your requirements and check whether our products are suitable.

If this is not your responsibility, could you please forward this email to the purchasing or product team?

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`
  },
  {
    template_key: 'finalFollowup',
    label: 'Final follow-up',
    subject: 'Final follow-up - fiberglass materials',
    body: `Dear {{contact_name}},

This is my final follow-up regarding {{product_line}} supply.

If these products are relevant to your business, please let me know your application and required specification. If not, no further action is needed.

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`
  }
];

const PRODUCT_REFERENCE_FIELDS = [
  ['product_category', 'Product category'],
  ['product_name', 'Product name'],
  ['product_type', 'Product type'],
  ['material_or_glass_type', 'Material or glass type'],
  ['model_specification', 'Model or specification'],
  ['linear_density_tex', 'Linear density / tex'],
  ['weight', 'Weight'],
  ['width', 'Width'],
  ['roll_length', 'Roll length'],
  ['color', 'Color'],
  ['temperature_resistance', 'Temperature resistance'],
  ['surface_treatment', 'Surface treatment'],
  ['packaging', 'Packaging'],
  ['moq', 'MOQ'],
  ['customization_options', 'Customization options'],
  ['main_applications', 'Main applications'],
  ['available_documents', 'Available documents']
];

export function listTemplateCategories() {
  return DEFAULT_TEMPLATES.map(({ template_key, label }) => ({ key: template_key, label }));
}

export function chooseTemplate(lead = {}, requestedTemplate) {
  if (requestedTemplate && DEFAULT_TEMPLATES.some((template) => template.template_key === requestedTemplate)) {
    return requestedTemplate;
  }

  const text = `${lead.industry || ''} ${lead.notes || ''}`.toLowerCase();
  if (text.includes('construction') || text.includes('insulation') || text.includes('building')) {
    return 'construction';
  }
  if (text.includes('manufacturer') || text.includes('manufacturing') || text.includes('production') || text.includes('factory')) {
    return 'manufacturer';
  }
  return 'distributor';
}

function defaultTemplateFor(lead = {}, requestedTemplate) {
  const key = chooseTemplate(lead, requestedTemplate);
  return DEFAULT_TEMPLATES.find((template) => template.template_key === key) || DEFAULT_TEMPLATES[0];
}

function productLineForLead(lead = {}) {
  if (lead.product_fit === 'Fiberglass Yarn') return 'fiberglass yarn';
  if (lead.product_fit === 'Fiberglass Fabric') return 'fiberglass fabric';
  return 'fiberglass yarn and fiberglass fabric';
}

function leadContext(lead = {}) {
  if (lead.industry) return `I noticed that your company works in ${lead.industry}.`;
  if (lead.website) return `I reviewed your website and thought fiberglass materials may be relevant to your business.`;
  return 'I noticed that your business may be related to industrial fiberglass materials.';
}

export function productReferenceLines(product = {}) {
  return PRODUCT_REFERENCE_FIELDS
    .map(([key, label]) => {
      const value = String(product?.[key] || '').trim();
      return value ? `${label}: ${value}` : '';
    })
    .filter(Boolean);
}

function productReferenceText(product = {}) {
  const lines = productReferenceLines(product);
  if (!lines.length) return '';

  return `Selected product information:
${lines.map((line) => `- ${line}`).join('\n')}

`;
}

function signature(company = {}) {
  const companyName = company.name || 'Qinhuangdao Hengda Fiberglass Co., Ltd.';
  const website = company.website || 'https://www.hengdaboxian.com/';
  const address = company.address || 'Qinhuangdao, Hebei, China';
  return `Best regards,

Sales Team
${companyName}
Email: sales@hengdaboxian.com
Website: ${website}
Address: ${address}`;
}

function renderPlaceholders(text, values) {
  return String(text || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    return Object.hasOwn(values, key) ? values[key] : match;
  });
}

export function renderDraftFromTemplate(lead = {}, company = {}, template = null, product = null) {
  const selectedTemplate = typeof template === 'object' && template
    ? template
    : defaultTemplateFor(lead, template);
  const companyName = company.name || 'Qinhuangdao Hengda Fiberglass Co., Ltd.';
  const values = {
    contact_name: lead.contact_name || 'Purchasing Team',
    company_name: lead.company_name || '',
    product_line: productLineForLead(lead),
    lead_context: leadContext(lead),
    product_reference: productReferenceText(product),
    sender_company: companyName,
    sender_email: 'sales@hengdaboxian.com',
    sender_website: company.website || 'https://www.hengdaboxian.com/',
    sender_address: company.address || 'Qinhuangdao, Hebei, China',
    signature: signature(company)
  };

  return {
    subject: renderPlaceholders(selectedTemplate.subject, values),
    body: renderPlaceholders(selectedTemplate.body, values),
    draft_mode: 'template',
    template_name: selectedTemplate.template_key || '',
    ai_provider: ''
  };
}
