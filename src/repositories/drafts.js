const DRAFT_FIELDS = [
  'subject',
  'body',
  'draft_mode',
  'template_name',
  'ai_provider',
  'status',
  'sent_at'
];

export function getDraft(db, id) {
  return db.prepare('SELECT * FROM email_drafts WHERE id = ?').get(id);
}

export function listDrafts(db) {
  return db.prepare('SELECT * FROM email_drafts ORDER BY updated_at DESC, id DESC').all();
}

export function listDraftsForLead(db, leadId) {
  return db.prepare('SELECT * FROM email_drafts WHERE lead_id = ? ORDER BY updated_at DESC, id DESC').all(leadId);
}

export function createDraft(db, input) {
  const result = db.prepare(`
    INSERT INTO email_drafts (
      lead_id, subject, body, draft_mode, template_name, ai_provider, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.lead_id,
    input.subject,
    input.body,
    input.draft_mode || 'template',
    input.template_name || '',
    input.ai_provider || '',
    input.status || 'Draft',
    input.created_by || 'Default'
  );

  return getDraft(db, Number(result.lastInsertRowid));
}

export function updateDraft(db, id, input) {
  const current = getDraft(db, id);
  if (!current) return undefined;

  const next = { ...current };
  for (const field of DRAFT_FIELDS) {
    if (Object.hasOwn(input, field)) next[field] = input[field] ?? '';
  }

  db.prepare(`
    UPDATE email_drafts SET
      subject = ?, body = ?, draft_mode = ?, template_name = ?, ai_provider = ?,
      status = ?, sent_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.subject,
    next.body,
    next.draft_mode,
    next.template_name,
    next.ai_provider,
    next.status,
    next.sent_at || null,
    id
  );

  return getDraft(db, id);
}
