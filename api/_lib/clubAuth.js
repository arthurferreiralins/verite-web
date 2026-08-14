const crypto = require('crypto');
const { sql } = require('./db');

// Mirrors api/_lib/auth.js (admin session), but scoped to club members —
// separate cookie name so an admin session and a club session never collide
// in the same browser, and a much longer TTL since this is a customer login,
// not a privileged admin one.
const SESSION_COOKIE_NAME = 'verite_club_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input) {
  return Buffer.from(input, 'base64url');
}

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

function createSessionCookie(req, customerId, sessionVersion) {
  const now = Date.now();
  const token = sign({ cid: customerId, v: Number.isFinite(sessionVersion) ? sessionVersion : 1, iat: now, exp: now + SESSION_TTL_MS });
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

function getSessionToken(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  return verify(token);
}

/**
 * Gates an /api/club/* route that requires a logged-in member. Returns the
 * full customer row (never the password_hash — stripped before returning)
 * on success, or writes a 401 and returns null. Every customer row carries
 * its own session_version (bumped on password change) so changing your
 * password logs out every other device — same mechanism as the admin panel.
 */
async function requireClubSession(req, res) {
  const session = getSessionToken(req);
  if (!session || !Number.isFinite(session.cid)) {
    res.status(401).json({ ok: false, error: 'Não autenticado.' });
    return null;
  }
  const { rows } = await sql`SELECT * FROM customers WHERE id = ${session.cid} AND club_member = true`;
  const customer = rows[0];
  if (!customer) {
    res.status(401).json({ ok: false, error: 'Conta não encontrada.' });
    return null;
  }
  const sessionVersion = Number.isFinite(session.v) ? session.v : 1;
  if (sessionVersion !== customer.session_version) {
    res.status(401).json({ ok: false, error: 'Sessão encerrada. Entre novamente.' });
    return null;
  }
  delete customer.password_hash;
  return customer;
}

module.exports = {
  SESSION_COOKIE_NAME,
  hashPassword,
  verifyPassword,
  createSessionCookie,
  clearSessionCookie,
  getSessionToken,
  requireClubSession,
};
