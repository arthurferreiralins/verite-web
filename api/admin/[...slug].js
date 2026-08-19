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
const categories = require('../_handlers/admin/categories');
const orders = require('../_handlers/admin/orders');
const customers = require('../_handlers/admin/customers');
const media = require('../_handlers/admin/media');
const notifications = require('../_handlers/admin/notifications');
const search = require('../_handlers/admin/search');
const account = require('../_handlers/admin/account');
const appearance = require('../_handlers/admin/appearance');
const clubCodes = require('../_handlers/admin/clubCodes');
const inventory = require('../_handlers/admin/inventory');
const production = require('../_handlers/admin/production');
const stockMovements = require('../_handlers/admin/stockMovements');
const clubMembers = require('../_handlers/admin/clubMembers');
const clubTiers = require('../_handlers/admin/clubTiers');
const clubBenefits = require('../_handlers/admin/clubBenefits');
const clubPointsRules = require('../_handlers/admin/clubPointsRules');
const clubPointsAdjust = require('../_handlers/admin/clubPointsAdjust');
const clubRewards = require('../_handlers/admin/clubRewards');
const clubGifts = require('../_handlers/admin/clubGifts');
const clubNews = require('../_handlers/admin/clubNews');
const clubCoupons = require('../_handlers/admin/clubCoupons');

const routes = {
  login, logout, me, dashboard, products, upload, leads, messages, content, faq, settings, seo,
  categories, orders, customers, media, notifications, search, account, appearance,
  'club-codes': clubCodes,
  inventory, production,
  'stock-movements': stockMovements,
  'club-members': clubMembers,
  'club-tiers': clubTiers,
  'club-benefits': clubBenefits,
  'club-points-rules': clubPointsRules,
  'club-points-adjust': clubPointsAdjust,
  'club-rewards': clubRewards,
  'club-gifts': clubGifts,
  'club-news': clubNews,
  'club-coupons': clubCoupons,
};

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

module.exports.config = { api: { bodyParser: false } };
