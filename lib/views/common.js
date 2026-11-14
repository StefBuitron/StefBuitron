const cfg = require('../config');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// JSON seguro para incrustar dentro de <script>.
const jsonForScript = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const money = (n) => {
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: cfg.currency }).format(n);
  } catch {
    return `${Number(n).toFixed(2)} ${cfg.currency}`;
  }
};

const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

// "Tu estilo, tu *poder*" -> resalta en dorado lo que va entre asteriscos.
const highlight = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

const waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

// Íconos SVG en línea (trazo, heredan el color del texto).
const ICONS = {
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/><circle cx="3" cy="7" r="1.3"/><circle cx="12" cy="4" r="1.3"/><circle cx="21" cy="7" r="1.3"/>',
  cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.6 12.2a1.5 1.5 0 0 0 1.5 1.2h8.8a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/>',
  user: '<circle cx="12" cy="8" r="4.5"/><path d="M3.5 21c1.2-4 4.6-6 8.5-6s7.3 2 8.5 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5 16 16"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  heart: '<path d="M12 20.5s-8-4.6-8-10.7A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8c0 6.1-8 10.7-8 10.7z"/>',
  tag: '<path d="M3 12.2V4a1 1 0 0 1 1-1h8.2a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-8.2 8.2a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-2 2.5-5 2.5"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3.5 8 4.5 9 8 12 8zm0 0s1.5-4.5 4-3.5S15 8 12 8z"/>',
  sparkle: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/>',
  whatsapp: '<path d="M4 20l1.2-3.6A8 8 0 1 1 8 19.2L4 20z"/><path d="M9 9.5c.3 2 2.5 4.3 4.6 4.6l1-1.1 1.6.8c-.2 1-1 1.7-2 1.7-3.2 0-6.3-3-6.3-6.3 0-1 .7-1.8 1.7-2l.8 1.6-1 .7z"/>',
  bag: '<path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  play: '<path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
};
const icon = (name, cls = '') =>
  `<svg class="ico${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// Ícono de respaldo para cada categoría cuando todavía no tiene fotos.
const CATEGORY_EMOJI = { ropa: '👕', bolsos: '👜', carteras: '👜', vitaminas: '💊', joyas: '💍', accesorios: '🕶️', ofertas: '🎁' };
const categoryEmoji = (c) => CATEGORY_EMOJI[String(c).toLowerCase()] || '✨';

// Estrellas de calificación (1 a 5).
function stars(value, cls = '') {
  const n = Math.round(Number(value) * 2) / 2;
  let out = '';
  for (let i = 1; i <= 5; i++) out += `<i class="${n >= i ? 'on' : n >= i - 0.5 ? 'half' : ''}">★</i>`;
  return `<span class="stars${cls ? ` ${cls}` : ''}" role="img" aria-label="${n} de 5 estrellas">${out}</span>`;
}

function pixelSnippet() {
  const id = cfg.tiktokPixelId;
  if (!/^[A-Z0-9]+$/i.test(id)) return '';
  return `<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('${id}');
  ttq.page();
}(window, document, 'ttq');
</script>`;
}

const logo = () => `<span class="logo">${icon('crown', 'crown')}<span class="logo-name">${esc(cfg.storeName)}</span></span>`;

function publicHeader(q) {
  return `<header class="top">
  <div class="top-row">
    <a class="brand" href="/" aria-label="Inicio">${logo()}</a>
    ${cfg.tagline ? `<span class="tagline">${esc(cfg.tagline)}</span>` : ''}
    <nav class="desk-nav">
      <a href="/productos">Productos</a><a href="/categorias">Categorías</a><a href="/videos">Videos</a><a href="/ofertas">Ofertas</a><a href="/personalizados">Personalizados</a><a href="/soporte">Soporte</a>
    </nav>
    <div class="top-icons">
      <a class="icon-btn" href="/carrito" aria-label="Carrito">${icon('cart')}<span class="badge" data-cart-count hidden>0</span></a>
      <a class="icon-btn" href="/mis-pedidos" aria-label="Mis pedidos">${icon('user')}</a>
    </div>
  </div>
  <form class="search" action="/buscar" role="search">
    ${icon('search')}
    <input type="search" name="q" value="${esc(q || '')}" placeholder="Buscar productos..." aria-label="Buscar productos" enterkeyhint="search">
    <a href="/categorias" aria-label="Ver categorías">${icon('sliders')}</a>
  </form>
</header>`;
}

function bottomNav(active) {
  const item = (href, ic, label, key) =>
    `<a href="${href}"${active === key ? ' class="on" aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`;
  return `<nav class="bottom-nav">
  ${item('/', 'home', 'Inicio', 'inicio')}
  ${item('/categorias', 'grid', 'Categorías', 'categorias')}
  ${item('/favoritos', 'heart', 'Favoritos', 'favoritos')}
  ${item('/ofertas', 'tag', 'Ofertas', 'ofertas')}
  ${item('/soporte', 'headset', 'Soporte', 'soporte')}
</nav>`;
}

function adminNav(active, counts = {}) {
  const item = (href, label, key, n) =>
    `<a href="${href}"${active === key ? ' class="active"' : ''}>${label}${n ? ` <span class="badge">${n}</span>` : ''}</a>`;
  return `<nav class="admin-nav">${item('/admin', 'Productos', 'productos')}
${item('/admin/pedidos', 'Pedidos', 'pedidos', counts.orders)}
${item('/admin/personalizados', 'Personalizados', 'personalizados', counts.custom)}
${item('/admin/resenas', 'Reseñas', 'resenas')}
${item('/admin/portada', 'Portada', 'portada')}
${item('/admin/pagos', 'Pagos y envíos', 'pagos')}
<a href="/">Ver tienda</a>
<form method="post" action="/admin/salir" class="inline"><button class="link">Salir</button></form></nav>`;
}

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600;1,800&family=Kaushan+Script&display=swap">`;

function layout({ title, body, admin = null, head = '', active = '', q = '' }) {
  const store = jsonForScript({ currency: cfg.currency });
  const header = admin
    ? `<header class="top"><div class="top-row"><a class="brand" href="/admin">${logo()}</a><span class="tagline">Panel</span></div>${adminNav(admin.active, admin.counts)}</header>`
    : publicHeader(q);
  return `<!doctype html>
<html lang="es-PE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#111014">
<title>${esc(title ? `${title} · ${cfg.storeName}` : `${cfg.storeName}${cfg.tagline ? ` · ${cfg.tagline}` : ''}`)}</title>
${FONTS}
<link rel="stylesheet" href="/static/styles.css">
${head}
${admin ? '' : pixelSnippet()}<script>window.STORE=${store};</script><script src="/static/app.js" defer></script>
</head>
<body class="${admin ? 'is-admin' : 'is-shop'}">
${header}
<main>${body}</main>
<footer class="foot">
  ${logo()}
  <p>Envíos a todo el Perú · Yape · Plin · Transferencias${cfg.whatsappNumber ? ` · <a href="https://wa.me/${cfg.whatsappNumber}" target="_blank" rel="noopener">WhatsApp</a>` : ''}${cfg.tiktokUsername ? ` · <a href="https://www.tiktok.com/@${encodeURIComponent(cfg.tiktokUsername)}" target="_blank" rel="noopener">TikTok @${esc(cfg.tiktokUsername)}</a>` : ''}</p>
</footer>
${admin ? '' : bottomNav(active)}
</body>
</html>`;
}

module.exports = { esc, money, nl2br, highlight, waLink, jsonForScript, layout, icon, categoryEmoji, stars };
