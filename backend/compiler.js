const { callLLM } = require('./llmClient');

async function runStage1(prompt, clientConfig) {
  const systemPrompt = `You are the first stage (Intent Extractor) of a software generation compiler. Return JSON.`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt: prompt, jsonMode: true });
  return JSON.parse(resultText.trim());
}

async function runStage2(intentData, clientConfig) {
  const systemPrompt = `You are the second stage (System Design Layer) of a software compiler. Return JSON.`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt: JSON.stringify(intentData), jsonMode: true });
  return JSON.parse(resultText.trim());
}

async function runStage3(designBlueprint, clientConfig) {
  const systemPrompt = `You are the third stage (Schema Generator) of a software compiler.
Generate a VALID JSON object with this exact structure:
{
  "db_schema": {
    "tables": [
      {
        "name": "table_name_lowercase",
        "columns": [
          { "name": "col_name", "type": "string|number|boolean", "primary": true/false, "nullable": true/false, "references": "table_name.col_name" (optional) }
        ]
      }
    ]
  },
  "api_schema": {
    "endpoints": [
      {
        "path": "/api/...",
        "method": "GET|POST|PUT|DELETE",
        "description": "...",
        "authRequired": true/false,
        "allowedRoles": ["Admin", "Member"],
        "requestBody": [
          { "name": "field_name", "type": "string|number|boolean", "required": true/false }
        ],
        "dbAction": {
          "type": "insert|select|update|delete",
          "targetTable": "table_name_lowercase",
          "queryConditions": [{"field": "col_name", "operator": "equals", "valueFrom": "body.field_name|auth.userId"}]
        }
      }
    ]
  },
  "ui_schema": {
    "pages": [
      {
        "name": "Dashboard|Contacts|checkout|etc",
        "icon": "home|users|chart|credit-card|settings",
        "layout": "grid|sidebar|standalone",
        "rolesAllowed": ["Admin", "Member", "Guest"],
        "widgets": [
          {
            "id": "w_1",
            "type": "metric|table|form|chart|payment_button",
            "title": "Widget Title",
            "targetTable": "table_name_lowercase",
            "dataSourceApi": "/api/...",
            "submitApi": "/api/...",
            "formFields": [
              { "name": "field_name", "label": "Label Text", "type": "text|number|email", "required": true }
            ]
          }
        ]
      }
    ]
  },
  "auth_schema": {
    "defaultRole": "Guest",
    "roles": ["Admin", "Member", "Guest"],
    "permissions": {
      "pages": { "Dashboard": ["Admin", "Member"], "Contacts": ["Admin", "Member"], "checkout": ["Guest", "Member"] },
      "apis": { "/api/contacts": ["Admin", "Member"] }
    }
  },
  "business_rules": {
    "premiumGating": {
      "enabled": true/false,
      "premiumRole": "PremiumUser",
      "gatedPages": ["Analytics"],
      "checkoutPage": "checkout"
    }
  }
}
Return raw valid JSON.`;

  const userPrompt = `Expand this Blueprint into the executable configuration schemas: 	ext${JSON.stringify(designBlueprint, null, 2)}`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt, jsonMode: true });
  return JSON.parse(resultText.trim());
}

module.exports = { runStage1, runStage2, runStage3 };