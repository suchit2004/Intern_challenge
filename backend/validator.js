const { callLLM } = require('./llmClient');

function validateSchema(schema) {
  const errors = [];
  if (!schema) return { valid: false, errors: ["Schema is undefined."] };

  const layers = ['db_schema', 'api_schema', 'ui_schema', 'auth_schema', 'business_rules'];
  for (const layer of layers) {
    if (!schema[layer]) errors.push(`Missing layer: 	ext${layer}`);
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = { validateSchema };