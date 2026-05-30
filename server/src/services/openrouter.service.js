const { API_URL, APP_NAME, DEFAULT_MODEL, FALLBACK_MODEL, SITE_URL } = require('../config/openrouter');

const SYSTEM_PROMPT = [
  'You write donor thank-you email drafts for a stewardship team.',
  'The output will be reviewed by a human before sending, so keep the message warm, appreciative, sentimental, and specific.',
  'Do not mention that you are an AI or language model.',
  'Do not invent facts that are not supported by the provided metadata.',
  'If the donor is anonymous or uncertain, keep the draft safe, gracious, and generic instead of over-personalizing.',
  'Return only valid JSON with this shape:',
  '{"subject":"string","body":"string","reasoning":"string","personalization_points":["string"],"risk_flags":["string"]}',
  'Keep subject lines short and natural.',
  'Keep the body human, polished, and emotionally grounded.',
  'Include a clear gratitude-first opening, one or two specific references to the donor or gift, and a warm closing signed OpenPaws.',
].join(' ');

function createHeaders() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const error = new Error('OPENROUTER_API_KEY is not configured');
    error.statusCode = 500;
    throw error;
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': SITE_URL,
    'X-Title': APP_NAME,
  };
}

function extractJsonPayload(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('OpenRouter returned an empty draft payload');
  }

  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const jsonText = start >= 0 && end >= start ? candidate.slice(start, end + 1) : candidate;

  return JSON.parse(jsonText);
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

async function callOpenRouter(model, promptPayload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(promptPayload, null, 2) },
      ],
      temperature: 0.55,
      top_p: 0.9,
      max_tokens: 900,
    }),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    const message = responseBody?.error?.message || responseBody?.message || `OpenRouter request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  const content = responseBody?.choices?.[0]?.message?.content;

  if (!content) {
    const error = new Error('OpenRouter returned no assistant content');
    error.statusCode = 502;
    throw error;
  }

  const parsed = extractJsonPayload(content);

  return {
    model,
    rawContent: content,
    draft: {
      subject: String(parsed.subject || '').trim(),
      body: String(parsed.body || '').trim(),
      reasoning: String(parsed.reasoning || '').trim(),
      personalization_points: normalizeArray(parsed.personalization_points),
      risk_flags: normalizeArray(parsed.risk_flags),
    },
  };
}

async function generateThankYouDraft(promptPayload, preferredModel = DEFAULT_MODEL) {
  const modelsToTry = [...new Set([preferredModel, DEFAULT_MODEL, FALLBACK_MODEL].filter(Boolean))];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      return await callOpenRouter(model, promptPayload);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to generate draft with OpenRouter');
}

module.exports = {
  generateThankYouDraft,
};
