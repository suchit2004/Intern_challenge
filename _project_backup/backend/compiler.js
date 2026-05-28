const { callLLM } = require('./llmClient');
const { validateSchema, repairSchema } = require('./validator');

/**
 * Runs Stage 1: Intent Extraction
 * Translates natural language into a structured feature checklist and conceptual blueprint.
 */
async function runStage1(prompt, clientConfig) {
  const systemPrompt = `You are the first stage (Intent Extractor) of a software generation compiler.
Your task is to parse open-ended user requirements and extract a clean structured representation.
You must output a VALID JSON object containing:
{
  "projectName": "Short name of the project",
  "description": "Clean project description",
  "roles": ["Array of user roles required, e.g., Admin, Member, Guest"],
  "features": [
    {
      "name": "Feature name",
      "description": "What it does",
      "premiumGated": true/false (if it requires payment/premium tier)
    }
  ],
  "entities": ["Database entities needed, e.g., User, Contact, Order"],
  "pages": ["Dashboard, Contacts, Analytics, checkout, etc."],
  "vagueOrConflictingFlags": [
    "List of warnings if requirements are contradictory, vague, or missing. E.g., 'Payments requested but no payment tier defined. Assumption: premium plan gets payment flow.'"
  ],
  "assumptionsMade": [
    "List of design assumptions you made to resolve missing info."
  ]
}

DO NOT include any explanation or markdown formatting outside the JSON. Return raw valid JSON.`;

  const userPrompt = `Build an application based on these requirements: "${prompt}"`;

  const resultText = await callLLM({
    ...clientConfig,
    systemPrompt,
    userPrompt,
    jsonMode: true
  });

  return JSON.parse(resultText.trim());
}

/**
 * Runs Stage 2: System Design
 * Converts the structured intent list into a conceptual software architecture.
 */
async function runStage2(intentData, clientConfig) {
  const systemPrompt = `You are the second stage (System Design Layer) of a software compiler.
Your task is to take a structured intent specification and convert it into a detailed system design blueprint.
You will specify:
1. Database layout (entities and attributes with basic types)
2. REST API endpoints needed for the features
3. UI page layouts and what buttons/actions are on each page
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

DO NOT include any explanation or markdown formatting outside the JSON. Return raw valid JSON.`;

  const userPrompt = `Convert this Intent Specification into a System Design Blueprint: ${JSON.stringify(intentData, null, 2)}`;

  const resultText = await callLLM({
    ...clientConfig,
    systemPrompt,
    userPrompt,
    jsonMode: true
  });

  return JSON.parse(resultText.trim());
}

/**
 * Runs Stage 3: Schema Generation
 * Fills out the detailed schemas (UI, API, DB, Auth, Logic) matching the design.
 */
async function runStage3(designBlueprint, clientConfig) {
  const systemPrompt = `You are the third stage (Schema Generator) of a software compiler.
Your task is to write the final concrete executable configuration schemas.
These schemas will directly instruct a dynamic web runtime engine on how to render and run the application.

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
          "queryConditions": [{"field": "col_name", "operator": "equals", "valueFrom": "body.field_name|auth.userId|auth.role"}]
        }
      }
    ]
  },
  "ui_schema": {
    "pages": [
      {
        "name": "Dashboard|Contacts|Analytics|checkout|etc",
        "icon": "home|users|chart|credit-card|settings",
        "layout": "grid|sidebar|standalone",
        "rolesAllowed": ["Admin", "Member", "Guest"],
        "widgets": [
          {
            "id": "w_1",
            "type": "metric|table|form|chart|payment_button",
            "title": "Widget Title",
            "targetTable": "table_name_lowercase", (if table or form)
            "dataSourceApi": "/api/...", (if table or chart needs data)
            "submitApi": "/api/...", (if form or payment_button triggers API)
            "formFields": [ (if type is form)
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
      "pages": { "Dashboard": ["Admin", "Member"], "Contacts": ["Admin", "Member"], "Analytics": ["Admin"], "checkout": ["Guest", "Member"] },
      "apis": { "/api/contacts": ["Admin", "Member"], "/api/analytics": ["Admin"] }
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

CRITICAL RULES:
1. Ensure Table Names and Column Names in the db_schema are lowercase and consistent.
2. Every API endpoint that touches the database must specify a valid targetTable from the db_schema.
3. Every UI widget that renders data from an API or submits a form to an API must use a valid path from the api_schema.
4. If the app requires premium plans or payments, enable premiumGating and restrict specific pages to the premium role.

DO NOT include any explanation or markdown formatting outside the JSON. Return raw valid JSON.`;

  const userPrompt = `Expand this Blueprint into the executable configuration schemas: ${JSON.stringify(designBlueprint, null, 2)}`;

  const resultText = await callLLM({
    ...clientConfig,
    systemPrompt,
    userPrompt,
    jsonMode: true
  });

  return JSON.parse(resultText.trim());
}

/**
 * Executes the entire compilation pipeline:
 * Intent Extractor -> System Design -> Schema Generator -> Validation & Repair -> Validated Config
 */
async function compileApp(userPrompt, clientConfig, onProgress) {
  const logs = [];
  const log = (stage, message, details = null) => {
    const entry = { timestamp: new Date().toISOString(), stage, message, details };
    logs.push(entry);
    if (onProgress) onProgress(entry);
  };

  let startTime = Date.now();
  let intentData = null;
  let designBlueprint = null;
  let rawSchema = null;
  let finalSchema = null;
  let stats = {
    totalLatencyMs: 0,
    stages: {},
    repairRetries: 0
  };

  try {
    // ----------------------------------------------------
    // STAGE 1: INTENT EXTRACTION
    // ----------------------------------------------------
    log('Stage 1: Intent Extraction', 'Parsing user requirements into structured feature catalog...');
    const s1Start = Date.now();
    intentData = await runStage1(userPrompt, clientConfig);
    stats.stages.intentExtraction = { latencyMs: Date.now() - s1Start };
    log('Stage 1: Intent Extraction', 'Success: Extracted requirements blueprint.', intentData);

    // ----------------------------------------------------
    // STAGE 2: SYSTEM DESIGN
    // ----------------------------------------------------
    log('Stage 2: System Design', 'Converting intent into detailed system layout...');
    const s2Start = Date.now();
    designBlueprint = await runStage2(intentData, clientConfig);
    stats.stages.systemDesign = { latencyMs: Date.now() - s2Start };
    log('Stage 2: System Design', 'Success: Generated architecture blueprint.', designBlueprint);

    // ----------------------------------------------------
    // STAGE 3: SCHEMA GENERATION
    // ----------------------------------------------------
    log('Stage 3: Schema Generation', 'Writing execution JSON schemas (UI, API, DB, Auth)...');
    const s3Start = Date.now();
    rawSchema = await runStage3(designBlueprint, clientConfig);
    stats.stages.schemaGeneration = { latencyMs: Date.now() - s3Start };
    log('Stage 3: Schema Generation', 'Success: Compiled raw executable schemas.', rawSchema);

    // ----------------------------------------------------
    // STAGE 4: REFINEMENT, VALIDATION & REPAIR LOOP
    // ----------------------------------------------------
    log('Stage 4: Refinement Layer', 'Initiating semantic validation checks...');
    const validationResult = validateSchema(rawSchema);

    if (validationResult.valid) {
      log('Stage 4: Refinement Layer', 'Semantic validation PASSED. Config is executable.');
      finalSchema = rawSchema;
    } else {
      log('Stage 4: Refinement Layer', 'Semantic validation FAILED. Attempting automated repair...', validationResult.errors);
      
      let currentSchema = rawSchema;
      let errors = validationResult.errors;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        retries++;
        stats.repairRetries = retries;
        log('Stage 4: Refinement Layer', `Repair Cycle ${retries}/${maxRetries}...`);
        
        try {
          const repaired = await repairSchema(currentSchema, errors, clientConfig);
          log('Stage 4: Refinement Layer', `Repair Cycle ${retries} output received. Running re-validation...`);
          
          const reCheck = validateSchema(repaired);
          if (reCheck.valid) {
            log('Stage 4: Refinement Layer', `Auto-Repair SUCCESSFUL. Resolved all inconsistencies in ${retries} retry/retries.`);
            finalSchema = repaired;
            break;
          } else {
            log('Stage 4: Refinement Layer', `Re-validation FAILED. Errors remain.`, reCheck.errors);
            currentSchema = repaired;
            errors = reCheck.errors;
          }
        } catch (repairErr) {
          log('Stage 4: Refinement Layer', `Error during repair cycle ${retries}: ${repairErr.message}`);
        }
      }

      if (!finalSchema) {
        log('Stage 4: Refinement Layer', 'Failed to auto-repair schemas within maximum retries. Falling back to raw generated config.');
        finalSchema = rawSchema;
      }
    }

  } catch (error) {
    log('Pipeline Error', `Failed at compiled stage: ${error.message}`);
    throw error;
  }

  stats.totalLatencyMs = Date.now() - startTime;
  
  return {
    success: !!finalSchema,
    prompt: userPrompt,
    intentData,
    designBlueprint,
    schemas: finalSchema || rawSchema,
    logs,
    stats
  };
}

module.exports = { compileApp };
