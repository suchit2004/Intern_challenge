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
  const authRoles = new Set(schema.auth_schema.roles || []);

  const dbTables = schema.db_schema.tables || [];
  dbTables.forEach(table => {
    const primaryKeys = (table.columns || []).filter(c => c.primary);
    if (primaryKeys.length === 0) errors.push(`Table '	ext${table.name}' has no primary key.`);
  });

  const endpoints = schema.api_schema.endpoints || [];
  endpoints.forEach(endpoint => {
    if (endpoint.dbAction) {
      const targetTable = (endpoint.dbAction.targetTable || '').toLowerCase();
      if (targetTable && !tables.has(targetTable)) errors.push(`API targets missing '	ext${targetTable}'.`);
    }
  });

  const pages = schema.ui_schema.pages || [];
  pages.forEach(page => {
    (page.rolesAllowed || []).forEach(role => {
      if (!authRoles.has(role)) errors.push(`Page '	ext${page.name}' references undefined role '	ext${role}'.`);
    });
    const widgets = page.widgets || [];
    widgets.forEach(widget => {
      if (widget.targetTable && !tables.has(widget.targetTable.toLowerCase())) errors.push(`Widget targets missing table '	ext${widget.targetTable}'.`);
      if (widget.dataSourceApi && !apiOnlyPaths.has(widget.dataSourceApi)) errors.push(`Widget binds to missing API '	ext${widget.dataSourceApi}'.`);
      if (widget.submitApi && !apiOnlyPaths.has(widget.submitApi)) errors.push(`Widget binds to missing API '	ext${widget.submitApi}'.`);
    });
  });

  // Auth vs API matching checks
  const permissions = schema.auth_schema.permissions || {};
  if (permissions.apis) {
    Object.keys(permissions.apis).forEach(apiPath => {
      if (!apiOnlyPaths.has(apiPath)) {
        errors.push(`Auth permissions reference undefined API route: '	ext${apiPath}'.`);
      }
    });
  }

  // Premium gating check
  const pg = schema.business_rules?.premiumGating;
  if (pg && pg.enabled) {
    if (pg.premiumRole && !authRoles.has(pg.premiumRole)) {
      errors.push(`Premium Gating references non-existent role '	ext${pg.premiumRole}'.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateSchema };