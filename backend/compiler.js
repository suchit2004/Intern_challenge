const { callLLM } = require('./llmClient');

async function runStage1(prompt, clientConfig) {
  const systemPrompt = `You are the first stage (Intent Extractor) of a software generation compiler. Return intent JSON.`;
  const userPrompt = `Build an application based on these requirements: "	ext${prompt}"`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt, jsonMode: true });
  return JSON.parse(resultText.trim());
}

async function runStage2(intentData, clientConfig) {
  const systemPrompt = `You are the second stage (System Design Layer) of a software compiler.
Your task is to take a structured intent specification and convert it into a detailed system design blueprint.
You will specify:
1. Database layout
2. REST API endpoints needed
3. UI page layouts and buttons/actions
4. Role permissions mapping

Output a VALID JSON object containing:
{
  "databaseBlueprint": {
    "tables": [
      {
        "name": "TableName",
        "columns": [{"name": "colName", "type": "string|integer|boolean", "isPrimaryKey": true/false, "foreignKey": "OtherTable.id (optional)"}]
      }
    ]
  },
  "apiBlueprint": {
    "endpoints": [
      {
        "path": "/api/...",
        "method": "GET|POST|PUT|DELETE",
        "description": "what it does",
        "requiredRole": "Admin|Member|Guest|All",
        "dbOperation": "Reads TableName | Writes TableName"
      }
    ]
  },
  "uiBlueprint": {
    "pages": [
      {
        "name": "PageName",
        "layout": "dashboard|table|form|checkout",
        "components": [
          {
            "id": "comp_id",
            "type": "table|form|chart|button",
            "title": "Title",
            "action": "Navigates to PageName | Submits to /api/... (if button/form)"
          }
        ]
      }
    ]
  }
}
DO NOT include any explanation or markdown formatting outside the JSON.`;

  const userPrompt = `Convert this Intent Specification into a System Design Blueprint: 	ext${JSON.stringify(intentData, null, 2)}`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt, jsonMode: true });
  return JSON.parse(resultText.trim());
}

module.exports = { runStage1, runStage2 };