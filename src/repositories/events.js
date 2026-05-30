export function createEvent(db, input) {
  const result = db.prepare(`
    INSERT INTO contact_events (lead_id, email_draft_id, event_type, event_time, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.lead_id,
    input.email_draft_id || null,
    input.event_type,
    input.event_time || new Date().toISOString(),
    input.notes || '',
    input.created_by || 'Default'
  );

  return db.prepare('SELECT * FROM contact_events WHERE id = ?').get(Number(result.lastInsertRowid));
}

export function listEventsForLead(db, leadId) {
  return db.prepare(`
    SELECT * FROM contact_events
    WHERE lead_id = ?
    ORDER BY event_time DESC, id DESC
  `).all(leadId);
}
