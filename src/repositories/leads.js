const LEAD_FIELDS = [
  'company_name',
  'country_region',
  'market_region',
  'website',
  'source_url',
  'contact_name',
  'email',
  'industry',
  'product_fit',
  'fit_reason',
  'status',
  'owner_name',
  'last_contacted_at',
  'next_follow_up_at',
  'unsubscribed_at',
  'notes'
];

export function listLeads(db) {
  return db.prepare('SELECT * FROM leads ORDER BY updated_at DESC, id DESC').all();
}

export function getLead(db, id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

export function createLead(db, input) {
  const result = db.prepare(`
    INSERT INTO leads (
      company_name, country_region, market_region, website, source_url,
      contact_name, email, industry, product_fit, fit_reason, status,
      owner_name, last_contacted_at, next_follow_up_at, unsubscribed_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.company_name,
    input.country_region || '',
    input.market_region || '',
    input.website || '',
    input.source_url || '',
    input.contact_name || '',
    input.email || '',
    input.industry || '',
    input.product_fit || 'Both',
    input.fit_reason || '',
    input.status || 'New',
    input.owner_name || 'Default',
    input.last_contacted_at || null,
    input.next_follow_up_at || null,
    input.unsubscribed_at || null,
    input.notes || ''
  );

  return getLead(db, Number(result.lastInsertRowid));
}

export function updateLead(db, id, input) {
  const current = getLead(db, id);
  if (!current) return undefined;

  const next = { ...current };
  for (const field of LEAD_FIELDS) {
    if (Object.hasOwn(input, field)) next[field] = input[field] ?? '';
  }

  db.prepare(`
    UPDATE leads SET
      company_name = ?, country_region = ?, market_region = ?, website = ?,
      source_url = ?, contact_name = ?, email = ?, industry = ?,
      product_fit = ?, fit_reason = ?, status = ?, owner_name = ?,
      last_contacted_at = ?, next_follow_up_at = ?, unsubscribed_at = ?,
      notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.company_name,
    next.country_region,
    next.market_region,
    next.website,
    next.source_url,
    next.contact_name,
    next.email,
    next.industry,
    next.product_fit,
    next.fit_reason,
    next.status,
    next.owner_name,
    next.last_contacted_at || null,
    next.next_follow_up_at || null,
    next.unsubscribed_at || null,
    next.notes,
    id
  );

  return getLead(db, id);
}

export function deleteLead(db, id) {
  const result = db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  return result.changes > 0;
}

export function markLeadUnsubscribed(db, id) {
  return updateLead(db, id, {
    status: 'Unsubscribed',
    unsubscribed_at: new Date().toISOString()
  });
}
