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
  const apiOnlyPaths = new Set((schema.api_schema.endpoints || []).map(e => e.path));

  // DB tables validation
  const dbTables = schema.db_schema.tables || [];
  dbTables.forEach(table => {
    const primaryKeys = (table.columns || []).filter(c => c.primary);
    if (primaryKeys.length === 0) errors.push(`Table '	ext${table.name}' has no primary key.`);
  });

  // API endpoints validation
  const endpoints = schema.api_schema.endpoints || [];
  endpoints.forEach(endpoint => {
    if (endpoint.dbAction) {
      const targetTable = (endpoint.dbAction.targetTable || '').toLowerCase();
      if (targetTable && !tables.has(targetTable)) errors.push(`API targets missing '	ext${targetTable}'.`);
    }
  });

  // UI bindings validation
  const pages = schema.ui_schema.pages || [];
  pages.forEach(page => {
    const widgets = page.widgets || [];
    widgets.forEach(widget => {
      if (widget.targetTable) {
        const tTable = widget.targetTable.toLowerCase();
        if (!tables.has(tTable)) {
          errors.push(`Widget '	ext${widget.title}' on '	ext${page.name}' targets missing table '	ext${tTable}'.`);
        }
      }
      if (widget.dataSourceApi && !apiOnlyPaths.has(widget.dataSourceApi)) {
        errors.push(`Widget '	ext${widget.title}' on '	ext${page.name}' binds to missing API '	ext${widget.dataSourceApi}'.`);
      }
      if (widget.submitApi && !apiOnlyPaths.has(widget.submitApi)) {
        errors.push(`Widget '	ext${widget.title}' on '	ext${page.name}' binds to missing API '	ext${widget.submitApi}'.`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

module.exports = { validateSchema };