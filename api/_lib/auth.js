const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'verite_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input) {
  return Buffer.from(input, 'base64url');
}

/**
 * Hashes a password for storage in ADMIN_PASSWORD_HASH. Only ever run
 * offline by us to produce the env var value — never at request time.
 * Format: "scrypt:<saltHex>:<hashHex>"
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured');
  return secret;
}

function sign(payloadObj) {
  const payload = base64url(JSON.stringify(payloadObj));
  const mac = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest();
  return `${payload}.${base64url(mac)}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  const expectedMac = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest();
  const actualMac = fromBase64url(mac);
  if (actualMac.length !== expectedMac.length) return null;
  if (!crypto.timingSafeEqual(actualMac, expectedMac)) return null;
  try {
    const data = JSON.parse(fromBase64url(payload).toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function isHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https';
}

function buildCookie(name, value, req, maxAgeSeconds) {
  const attrs = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (isHttps(req)) attrs.push('Secure');
  if (maxAgeSeconds != null) attrs.push(`Max-Age=${maxAgeSeconds}`);
  return attrs.join('; ');
}

function createSessionCookie(req, email) {
  const now = Date.now();
  const token = sign({ email, iat: now, exp: now + SESSION_TTL_MS });
  return buildCookie(SESSION_COOKIE_NAME, token, req, Math.floor(SESSION_TTL_MS / 1000));
}

function clearSessionCookie(req) {
  return buildCookie(SESSION_COOKIE_NAME, '', req, 0);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return verify(token);
}

/**
 * Gates an /api/admin/* handler. Returns the session payload when valid,
 * or writes a 401 JSON response and returns null when not — callers
 * should `return` immediately when this returns null.
 */
function requireAdminSession(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'Não autenticado.' });
    return null;
  }
  return session;
}

module.exports = {
  SESSION_COOKIE_NAME,
  hashPassword,
  verifyPassword,
  createSessionCookie,
  clearSessionCookie,
  getSession,
  requireAdminSession,
};
