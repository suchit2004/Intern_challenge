const { callLLM } = require('./llmClient');

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
      "premiumGated": true/false
    }
  ],
  "entities": ["Database entities needed"],
  "pages": ["Dashboard, Contacts, Analytics, checkout, etc."],
  "vagueOrConflictingFlags": ["List of warnings if requirements are contradictory, vague, or missing."],
  "assumptionsMade": ["List of design assumptions you made to resolve missing info."]
}
DO NOT include any explanation or markdown formatting outside the JSON. Return raw valid JSON.`;

  const userPrompt = `Build an application based on these requirements: "	ext${prompt}"`;
  const resultText = await callLLM({ ...clientConfig, systemPrompt, userPrompt, jsonMode: true });
  return JSON.parse(resultText.trim());
}

module.exports = { runStage1 };