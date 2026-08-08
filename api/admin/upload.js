const { put, del } = require('@vercel/blob');
const { requireAdminSession } = require('../_lib/auth');

const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'DELETE') {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!url || !url.includes('blob.vercel-storage.com')) {
      res.status(400).json({ ok: false, error: 'URL de imagem inválida.' });
      return;
    }
    try {
      await del(url);
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: 'Não foi possível remover a imagem.' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  const contentType = req.headers['content-type'] || '';
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    res.status(400).json({ ok: false, error: 'Formato de imagem não suportado. Use JPEG, PNG ou WebP.' });
    return;
  }

  const chunks = [];
  let totalBytes = 0;
  let tooLarge = false;
  await new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BYTES) {
        tooLarge = true;
        req.destroy();
        resolve();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', resolve);
    req.on('error', reject);
  });

  if (tooLarge) {
    res.status(413).json({ ok: false, error: 'Imagem maior que o limite de 5MB.' });
    return;
  }
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) {
    res.status(400).json({ ok: false, error: 'Nenhum arquivo recebido.' });
    return;
  }

  const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
    });
    res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Falha ao enviar a imagem.' });
  }
};

module.exports.config = { api: { bodyParser: false } };
