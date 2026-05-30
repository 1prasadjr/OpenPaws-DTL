const DEFAULT_SENDER_NAME = 'OpenPaws';

function replaceSenderNamePlaceholder(value, senderName = DEFAULT_SENDER_NAME) {
  if (value === null || value === undefined) {
    return value;
  }

  return String(value).replace(/\[Sender Name\]/g, senderName);
}

function normalizeEmailBody(value, senderName = DEFAULT_SENDER_NAME) {
  if (value === null || value === undefined) {
    return null;
  }

  let text = String(value).trim();

  if (!text) {
    return null;
  }

  // Normalize to LF for consistent regex handling
  text = text.replace(/\r\n/g, "\n");

  // Replace placeholder with the sender name first
  text = replaceSenderNamePlaceholder(text, senderName);

  // Remove any blank lines immediately before the sender name so the
  // signature appears directly below the closing line (no extra empty lines).
  // Example: "With heartfelt gratitude,\n\nOpenPaws" -> "With heartfelt gratitude,\nOpenPaws"
  const escSender = senderName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
  const senderPattern = new RegExp("\\n\\s*\\n\\s*(" + escSender + ")", "g");
  text = text.replace(senderPattern, "\n$1");

  // Collapse long runs of blank lines to at most one empty line
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
}

module.exports = {
  DEFAULT_SENDER_NAME,
  normalizeEmailBody,
  replaceSenderNamePlaceholder,
};