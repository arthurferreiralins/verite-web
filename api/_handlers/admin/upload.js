const { put, del } = require('@vercel/blob');
const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');

const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_FOLDERS = ['products', 'categories', 'seo', 'appearance', 'geral'];

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  if (req.method === 'DELETE') {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!url || !url.includes('blob.vercel-storage.com')) {
      res.status(400).json({ ok: false, error: 'URL de imagem inválida.' });
      return;
    }
    try {
      await del(url);
    } catch (e) {
      // segue mesmo se o blob já não existir mais
    }
    try {
      await sql`DELETE FROM media WHERE url = ${url}`;
    } catch (e) {
      // best effort — a tabela media é só um índice de conveniência para a biblioteca de mídia
    }
    res.status(200).json({ ok: true });
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
  const folderParam = typeof req.query.folder === 'string' ? req.query.folder : 'products';
  const folder = ALLOWED_FOLDERS.includes(folderParam) ? folderParam : 'products';

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

  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
    });
    try {
      await sql`
        INSERT INTO media (url, pathname, filename, mime_type, size_bytes, folder)
        VALUES (${blob.url}, ${blob.pathname || filename}, ${filename.split('/').pop()}, ${contentType}, ${buffer.length}, ${folder})
      `;
    } catch (e) {
      // best effort — o upload em si já teve sucesso, a biblioteca de mídia é só um índice
    }
    res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Falha ao enviar a imagem.' });
  }
};

// bodyParser is disabled at the dispatcher level (api/admin/[...slug].js),
// not here — this file is no longer a top-level Vercel route on its own.
