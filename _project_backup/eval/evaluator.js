const fs = require('fs');
const path = require('path');
const { PRODUCT_PROMPTS, EDGE_CASE_PROMPTS } = require('./dataset');
const { compileApp } = require('../backend/compiler');

// Token pricing metrics (USD per 1,000,000 tokens)
const COST_METRICS = {
  groq: { input: 0.59, output: 0.79 },
  openai: { input: 0.15, output: 0.60 },
  gemini: { input: 0.075, output: 0.30 },
  vertex: { input: 0.075, output: 0.30 }
};

// Simple tokenizer approximation (1 word ~= 1.33 tokens)
function estimateTokens(text) {
  if (!text) return 0;
  const words = text.split(/\s+/).length;
  return Math.ceil(words * 1.33);
}

/**
 * Runs the evaluation suite for a given client configuration.
 * @param {Object} clientConfig - API key and model config
 * @returns {Promise<Object>} The aggregated evaluation report
 */
async function runEvaluator(clientConfig) {
  const provider = clientConfig.provider || 'groq';
  const price = COST_METRICS[provider] || COST_METRICS.groq;

  console.log(`================================================================`);
  console.log(`🏁 RUNNING EVALUATION SUITE (${provider.toUpperCase()})`);
  console.log(`================================================================`);

  const results = [];
  const testCases = [
    ...PRODUCT_PROMPTS.map(p => ({ ...p, type: 'Product' })),
    ...EDGE_CASE_PROMPTS.map(p => ({ ...p, type: 'EdgeCase' }))
  ];

  let successfulRuns = 0;
  let totalLatency = 0;
  let totalRepairRetries = 0;
  let totalCost = 0;

  for (const tc of testCases) {
    console.log(`\n[Test Case] running ${tc.id} (${tc.type}): "${tc.name}"...`);
    const startTime = Date.now();
    let success = false;
    let repairRetries = 0;
    let errorMsg = null;
    let estimatedCost = 0;
    
    try {
      const compileResult = await compileApp(tc.prompt, clientConfig, null);
      success = compileResult.success;
      repairRetries = compileResult.stats.repairRetries;

      // Estimate tokens & cost
      let inputWords = 0;
      let outputWords = 0;

      // Calculate approximate tokens for each stage
      if (compileResult.intentData) {
        inputWords += JSON.stringify(tc.prompt).split(/\s+/).length + 200; // Prompt + System Guidelines
        outputWords += JSON.stringify(compileResult.intentData).split(/\s+/).length;
      }
      if (compileResult.designBlueprint) {
        inputWords += JSON.stringify(compileResult.intentData).split(/\s+/).length + 300;
        outputWords += JSON.stringify(compileResult.designBlueprint).split(/\s+/).length;
      }
      if (compileResult.schemas) {
        inputWords += JSON.stringify(compileResult.designBlueprint).split(/\s+/).length + 600;
        outputWords += JSON.stringify(compileResult.schemas).split(/\s+/).length;
      }

      const inputTokens = Math.ceil(inputWords * 1.33);
      const outputTokens = Math.ceil(outputWords * 1.33);
      estimatedCost = ((inputTokens * price.input) + (outputTokens * price.output)) / 1000000;

    } catch (err) {
      errorMsg = err.message;
      success = false;
    }

    const latencyMs = Date.now() - startTime;
    totalLatency += latencyMs;
    totalRepairRetries += repairRetries;
    totalCost += estimatedCost;
    if (success) successfulRuns++;

    const runResult = {
      id: tc.id,
      name: tc.name,
      type: tc.type,
      success,
      repairRetries,
      latencyMs,
      estimatedCostUsd: estimatedCost,
      error: errorMsg
    };

    results.push(runResult);
    console.log(`[Result] Status: ${success ? '✅ SUCCESS' : '❌ FAILED'} | Latency: ${(latencyMs/1000).toFixed(2)}s | Retries: ${repairRetries} | Cost: $${estimatedCost.toFixed(5)}`);
  }

  // Compile aggregate metrics
  const summary = {
    totalPrompts: testCases.length,
    successfulRuns,
    successRate: successfulRuns / testCases.length,
    avgLatencyMs: totalLatency / testCases.length,
    avgRepairRetries: totalRepairRetries / testCases.length,
    totalEstimatedCostUsd: totalCost,
    avgCostPerPromptUsd: totalCost / testCases.length
  };

  const report = {
    timestamp: new Date().toISOString(),
    provider,
    summary,
    results
  };

  // Write report files
  const reportPath = path.join(__dirname, 'evaluation_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Evaluation Report written to: ${reportPath}`);

  // Display Markdown Table in Console
  console.log("\n================================================================");
  console.log("📊 EVALUATION RESULTS SUMMARY");
  console.log("================================================================");
  console.log(`Success Rate:        ${(summary.successRate * 100).toFixed(0)}% (${summary.successfulRuns}/${summary.totalPrompts})`);
  console.log(`Average Latency:     ${(summary.avgLatencyMs / 1000).toFixed(2)}s`);
  console.log(`Avg Repair Retries:  ${summary.avgRepairRetries.toFixed(1)}`);
  console.log(`Total Est. Cost:     $${summary.totalEstimatedCostUsd.toFixed(4)}`);
  console.log("================================================================\n");

  return report;
}

// Support running directly from command line (npm run eval)
if (require.main === module) {
  require('dotenv').config();
  
  // Resolve key from env
  const provider = process.env.GROQ_API_KEY ? 'groq' : 
                   process.env.GEMINI_API_KEY ? 'gemini' : 
                   process.env.OPENAI_API_KEY ? 'openai' : null;

  if (!provider) {
    console.error("❌ No API Keys found in .env. Please configure GROQ_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY.");
    process.exit(1);
  }

  const clientConfig = {
    provider,
    apiKey: null
  };

  runEvaluator(clientConfig).catch(err => {
    console.error("Evaluation run failed:", err);
    process.exit(1);
  });
}

module.exports = { runEvaluator };
