const { sql } = require('../../_lib/db');
const { requireAdminSession } = require('../../_lib/auth');

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

module.exports = async function handler(req, res) {
  const session = await requireAdminSession(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  if (req.query.export === 'csv') {
    const { rows } = await sql`SELECT name, email, created_at FROM leads ORDER BY created_at DESC`;
    const lines = ['Nome,E-mail,Data de cadastro'];
    rows.forEach((r) => {
      lines.push([csvEscape(r.name), csvEscape(r.email), csvEscape(new Date(r.created_at).toISOString())].join(','));
    });
    const csv = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lista-de-espera.csv"');
    res.status(200).send('﻿' + csv);
    return;
  }

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;

  const like = `%${search}%`;
  const [{ rows: items }, { rows: countRows }] = await Promise.all([
    search
      ? sql`SELECT * FROM leads WHERE name ILIKE ${like} OR email ILIKE ${like} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      : sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    search
      ? sql`SELECT count(*)::int AS n FROM leads WHERE name ILIKE ${like} OR email ILIKE ${like}`
      : sql`SELECT count(*)::int AS n FROM leads`,
  ]);

  res.status(200).json({ ok: true, items, total: countRows[0].n, page, pageSize });
};
