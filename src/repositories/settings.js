const SECRET_KEYS = new Set(['SMTP_PASS', 'AI_API_KEY']);

export function getSetting(db, key) {
  return db.prepare('SELECT * FROM app_settings WHERE key = ?').get(key);
}

export function setSetting(db, key, value, isSecret = false) {
  const secret = isSecret || SECRET_KEYS.has(key);
  db.prepare(`
    INSERT INTO app_settings (key, value, is_secret, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      is_secret = excluded.is_secret,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, value || '', secret ? 1 : 0);

  return getSetting(db, key);
}

export function getSettingsMap(db, { includeSecrets = false } = {}) {
  const rows = listSettings(db, { includeSecrets });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export function listSettings(db, { includeSecrets = false } = {}) {
  const rows = db.prepare('SELECT * FROM app_settings ORDER BY key').all();
  if (includeSecrets) return rows;

  return rows.map((row) => ({
    ...row,
    value: row.is_secret ? '' : row.value
  }));
}

export function setSettings(db, settings) {
  for (const [key, entry] of Object.entries(settings || {})) {
    if (entry && typeof entry === 'object' && Object.hasOwn(entry, 'value')) {
      setSetting(db, key, entry.value, Boolean(entry.is_secret));
    } else {
      setSetting(db, key, entry);
    }
  }
  return listSettings(db);
}
