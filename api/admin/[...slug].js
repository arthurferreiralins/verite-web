/**
 * Single serverless function handling every /api/admin/* route (Vercel's
 * Hobby plan caps a deployment at 12 functions — this project has 12
 * distinct admin endpoints on its own, so they're dispatched internally
 * from one function instead of one file each). Body parsing is disabled
 * here because upload.js needs the raw binary stream; every other handler
 * reads/parses JSON itself via api/_lib/readBody.js.
 */
const login = require('../_handlers/admin/login');
const logout = require('../_handlers/admin/logout');
const me = require('../_handlers/admin/me');
const dashboard = require('../_handlers/admin/dashboard');
const products = require('../_handlers/admin/products');
const upload = require('../_handlers/admin/upload');
const leads = require('../_handlers/admin/leads');
const messages = require('../_handlers/admin/messages');
const content = require('../_handlers/admin/content');
const faq = require('../_handlers/admin/faq');
const settings = require('../_handlers/admin/settings');
const seo = require('../_handlers/admin/seo');

const routes = { login, logout, me, dashboard, products, upload, leads, messages, content, faq, settings, seo };

module.exports = async function handler(req, res) {
  const slug = req.query.slug;
  const key = Array.isArray(slug) ? slug[0] : slug;
  const target = routes[key];
  if (!target) {
    res.status(404).json({ ok: false, error: 'Rota não encontrada.' });
    return;
  }
  return target(req, res);
};

module.exports.config = { api: { bodyParser: false } };
