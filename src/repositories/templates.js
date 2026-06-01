const TEMPLATE_FIELDS = [
  'template_key',
  'label',
  'subject',
  'body'
];

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

export function listTemplates(db) {
  return db.prepare('SELECT * FROM email_templates ORDER BY is_builtin DESC, id').all();
}

export function getTemplate(db, id) {
  return db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id);
}

export function getTemplateByKey(db, key) {
  return db.prepare('SELECT * FROM email_templates WHERE template_key = ?').get(key);
}

export function createTemplate(db, input) {
  const key = normalizeKey(input.template_key || input.label);
  const result = db.prepare(`
    INSERT INTO email_templates (template_key, label, subject, body, is_builtin)
    VALUES (?, ?, ?, ?, 0)
  `).run(
    key,
    input.label || key,
    input.subject || '',
    input.body || ''
  );

  return getTemplate(db, Number(result.lastInsertRowid));
}

export function updateTemplate(db, id, input) {
  const current = getTemplate(db, id);
  if (!current) return undefined;

  const next = { ...current };
  for (const field of TEMPLATE_FIELDS) {
    if (Object.hasOwn(input, field)) next[field] = input[field] ?? '';
  }
  next.template_key = normalizeKey(next.template_key);

  db.prepare(`
    UPDATE email_templates SET
      template_key = ?, label = ?, subject = ?, body = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.template_key,
    next.label,
    next.subject,
    next.body,
    id
  );

  return getTemplate(db, id);
}

export function deleteTemplate(db, id) {
  const current = getTemplate(db, id);
  if (!current) return { ok: false, reason: 'missing' };
  if (current.is_builtin) return { ok: false, reason: 'builtin' };
  db.prepare('DELETE FROM email_templates WHERE id = ?').run(id);
  return { ok: true };
}
