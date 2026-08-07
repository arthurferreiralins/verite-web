/**
 * VERITÉ product catalog.
 *
 * Empty on purpose — no products exist yet. When real products are ready,
 * push entries here (or swap this file for a fetch() to a real backend/CMS
 * later, keeping the same shape) using:
 *
 * {
 *   id: 'unique-slug',                 // used in produto.html?slug=...
 *   name: 'Product name',
 *   category: 'perfumes',              // 'perfumes' | 'oleos-corporais' | 'kits' | 'novidades'
 *   shortDescription: 'One line for the category grid card.',
 *   description: 'Full paragraph for the product page.',
 *   volume: '50ml',
 *   price: 0,                          // number, in BRL unless currency is set
 *   currency: 'BRL',
 *   images: ['assets/img/produtos/slug-1.jpg'],
 *   relatedIds: ['other-slug'],
 *   buyUrl: null                       // real checkout link — leave null until purchasing exists
 * }
 *
 * assets/js/products.js reads this array to render the category grids on
 * produtos.html and the product page on produto.html. Both already handle
 * an empty catalog gracefully — nothing else needs to change when this
 * array gets its first real entry.
 */
window.VERITE_PRODUCTS = [];
