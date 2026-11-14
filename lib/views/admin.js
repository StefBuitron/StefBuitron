const cfg = require('../config');
const { esc, money, nl2br, waLink, layout, stars } = require('./common');
const { MAX_TIKTOKS } = require('../media');
const { PAYMENT_LABELS, ORDER_STATUS, CUSTOM_STATUS } = require('../peru');

const MAX_BANKS = 4;
const MAX_BANNERS = 4;
const flash = ({ error, ok } = {}) =>
  `${error ? `<p class="error">${esc(error)}</p>` : ''}${ok ? `<p class="ok">${esc(ok)}</p>` : ''}`;
const date = (iso) =>
  new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });
const statusSelect = (action, statuses, current) => `<form method="post" action="${action}" class="status-form">
  <select name="status">${Object.entries(statuses)
    .map(([k, l]) => `<option value="${k}"${k === current ? ' selected' : ''}>${esc(l)}</option>`)
    .join('')}</select>
  <button class="btn small">Guardar</button>
</form>`;

function login(error) {
  const body = `<form class="panel narrow" method="post" action="/admin/entrar">
  <h1>Panel de la tienda</h1>
  ${error ? `<p class="error">${esc(error)}</p>` : ''}
  <label>Contraseña <input type="password" name="password" required autofocus></label>
  <button class="btn dark wide">Entrar</button>
</form>`;
  return layout({ title: 'Entrar', body, admin: { active: '' } });
}

function productFields(p = {}) {
  const options = cfg.categories
    .map((c) => `<option${p.category === c ? ' selected' : ''}>${esc(c)}</option>`)
    .join('');
  return `<label>Descripción
    <textarea name="description" rows="5" required placeholder="La primera línea se usa como título.&#10;Ej: Bolso crossbody negro&#10;Cuero sintético, correa ajustable.">${esc(p.description)}</textarea>
  </label>
  <div class="row">
    <label>Precio (S/) <input type="number" name="price" min="0" step="0.01" required inputmode="decimal" value="${esc(p.price ?? '')}"></label>
    <label>Precio antes (S/, opcional) <input type="number" name="compareAtPrice" min="0" step="0.01" inputmode="decimal" value="${esc(p.compareAtPrice || '')}" placeholder="Para mostrar -30%"></label>
  </div>
  <label>Categoría <select name="category" required>${options}</select></label>
  <label class="check"><input type="checkbox" name="featured"${p.featured ? ' checked' : ''}> ⭐ Mostrar en “Productos destacados”</label>
  <fieldset>
    <legend>🎬 Videos (opcional)</legend>
    <label>Enlaces de TikTok, uno por línea (hasta ${MAX_TIKTOKS})
      <textarea name="tiktok" rows="2" placeholder="https://www.tiktok.com/@tutienda/video/123...&#10;https://vm.tiktok.com/abc123/">${esc((p.tiktok || []).map((id) => `https://www.tiktok.com/video/${id}`).join('\n'))}</textarea>
    </label>
    <p class="hint">Recomendado: los videos de TikTok no ocupan espacio en tu servidor. En TikTok: Compartir → Copiar enlace.</p>
    <label class="drop small">
      <input type="file" name="video" accept="video/mp4,video/webm,video/quicktime">
      <span>${p.video ? 'Video subido ✓ (toca para cambiarlo)' : '…o sube un video corto (MP4, hasta 50 MB)'}</span>
    </label>
    ${p.video ? `<video class="vid admin-vid" src="${esc(p.video)}" controls preload="metadata"></video><label class="check"><input type="checkbox" name="video_remove"> Quitar video subido</label>` : ''}
  </fieldset>
  <details${p.id ? ' open' : ''}><summary>Más opciones</summary>
    <label>Título (opcional) <input type="text" name="title" maxlength="255" value="${p.id ? esc(p.title) : ''}"></label>
  </details>`;
}

function products(list, counts, msg) {
  const feedUrl = `${cfg.baseUrl}/feeds/tiktok.csv`;
  const rows = list
    .map(
      (p) => `<tr>
  <td><img class="thumb" src="${esc(p.image)}" alt=""></td>
  <td><a href="/producto/${esc(p.id)}">${esc(p.title)}</a><br><small>${money(p.price)}${p.compareAtPrice > p.price ? ` <s>${money(p.compareAtPrice)}</s>` : ''} · ${esc(p.category || 'Sin categoría')}${p.featured ? ' · ⭐' : ''}${p.video || (p.tiktok && p.tiktok.length) ? ' · 🎬' : ''}${p.inStock ? '' : ' · <b>Agotado</b>'}</small></td>
  <td class="actions">
    <a class="link" href="/admin/productos/${esc(p.id)}/editar">Editar</a>
    <form method="post" action="/admin/productos/${esc(p.id)}/stock" class="inline"><button class="link">${p.inStock ? 'Agotado' : 'Disponible'}</button></form>
    <form method="post" action="/admin/productos/${esc(p.id)}/borrar" class="inline" onsubmit="return confirm('¿Borrar este producto?')"><button class="link danger">Borrar</button></form>
  </td>
</tr>`
    )
    .join('');

  const body = `<div class="wrap">${flash(msg)}
<form class="panel" method="post" action="/admin/productos" enctype="multipart/form-data">
  <h1>Subir producto</h1>
  <label class="drop">
    <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required data-compress>
    <span>📷 Toca para tomar o elegir la foto</span>
    <img class="preview" alt="">
  </label>
  ${productFields()}
  <button class="btn dark">Publicar</button>
</form>

<section class="panel">
  <h2>Productos (${list.length})</h2>
  ${list.length ? `<table class="list">${rows}</table>` : '<p>Aún no has subido productos.</p>'}
</section>

<section class="panel">
  <h2>Conexión con TikTok</h2>
  <p>Tu catálogo se publica automáticamente en esta URL:</p>
  <p><code>${esc(feedUrl)}</code></p>
  <ol>
    <li>En <b>TikTok Ads Manager</b> o <b>TikTok Shop Seller Center</b> abre <b>Catálogos</b>.</li>
    <li>Agregar productos &rarr; <b>Fuente de datos</b> &rarr; <b>Programado (URL)</b>.</li>
    <li>Pega la URL de arriba y elige actualización diaria o cada hora.</li>
  </ol>
  <p>Pixel de TikTok: ${cfg.tiktokPixelId ? `<b>activo</b> (${esc(cfg.tiktokPixelId)})` : 'no configurado (agrega <code>TIKTOK_PIXEL_ID</code>)'}</p>
</section></div>`;
  return layout({ title: 'Productos', body, admin: { active: 'productos', counts } });
}

function editProduct(p, counts, msg) {
  const body = `<div class="wrap narrow-col">${flash(msg)}
<form class="panel" method="post" action="/admin/productos/${esc(p.id)}/editar" enctype="multipart/form-data">
  <h1>Editar producto</h1>
  <label class="drop">
    <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" data-compress>
    <span>📷 Toca para cambiar la foto (opcional)</span>
    <img class="preview" src="${esc(p.image)}" alt="" style="display:block">
  </label>
  ${productFields(p)}
  <button class="btn dark">Guardar cambios</button> <a href="/admin">Cancelar</a>
</form></div>`;
  return layout({ title: 'Editar producto', body, admin: { active: 'productos', counts } });
}

function banners(list, counts, msg) {
  const slot = (b, i) => `<fieldset>
  <legend>Imagen ${i + 1}</legend>
  <label class="drop small">
    <input type="file" name="banner_${i}_image" accept="image/jpeg,image/png,image/webp" data-compress="2000">
    <span>${b.image ? 'Imagen cargada ✓ (toca para cambiarla)' : 'Sube una imagen horizontal (opcional)'}</span>
    <img class="preview" alt=""${b.image ? ` src="${esc(b.image)}" style="display:block"` : ''}>
  </label>
  ${b.image ? `<label class="check"><input type="checkbox" name="banner_${i}_remove"> Quitar imagen</label>` : ''}
  <label>Título <input type="text" name="banner_${i}_title" value="${esc(b.title)}" maxlength="60" placeholder="Tu estilo, tu *poder*"></label>
  <label>Texto <input type="text" name="banner_${i}_subtitle" value="${esc(b.subtitle)}" maxlength="120" placeholder="Moda, bienestar y mucho más en un solo lugar."></label>
  <div class="row">
    <label>Botón <input type="text" name="banner_${i}_button" value="${esc(b.button)}" maxlength="30" placeholder="Comprar ahora"></label>
    <label>Lleva a <input type="text" name="banner_${i}_link" value="${esc(b.link)}" maxlength="300" placeholder="/ofertas · /productos?categoria=Ropa"></label>
  </div>
</fieldset>`;
  const body = `<div class="wrap narrow-col">${flash(msg)}
<form class="panel" method="post" action="/admin/portada" enctype="multipart/form-data">
  <h1>Portada</h1>
  <p class="hint">Hasta ${MAX_BANNERS} imágenes que pasan solas en el inicio. Pon entre *asteriscos* la palabra que quieres resaltar en dorado. Si dejas todo vacío se muestra la portada “Tu estilo, tu poder”.</p>
  ${Array.from({ length: MAX_BANNERS }, (_, i) => slot(list[i] || {}, i)).join('')}
  <button class="btn dark">Guardar portada</button>
</form></div>`;
  return layout({ title: 'Portada', body, admin: { active: 'portada', counts } });
}

function orders(list, counts, msg) {
  const rows = list
    .map((o) => {
      const c = o.customer;
      const wa = waLink(`51${c.phone}`, `Hola ${c.name}, te escribimos de ${cfg.storeName} por tu pedido ${o.code}.`);
      return `<details class="order"${o.status === 'por_verificar' ? ' open' : ''}>
  <summary>
    <b>${esc(o.code)}</b> · ${esc(c.name)} · ${money(o.total)}
    <span class="status s-${esc(o.status)}">${esc(ORDER_STATUS[o.status])}</span>
    <small>${date(o.createdAt)}</small>
  </summary>
  <div class="order-body">
    <ul class="lines">${o.items.map((i) => `<li><span>${i.qty} × ${esc(i.title)}</span><b>${money(i.price * i.qty)}</b></li>`).join('')}
      <li><span>${esc(o.shipping.label)}</span><b>${money(o.shippingCost)}</b></li></ul>
    <p><b>Pago:</b> ${esc(PAYMENT_LABELS[o.payment])}</p>
    <p><b>Cliente:</b> ${esc(c.name)} · <a href="${esc(wa)}" target="_blank" rel="noopener">${esc(c.phone)} (WhatsApp)</a>${c.dni ? ` · DNI ${esc(c.dni)}` : ''}</p>
    ${c.address ? `<p><b>Entrega:</b> ${esc(c.address)}, ${esc(c.district)}</p>` : ''}
    ${c.notes ? `<p><b>Notas:</b> ${nl2br(c.notes)}</p>` : ''}
    ${o.voucher ? `<p><b>Comprobante:</b><br><a href="/admin/archivo/${esc(o.voucher)}" target="_blank"><img class="voucher-img" src="/admin/archivo/${esc(o.voucher)}" alt="Comprobante"></a></p>` : '<p class="muted">Sin comprobante todavía.</p>'}
    ${o.status === 'entregado' ? `<p><a class="btn small gold" href="${esc(waLink(`51${c.phone}`, `Hola ${c.name.split(' ')[0]}, ¡gracias por tu compra en ${cfg.storeName}! 💛 ¿Nos cuentas qué te pareció? Deja tu reseña aquí: ${cfg.baseUrl}/pedido/${o.id}#resenas`))}" target="_blank" rel="noopener">⭐ Pedir reseña por WhatsApp</a></p>` : ''}
    ${statusSelect(`/admin/pedidos/${esc(o.id)}/estado`, ORDER_STATUS, o.status)}
  </div>
</details>`;
    })
    .join('');
  const body = `<div class="wrap">${flash(msg)}<section class="panel"><h1>Pedidos (${list.length})</h1>
<p class="hint">Revisa el comprobante, confírmalo en tu app de Yape/Plin o banco, y cambia el estado a <b>Pago confirmado</b>.</p>
${rows || '<p>Aún no hay pedidos.</p>'}</section></div>`;
  return layout({ title: 'Pedidos', body, admin: { active: 'pedidos', counts } });
}

function customRequests(list, counts, msg) {
  const rows = list
    .map((r) => {
      const wa = waLink(`51${r.phone}`, `Hola ${r.name}, te escribimos de ${cfg.storeName} por tu pedido personalizado.`);
      return `<details class="order"${r.status === 'nuevo' ? ' open' : ''}>
  <summary><b>${esc(r.category)}</b> · ${esc(r.name)} <span class="status s-${esc(r.status)}">${esc(CUSTOM_STATUS[r.status])}</span> <small>${date(r.createdAt)}</small></summary>
  <div class="order-body">
    <p>${nl2br(r.description)}</p>
    ${r.budget ? `<p><b>Presupuesto:</b> ${money(r.budget)}</p>` : ''}
    ${r.dueDate ? `<p><b>Para:</b> ${esc(r.dueDate)}</p>` : ''}
    <p><b>Contacto:</b> <a href="${esc(wa)}" target="_blank" rel="noopener">${esc(r.phone)} (WhatsApp)</a></p>
    ${r.photo ? `<p><a href="/admin/archivo/${esc(r.photo)}" target="_blank"><img class="voucher-img" src="/admin/archivo/${esc(r.photo)}" alt="Referencia"></a></p>` : ''}
    ${statusSelect(`/admin/personalizados/${esc(r.id)}/estado`, CUSTOM_STATUS, r.status)}
  </div>
</details>`;
    })
    .join('');
  const body = `<div class="wrap">${flash(msg)}<section class="panel"><h1>Pedidos personalizados (${list.length})</h1>
<p class="hint">Los clientes los envían desde <a href="/personalizados">/personalizados</a>. Responde con la cotización por WhatsApp.</p>
${rows || '<p>Aún no hay solicitudes.</p>'}</section></div>`;
  return layout({ title: 'Personalizados', body, admin: { active: 'personalizados', counts } });
}

function reviews(list, counts, msg) {
  const rows = list
    .map(
      (r) => `<article class="review admin-review${r.status === 'oculta' ? ' hidden-review' : ''}">
  <header>${stars(r.rating)} <b>${esc(r.name)}</b> · <a href="/producto/${esc(r.productId)}">${esc(r.productTitle)}</a> <small>${date(r.createdAt)}</small>${r.status === 'oculta' ? ' <span class="tag">Oculta</span>' : ''}</header>
  ${r.comment ? `<p>${nl2br(r.comment)}</p>` : ''}
  ${r.photo ? `<img class="review-photo" src="${esc(r.photo)}" alt="">` : ''}
  <footer>
    <form method="post" action="/admin/resenas/${esc(r.id)}/estado" class="inline"><input type="hidden" name="status" value="${r.status === 'oculta' ? 'publicada' : 'oculta'}"><button class="link">${r.status === 'oculta' ? 'Mostrar' : 'Ocultar'}</button></form>
    <form method="post" action="/admin/resenas/${esc(r.id)}/borrar" class="inline" onsubmit="return confirm('¿Borrar esta reseña?')"><button class="link danger">Borrar</button></form>
  </footer>
</article>`
    )
    .join('');
  const body = `<div class="wrap narrow-col">${flash(msg)}<section class="panel"><h1>Reseñas (${list.length})</h1>
<p class="hint">Solo pueden opinar clientes cuyo pedido marcaste como <b>Entregado</b>. Se publican al instante; puedes ocultar o borrar las que no correspondan. Para pedirlas, usa el botón “Pedir reseña por WhatsApp” en el pedido.</p>
${rows || '<p>Aún no hay reseñas.</p>'}</section></div>`;
  return layout({ title: 'Reseñas', body, admin: { active: 'resenas', counts } });
}

function payments(s, counts, msg) {
  const wallet = (key, label, hint) => `<fieldset>
  <legend>${label}</legend>
  <p class="hint">${hint}</p>
  <div class="row">
    <label>Número de celular <input type="tel" name="${key}_number" value="${esc(s[key].number)}" placeholder="987654321" inputmode="tel"></label>
    <label>Nombre del titular <input type="text" name="${key}_name" value="${esc(s[key].name)}" maxlength="80"></label>
  </div>
  <label class="drop small">
    <input type="file" name="${key}_qr" accept="image/jpeg,image/png,image/webp">
    <span>${s[key].qr ? 'QR cargado ✓ (toca para cambiarlo)' : 'Sube tu código QR (opcional)'}</span>
  </label>
  ${s[key].qr ? `<img class="qr" src="${esc(s[key].qr)}" alt=""><label class="check"><input type="checkbox" name="${key}_qr_remove"> Quitar QR</label>` : ''}
</fieldset>`;
  const banks = Array.from({ length: MAX_BANKS }, (_, i) => s.banks[i] || {})
    .map(
      (b, i) => `<div class="bank">
  <div class="row">
    <label>Banco <input type="text" name="bank_${i}_bank" value="${esc(b.bank)}" list="bancos" placeholder="BCP, Interbank, BBVA..."></label>
    <label>Titular <input type="text" name="bank_${i}_holder" value="${esc(b.holder)}"></label>
  </div>
  <div class="row">
    <label>N.º de cuenta <input type="text" name="bank_${i}_account" value="${esc(b.account)}" inputmode="numeric"></label>
    <label>CCI (20 dígitos) <input type="text" name="bank_${i}_cci" value="${esc(b.cci)}" inputmode="numeric"></label>
  </div>
</div>`
    )
    .join('');
  const sh = s.shipping;
  const body = `<div class="wrap narrow-col">${flash(msg)}
<form class="panel" method="post" action="/admin/pagos" enctype="multipart/form-data">
  <h1>Pagos y envíos</h1>
  <p class="hint">Solo los métodos que llenes aparecerán al cliente al pagar.</p>
  ${wallet('yape', 'Yape', 'Yape y Plin son interoperables: también puedes recibir pagos de Plin en tu número de Yape.')}
  ${wallet('plin', 'Plin', 'Para clientes de BBVA, Interbank, Scotiabank y otras apps con Plin.')}
  <fieldset>
    <legend>Transferencias bancarias</legend>
    <p class="hint">Agrega hasta ${MAX_BANKS} cuentas. El CCI permite que te transfieran desde cualquier banco.</p>
    ${banks}
    <datalist id="bancos"><option>BCP</option><option>Interbank</option><option>BBVA</option><option>Scotiabank</option><option>BanBif</option><option>Banco de la Nación</option><option>Caja Arequipa</option><option>Caja Huancayo</option></datalist>
  </fieldset>
  <fieldset>
    <legend>Tarjeta de crédito/débito</legend>
    <p class="hint">Pega tu enlace de pago de Mercado Pago, Izipay, Culqi o Niubiz. El cliente lo abrirá y pagará el total de su pedido.</p>
    <label>Enlace de pago <input type="url" name="card_link" value="${esc(s.cardLink)}" placeholder="https://..."></label>
  </fieldset>
  <fieldset>
    <legend>Envíos</legend>
    <div class="row">
      <label>Delivery Lima (S/) <input type="number" name="ship_lima" min="0" step="0.5" value="${esc(sh.lima)}"></label>
      <label>Envío a provincia (S/) <input type="number" name="ship_provincia" min="0" step="0.5" value="${esc(sh.provincia)}"></label>
    </div>
    <label>Envío gratis desde (S/, 0 = no) <input type="number" name="ship_free_from" min="0" step="1" value="${esc(sh.freeFrom || 0)}"></label>
    <label>Nota para el cliente (opcional) <textarea name="ship_note" rows="2" maxlength="300" placeholder="Ej: Entregas en Lima de lunes a sábado. Provincia por Shalom, 2 a 4 días.">${esc(sh.note)}</textarea></label>
    <label class="check"><input type="checkbox" name="ship_pickup"${sh.pickup ? ' checked' : ''}> Ofrecer recojo en tienda (gratis)</label>
    <label>Dirección / indicaciones de recojo <input type="text" name="ship_pickup_note" value="${esc(sh.pickupNote)}" maxlength="200"></label>
  </fieldset>
  <button class="btn dark">Guardar</button>
</form></div>`;
  return layout({ title: 'Pagos y envíos', body, admin: { active: 'pagos', counts } });
}

module.exports = { login, products, editProduct, banners, reviews, orders, customRequests, payments, MAX_BANKS, MAX_BANNERS };
