const { callLLM } = require('./llmClient');

function validateSchema(schema) {
  const errors = [];
  if (!schema) return { valid: false, errors: ["Schema is undefined."] };
  const layers = ['db_schema', 'api_schema', 'ui_schema', 'auth_schema', 'business_rules'];
  for (const layer of layers) {
    if (!schema[layer]) errors.push(`Missing layer: 	ext${layer}`);
  }
  if (errors.length > 0) return { valid: false, errors };

  const tables = new Set((schema.db_schema.tables || []).map(t => t.name.toLowerCase()));
  const dbTables = schema.db_schema.tables || [];
  
  if (dbTables.length === 0) {
    errors.push("Database schema defines no tables.");
  }

  dbTables.forEach(table => {
    const primaryKeys = (table.columns || []).filter(c => c.primary);
    if (primaryKeys.length === 0) {
      errors.push(`Table '	ext${table.name}' has no primary key.`);
    }

    (table.columns || []).forEach(col => {
      if (col.references) {
        const [refTable, refCol] = col.references.split('.');
        if (!refTable || !refCol) {
          errors.push(`Invalid foreign key format on '	ext${table.name}.	ext${col.name}': '	ext${col.references}'`);
        } else if (!tables.has(refTable.toLowerCase())) {
          errors.push(`Table '	ext${table.name}.	ext${col.name}' references non-existent table '	ext${refTable}'.`);
        }
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

module.exports = { validateSchema };