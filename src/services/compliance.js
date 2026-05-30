const EUROPE_TERMS = [
  'europe',
  'eu',
  'european union',
  'united kingdom',
  'uk',
  'germany',
  'france',
  'italy',
  'spain',
  'netherlands',
  'poland',
  'belgium',
  'sweden',
  'norway',
  'denmark',
  'finland',
  'ireland',
  'austria',
  'switzerland'
];

const RISKY_CLAIMS = [
  /\biso\b/i,
  /\bce\b/i,
  /certified/i,
  /production capacity/i,
  /famous customer/i,
  /lowest price/i,
  /best quality/i
];

export function hasUnsubscribeLanguage(body) {
  return /unsubscribe/i.test(body || '');
}

export function hasMisleadingClaim(text) {
  return RISKY_CLAIMS.some((pattern) => pattern.test(text || ''));
}

export function isEuropeLead(lead) {
  const text = `${lead?.market_region || ''} ${lead?.country_region || ''}`.toLowerCase();
  return EUROPE_TERMS.some((term) => text === term || text.includes(term));
}

export function validateSmtpSettings(smtpConfig = {}) {
  const errors = [];
  if (!smtpConfig.host) errors.push('SMTP host is not configured.');
  if (!smtpConfig.port) errors.push('SMTP port is not configured.');
  if (!smtpConfig.user) errors.push('SMTP username is not configured.');
  if (!smtpConfig.pass) errors.push('SMTP password is not configured.');
  if (!smtpConfig.from) errors.push('SMTP sender address is not configured.');
  return errors;
}

export function validateDraftForSend(lead, draft, smtpConfig) {
  const errors = [];
  const warnings = [];

  if (!lead) {
    errors.push('Lead not found.');
  } else {
    if (!lead.email) errors.push('Lead email is required.');
    if (!lead.source_url) errors.push('Lead source URL is required.');
    if (lead.status === 'Unsubscribed' || lead.unsubscribed_at) {
      errors.push('Lead is unsubscribed. Sending is blocked.');
    }
    if (isEuropeLead(lead)) {
      warnings.push('Europe-region lead: review consent and outreach basis before sending.');
    }
  }

  if (!draft || !draft.subject || !draft.body) {
    errors.push('Draft subject and body are required.');
  } else {
    if (!hasUnsubscribeLanguage(draft.body)) {
      errors.push('Draft body must include unsubscribe language.');
    }
    if (hasMisleadingClaim(`${draft.subject}\n${draft.body}`)) {
      errors.push('Draft contains unconfirmed claims such as certification, capacity, lowest price, or best quality. Remove or verify them before sending.');
    }
  }

  errors.push(...validateSmtpSettings(smtpConfig));

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
