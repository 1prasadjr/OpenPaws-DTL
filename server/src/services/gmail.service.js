const { google } = require('googleapis');

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    const error = new Error(`${name} is not configured`);
    error.statusCode = 500;
    throw error;
  }

  return value;
}

function sanitizeHeaderValue(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function normalizeBody(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '\r\n');
}

function createOAuthClient() {
  const clientId = getRequiredEnv('GMAIL_CLIENT_ID');
  const clientSecret = getRequiredEnv('GMAIL_CLIENT_SECRET');
  const redirectUri = getRequiredEnv('GMAIL_REDIRECT_URI');

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();

  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken });
  }

  return client;
}

function createRawEmail({ from, to, subject, body }) {
  const headers = [
    `From: ${sanitizeHeaderValue(from)}`,
    `To: ${sanitizeHeaderValue(to)}`,
    `Subject: ${sanitizeHeaderValue(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ];

  const rawMessage = `${headers.join('\r\n')}\r\n\r\n${normalizeBody(body)}`;

  return Buffer.from(rawMessage, 'utf8').toString('base64url');
}

function createAuthenticatedGmailClient() {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();

  if (!refreshToken) {
    const error = new Error('GMAIL_REFRESH_TOKEN is not configured');
    error.statusCode = 500;
    throw error;
  }

  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: 'v1', auth: client });
}

async function createGmailDraft({ to, subject, body }) {
  const from = getRequiredEnv('GMAIL_SENDER_EMAIL');
  const gmail = createAuthenticatedGmailClient();
  const raw = createRawEmail({ from, to, subject, body });

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw,
      },
    },
  });

  return response.data;
}

async function sendGmailEmail({ to, subject, body }) {
  const from = getRequiredEnv('GMAIL_SENDER_EMAIL');
  const gmail = createAuthenticatedGmailClient();
  const raw = createRawEmail({ from, to, subject, body });

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
    },
  });

  return response.data;
}

module.exports = {
  createOAuthClient,
  createRawEmail,
  createGmailDraft,
  sendGmailEmail,
};