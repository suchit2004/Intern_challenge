const { callLLM } = require('./llmClient');
const { validateSchema, repairSchema } = require('./validator');

async function runStage1(prompt, clientConfig) {
  const systemPrompt = `You are the first stage (Intent Extractor) of a software generation compiler. Output intent JSON.`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt: prompt, jsonMode: true });
  return JSON.parse(resultText.trim());
}

async function runStage2(intentData, clientConfig) {
  const systemPrompt = `You are the second stage (System Design Layer) of a software compiler. Output system blueprint JSON.`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt: JSON.stringify(intentData), jsonMode: true });
  return JSON.parse(resultText.trim());
}

async function runStage3(designBlueprint, clientConfig) {
  const systemPrompt = `You are the third stage (Schema Generator) of a software compiler. Output schema JSON.`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt: JSON.stringify(designBlueprint), jsonMode: true });
  return JSON.parse(resultText.trim());
}

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
  let stats = { totalLatencyMs: 0, stages: {}, repairRetries: 0 };

  try {
    log('Stage 1: Intent Extraction', 'Parsing user requirements into structured feature catalog...');
    const s1Start = Date.now();
    intentData = await runStage1(userPrompt, clientConfig);
    stats.stages.intentExtraction = { latencyMs: Date.now() - s1Start };
    log('Stage 1: Intent Extraction', 'Success: Extracted requirements blueprint.', intentData);

    log('Stage 2: System Design', 'Converting intent into detailed system layout...');
    const s2Start = Date.now();
    designBlueprint = await runStage2(intentData, clientConfig);
    stats.stages.systemDesign = { latencyMs: Date.now() - s2Start };
    log('Stage 2: System Design', 'Success: Generated architecture blueprint.', designBlueprint);

    log('Stage 3: Schema Generation', 'Writing execution JSON schemas (UI, API, DB, Auth)...');
    const s3Start = Date.now();
    rawSchema = await runStage3(designBlueprint, clientConfig);
    stats.stages.schemaGeneration = { latencyMs: Date.now() - s3Start };
    log('Stage 3: Schema Generation', 'Success: Compiled raw executable schemas.', rawSchema);

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
        log('Stage 4: Refinement Layer', `Repair Cycle 	ext${retries}/3...`);
        try {
          const repaired = await repairSchema(currentSchema, errors, clientConfig);
          log('Stage 4: Refinement Layer', `Repair Cycle 	ext${retries} output received. Running re-validation...`);
          const reCheck = validateSchema(repaired);
          if (reCheck.valid) {
            log('Stage 4: Refinement Layer', `Auto-Repair SUCCESSFUL. Resolved inconsistencies.`);
            finalSchema = repaired;
            break;
          } else {
            currentSchema = repaired;
            errors = reCheck.errors;
          }
        } catch (repairErr) {
          log('Stage 4: Refinement Layer', `Error: 	ext${repairErr.message}`);
        }
      }
      if (!finalSchema) finalSchema = rawSchema;
    }
  } catch (error) {
    log('Pipeline Error', `Failed at stage: 	ext${error.message}`);
    throw error;
  }

  stats.totalLatencyMs = Date.now() - startTime;
  return { success: !!finalSchema, prompt: userPrompt, intentData, designBlueprint, schemas: finalSchema, logs, stats };
}

module.exports = { compileApp };