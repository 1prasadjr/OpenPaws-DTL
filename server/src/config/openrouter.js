const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4.1';
const API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const SITE_URL = process.env.OPENROUTER_SITE_URL || 'http://localhost:5000';
const APP_NAME = process.env.OPENROUTER_APP_NAME || 'Donor Thank-You Automation';

module.exports = {
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  API_URL,
  SITE_URL,
  APP_NAME,
};
