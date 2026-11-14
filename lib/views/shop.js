const cfg = require('../config');
const { esc, money, nl2br, highlight, waLink, jsonForScript, layout, icon, categoryEmoji } = require('./common');
const { PAYMENT_LABELS, ORDER_STATUS, paymentMethods, shippingOptions, discountPct } = require('../peru');

const catUrl = (c) => `/productos?categoria=${encodeURIComponent(c)}`;

// ---------- Piezas reutilizables ----------
function price(p, big = false) {
  const pct = discountPct(p);
  return `<p class="pprice${pct ? ' sale' : ''}${big ? ' big' : ''}"><b>${money(p.price)}</b>${pct ? ` <s>${money(p.compareAtPrice)}</s>` : ''}</p>`;
}

const cartData = (p) => esc(JSON.stringify({ id: p.id, title: p.title, price: p.price, image: p.image }));
const favButton = (p) =>
  `<button class="fav" type="button" data-fav="${esc(p.id)}" aria-label="Guardar en favoritos" aria-pressed="false">${icon('heart')}</button>`;

function card(p) {
  const pct = discountPct(p);
  return `<article class="pcard">
  <a class="pimg" href="/producto/${esc(p.id)}"><img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy"></a>
  ${pct ? `<span class="off">-${pct}%</span>` : ''}
  ${favButton(p)}
  <div class="pbody">
    <a class="pname" href="/producto/${esc(p.id)}">${esc(p.title)}</a>
    ${price(p)}
    ${
      p.inStock
        ? `<button class="btn-add" type="button" data-add-to-cart="${cartData(p)}">${icon('cart')}<span>Agregar</span></button>`
        : '<span class="btn-add disabled">Agotado</span>'
    }
  </div>
</article>`;
}

const grid = (list, empty = 'Todavía no hay productos aquí. ¡Vuelve pronto!') =>
  list.length ? `<section class="grid">${list.map(card).join('')}</section>` : `<p class="empty">${esc(empty)}</p>`;

const sectionHead = (title, link, ic = '') =>
  `<div class="sec-head"><h2>${ic}${esc(title)}</h2>${link ? `<a href="${link}">Ver todos ${icon('arrow')}</a>` : ''}</div>`;

function categoryTiles(products, { big = false } = {}) {
  const tile = (label, href, img, extra = '', count = null) =>
    `<a class="tile${extra}" href="${href}">
  <span class="tile-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="emoji">${categoryEmoji(label)}</span>`}</span>
  <span class="tile-label">${esc(label)} ${icon('chevron')}</span>
  ${big && count !== null ? `<span class="tile-count">${count} producto${count === 1 ? '' : 's'}</span>` : ''}
</a>`;
  const inCat = (c) => products.filter((p) => p.category === c);
  const tiles = cfg.categories.map((c) => tile(c, catUrl(c), (inCat(c)[0] || {}).image, '', inCat(c).length));
  tiles.push(tile('Ofertas', '/ofertas', '', ' tile-gift', big ? products.filter((p) => discountPct(p) > 0).length : null));
  if (big) tiles.push(tile('Personalizados', '/personalizados', '', ' tile-custom'));
  return `<nav class="tiles${big ? ' big' : ''}" aria-label="Categorías">${tiles.join('')}</nav>`;
}

// ---------- Portada ----------
const DEFAULT_SLIDE = {
  title: 'Tu estilo, tu *poder*',
  subtitle: 'Moda, bienestar y mucho más en un solo lugar.',
  button: 'Comprar ahora',
  link: '/productos',
  image: '',
};

function hero(banners) {
  const slides = banners.length ? banners : [DEFAULT_SLIDE];
  const slide = (b, i) => `<a class="slide${b.image ? ' has-img' : ''}" href="${esc(b.link || '/productos')}"${i ? ' aria-hidden="true" tabindex="-1"' : ''}>
  ${b.image ? `<img class="slide-img" src="${esc(b.image)}" alt=""${i ? ' loading="lazy"' : ''}>` : `<span class="slide-deco">${icon('crown', 'deco-crown')}${icon('sparkle', 'spark s1')}${icon('sparkle', 'spark s2')}${icon('sparkle', 'spark s3')}<span class="script">Vive<br>Mejor</span></span>`}
  <span class="slide-text">
    ${b.title ? `<span class="slide-title">${icon('crown', 'mini-crown')}${highlight(b.title)}</span>` : ''}
    ${b.subtitle ? `<span class="slide-sub">${esc(b.subtitle)}</span>` : ''}
    ${b.button ? `<span class="pill">${esc(b.button)} ${icon('arrow')}</span>` : ''}
  </span>
</a>`;
  return `<section class="hero" data-carousel aria-roledescription="carrusel">
  <div class="slides">${slides.map(slide).join('')}</div>
  ${slides.length > 1 ? `<div class="dots">${slides.map((_, i) => `<button type="button" aria-label="Ir a la imagen ${i + 1}"${i ? '' : ' class="on"'}></button>`).join('')}</div>` : ''}
</section>`;
}

function promos(products, settings) {
  const free = Number(settings.shipping.freeFrom) || 0;
  const maxPct = Math.max(0, ...products.filter((p) => p.inStock).map(discountPct));
  const cards = [];
  if (free > 0) {
    cards.push(`<a class="promo-card dark" href="/soporte#envios">
  ${icon('gift', 'promo-ico')}
  <span><strong class="script-gold">Envío gratis</strong><span>en compras desde</span><b>${money(free)}</b></span>
  ${icon('truck', 'promo-truck')}
</a>`);
  }
  if (maxPct > 0) {
    cards.push(`<a class="promo-card lilac" href="/ofertas">
  ${icon('tag', 'promo-ico')}
  <span><span>Hasta</span><strong class="pct">${maxPct}%</strong><span>de descuento</span></span>
  <span class="round-arrow">${icon('chevron')}</span>
</a>`);
  }
  return cards.length ? `<section class="promos${cards.length === 1 ? ' single' : ''}">${cards.join('')}</section>` : '';
}

const customPromo = () => `<a class="custom-promo" href="/personalizados">
  ${icon('palette', 'promo-ico')}
  <span><strong>¿Buscas algo especial?</strong><span>Pídelo personalizado y te cotizamos por WhatsApp.</span></span>
  <span class="round-arrow">${icon('chevron')}</span>
</a>`;

function home(products, settings) {
  const available = products.filter((p) => p.inStock);
  const featured = products.filter((p) => p.featured && p.inStock);
  const top = (featured.length ? featured : available).slice(0, 10);
  const body = `${hero(settings.banners)}
<div class="wrap">
${categoryTiles(products)}
${promos(products, settings)}
${top.length ? `${sectionHead('Productos destacados', '/productos', '<span class="fire">🔥</span>')}<section class="row-scroll">${top.map(card).join('')}</section>` : '<p class="empty">Muy pronto tendremos productos para ti ✨</p>'}
${customPromo()}
${products.length > top.length ? `${sectionHead('Lo nuevo', '/productos')}${grid(products.slice(0, 12))}` : ''}
</div>`;
  return layout({ title: '', body, active: 'inicio' });
}

// ---------- Listados ----------
function listPage({ title, list, active = '', category = '', q = '', empty, intro = '' }) {
  const chips = ['Todo', ...cfg.categories]
    .map((c) => {
      const on = c === 'Todo' ? !category : c === category;
      return `<a class="chip${on ? ' on' : ''}" href="${c === 'Todo' ? '/productos' : catUrl(c)}">${esc(c)}</a>`;
    })
    .join('');
  const body = `<div class="wrap">
  <h1 class="page-title">${esc(title)}</h1>
  ${intro}
  ${q ? '' : `<nav class="chips">${chips}</nav>`}
  ${grid(list, empty)}
</div>`;
  return layout({ title, body, active, q });
}

const productsPage = (products, category) =>
  listPage({
    title: category || 'Todos los productos',
    list: category ? products.filter((p) => p.category === category) : products,
    category,
  });

const offersPage = (products) =>
  listPage({
    title: 'Ofertas',
    list: products.filter((p) => discountPct(p) > 0).sort((a, b) => discountPct(b) - discountPct(a)),
    active: 'ofertas',
    empty: 'Por ahora no hay ofertas. ¡Síguenos en TikTok para enterarte primero!',
  });

function searchPage(products, q) {
  const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const list = terms.length
    ? products.filter((p) => {
        const hay = norm(`${p.title} ${p.description} ${p.category || ''}`);
        return terms.every((t) => hay.includes(t));
      })
    : [];
  return listPage({
    title: q ? `Resultados para “${q}”` : 'Buscar',
    list,
    q,
    empty: q ? 'No encontramos productos. Prueba con otra palabra o pídelo personalizado.' : 'Escribe qué buscas.',
  });
}

function favoritesPage(list, hasIds) {
  const body = `<div class="wrap">
  <h1 class="page-title">Favoritos</h1>
  ${hasIds ? grid(list, 'Tus favoritos ya no están disponibles.') : `<div id="fav-empty" class="empty">Toca el ${icon('heart')} en un producto para guardarlo aquí.<br><a class="btn" href="/productos">Ver productos</a></div>`}
</div>
${hasIds ? '' : '<script>try{var f=JSON.parse(localStorage.getItem("tienda_favoritos")||"[]");if(f.length)location.replace("/favoritos?ids="+encodeURIComponent(f.join(",")))}catch(e){}</script>'}`;
  return layout({ title: 'Favoritos', body, active: 'favoritos' });
}

function categoriesPage(products) {
  const body = `<div class="wrap">
  <h1 class="page-title">Categorías</h1>
  ${categoryTiles(products, { big: true })}
</div>`;
  return layout({ title: 'Categorías', body, active: 'categorias' });
}

// ---------- Soporte y mis pedidos ----------
function supportPage(settings) {
  const methods = paymentMethods(settings).map((m) => PAYMENT_LABELS[m]);
  const ship = shippingOptions(settings)
    .map((o) => `<li>${esc(o.label)}: <b>${o.cost ? money(o.cost) : 'gratis'}</b></li>`)
    .join('');
  const free = Number(settings.shipping.freeFrom) || 0;
  const wa = cfg.whatsappNumber
    ? `<a class="support-card wa" href="${esc(waLink(cfg.whatsappNumber, 'Hola, tengo una consulta'))}" target="_blank" rel="noopener">${icon('whatsapp')}<span><strong>Escríbenos por WhatsApp</strong><span>Te respondemos lo antes posible</span></span></a>`
    : '';
  const tt = cfg.tiktokUsername
    ? `<a class="support-card" href="https://www.tiktok.com/@${encodeURIComponent(cfg.tiktokUsername)}" target="_blank" rel="noopener">${icon('sparkle')}<span><strong>Síguenos en TikTok</strong><span>@${esc(cfg.tiktokUsername)} · novedades y ofertas</span></span></a>`
    : '';
  const body = `<div class="wrap narrow-col">
  <h1 class="page-title">¿En qué te ayudamos?</h1>
  <div class="support-grid">
    ${wa}
    <a class="support-card" href="/mis-pedidos">${icon('bag')}<span><strong>Mis pedidos</strong><span>Revisa el estado o sube tu comprobante</span></span></a>
    <a class="support-card" href="/personalizados">${icon('palette')}<span><strong>Pedidos personalizados</strong><span>Cuéntanos qué quieres y te cotizamos</span></span></a>
    ${tt}
  </div>
  <h2>Preguntas frecuentes</h2>
  <details class="faq" open><summary>¿Cómo pago?</summary>
    <p>${methods.length ? `Aceptamos ${esc(methods.join(', '))}.` : 'Escríbenos por WhatsApp para coordinar el pago.'} Al hacer tu pedido verás el monto exacto y los datos para pagar; luego subes la captura de tu pago y te confirmamos.</p></details>
  <details class="faq" id="envios"><summary>¿Cuánto cuesta el envío?</summary>
    <ul>${ship}</ul>${free ? `<p><b>Envío gratis</b> en compras desde ${money(free)}.</p>` : ''}${settings.shipping.note ? `<p>${nl2br(settings.shipping.note)}</p>` : ''}</details>
  <details class="faq"><summary>¿Envían a provincia?</summary>
    <p>Sí, enviamos a todo el Perú por agencia (Shalom, Olva u otra). Te pediremos tu DNI para que puedas recoger tu paquete.</p></details>
  <details class="faq"><summary>¿Cómo sé el estado de mi pedido?</summary>
    <p>Entra a <a href="/mis-pedidos">Mis pedidos</a> con tu código (por ejemplo P-1001) y tu celular.</p></details>
</div>`;
  return layout({ title: 'Soporte', body, active: 'soporte' });
}

function myOrdersPage(orders, error) {
  const list = orders
    .map(
      (o) => `<a class="order-row" href="/pedido/${esc(o.id)}"><b>${esc(o.code)}</b><span class="status s-${esc(o.status)}">${esc(ORDER_STATUS[o.status])}</span><span>${money(o.total)}</span></a>`
    )
    .join('');
  const body = `<div class="wrap narrow-col">
  <h1 class="page-title">Mis pedidos</h1>
  ${list ? `<section class="panel">${list}</section>` : ''}
  <form class="panel" method="post" action="/mis-pedidos">
    <h2>Buscar un pedido</h2>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <label>Código del pedido <input type="text" name="code" required placeholder="P-1001" autocapitalize="characters"></label>
    <label>Celular con el que compraste <input type="tel" name="phone" required placeholder="987 654 321" inputmode="tel"></label>
    <button class="btn wide">Ver pedido</button>
  </form>
</div>
${orders.length ? '' : '<script>try{var o=JSON.parse(localStorage.getItem("tienda_pedidos")||"[]");if(o.length&&!location.search)location.replace("/mis-pedidos?ids="+encodeURIComponent(o.join(",")))}catch(e){}</script>'}`;
  return layout({ title: 'Mis pedidos', body });
}

// ---------- Producto ----------
function productPage(p, related) {
  const pct = discountPct(p);
  const track = cfg.tiktokPixelId
    ? `<script>window.ttq&&ttq.track('ViewContent',{content_id:${jsonForScript(p.id)},content_type:'product',value:${Number(p.price)},currency:${jsonForScript(cfg.currency)}});</script>`
    : '';
  const og = `<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description.slice(0, 200))}">
<meta property="og:image" content="${esc(cfg.baseUrl + p.image)}">`;
  const ask = cfg.whatsappNumber
    ? `<a class="btn ghost" href="${esc(waLink(cfg.whatsappNumber, `Hola, tengo una consulta sobre: ${p.title} ${cfg.baseUrl}/producto/${p.id}`))}" target="_blank" rel="noopener">${icon('whatsapp')} Preguntar</a>`
    : '';
  const buy = p.inStock
    ? `<div class="buy">
  <div class="stepper big" data-qty-stepper><button type="button" data-step="-1" aria-label="Menos">−</button><input id="qty" type="number" min="1" max="99" value="1" inputmode="numeric" aria-label="Cantidad"><button type="button" data-step="1" aria-label="Más">+</button></div>
  <button class="btn dark grow" type="button" data-add-to-cart="${cartData(p)}" data-use-qty>${icon('cart')} Agregar<span class="hide-sm">&nbsp;al carrito</span></button>
</div>
<div class="buy"><button class="btn gold grow" type="button" data-add-to-cart="${cartData(p)}" data-use-qty data-go="/carrito">Comprar ahora ${icon('arrow')}</button>${ask}</div>`
    : `<p><span class="tag">Agotado</span></p><p>${ask}</p>`;
  const body = `<div class="wrap">
<article class="product">
  <div class="product-img">
    <img src="${esc(p.image)}" alt="${esc(p.title)}">
    ${pct ? `<span class="off">-${pct}%</span>` : ''}
    ${favButton(p)}
  </div>
  <div>
    ${p.category ? `<a class="chip small" href="${catUrl(p.category)}">${esc(p.category)}</a>` : ''}
    <h1>${esc(p.title)}</h1>
    ${price(p, true)}
    ${buy}
    <ul class="perks"><li>${icon('truck')} Envíos a todo el Perú</li><li>${icon('sparkle')} Paga con Yape, Plin o transferencia</li></ul>
    <div class="desc">${nl2br(p.description)}</div>
  </div>
</article>
${related.length ? `${sectionHead('También te puede gustar', p.category ? catUrl(p.category) : '/productos')}<section class="row-scroll">${related.map(card).join('')}</section>` : ''}
</div>${track}`;
  return layout({ title: p.title, body, head: og });
}

// ---------- Carrito y pedido ----------
function cartPage(settings, error) {
  const methods = paymentMethods(settings);
  const shipping = shippingOptions(settings);
  const free = Number(settings.shipping.freeFrom) || 0;
  const radio = (name, value, label, extra = '', checked = false) =>
    `<label class="option"><input type="radio" name="${name}" value="${esc(value)}" required${checked ? ' checked' : ''}${extra}> <span>${label}</span></label>`;

  const form = methods.length
    ? `<form id="checkout" class="panel" method="post" action="/checkout" data-free-from="${free}">
  <h2>Tus datos</h2>
  <label>Nombre y apellido <input type="text" name="name" required maxlength="120" autocomplete="name"></label>
  <label>Celular (WhatsApp) <input type="tel" name="phone" required placeholder="987 654 321" inputmode="tel" autocomplete="tel"></label>

  <h2>Entrega</h2>
  ${shipping.map((o, i) => radio('shipping', o.id, `${esc(o.label)} <b data-ship-label>${o.cost ? money(o.cost) : 'Gratis'}</b>`, ` data-cost="${o.cost}"`, i === 0)).join('')}
  ${settings.shipping.note ? `<p class="hint">${nl2br(settings.shipping.note)}</p>` : ''}
  ${settings.shipping.pickup && settings.shipping.pickupNote ? `<p class="hint" data-show-for="recojo">Recojo: ${nl2br(settings.shipping.pickupNote)}</p>` : ''}
  <div data-hide-for="recojo">
    <label>Dirección <input type="text" name="address" maxlength="300" autocomplete="street-address" placeholder="Av./Jr./Calle, número, referencia"></label>
    <label>Distrito / ciudad <input type="text" name="district" maxlength="120" placeholder="Ej: Miraflores, Lima · Arequipa"></label>
  </div>
  <label data-show-for="provincia">DNI (lo pide la agencia) <input type="text" name="dni" maxlength="8" inputmode="numeric" pattern="\\d{8}"></label>
  <label>Notas (opcional) <textarea name="notes" rows="2" maxlength="500" placeholder="Talla, color, horario de entrega..."></textarea></label>

  <h2>Método de pago</h2>
  ${methods.map((m, i) => radio('payment', m, esc(PAYMENT_LABELS[m]), '', i === 0)).join('')}

  <div class="totals">
    <p>Subtotal <span data-subtotal>—</span></p>
    <p>Envío <span data-shipping-cost>—</span></p>
    <p class="total">Total <span data-total>—</span></p>
  </div>
  <input type="hidden" name="items">
  <button class="btn dark wide">Hacer pedido</button>
  <p class="hint">En el siguiente paso verás los datos para pagar y podrás subir tu comprobante.</p>
</form>`
    : '<p class="panel">La tienda aún no configuró sus métodos de pago. Escríbenos por WhatsApp para comprar.</p>';

  const body = `<div class="wrap">
<h1 class="page-title">Tu carrito</h1>
${error ? `<p class="error">${esc(error)}</p>` : ''}
<div class="cart-layout">
  <section id="cart-items" class="panel"><p class="empty">Tu carrito está vacío. <a href="/productos">Ver productos</a></p></section>
  ${form}
</div>
</div>`;
  return layout({ title: 'Carrito', body });
}

function paymentInstructions(order, settings) {
  const amount = `<b>${money(order.total)}</b>`;
  const qr = (src) => (src ? `<img class="qr" src="${esc(src)}" alt="Código QR">` : '');
  switch (order.payment) {
    case 'yape':
      return `<p>Yapea ${amount} al <b class="big-number">${esc(settings.yape.number)}</b>${settings.yape.name ? ` (${esc(settings.yape.name)})` : ''}.</p>${qr(settings.yape.qr)}`;
    case 'plin':
      return `<p>Plinea ${amount} al <b class="big-number">${esc(settings.plin.number)}</b>${settings.plin.name ? ` (${esc(settings.plin.name)})` : ''} desde BBVA, Interbank, Scotiabank u otra app con Plin.</p>${qr(settings.plin.qr)}`;
    case 'transferencia':
      return `<p>Transfiere ${amount} a cualquiera de estas cuentas. Desde otro banco usa el <b>CCI</b>.</p>
<ul class="banks">${settings.banks
        .map(
          (b) => `<li><b>${esc(b.bank)}</b>${b.holder ? ` · ${esc(b.holder)}` : ''}${b.account ? `<br>Cuenta: <code>${esc(b.account)}</code>` : ''}${b.cci ? `<br>CCI: <code>${esc(b.cci)}</code>` : ''}</li>`
        )
        .join('')}</ul>`;
    case 'tarjeta':
      return `<p>Paga ${amount} con tarjeta en nuestro enlace de pago seguro. Escribe tu código de pedido <b>${esc(order.code)}</b> en la descripción.</p>
<p><a class="btn gold" href="${esc(settings.cardLink)}" target="_blank" rel="noopener">Pagar con tarjeta</a></p>`;
    default:
      return '';
  }
}

function orderPage(order, settings, { isNew, error, uploaded }) {
  const items = order.items
    .map((i) => `<li><img class="thumb" src="${esc(i.image)}" alt=""><span>${i.qty} × ${esc(i.title)}</span><b>${money(i.price * i.qty)}</b></li>`)
    .join('');
  const notify = cfg.whatsappNumber
    ? `<a class="btn ghost" href="${esc(waLink(cfg.whatsappNumber, `Hola, hice el pedido ${order.code} por ${money(order.total)} con ${PAYMENT_LABELS[order.payment]}. ${cfg.baseUrl}/pedido/${order.id}`))}" target="_blank" rel="noopener">${icon('whatsapp')} Avisar por WhatsApp</a>`
    : '';
  const open = order.status === 'pendiente' || order.status === 'por_verificar';
  const voucherBlock = open
    ? `<form class="voucher" method="post" action="/pedido/${esc(order.id)}/comprobante" enctype="multipart/form-data">
  <label class="drop">
    <input type="file" name="voucher" accept="image/jpeg,image/png,image/webp" required>
    <span>${order.voucher ? '✅ Comprobante recibido. Toca para cambiarlo.' : '📎 Sube la captura de tu pago (Yape, Plin o voucher)'}</span>
    <img class="preview" alt="">
  </label>
  <button class="btn dark">Enviar comprobante</button>
</form>`
    : '';
  const track =
    isNew && cfg.tiktokPixelId
      ? `<script>window.ttq&&ttq.track('PlaceAnOrder',{value:${order.total},currency:${jsonForScript(cfg.currency)},contents:${jsonForScript(order.items.map((i) => ({ content_id: i.productId, quantity: i.qty, price: i.price })))}});</script>`
      : '';
  // Recuerda el pedido en este celular para "Mis pedidos".
  const remember = `<script>try{var k="tienda_pedidos",o=JSON.parse(localStorage.getItem(k)||"[]"),id=${jsonForScript(order.id)};if(o.indexOf(id)<0){o.unshift(id);localStorage.setItem(k,JSON.stringify(o.slice(0,20)))}${isNew ? 'localStorage.removeItem("tienda_carrito");' : ''}}catch(e){}</script>`;

  const body = `${remember}<div class="wrap narrow-col">
${error ? `<p class="error">${esc(error)}</p>` : ''}
${uploaded ? '<p class="ok">¡Gracias! Recibimos tu comprobante. Te confirmaremos por WhatsApp.</p>' : ''}
<section class="panel order-head">
  ${icon('crown', 'order-crown')}
  <p class="muted">${isNew ? '¡Pedido recibido!' : 'Pedido'}</p>
  <h1>${esc(order.code)}</h1>
  <p><span class="status s-${esc(order.status)}">${esc(ORDER_STATUS[order.status])}</span></p>
</section>
${open ? `<section class="panel pay">
  <h2>Cómo pagar · ${esc(PAYMENT_LABELS[order.payment])}</h2>
  ${paymentInstructions(order, settings)}
  ${voucherBlock}
  <p>${notify}</p>
</section>` : ''}
<section class="panel">
  <h2>Resumen</h2>
  <ul class="lines">${items}</ul>
  <div class="totals">
    <p>Subtotal <span>${money(order.subtotal)}</span></p>
    <p>${esc(order.shipping.label)} <span>${order.shippingCost ? money(order.shippingCost) : 'Gratis'}</span></p>
    <p class="total">Total <span>${money(order.total)}</span></p>
  </div>
  <p class="muted">${esc(order.customer.name)} · ${esc(order.customer.phone)}${order.customer.address ? ` · ${esc(order.customer.address)}, ${esc(order.customer.district)}` : ''}</p>
</section>
</div>${track}`;
  return layout({ title: `Pedido ${order.code}`, body });
}

// ---------- Personalizados ----------
function customForm({ error, values = {} } = {}) {
  const v = (k) => esc(values[k] || '');
  const cats = cfg.categories
    .concat('Otro')
    .map((c) => `<option${values.category === c ? ' selected' : ''}>${esc(c)}</option>`)
    .join('');
  const body = `<div class="wrap narrow-col">
<section class="custom-hero">
  ${icon('palette', 'promo-ico')}
  <h1>Pedidos <em>personalizados</em></h1>
  <p>¿Una cartera en otro color, una joya con tu nombre, ropa a medida o un pack de vitaminas? Cuéntanos y te enviamos una cotización por WhatsApp.</p>
</section>
<form class="panel" method="post" action="/personalizados" enctype="multipart/form-data">
  ${error ? `<p class="error">${esc(error)}</p>` : ''}
  <label>Nombre <input type="text" name="name" required maxlength="120" value="${v('name')}" autocomplete="name"></label>
  <label>Celular (WhatsApp) <input type="tel" name="phone" required placeholder="987 654 321" value="${v('phone')}" inputmode="tel" autocomplete="tel"></label>
  <label>Tipo de producto <select name="category" required>${cats}</select></label>
  <label>¿Qué te gustaría? <textarea name="description" rows="5" required maxlength="2000" placeholder="Describe colores, tallas, medidas, cantidad, texto a grabar...">${v('description')}</textarea></label>
  <label class="drop">
    <input type="file" name="photo" accept="image/jpeg,image/png,image/webp">
    <span>🖼️ Foto de referencia (opcional)</span>
    <img class="preview" alt="">
  </label>
  <div class="row">
    <label>Presupuesto aprox. (S/) <input type="number" name="budget" min="0" step="1" value="${v('budget')}" inputmode="numeric"></label>
    <label>¿Para cuándo? <input type="date" name="dueDate" value="${v('dueDate')}"></label>
  </div>
  <button class="btn dark wide">Enviar solicitud</button>
</form>
</div>`;
  return layout({ title: 'Pedidos personalizados', body });
}

function customThanks(req) {
  const wa = cfg.whatsappNumber
    ? `<p><a class="btn gold" href="${esc(waLink(cfg.whatsappNumber, `Hola, soy ${req.name}. Envié una solicitud de pedido personalizado (${req.category}): ${req.description.slice(0, 300)}`))}" target="_blank" rel="noopener">${icon('whatsapp')} Escribirnos por WhatsApp</a></p>`
    : '';
  const track = cfg.tiktokPixelId ? "<script>window.ttq&&ttq.track('SubmitForm');</script>" : '';
  const body = `<div class="wrap narrow-col"><section class="panel order-head">
  ${icon('crown', 'order-crown')}
  <h1>¡Solicitud enviada!</h1>
  <p>Revisaremos tu pedido y te escribiremos al <b>${esc(req.phone)}</b> con la cotización.</p>
  ${wa}
  <p><a href="/">&larr; Volver a la tienda</a></p>
</section></div>${track}`;
  return layout({ title: 'Solicitud enviada', body });
}

function notFound(msg = 'No encontramos lo que buscas.') {
  return layout({ title: 'No encontrado', body: `<div class="wrap"><p class="empty">${esc(msg)} <a href="/">Volver a la tienda</a></p></div>` });
}

module.exports = {
  home,
  productsPage,
  offersPage,
  searchPage,
  favoritesPage,
  categoriesPage,
  supportPage,
  myOrdersPage,
  productPage,
  cartPage,
  orderPage,
  customForm,
  customThanks,
  notFound,
};
