const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Global fetch wrapper with automated retries on HTTP 429 (Rate Limit) errors
async function fetchWithRetry(url, options, maxRetries = 6) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const res = await fetch(url, options);
    
    if (res.status === 429) {
      const errText = await res.clone().text();
      let waitMs = 2000 * Math.pow(1.5, attempt - 1); // Exponential backoff fallback
      
      try {
        const errObj = JSON.parse(errText);
        const msg = errObj.error?.message || errObj.error || "";
        const match = msg.match(/try again in ([\d\.]+)s/i) || msg.match(/try again in ([\d\.]+)ms/i);
        if (match) {
          const num = parseFloat(match[1]);
          const isMs = msg.toLowerCase().includes('ms');
          waitMs = isMs ? num : num * 1000;
        }
      } catch (e) {
        // ignore
      }
      
      waitMs += 1000; // 1-second safety buffer
      console.warn(`⚠️ [Rate Limit 429] (Attempt ${attempt}/${maxRetries}): Waiting for ${(waitMs / 1000).toFixed(2)}s before retrying request...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue; // retry
    }
    
    return res;
  }
  
  // Final fallback attempt
  return fetch(url, options);
}

// Helper to encode a string to base64url (required for JWT creation)
function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Function to generate an OAuth2 Access Token for Vertex AI using service account credentials
async function getVertexAccessToken(creds) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = base64url(signer.sign(creds.private_key));

  const jwt = `${signatureInput}.${signature}`;

  const response = await fetchWithRetry('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vertex Token Auth Failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Uniform entrypoint for LLM completion requests.
 * @param {Object} params
 * @param {string} params.provider - 'groq' | 'openai' | 'gemini' | 'vertex'
 * @param {string} [params.apiKey] - Optional override key from client
 * @param {string} [params.model] - Optional model override
 * @param {string} params.systemPrompt - Role and guidelines
 * @param {string} params.userPrompt - User instructions
 * @param {boolean} [params.jsonMode] - Enforce JSON formatting
 */
async function callLLM({ provider, apiKey, model, systemPrompt, userPrompt, jsonMode = false }) {
  const resolvedProvider = provider || 'groq';

  if (resolvedProvider === 'groq') {
    const key = (apiKey || process.env.GROQ_API_KEY || '').trim();
    if (!key) throw new Error("Groq API Key not found. Please set GROQ_API_KEY.");
    const selectedModel = model || 'llama-3.3-70b-versatile';

    const body = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.05
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (resolvedProvider === 'openai') {
    const key = (apiKey || process.env.OPENAI_API_KEY || '').trim();
    if (!key) throw new Error("OpenAI API Key not found. Please set OPENAI_API_KEY.");
    const selectedModel = model || 'gpt-4o-mini';

    const body = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.05
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (resolvedProvider === 'gemini') {
    const key = (apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) throw new Error("Gemini API Key not found. Please set GEMINI_API_KEY.");
    const selectedModel = model || 'gemini-1.5-flash';

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `System Instructions:\n${systemPrompt}\n\nUser Prompt:\n${userPrompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.05
      }
    };

    if (jsonMode) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`;
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  }

  if (resolvedProvider === 'vertex') {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath || !fs.existsSync(credPath)) {
      throw new Error(`GCP Credentials file not found at path: ${credPath}`);
    }

    const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const token = await getVertexAccessToken(creds);

    const projectId = creds.project_id;
    const location = 'us-central1';
    const selectedModel = model || 'gemini-1.5-flash-001';

    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${selectedModel}:generateContent`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `System Instructions:\n${systemPrompt}\n\nUser Input:\n${userPrompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.05
      }
    };

    if (jsonMode) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Vertex AI API Error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

module.exports = { callLLM };