const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

function isNonEmptyString(value, maxLen) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.length) return false;
  if (maxLen && trimmed.length > maxLen) return false;
  return true;
}

function isOptionalString(value, maxLen) {
  if (value == null || value === '') return true;
  return typeof value === 'string' && (!maxLen || value.length <= maxLen);
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 120;
}

var DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function isValidPrice(value) {
  if (value == null || value === '') return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1000000;
}

module.exports = {
  isValidEmail,
  isNonEmptyString,
  isOptionalString,
  isValidSlug,
  slugify,
  isValidPrice,
  str,
};
