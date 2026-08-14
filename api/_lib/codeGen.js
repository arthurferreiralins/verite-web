const crypto = require('crypto');
const { sql } = require('./db');

// Alfabeto sem 0/O/1/I/L — evita ambiguidade ao digitar o código de um
// cartão físico. Formato final: VRT-XXXX-XXXX (ex. VRT-7K4P-92XQ).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomChunk(len) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function formatCode() {
  return `VRT-${randomChunk(4)}-${randomChunk(4)}`;
}

function normalizeCode(input) {
  return String(input || '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Generates a code guaranteed unique against club_codes.code. */
async function generateUniqueCode() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = formatCode();
    const { rows } = await sql`SELECT id FROM club_codes WHERE code = ${candidate}`;
    if (!rows.length) return candidate;
  }
}

module.exports = { generateUniqueCode, normalizeCode, formatCode };
