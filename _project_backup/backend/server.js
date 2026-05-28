require('dotenv').config();
const express = require('express');
const path = require('path');
const { compileApp } = require('./compiler');
// We will write the evaluator logic soon, let's declare a placeholder for it
let runEvaluator = null;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static dashboard files from frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Compile Endpoint
app.post('/api/compile', async (req, res) => {
  const { prompt, provider, apiKey, model } = req.body;

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ error: "Prompt is required." });
  }

  // Set up client configuration
  const clientConfig = {
    provider: provider || 'groq',
    apiKey: apiKey || null,
    model: model || null
  };

  try {
    console.log(`Starting compilation request for prompt: "${prompt}" using provider: ${clientConfig.provider}`);
    
    // We pass a progress logger to write logs to console in real time
    const result = await compileApp(prompt, clientConfig, (logEntry) => {
      console.log(`[${logEntry.stage}] ${logEntry.message}`);
    });

    return res.json(result);
  } catch (error) {
    console.error("Compilation Pipeline Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      logs: [{ stage: "Pipeline Failure", message: `System error: ${error.message}` }]
    });
  }
});

// Evaluate Endpoint
app.post('/api/evaluate', async (req, res) => {
  const { provider, apiKey, model } = req.body;
  const clientConfig = {
    provider: provider || 'groq',
    apiKey: apiKey || null,
    model: model || null
  };

  if (!runEvaluator) {
    try {
      // Lazy load evaluator to avoid circular references
      const evaluatorModule = require('../eval/evaluator');
      runEvaluator = evaluatorModule.runEvaluator;
    } catch (err) {
      return res.status(500).json({ error: `Evaluator script not found or failed to load: ${err.message}` });
    }
  }

  try {
    console.log("Starting evaluation dataset execution...");
    const report = await runEvaluator(clientConfig);
    return res.json(report);
  } catch (error) {
    console.error("Evaluation Error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 AI SOFTWARE COMPILER SERVER IS RUNNING AT: http://localhost:${PORT}`);
  console.log(`================================================================`);
});
