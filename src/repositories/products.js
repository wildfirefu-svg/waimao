const PRODUCT_FIELDS = [
  'product_category',
  'product_name',
  'product_type',
  'material_or_glass_type',
  'model_specification',
  'linear_density_tex',
  'weight',
  'width',
  'roll_length',
  'color',
  'temperature_resistance',
  'surface_treatment',
  'packaging',
  'moq',
  'customization_options',
  'main_applications',
  'available_documents',
  'internal_notes'
];

export function listProducts(db) {
  return db.prepare('SELECT * FROM products ORDER BY product_category, id').all();
}

export function getProduct(db, id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

export function createProduct(db, input) {
  const result = db.prepare(`
    INSERT INTO products (
      product_category, product_name, product_type, material_or_glass_type,
      model_specification, linear_density_tex, weight, width, roll_length,
      color, temperature_resistance, surface_treatment, packaging, moq,
      customization_options, main_applications, available_documents, internal_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.product_category,
    input.product_name || '',
    input.product_type || '',
    input.material_or_glass_type || '',
    input.model_specification || '',
    input.linear_density_tex || '',
    input.weight || '',
    input.width || '',
    input.roll_length || '',
    input.color || '',
    input.temperature_resistance || '',
    input.surface_treatment || '',
    input.packaging || '',
    input.moq || '',
    input.customization_options || '',
    input.main_applications || '',
    input.available_documents || 'TDS / COA / sample / quotation',
    input.internal_notes || ''
  );

  return getProduct(db, Number(result.lastInsertRowid));
}

export function updateProduct(db, id, input) {
  const current = getProduct(db, id);
  if (!current) return undefined;

  const next = { ...current };
  for (const field of PRODUCT_FIELDS) {
    if (Object.hasOwn(input, field)) next[field] = input[field] ?? '';
  }

  db.prepare(`
    UPDATE products SET
      product_category = ?, product_name = ?, product_type = ?,
      material_or_glass_type = ?, model_specification = ?,
      linear_density_tex = ?, weight = ?, width = ?, roll_length = ?,
      color = ?, temperature_resistance = ?, surface_treatment = ?,
      packaging = ?, moq = ?, customization_options = ?,
      main_applications = ?, available_documents = ?, internal_notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.product_category,
    next.product_name,
    next.product_type,
    next.material_or_glass_type,
    next.model_specification,
    next.linear_density_tex,
    next.weight,
    next.width,
    next.roll_length,
    next.color,
    next.temperature_resistance,
    next.surface_treatment,
    next.packaging,
    next.moq,
    next.customization_options,
    next.main_applications,
    next.available_documents,
    next.internal_notes,
    id
  );

  return getProduct(db, id);
}
