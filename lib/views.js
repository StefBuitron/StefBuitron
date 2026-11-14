const cfg = require('./config');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (n) => {
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency: cfg.currency }).format(n);
  } catch {
    return `${Number(n).toFixed(2)} ${cfg.currency}`;
  }
};

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

function layout({ title, body, admin = false, head = '' }) {
  const tiktok = cfg.tiktokUsername
    ? `<a class="tiktok-link" href="https://www.tiktok.com/@${encodeURIComponent(cfg.tiktokUsername)}" target="_blank" rel="noopener">@${esc(cfg.tiktokUsername)} en TikTok</a>`
    : '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? `${title} · ${cfg.storeName}` : cfg.storeName)}</title>
<link rel="stylesheet" href="/static/styles.css">
${head}
${admin ? '' : pixelSnippet()}
</head>
<body>
<header class="top">
  <a class="brand" href="/">${esc(cfg.storeName)}</a>
  <nav>${admin ? '<a href="/">Ver tienda</a> <form method="post" action="/admin/salir" class="inline"><button class="link">Salir</button></form>' : tiktok}</nav>
</header>
<main>${body}</main>
<footer class="foot">${esc(cfg.storeName)}</footer>
</body>
</html>`;
}

function buyButton(p) {
  if (!cfg.whatsappNumber) return '';
  const text = `Hola, me interesa: ${p.title} (${money(p.price)}) ${cfg.baseUrl}/producto/${p.id}`;
  const href = `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(text)}`;
  const track = cfg.tiktokPixelId
    ? ` onclick="window.ttq&&ttq.track('Contact',{content_id:'${esc(p.id)}',value:${Number(p.price)},currency:'${esc(cfg.currency)}'})"`
    : '';
  return `<a class="btn" href="${esc(href)}" target="_blank" rel="noopener"${track}>Comprar por WhatsApp</a>`;
}

function card(p) {
  return `<a class="card" href="/producto/${esc(p.id)}">
  <img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">
  <div class="card-body">
    <h3>${esc(p.title)}</h3>
    <p class="price">${money(p.price)}${p.inStock ? '' : ' <span class="tag">Agotado</span>'}</p>
  </div>
</a>`;
}

function home(products) {
  const body = products.length
    ? `<section class="grid">${products.map(card).join('')}</section>`
    : '<p class="empty">Todavía no hay productos. ¡Vuelve pronto!</p>';
  return layout({ title: '', body });
}

function productPage(p) {
  const track = cfg.tiktokPixelId
    ? `<script>window.ttq&&ttq.track('ViewContent',{content_id:${JSON.stringify(p.id)},content_type:'product',value:${Number(p.price)},currency:${JSON.stringify(cfg.currency)}});</script>`
    : '';
  const og = `<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description.slice(0, 200))}">
<meta property="og:image" content="${esc(cfg.baseUrl + p.image)}">`;
  const body = `<article class="product">
  <img src="${esc(p.image)}" alt="${esc(p.title)}">
  <div>
    <h1>${esc(p.title)}</h1>
    <p class="price big">${money(p.price)}${p.inStock ? '' : ' <span class="tag">Agotado</span>'}</p>
    <div class="desc">${esc(p.description).replace(/\n/g, '<br>')}</div>
    ${p.inStock ? buyButton(p) : ''}
    <p><a href="/">&larr; Ver todos los productos</a></p>
  </div>
</article>${track}`;
  return layout({ title: p.title, body, head: og });
}

function notFound() {
  return layout({ title: 'No encontrado', body: '<p class="empty">Ese producto no existe.</p>' });
}

function login(error) {
  const body = `<form class="panel narrow" method="post" action="/admin/entrar">
  <h1>Panel de la tienda</h1>
  ${error ? `<p class="error">${esc(error)}</p>` : ''}
  <label>Contraseña <input type="password" name="password" required autofocus></label>
  <button class="btn">Entrar</button>
</form>`;
  return layout({ title: 'Entrar', body, admin: true });
}

function admin(products, { error, ok } = {}) {
  const feedUrl = `${cfg.baseUrl}/feeds/tiktok.csv`;
  const rows = products
    .map(
      (p) => `<tr>
  <td><img class="thumb" src="${esc(p.image)}" alt=""></td>
  <td><a href="/producto/${esc(p.id)}">${esc(p.title)}</a><br><small>${money(p.price)}</small></td>
  <td>
    <form method="post" action="/admin/productos/${esc(p.id)}/stock" class="inline">
      <button class="link">${p.inStock ? 'Marcar agotado' : 'Marcar disponible'}</button>
    </form>
    <form method="post" action="/admin/productos/${esc(p.id)}/borrar" class="inline" onsubmit="return confirm('¿Borrar este producto?')">
      <button class="link danger">Borrar</button>
    </form>
  </td>
</tr>`
    )
    .join('');

  const body = `
${error ? `<p class="error">${esc(error)}</p>` : ''}
${ok ? `<p class="ok">${esc(ok)}</p>` : ''}
<form class="panel" method="post" action="/admin/productos" enctype="multipart/form-data">
  <h1>Subir producto</h1>
  <label class="drop">
    <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" capture="environment" required>
    <span>📷 Toca para tomar o elegir la foto</span>
    <img id="preview" alt="">
  </label>
  <label>Descripción
    <textarea name="description" rows="5" required placeholder="La primera línea se usa como título.&#10;Ej: Bolso de piel color miel&#10;Hecho a mano, 30 x 20 cm."></textarea>
  </label>
  <label>Precio (${esc(cfg.currency)}) <input type="number" name="price" min="0" step="0.01" required inputmode="decimal"></label>
  <details><summary>Más opciones</summary>
    <label>Título (opcional) <input type="text" name="title" maxlength="255"></label>
  </details>
  <button class="btn">Publicar</button>
</form>

<section class="panel">
  <h2>Conexión con TikTok</h2>
  <p>Tu catálogo se publica automáticamente en esta URL:</p>
  <p><code>${esc(feedUrl)}</code></p>
  <ol>
    <li>En <b>TikTok Ads Manager</b> o <b>TikTok Shop Seller Center</b> abre <b>Catálogos</b>.</li>
    <li>Agregar productos &rarr; <b>Fuente de datos</b> &rarr; <b>Programado (URL)</b>.</li>
    <li>Pega la URL de arriba y elige actualización diaria o cada hora.</li>
  </ol>
  <p>Cada producto que subas aquí aparecerá en TikTok en la siguiente actualización, listo para etiquetarlo en tus videos y anuncios.</p>
  <p>Pixel de TikTok: ${cfg.tiktokPixelId ? `<b>activo</b> (${esc(cfg.tiktokPixelId)})` : 'no configurado (agrega <code>TIKTOK_PIXEL_ID</code>)'}</p>
</section>

<section class="panel">
  <h2>Productos (${products.length})</h2>
  ${products.length ? `<table class="list">${rows}</table>` : '<p>Aún no has subido productos.</p>'}
</section>
<script>
document.querySelector('input[name=photo]').addEventListener('change', (e) => {
  const f = e.target.files[0]; const img = document.getElementById('preview');
  if (f) { img.src = URL.createObjectURL(f); img.style.display = 'block'; }
});
</script>`;
  return layout({ title: 'Panel', body, admin: true });
}

module.exports = { home, productPage, notFound, login, admin, esc, money };
