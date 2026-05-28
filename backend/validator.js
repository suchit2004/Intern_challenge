const { callLLM } = require('./llmClient');

/**
 * Validates the generated app schema for cross-layer semantic consistency.
 * @param {Object} schema - The generated 5-layer schema config
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateSchema(schema) {
  const errors = [];

  if (!schema) {
    return { valid: false, errors: ["Schema is empty or undefined."] };
  }

  // 1. Syntactic Structure Checks
  const layers = ['db_schema', 'api_schema', 'ui_schema', 'auth_schema', 'business_rules'];
  for (const layer of layers) {
    if (!schema[layer]) {
      errors.push(`Missing core layer: '${layer}'`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Collect references for cross-validation
  const tables = new Set((schema.db_schema.tables || []).map(t => t.name.toLowerCase()));
  const apiPaths = new Set((schema.api_schema.endpoints || []).map(e => `${e.method.toUpperCase()} ${e.path}`));
  const apiOnlyPaths = new Set((schema.api_schema.endpoints || []).map(e => e.path));
  const authRoles = new Set(schema.auth_schema.roles || []);

  // 2. Database Schema Checks
  const dbTables = schema.db_schema.tables || [];
  if (dbTables.length === 0) {
    errors.push("Database schema defines no tables.");
  }
  dbTables.forEach(table => {
    const primaryKeys = (table.columns || []).filter(c => c.primary);
    if (primaryKeys.length === 0) {
      errors.push(`Database table '${table.name}' has no primary key defined.`);
    }

    // Check foreign key references
    (table.columns || []).forEach(col => {
      if (col.references) {
        // e.g., "users.id"
        const [refTable, refCol] = col.references.split('.');
        if (!refTable || !refCol) {
          errors.push(`Invalid foreign key format on table '${table.name}', column '${col.name}': '${col.references}'`);
        } else if (!tables.has(refTable.toLowerCase())) {
          errors.push(`Table '${table.name}', column '${col.name}' references non-existent table '${refTable}'.`);
        }
      }
    });
  });

  // 3. API Schema vs Database Schema Checks
  const endpoints = schema.api_schema.endpoints || [];
  endpoints.forEach(endpoint => {
    if (endpoint.dbAction) {
      const targetTable = (endpoint.dbAction.targetTable || '').toLowerCase();
      if (targetTable && !tables.has(targetTable)) {
        errors.push(`API endpoint '${endpoint.method} ${endpoint.path}' references database table '${targetTable}' which does not exist in the database schema.`);
      }
    }
  });

  // 4. UI Schema vs API & DB Schema Checks
  const pages = schema.ui_schema.pages || [];
  pages.forEach(page => {
    // Check page roles
    (page.rolesAllowed || []).forEach(role => {
      if (!authRoles.has(role)) {
        errors.push(`UI Page '${page.name}' allows role '${role}' which is not defined in the Auth roles.`);
      }
    });

    const widgets = page.widgets || [];
    widgets.forEach(widget => {
      // If table/form points to a database table directly
      if (widget.targetTable) {
        const tTable = widget.targetTable.toLowerCase();
        if (!tables.has(tTable)) {
          errors.push(`Widget '${widget.title}' on page '${page.name}' references database table '${tTable}' which does not exist.`);
        }
      }

      // Check bound API endpoints with method awareness
      if (widget.type === 'form') {
        const effectiveSubmitApi = widget.submitApi || (widget.targetTable ? `/api/${widget.targetTable.toLowerCase()}` : null);
        if (effectiveSubmitApi) {
          if (!apiPaths.has(`POST ${effectiveSubmitApi}`)) {
            errors.push(`Form Widget '${widget.title}' on page '${page.name}' requires a 'POST ${effectiveSubmitApi}' endpoint in the API schema.`);
          }
        } else {
          errors.push(`Form Widget '${widget.title}' on page '${page.name}' must define either 'submitApi' or 'targetTable'.`);
        }
      }

      if (widget.dataSourceApi) {
        if (!apiPaths.has(`GET ${widget.dataSourceApi}`)) {
          errors.push(`Widget '${widget.title}' on page '${page.name}' binds to GET dataSourceApi '${widget.dataSourceApi}' which does not exist in the API schema.`);
        }
      }

      if (widget.submitApi && widget.type !== 'form') {
        if (!apiOnlyPaths.has(widget.submitApi)) {
          errors.push(`Widget '${widget.title}' on page '${page.name}' binds to submitApi '${widget.submitApi}' which does not exist in the API schema.`);
        }
      }
    });
  });

  // 5. Auth Permissions consistency checks
  const permissions = schema.auth_schema.permissions || {};
  if (permissions.pages) {
    Object.keys(permissions.pages).forEach(pageName => {
      const roles = permissions.pages[pageName] || [];
      roles.forEach(role => {
        if (!authRoles.has(role)) {
          errors.push(`Auth page permissions reference undefined role: '${role}' on page '${pageName}'.`);
        }
      });
    });
  }

  if (permissions.apis) {
    Object.keys(permissions.apis).forEach(apiPath => {
      if (!apiOnlyPaths.has(apiPath)) {
        errors.push(`Auth API permissions references route '${apiPath}' which is not defined in the API schema.`);
      }
      const roles = permissions.apis[apiPath] || [];
      roles.forEach(role => {
        if (!authRoles.has(role)) {
          errors.push(`Auth API permissions reference undefined role: '${role}' for route '${apiPath}'.`);
        }
      });
    });
  }

  // 6. Premium Gating Check
  const pg = schema.business_rules?.premiumGating;
  if (pg && pg.enabled) {
    if (pg.premiumRole && !authRoles.has(pg.premiumRole)) {
      errors.push(`Premium Gating refers to premiumRole '${pg.premiumRole}' which does not exist in the Auth roles.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sends a faulty schema and its error log to the LLM to patch and correct.
 * @param {Object} schema - The invalid schema config
 * @param {string[]} errors - List of semantic discrepancies
 * @param {Object} clientConfig - API key and model config
 * @returns {Promise<Object>} Repaired schema JSON object
 */
async function repairSchema(schema, errors, clientConfig) {
  const systemPrompt = `You are the Auto-Repair Engine of a software compiler.
Your task is to correct semantic errors and cross-layer inconsistencies in a generated application schema configuration.
You must review the provided schema and the validation errors list, patch the inconsistencies, and output the entire corrected JSON schema.

RULES:
1. Correct the specific mismatches (e.g. if a widget calls a missing API, define that API; if an API references a missing table, create the table or map to an existing one).
2. Maintain all original feature intents (e.g. payments, dashboard pages, contacts logic).
3. Do not modify the JSON structure contracts. Return only the valid corrected JSON.
4. DO NOT write explanations or markdown blocks (other than valid JSON) in your response. Output raw JSON only.`;

  const userPrompt = `Validation Errors Found:
${JSON.stringify(errors, null, 2)}

Current Faulty Schema Configuration:
${JSON.stringify(schema, null, 2)}

Please output the fully corrected JSON schema.`;

  const resultText = await callLLM({
    ...clientConfig,
    systemPrompt,
    userPrompt,
    jsonMode: true
  });

  return JSON.parse(resultText.trim());
}

module.exports = { validateSchema, repairSchema };