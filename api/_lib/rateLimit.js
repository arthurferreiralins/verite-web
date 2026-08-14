const { sql } = require('./db');

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_ATTEMPTS = 8;

async function isLoginRateLimited(ip) {
  const { rows } = await sql`
    SELECT count(*)::int AS n FROM admin_login_attempts
    WHERE ip = ${ip} AND success = false
      AND attempted_at > now() - (${LOGIN_WINDOW_MINUTES}::text || ' minutes')::interval
  `;
  return rows[0].n >= LOGIN_MAX_ATTEMPTS;
}

async function recordLoginAttempt(ip, success) {
  await sql`INSERT INTO admin_login_attempts (ip, success) VALUES (${ip}, ${success})`;
}

const SUBMIT_WINDOW_MINUTES = 10;
const SUBMIT_MAX_ATTEMPTS = 5;

async function isSubmissionRateLimited(ip, kind) {
  const { rows } = await sql`
    SELECT count(*)::int AS n FROM public_submission_attempts
    WHERE ip = ${ip} AND kind = ${kind}
      AND attempted_at > now() - (${SUBMIT_WINDOW_MINUTES}::text || ' minutes')::interval
  `;
  return rows[0].n >= SUBMIT_MAX_ATTEMPTS;
}

async function recordSubmissionAttempt(ip, kind) {
  await sql`INSERT INTO public_submission_attempts (ip, kind) VALUES (${ip}, ${kind})`;
}

const CLUB_LOGIN_WINDOW_MINUTES = 15;
const CLUB_LOGIN_MAX_ATTEMPTS = 8;

async function isClubLoginRateLimited(ip) {
  const { rows } = await sql`
    SELECT count(*)::int AS n FROM club_login_attempts
    WHERE ip = ${ip} AND success = false
      AND attempted_at > now() - (${CLUB_LOGIN_WINDOW_MINUTES}::text || ' minutes')::interval
  `;
  return rows[0].n >= CLUB_LOGIN_MAX_ATTEMPTS;
}

async function recordClubLoginAttempt(ip, success) {
  await sql`INSERT INTO club_login_attempts (ip, success) VALUES (${ip}, ${success})`;
}

const CODE_WINDOW_MINUTES = 15;
const CODE_MAX_ATTEMPTS = 10;

async function isCodeRateLimited(ip) {
  const { rows } = await sql`
    SELECT count(*)::int AS n FROM club_code_attempts
    WHERE ip = ${ip} AND success = false
      AND attempted_at > now() - (${CODE_WINDOW_MINUTES}::text || ' minutes')::interval
  `;
  return rows[0].n >= CODE_MAX_ATTEMPTS;
}

async function recordCodeAttempt(ip, success) {
  await sql`INSERT INTO club_code_attempts (ip, success) VALUES (${ip}, ${success})`;
}

module.exports = {
  getClientIp,
  isLoginRateLimited,
  recordLoginAttempt,
  isSubmissionRateLimited,
  recordSubmissionAttempt,
  isClubLoginRateLimited,
  recordClubLoginAttempt,
  isCodeRateLimited,
  recordCodeAttempt,
};
