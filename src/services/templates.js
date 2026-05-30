const SUBJECTS = {
  distributor: 'Fiberglass yarn and fabric supplier from China',
  manufacturer: 'Fiberglass materials for manufacturing applications',
  construction: 'Fiberglass fabric for construction and insulation applications',
  interestedReply: 'Fiberglass material information for your review',
  followup: 'Follow-up - fiberglass yarn and fabric',
  finalFollowup: 'Final follow-up - fiberglass materials'
};

export function listTemplateCategories() {
  return [
    { key: 'distributor', label: 'General importer or distributor' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'construction', label: 'Construction or insulation market' },
    { key: 'interestedReply', label: 'Customer interested reply' },
    { key: 'followup', label: 'No-response follow-up' },
    { key: 'finalFollowup', label: 'Final follow-up' }
  ];
}

export function chooseTemplate(lead = {}, requestedTemplate) {
  if (requestedTemplate && SUBJECTS[requestedTemplate]) return requestedTemplate;

  const text = `${lead.industry || ''} ${lead.notes || ''}`.toLowerCase();
  if (text.includes('construction') || text.includes('insulation') || text.includes('building')) {
    return 'construction';
  }
  if (text.includes('manufacturer') || text.includes('manufacturing') || text.includes('production') || text.includes('factory')) {
    return 'manufacturer';
  }
  return 'distributor';
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

export function renderDraftFromTemplate(lead = {}, company = {}, requestedTemplate) {
  const templateName = chooseTemplate(lead, requestedTemplate);
  const name = lead.contact_name || 'Purchasing Team';
  const companyName = company.name || 'Qinhuangdao Hengda Fiberglass Co., Ltd.';
  const website = company.website || 'https://www.hengdaboxian.com/';
  const address = company.address || 'Qinhuangdao, Hebei, China';
  const productLine = productLineForLead(lead);
  const signoff = `Best regards,

Sales Team
${companyName}
Email: sales@hengdaboxian.com
Website: ${website}
Address: ${address}`;

  if (templateName === 'followup') {
    return {
      subject: SUBJECTS.followup,
      body: `Dear ${name},

I wanted to follow up on my previous email about ${productLine}.

If your company is purchasing these materials, we would be glad to learn your requirements and check whether our products are suitable.

If this is not your responsibility, could you please forward this email to the purchasing or product team?

${signoff}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`,
      draft_mode: 'template',
      template_name: templateName,
      ai_provider: ''
    };
  }

  if (templateName === 'finalFollowup') {
    return {
      subject: SUBJECTS.finalFollowup,
      body: `Dear ${name},

This is my final follow-up regarding ${productLine} supply.

If these products are relevant to your business, please let me know your application and required specification. If not, no further action is needed.

${signoff}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`,
      draft_mode: 'template',
      template_name: templateName,
      ai_provider: ''
    };
  }

  if (templateName === 'interestedReply') {
    return {
      subject: SUBJECTS.interestedReply,
      body: `Dear ${name},

Thank you for your reply.

To recommend the right product, could you please share the following information?

1. Product type: fiberglass yarn or fiberglass fabric
2. Application
3. Required specification or sample photo
4. Estimated quantity
5. Destination country or port
6. Any packaging or certification requirements

After receiving these details, we will check internally and send suitable product information and quotation.

${signoff}`,
      draft_mode: 'template',
      template_name: templateName,
      ai_provider: ''
    };
  }

  const body = `Dear ${name},

I am contacting you from ${companyName}, a China-based manufacturer of fiberglass materials.

We supply ${productLine} for industrial, construction, insulation, fire protection, transportation, and composite material applications. Specifications can be customized based on customer requirements.

${leadContext(lead)} May I know if you currently purchase ${productLine}?

If relevant, we can provide product information, samples, and quotations for your review. Please share your required specification and application so we can check the suitable product information.

${signoff}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.`;

  return {
    subject: SUBJECTS[templateName],
    body,
    draft_mode: 'template',
    template_name: templateName,
    ai_provider: ''
  };
}
