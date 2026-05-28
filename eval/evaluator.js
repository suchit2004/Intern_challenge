const fs = require('fs');
const path = require('path');
const { PRODUCT_PROMPTS, EDGE_CASE_PROMPTS } = require('./dataset');
const { compileApp } = require('../backend/compiler');

async function runEvaluator(clientConfig) {
  const provider = clientConfig.provider || 'groq';
  const results = [];
  const testCases = [...PRODUCT_PROMPTS, ...EDGE_CASE_PROMPTS];

  for (const tc of testCases) {
    const startTime = Date.now();
    let success = false;
    let repairRetries = 0;
    try {
      const compileResult = await compileApp(tc.prompt, clientConfig, null);
      success = compileResult.success;
      repairRetries = compileResult.stats.repairRetries;
    } catch (e) {
      success = false;
    }
    results.push({
      id: tc.id,
      name: tc.name,
      success,
      repairRetries,
      latencyMs: Date.now() - startTime
    });
  }

  const summary = {
    total: testCases.length,
    successRate: results.filter(r => r.success).length / testCases.length,
    avgLatencyMs: results.reduce((acc, r) => acc + r.latencyMs, 0) / testCases.length,
    avgRepairRetries: results.reduce((acc, r) => acc + r.repairRetries, 0) / testCases.length
  };

  const report = { timestamp: new Date().toISOString(), provider, summary, results };
  fs.writeFileSync(path.join(__dirname, 'evaluation_report.json'), JSON.stringify(report, null, 2));
  return report;
}

module.exports = { runEvaluator };