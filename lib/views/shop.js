const cfg = require('../config');
const { esc, money, nl2br, waLink, jsonForScript, layout } = require('./common');
const { PAYMENT_LABELS, ORDER_STATUS, paymentMethods, shippingOptions } = require('../peru');

function card(p) {
  return `<a class="card" href="/producto/${esc(p.id)}">
  <img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">
  <div class="card-body">
    <h3>${esc(p.title)}</h3>
    <p class="price">${money(p.price)}${p.inStock ? '' : ' <span class="tag">Agotado</span>'}</p>
  </div>
</a>`;
}

function home(products, active) {
  const chip = (label, href, on) => `<a class="chip${on ? ' on' : ''}" href="${href}">${esc(label)}</a>`;
  const chips = [chip('Todo', '/', !active)]
    .concat(cfg.categories.map((c) => chip(c, `/?categoria=${encodeURIComponent(c)}`, c === active)))
    .join('');
  const list = active ? products.filter((p) => p.category === active) : products;
  const body = `<nav class="chips">${chips}</nav>
${list.length ? `<section class="grid">${list.map(card).join('')}</section>` : '<p class="empty">Todavía no hay productos aquí. ¡Vuelve pronto!</p>'}
<a class="promo" href="/personalizados">
  <strong>¿Buscas algo especial?</strong>
  <span>Pídelo personalizado: cuéntanos qué quieres y te enviamos una cotización por WhatsApp →</span>
</a>`;
  return layout({ title: active || '', body });
}

function productPage(p) {
  const track = cfg.tiktokPixelId
    ? `<script>window.ttq&&ttq.track('ViewContent',{content_id:${jsonForScript(p.id)},content_type:'product',value:${Number(p.price)},currency:${jsonForScript(cfg.currency)}});</script>`
    : '';
  const og = `<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description.slice(0, 200))}">
<meta property="og:image" content="${esc(cfg.baseUrl + p.image)}">`;
  const cartData = esc(JSON.stringify({ id: p.id, title: p.title, price: p.price, image: p.image }));
  const ask = cfg.whatsappNumber
    ? `<a class="btn ghost" href="${esc(waLink(cfg.whatsappNumber, `Hola, tengo una consulta sobre: ${p.title} ${cfg.baseUrl}/producto/${p.id}`))}" target="_blank" rel="noopener">Preguntar por WhatsApp</a>`
    : '';
  const buy = p.inStock
    ? `<div class="buy">
  <label class="qty">Cantidad <input id="qty" type="number" min="1" max="99" value="1" inputmode="numeric"></label>
  <button class="btn" type="button" data-add-to-cart="${cartData}">Agregar al carrito</button>
</div>
<p><a class="btn ghost" href="/carrito">Ir a pagar</a> ${ask}</p>`
    : `<p><span class="tag">Agotado</span></p><p>${ask}</p>`;
  const body = `<article class="product">
  <img src="${esc(p.image)}" alt="${esc(p.title)}">
  <div>
    ${p.category ? `<a class="chip small" href="/?categoria=${encodeURIComponent(p.category)}">${esc(p.category)}</a>` : ''}
    <h1>${esc(p.title)}</h1>
    <p class="price big">${money(p.price)}</p>
    <div class="desc">${nl2br(p.description)}</div>
    ${buy}
    <p class="pay-logos">Paga con Yape, Plin o transferencia · Envíos a todo el Perú</p>
    <p><a href="/">&larr; Seguir comprando</a></p>
  </div>
</article>${track}`;
  return layout({ title: p.title, body, head: og });
}

function cartPage(settings, error) {
  const methods = paymentMethods(settings);
  const shipping = shippingOptions(settings);
  const radio = (name, value, label, extra = '', checked = false) =>
    `<label class="option"><input type="radio" name="${name}" value="${esc(value)}" required${checked ? ' checked' : ''}${extra}> <span>${label}</span></label>`;

  const form = methods.length
    ? `<form id="checkout" class="panel" method="post" action="/checkout">
  <h2>Tus datos</h2>
  <label>Nombre y apellido <input type="text" name="name" required maxlength="120" autocomplete="name"></label>
  <label>Celular (WhatsApp) <input type="tel" name="phone" required placeholder="987 654 321" inputmode="tel" autocomplete="tel"></label>

  <h2>Entrega</h2>
  ${shipping.map((o, i) => radio('shipping', o.id, `${esc(o.label)} <b>${o.cost ? money(o.cost) : 'Gratis'}</b>`, ` data-cost="${o.cost}"`, i === 0)).join('')}
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
  <button class="btn wide">Hacer pedido</button>
  <p class="hint">En el siguiente paso verás los datos para pagar y podrás subir tu comprobante.</p>
</form>`
    : '<p class="panel">La tienda aún no configuró sus métodos de pago. Escríbenos por WhatsApp para comprar.</p>';

  const body = `<h1>Tu carrito</h1>
${error ? `<p class="error">${esc(error)}</p>` : ''}
<div class="cart-layout">
  <section id="cart-items" class="panel"><p class="empty">Tu carrito está vacío. <a href="/">Ver productos</a></p></section>
  ${form}
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
<p><a class="btn" href="${esc(settings.cardLink)}" target="_blank" rel="noopener">Pagar con tarjeta</a></p>`;
    default:
      return '';
  }
}

function orderPage(order, settings, { isNew, error, uploaded }) {
  const items = order.items
    .map((i) => `<li><img class="thumb" src="${esc(i.image)}" alt=""><span>${i.qty} × ${esc(i.title)}</span><b>${money(i.price * i.qty)}</b></li>`)
    .join('');
  const notify = cfg.whatsappNumber
    ? `<a class="btn ghost" href="${esc(waLink(cfg.whatsappNumber, `Hola, hice el pedido ${order.code} por ${money(order.total)} con ${PAYMENT_LABELS[order.payment]}. ${cfg.baseUrl}/pedido/${order.id}`))}" target="_blank" rel="noopener">Avisar por WhatsApp</a>`
    : '';
  const voucherBlock =
    order.status === 'pendiente' || order.status === 'por_verificar'
      ? `<form class="voucher" method="post" action="/pedido/${esc(order.id)}/comprobante" enctype="multipart/form-data">
  <label class="drop">
    <input type="file" name="voucher" accept="image/jpeg,image/png,image/webp" required>
    <span>${order.voucher ? '✅ Comprobante recibido. Toca para cambiarlo.' : '📎 Sube la captura de tu pago (Yape, Plin o voucher)'}</span>
    <img id="preview" alt="">
  </label>
  <button class="btn">Enviar comprobante</button>
</form>`
      : '';
  const track =
    isNew && cfg.tiktokPixelId
      ? `<script>window.ttq&&ttq.track('PlaceAnOrder',{value:${order.total},currency:${jsonForScript(cfg.currency)},contents:${jsonForScript(order.items.map((i) => ({ content_id: i.productId, quantity: i.qty, price: i.price })))}});</script>`
      : '';

  const body = `${isNew ? '<script>try{localStorage.removeItem("tienda_carrito")}catch(e){}</script>' : ''}
${error ? `<p class="error">${esc(error)}</p>` : ''}
${uploaded ? '<p class="ok">¡Gracias! Recibimos tu comprobante. Te confirmaremos por WhatsApp.</p>' : ''}
<section class="panel">
  <p class="muted">Pedido</p>
  <h1>${esc(order.code)}</h1>
  <p><span class="status s-${esc(order.status)}">${esc(ORDER_STATUS[order.status])}</span></p>
  <p class="hint">Guarda este enlace para revisar el estado de tu pedido.</p>
</section>
${
  order.status === 'pendiente' || order.status === 'por_verificar'
    ? `<section class="panel pay">
  <h2>Cómo pagar · ${esc(PAYMENT_LABELS[order.payment])}</h2>
  ${paymentInstructions(order, settings)}
  ${voucherBlock}
  <p>${notify}</p>
</section>`
    : ''
}
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
<script>
var f=document.querySelector('.voucher input[type=file]');
f&&f.addEventListener('change',function(e){var x=e.target.files[0],i=document.getElementById('preview');if(x){i.src=URL.createObjectURL(x);i.style.display='block'}});
</script>${track}`;
  return layout({ title: `Pedido ${order.code}`, body });
}

function customForm({ error, values = {} } = {}) {
  const v = (k) => esc(values[k] || '');
  const cats = cfg.categories
    .concat('Otro')
    .map((c) => `<option${values.category === c ? ' selected' : ''}>${esc(c)}</option>`)
    .join('');
  const body = `<form class="panel narrow-wide" method="post" action="/personalizados" enctype="multipart/form-data">
  <h1>Pedidos personalizados</h1>
  <p>¿Quieres una cartera en otro color, un accesorio con tu nombre, ropa a medida o un pack de vitaminas? Cuéntanos y te enviamos una cotización por WhatsApp.</p>
  ${error ? `<p class="error">${esc(error)}</p>` : ''}
  <label>Nombre <input type="text" name="name" required maxlength="120" value="${v('name')}" autocomplete="name"></label>
  <label>Celular (WhatsApp) <input type="tel" name="phone" required placeholder="987 654 321" value="${v('phone')}" inputmode="tel" autocomplete="tel"></label>
  <label>Tipo de producto <select name="category" required>${cats}</select></label>
  <label>¿Qué te gustaría? <textarea name="description" rows="5" required maxlength="2000" placeholder="Describe colores, tallas, medidas, cantidad, texto a grabar...">${v('description')}</textarea></label>
  <label class="drop">
    <input type="file" name="photo" accept="image/jpeg,image/png,image/webp">
    <span>🖼️ Foto de referencia (opcional)</span>
    <img id="preview" alt="">
  </label>
  <label>Presupuesto aproximado en soles (opcional) <input type="number" name="budget" min="0" step="1" value="${v('budget')}" inputmode="numeric"></label>
  <label>¿Para cuándo lo necesitas? (opcional) <input type="date" name="dueDate" value="${v('dueDate')}"></label>
  <button class="btn wide">Enviar solicitud</button>
</form>
<script>
document.querySelector('input[name=photo]').addEventListener('change',function(e){var x=e.target.files[0],i=document.getElementById('preview');if(x){i.src=URL.createObjectURL(x);i.style.display='block'}});
</script>`;
  return layout({ title: 'Pedidos personalizados', body });
}

function customThanks(req) {
  const wa = cfg.whatsappNumber
    ? `<p><a class="btn" href="${esc(waLink(cfg.whatsappNumber, `Hola, soy ${req.name}. Envié una solicitud de pedido personalizado (${req.category}): ${req.description.slice(0, 300)}`))}" target="_blank" rel="noopener">Escribirnos por WhatsApp</a></p>`
    : '';
  const track = cfg.tiktokPixelId ? "<script>window.ttq&&ttq.track('SubmitForm');</script>" : '';
  const body = `<section class="panel narrow-wide">
  <h1>¡Solicitud enviada! 🎉</h1>
  <p>Revisaremos tu pedido y te escribiremos al <b>${esc(req.phone)}</b> con la cotización.</p>
  ${wa}
  <p><a href="/">&larr; Volver a la tienda</a></p>
</section>${track}`;
  return layout({ title: 'Solicitud enviada', body });
}

function notFound(msg = 'No encontramos lo que buscas.') {
  return layout({ title: 'No encontrado', body: `<p class="empty">${esc(msg)} <a href="/">Volver a la tienda</a></p>` });
}

module.exports = { home, productPage, cartPage, orderPage, customForm, customThanks, notFound };
