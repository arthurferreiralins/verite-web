/**
 * Single serverless function handling every /api/public/* route (see the
 * matching note in api/admin/[...slug].js re: the Hobby plan's 12-function
 * cap). Body parsing stays on Vercel's default here — no file uploads on
 * the public side, so waitlist.js/contact.js can keep reading req.body.
 */
const waitlist = require('../_handlers/public/waitlist');
const contact = require('../_handlers/public/contact');
const products = require('../_handlers/public/products');
const faq = require('../_handlers/public/faq');
const content = require('../_handlers/public/content');
const settings = require('../_handlers/public/settings');
const seo = require('../_handlers/public/seo');

const routes = { waitlist, contact, products, faq, content, settings, seo };

module.exports = async function handler(req, res) {
  // The catch-all query key comes through as "...slug" (not "slug") on
  // this runtime, and as a plain string for a single path segment rather
  // than a 1-item array — read defensively for both shapes.
  const slug = req.query.slug !== undefined ? req.query.slug : req.query['...slug'];
  const key = Array.isArray(slug) ? slug[0] : slug;
  const target = routes[key];
  if (!target) {
    res.status(404).json({ ok: false, error: 'Rota não encontrada.' });
    return;
  }
  return target(req, res);
};
