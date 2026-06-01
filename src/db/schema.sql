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

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sourced_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL DEFAULT 'Website',
  source_name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  country_region TEXT NOT NULL DEFAULT '',
  market_region TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  product_fit TEXT NOT NULL DEFAULT 'Both',
  fit_reason TEXT NOT NULL DEFAULT '',
  match_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Review',
  notes TEXT NOT NULL DEFAULT '',
  imported_lead_id INTEGER,
  raw_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (imported_lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

INSERT INTO products (product_category, product_type, available_documents)
SELECT 'Fiberglass Yarn', 'Fiberglass yarn / direct roving / plied yarn', 'TDS / COA / sample / quotation'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_category = 'Fiberglass Yarn');

INSERT INTO products (product_category, product_type, available_documents)
SELECT 'Fiberglass Fabric', 'Fiberglass cloth / mesh fabric / woven fabric', 'TDS / COA / sample / quotation'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_category = 'Fiberglass Fabric');

INSERT OR IGNORE INTO email_templates (template_key, label, subject, body, is_builtin)
VALUES (
  'distributor',
  'General importer or distributor',
  'Fiberglass yarn and fabric supplier from China',
  'Dear {{contact_name}},

I am contacting you from {{sender_company}}, a China-based manufacturer of fiberglass materials.

We supply {{product_line}} for industrial, construction, insulation, fire protection, transportation, and composite material applications. Specifications can be customized based on customer requirements.

{{product_reference}}{{lead_context}} May I know if you currently purchase {{product_line}}?

If relevant, we can provide product information, samples, and quotations for your review. Please share your required specification and application so we can check the suitable product information.

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.',
  1
);

INSERT OR IGNORE INTO email_templates (template_key, label, subject, body, is_builtin)
VALUES (
  'manufacturer',
  'Manufacturer',
  'Fiberglass materials for manufacturing applications',
  'Dear {{contact_name}},

I am contacting you from {{sender_company}}, a China-based manufacturer of fiberglass materials.

We supply {{product_line}} for manufacturing, composite material, insulation, fire protection, transportation, and industrial applications. Specifications can be customized based on customer requirements.

{{product_reference}}{{lead_context}} May I know if you currently purchase {{product_line}}?

If relevant, we can provide product information, samples, and quotations for your review. Please share your required specification and application so we can check the suitable product information.

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.',
  1
);

INSERT OR IGNORE INTO email_templates (template_key, label, subject, body, is_builtin)
VALUES (
  'construction',
  'Construction or insulation market',
  'Fiberglass fabric for construction and insulation applications',
  'Dear {{contact_name}},

I am contacting you from {{sender_company}}, a China-based manufacturer of fiberglass materials.

We supply {{product_line}} for construction, insulation, fire protection, transportation, and industrial applications. Specifications can be customized based on customer requirements.

{{product_reference}}{{lead_context}} May I know if you currently purchase {{product_line}}?

If relevant, we can provide product information, samples, and quotations for your review. Please share your required specification and application so we can check the suitable product information.

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.',
  1
);

INSERT OR IGNORE INTO email_templates (template_key, label, subject, body, is_builtin)
VALUES (
  'interestedReply',
  'Customer interested reply',
  'Fiberglass material information for your review',
  'Dear {{contact_name}},

Thank you for your reply.

To recommend the right product, could you please share the following information?

{{product_reference}}1. Product type: fiberglass yarn or fiberglass fabric
2. Application
3. Required specification or sample photo
4. Estimated quantity
5. Destination country or port
6. Any packaging or certification requirements

After receiving these details, we will check internally and send suitable product information and quotation.

{{signature}}',
  1
);

INSERT OR IGNORE INTO email_templates (template_key, label, subject, body, is_builtin)
VALUES (
  'followup',
  'No-response follow-up',
  'Follow-up - fiberglass yarn and fabric',
  'Dear {{contact_name}},

I wanted to follow up on my previous email about {{product_line}}.

If your company is purchasing these materials, we would be glad to learn your requirements and check whether our products are suitable.

If this is not your responsibility, could you please forward this email to the purchasing or product team?

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.',
  1
);

INSERT OR IGNORE INTO email_templates (template_key, label, subject, body, is_builtin)
VALUES (
  'finalFollowup',
  'Final follow-up',
  'Final follow-up - fiberglass materials',
  'Dear {{contact_name}},

This is my final follow-up regarding {{product_line}} supply.

If these products are relevant to your business, please let me know your application and required specification. If not, no further action is needed.

{{signature}}

If this is not relevant, please reply "unsubscribe" and we will not contact you again.',
  1
);
