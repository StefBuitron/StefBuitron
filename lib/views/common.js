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

const waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

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

function publicNav() {
  const tiktok = cfg.tiktokUsername
    ? `<a class="tiktok-link" href="https://www.tiktok.com/@${encodeURIComponent(cfg.tiktokUsername)}" target="_blank" rel="noopener">TikTok</a>`
    : '';
  return `<a href="/personalizados">Personalizados</a>${tiktok}
<a class="cart-link" href="/carrito" aria-label="Carrito">🛒 <span class="badge" data-cart-count hidden>0</span></a>`;
}

function adminNav(active, counts = {}) {
  const item = (href, label, key, n) =>
    `<a href="${href}"${active === key ? ' class="active"' : ''}>${label}${n ? ` <span class="badge">${n}</span>` : ''}</a>`;
  return `${item('/admin', 'Productos', 'productos')}
${item('/admin/pedidos', 'Pedidos', 'pedidos', counts.orders)}
${item('/admin/personalizados', 'Personalizados', 'personalizados', counts.custom)}
${item('/admin/pagos', 'Pagos y envíos', 'pagos')}
<a href="/">Ver tienda</a>
<form method="post" action="/admin/salir" class="inline"><button class="link">Salir</button></form>`;
}

function layout({ title, body, admin = null, head = '' }) {
  const store = jsonForScript({ currency: cfg.currency });
  return `<!doctype html>
<html lang="es-PE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? `${title} · ${cfg.storeName}` : cfg.storeName)}</title>
<link rel="stylesheet" href="/static/styles.css">
${head}
${admin ? '' : `${pixelSnippet()}<script>window.STORE=${store};</script><script src="/static/cart.js" defer></script>`}
</head>
<body${admin ? ' class="is-admin"' : ''}>
<header class="top">
  <a class="brand" href="${admin ? '/admin' : '/'}">${esc(cfg.storeName)}</a>
  <nav>${admin ? adminNav(admin.active, admin.counts) : publicNav()}</nav>
</header>
<main>${body}</main>
<footer class="foot">${esc(cfg.storeName)} · Envíos a todo el Perú · Yape · Plin · Transferencias${cfg.whatsappNumber ? ` · <a href="https://wa.me/${cfg.whatsappNumber}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</footer>
</body>
</html>`;
}

module.exports = { esc, money, nl2br, waLink, jsonForScript, layout };
