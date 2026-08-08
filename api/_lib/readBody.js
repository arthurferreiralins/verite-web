/**
 * The /api/admin/[...slug] dispatcher disables Vercel's automatic body
 * parser (upload.js needs the raw binary stream), so every JSON-body
 * admin handler reads and parses the request body itself via this helper
 * instead of relying on req.body.
 */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readRawBody(req);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (e) {
    return {};
  }
}

module.exports = { readRawBody, readJsonBody };
