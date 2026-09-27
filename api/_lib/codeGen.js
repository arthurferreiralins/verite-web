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

/* Reconstrói o formato canônico VRT-XXXX-XXXX a partir de QUALQUER jeito
   razoável de digitar o código de um cartão físico: sem traço, com espaço
   no lugar do traço, em minúsculas, colado. Antes disto, "VRT 7K4P 92XQ"
   (o mesmo código, só com espaço em vez de traço) batia "Código não
   encontrado" — o banco guarda com traço e a comparação era literal. Só
   reconecta os traços quando o texto tem a cara de um código nosso (VRT +
   8 caracteres); qualquer outra coisa passa batom (vira maiúsculo/sem
   espaço) e simplesmente não bate com nada, como antes. */
function normalizeCode(input) {
  var raw = String(input || '').trim().toUpperCase();
  var bare = raw.replace(/[^A-Z0-9]/g, '');
  var m = bare.match(/^VRT([A-Z0-9]{4})([A-Z0-9]{4})$/);
  if (m) return 'VRT-' + m[1] + '-' + m[2];
  return raw.replace(/\s+/g, '');
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
