const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

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
  const response = await fetch('https://oauth2.googleapis.com/token', {
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

async function callLLM({ provider, apiKey, model, systemPrompt, userPrompt, jsonMode = false }) {
  const resolvedProvider = provider || 'groq';

  if (resolvedProvider === 'groq') {
    const key = (apiKey || process.env.GROQ_API_KEY || '').trim();
    if (!key) throw new Error("Groq API Key not found. Please set GROQ_API_KEY.");
    const selectedModel = model || 'llama-3.3-70b-versatile';
    const body = {
      model: selectedModel,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.05
    };
    if (jsonMode) body.response_format = { type: 'json_object' };
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Groq API Error (${res.status})`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (resolvedProvider === 'openai') {
    const key = (apiKey || process.env.OPENAI_API_KEY || '').trim();
    if (!key) throw new Error("OpenAI API Key not found.");
    const selectedModel = model || 'gpt-4o-mini';
    const body = {
      model: selectedModel,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.05
    };
    if (jsonMode) body.response_format = { type: 'json_object' };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`OpenAI API Error (${res.status})`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (resolvedProvider === 'gemini') {
    const key = (apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) throw new Error("Gemini API Key not found.");
    const selectedModel = model || 'gemini-1.5-flash';
    const body = {
      contents: [{ role: 'user', parts: [{ text: `System Instructions:\n${systemPrompt}\n\nUser Prompt:\n${userPrompt}` }] }],
      generationConfig: { temperature: 0.05 }
    };
    if (jsonMode) body.generationConfig.responseMimeType = 'application/json';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Gemini API Error (${res.status})`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  }

  if (resolvedProvider === 'vertex') {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath || !fs.existsSync(credPath)) throw new Error("GCP Credentials file not found.");
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const token = await getVertexAccessToken(creds);
    const projectId = creds.project_id;
    const location = 'us-central1';
    const selectedModel = model || 'gemini-1.5-flash-001';
    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${selectedModel}:generateContent`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: `System Instructions:\n${systemPrompt}\n\nUser Input:\n${userPrompt}` }] }],
      generationConfig: { temperature: 0.05 }
    };
    if (jsonMode) body.generationConfig.responseMimeType = 'application/json';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Vertex AI API Error (${res.status})`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

module.exports = { callLLM };