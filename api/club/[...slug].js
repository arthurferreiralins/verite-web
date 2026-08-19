/**
 * Single serverless function handling every /api/club/* route — same
 * Hobby-plan function-count reasoning as api/admin/[...slug].js and
 * api/public/[...slug].js.
 */
const redeem = require('../_handlers/club/redeem');
const register = require('../_handlers/club/register');
const login = require('../_handlers/club/login');
const logout = require('../_handlers/club/logout');
const me = require('../_handlers/club/me');
const account = require('../_handlers/club/account');
const coupons = require('../_handlers/club/coupons');
const favorites = require('../_handlers/club/favorites');
const orders = require('../_handlers/club/orders');
const products = require('../_handlers/club/products');
const tier = require('../_handlers/club/tier');
const points = require('../_handlers/club/points');
const benefits = require('../_handlers/club/benefits');
const gifts = require('../_handlers/club/gifts');
const news = require('../_handlers/club/news');
const notifications = require('../_handlers/club/notifications');
const card = require('../_handlers/club/card');

const routes = {
  redeem, register, login, logout, me, account, coupons, favorites, orders, products,
  tier, points, benefits, gifts, news, notifications, card,
};

module.exports = async function handler(req, res) {
  const slug = req.query.slug !== undefined ? req.query.slug : req.query['...slug'];
  const key = Array.isArray(slug) ? slug[0] : slug;
  const target = routes[key];
  if (!target) {
    res.status(404).json({ ok: false, error: 'Rota não encontrada.' });
    return;
  }
  return target(req, res);
};
