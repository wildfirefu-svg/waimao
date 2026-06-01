const SOURCED_LEAD_FIELDS = [
  'source_type',
  'source_name',
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
  'match_score',
  'status',
  'notes',
  'imported_lead_id',
  'raw_text'
];

export function listSourcedLeads(db) {
  return db.prepare('SELECT * FROM sourced_leads ORDER BY updated_at DESC, id DESC').all();
}

export function getSourcedLead(db, id) {
  return db.prepare('SELECT * FROM sourced_leads WHERE id = ?').get(id);
}

export function createSourcedLead(db, input) {
  const result = db.prepare(`
    INSERT INTO sourced_leads (
      source_type, source_name, company_name, country_region, market_region,
      website, source_url, contact_name, email, industry, product_fit,
      fit_reason, match_score, status, notes, imported_lead_id, raw_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.source_type || 'Website',
    input.source_name || '',
    input.company_name || '',
    input.country_region || '',
    input.market_region || '',
    input.website || '',
    input.source_url || '',
    input.contact_name || '',
    input.email || '',
    input.industry || '',
    input.product_fit || 'Both',
    input.fit_reason || '',
    Number(input.match_score || 0),
    input.status || 'Review',
    input.notes || '',
    input.imported_lead_id || null,
    input.raw_text || ''
  );

  return getSourcedLead(db, Number(result.lastInsertRowid));
}

export function updateSourcedLead(db, id, input) {
  const current = getSourcedLead(db, id);
  if (!current) return undefined;

  const next = { ...current };
  for (const field of SOURCED_LEAD_FIELDS) {
    if (Object.hasOwn(input, field)) next[field] = input[field] ?? '';
  }

  db.prepare(`
    UPDATE sourced_leads SET
      source_type = ?, source_name = ?, company_name = ?, country_region = ?,
      market_region = ?, website = ?, source_url = ?, contact_name = ?,
      email = ?, industry = ?, product_fit = ?, fit_reason = ?, match_score = ?,
      status = ?, notes = ?, imported_lead_id = ?, raw_text = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.source_type,
    next.source_name,
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
    Number(next.match_score || 0),
    next.status,
    next.notes,
    next.imported_lead_id || null,
    next.raw_text,
    id
  );

  return getSourcedLead(db, id);
}

export function deleteSourcedLead(db, id) {
  const result = db.prepare('DELETE FROM sourced_leads WHERE id = ?').run(id);
  return result.changes > 0;
}

export function findSourcedLeadDuplicate(db, input) {
  if (input.website) {
    const byWebsite = db.prepare('SELECT * FROM sourced_leads WHERE website = ? LIMIT 1').get(input.website);
    if (byWebsite) return byWebsite;
  }
  if (input.email) {
    const byEmail = db.prepare('SELECT * FROM sourced_leads WHERE email = ? LIMIT 1').get(input.email);
    if (byEmail) return byEmail;
  }
  if (input.company_name) {
    return db.prepare('SELECT * FROM sourced_leads WHERE lower(company_name) = lower(?) LIMIT 1').get(input.company_name);
  }
  return undefined;
}
