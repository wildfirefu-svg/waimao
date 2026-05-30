PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  country_region TEXT NOT NULL DEFAULT '',
  market_region TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  product_fit TEXT NOT NULL DEFAULT 'Both',
  fit_reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New',
  owner_name TEXT NOT NULL DEFAULT 'Default',
  last_contacted_at TEXT,
  next_follow_up_at TEXT,
  unsubscribed_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_category TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  product_type TEXT NOT NULL DEFAULT '',
  material_or_glass_type TEXT NOT NULL DEFAULT '',
  model_specification TEXT NOT NULL DEFAULT '',
  linear_density_tex TEXT NOT NULL DEFAULT '',
  weight TEXT NOT NULL DEFAULT '',
  width TEXT NOT NULL DEFAULT '',
  roll_length TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  temperature_resistance TEXT NOT NULL DEFAULT '',
  surface_treatment TEXT NOT NULL DEFAULT '',
  packaging TEXT NOT NULL DEFAULT '',
  moq TEXT NOT NULL DEFAULT '',
  customization_options TEXT NOT NULL DEFAULT '',
  main_applications TEXT NOT NULL DEFAULT '',
  available_documents TEXT NOT NULL DEFAULT 'TDS / COA / sample / quotation',
  internal_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  draft_mode TEXT NOT NULL DEFAULT 'template',
  template_name TEXT NOT NULL DEFAULT '',
  ai_provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by TEXT NOT NULL DEFAULT 'Default',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  email_draft_id INTEGER,
  event_type TEXT NOT NULL,
  event_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'Default',
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (email_draft_id) REFERENCES email_drafts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  is_secret INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (product_category, product_type, available_documents)
SELECT 'Fiberglass Yarn', 'Fiberglass yarn / direct roving / plied yarn', 'TDS / COA / sample / quotation'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_category = 'Fiberglass Yarn');

INSERT INTO products (product_category, product_type, available_documents)
SELECT 'Fiberglass Fabric', 'Fiberglass cloth / mesh fabric / woven fabric', 'TDS / COA / sample / quotation'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_category = 'Fiberglass Fabric');
