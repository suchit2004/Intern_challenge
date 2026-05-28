require('dotenv').config();
const express = require('express');
const path = require('path');
const { compileApp } = require('./compiler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.post('/api/compile', async (req, res) => {
  const { prompt, provider, apiKey, model } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required." });

  const clientConfig = { provider: provider || 'groq', apiKey, model };

  try {
    const result = await compileApp(prompt, clientConfig, (logEntry) => {
      console.log(`[	ext${logEntry.stage}] 	ext${logEntry.message}`);
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:	ext${PORT}`);
});