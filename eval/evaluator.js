const fs = require('fs');
const path = require('path');
const { PRODUCT_PROMPTS, EDGE_CASE_PROMPTS } = require('./dataset');
const { compileApp } = require('../backend/compiler');

/**
 * Executes the compilation pipeline across the evaluation dataset.
 * Logs execution progress and writes results to JSON.
 */
async function runEvaluator(clientConfig) {
  const provider = clientConfig.provider || 'groq';
  const results = [];
  const testCases = [...PRODUCT_PROMPTS, ...EDGE_CASE_PROMPTS];

  console.log(`Initiating Evaluation Harness. Running ${testCases.length} prompts sequentially...`);

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const startTime = Date.now();
    let success = false;
    let repairRetries = 0;
    
    console.log(`[Eval ${i+1}/${testCases.length}] Testing prompt "${tc.name}" (${tc.id})...`);
    
    try {
      const compileResult = await compileApp(tc.prompt, clientConfig, (progress) => {
        // Suppress detailed internal stages in eval loop console, but track them
      });
      success = compileResult.success;
      repairRetries = compileResult.stats.repairRetries;
    } catch (e) {
      console.error(`  - Failed with exception: ${e.message}`);
      success = false;
    }
    
    const latency = Date.now() - startTime;
    console.log(`  - Result: ${success ? '✅ SUCCESS' : '❌ FAILED'} | Retries: ${repairRetries} | Latency: ${(latency / 1000).toFixed(2)}s`);
    
    results.push({
      id: tc.id,
      name: tc.name,
      type: tc.id.startsWith('prod') ? 'Product Prompt' : 'Edge Case',
      success,
      repairRetries,
      latencyMs: latency
    });
  }

  const summary = {
    total: testCases.length,
    successRate: results.filter(r => r.success).length / testCases.length,
    avgLatencyMs: results.reduce((acc, r) => acc + r.latencyMs, 0) / testCases.length,
    avgRepairRetries: results.reduce((acc, r) => acc + r.repairRetries, 0) / testCases.length
  };

  const report = { timestamp: new Date().toISOString(), provider, summary, results };
  
  // Write result to evaluation_report.json in the current directory
  const reportPath = path.join(__dirname, 'evaluation_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport successfully written to: ${reportPath}`);
  
  return report;
}

// Support executing evaluation script directly via command line (npm run eval)
if (require.main === module) {
  require('dotenv').config({ override: true });
  
  const clientConfig = {
    provider: process.env.LLM_PROVIDER || 'groq',
    apiKey: process.env.GROQ_API_KEY || null,
    model: null
  };

  runEvaluator(clientConfig)
    .then(report => {
      console.log("\n=======================================================");
      console.log("🤖 EVALUATION HARNESS RUN COMPLETED");
      console.log("=======================================================");
      console.log(`Provider Used:       ${report.provider}`);
      console.log(`Success Rate:        ${(report.summary.successRate * 100).toFixed(0)}% (${report.results.filter(r => r.success).length}/${report.summary.total})`);
      console.log(`Avg Latency:         ${(report.summary.avgLatencyMs / 1000).toFixed(2)}s`);
      console.log(`Avg Repair Retries:  ${report.summary.avgRepairRetries.toFixed(2)}`);
      console.log("=======================================================");
    })
    .catch(err => {
      console.error("Evaluation pipeline failed:", err);
      process.exit(1);
    });
}

module.exports = { runEvaluator };