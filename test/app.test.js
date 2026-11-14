const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ADMIN_PASSWORD = 'secreto';
process.env.BASE_URL = 'https://tienda.example';
delete process.env.CURRENCY;
const { createApp } = require('../server');
const { openDb } = require('../lib/store');
const { buildCsv } = require('../lib/tiktok-feed');
const { normalizePhone } = require('../lib/peru');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const png = () => new Blob([PNG], { type: 'image/png' });
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tienda-'));
  const db = openDb(dir);
  const server = createApp(db).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, db); } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

async function login(base) {
  const r = await fetch(`${base}/admin/entrar`, { method: 'POST', redirect: 'manual', headers: FORM, body: 'password=secreto' });
  assert.strictEqual(r.status, 302);
  return r.headers.get('set-cookie').split(';')[0];
}

async function addProduct(base, cookie, { description = 'Cartera miel', price = '100', category = 'Bolsos', extra = {} } = {}) {
  const f = new FormData();
  f.append('photo', png(), 'x.png');
  f.append('description', description);
  f.append('price', price);
  f.append('category', category);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return fetch(`${base}/admin/productos`, { method: 'POST', body: f, headers: { cookie }, redirect: 'manual' });
}

async function configurePayments(base, cookie, extra = {}) {
  const f = new FormData();
  const fields = { yape_number: '987 654 321', yape_name: 'Stef', ship_lima: '10', ship_provincia: '15', ...extra };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return fetch(`${base}/admin/pagos`, { method: 'POST', body: f, headers: { cookie }, redirect: 'manual' });
}

const checkout = (base, fields) =>
  fetch(`${base}/checkout`, { method: 'POST', redirect: 'manual', headers: FORM, body: new URLSearchParams(fields).toString() });

test('celulares peruanos', () => {
  assert.strictEqual(normalizePhone('+51 987 654 321'), '987654321');
  assert.strictEqual(normalizePhone('987654321'), '987654321');
  assert.strictEqual(normalizePhone('012345678'), null);
  assert.strictEqual(normalizePhone('98765'), null);
});

test('el panel está protegido', () => withServer(async (base) => {
  const bad = await fetch(`${base}/admin/entrar`, { method: 'POST', headers: FORM, body: 'password=no' });
  assert.strictEqual(bad.status, 401);
  for (const p of ['/admin', '/admin/pedidos', '/admin/pagos', '/admin/personalizados', '/admin/archivo/abc.png']) {
    assert.strictEqual((await fetch(base + p, { redirect: 'manual' })).status, 302, p);
  }
  assert.strictEqual((await fetch(`${base}/admin/productos`, { method: 'POST', redirect: 'manual' })).status, 302);
}));

test('subir producto lo publica con categoría, en soles y en el feed de TikTok', () => withServer(async (base, db) => {
  const cookie = await login(base);
  assert.strictEqual((await addProduct(base, cookie, { description: 'Bolso "miel", de piel\nHecho a mano <b>', price: '450' })).status, 303);
  const [p] = db.products.all();
  assert.strictEqual(p.title, 'Bolso "miel", de piel');
  assert.strictEqual(p.category, 'Bolsos');

  const page = await (await fetch(`${base}/producto/${p.id}`)).text();
  assert.match(page, /Hecho a mano &lt;b&gt;/);
  assert.match(page, /S\/\s?450\.00/);
  assert.match(await (await fetch(`${base}/productos?categoria=Bolsos`)).text(), /Bolso &quot;miel/);
  assert.doesNotMatch(await (await fetch(`${base}/productos?categoria=Ropa`)).text(), /Bolso &quot;miel/);

  const csv = await (await fetch(`${base}/feeds/tiktok.csv`)).text();
  assert.ok(csv.includes('"Bolso ""miel"", de piel"'));
  assert.ok(csv.includes('450.00 PEN'));
  assert.ok(csv.includes(`https://tienda.example${p.image}`));

  assert.strictEqual((await addProduct(base, cookie, { category: 'Inventada' })).status, 400);
}));

test('compra completa: carrito, precios del servidor, Yape y comprobante privado', () => withServer(async (base, db) => {
  const cookie = await login(base);
  await addProduct(base, cookie, { description: 'Vitamina C', price: '35.50', category: 'Vitaminas' });
  const [p] = db.products.all();

  // Sin métodos de pago configurados no se puede comprar
  assert.strictEqual((await checkout(base, { items: '[]' })).status, 400);
  assert.strictEqual((await configurePayments(base, cookie)).status, 303);
  assert.strictEqual(db.settings.get().yape.number, '987654321');

  const cart = await (await fetch(`${base}/carrito`)).text();
  assert.match(cart, /value="yape"/);
  assert.doesNotMatch(cart, /value="plin"/);

  const base_fields = { name: 'Ana Pérez', phone: '987111222', shipping: 'lima', address: 'Av. Larco 123', district: 'Miraflores', payment: 'yape',
    items: JSON.stringify([{ id: p.id, qty: 2, price: 0.01 }]) };
  // Provincia exige DNI
  assert.strictEqual((await checkout(base, { ...base_fields, shipping: 'provincia' })).status, 400);
  // Método de pago no configurado
  assert.strictEqual((await checkout(base, { ...base_fields, payment: 'plin' })).status, 400);

  const r = await checkout(base, base_fields);
  assert.strictEqual(r.status, 303);
  const [o] = db.orders.all();
  assert.strictEqual(o.code, 'P-1001');
  assert.strictEqual(o.subtotal, 71);  // el precio enviado por el navegador se ignora
  assert.strictEqual(o.total, 81);     // + delivery Lima S/ 10

  const orderPage = await (await fetch(base + r.headers.get('location'))).text();
  assert.match(orderPage, /987654321/);
  assert.match(orderPage, /S\/\s?81\.00/);

  const f = new FormData();
  f.append('voucher', png(), 'pago.png');
  const up = await fetch(`${base}/pedido/${o.id}/comprobante`, { method: 'POST', body: f, redirect: 'manual' });
  assert.strictEqual(up.status, 303);
  const updated = db.orders.get(o.id);
  assert.strictEqual(updated.status, 'por_verificar');
  // El comprobante no es público, solo lo ve el admin
  assert.strictEqual((await fetch(`${base}/uploads/${updated.voucher}`)).status, 404);
  assert.strictEqual((await fetch(`${base}/admin/archivo/${updated.voucher}`, { headers: { cookie } })).status, 200);
  assert.match(await (await fetch(`${base}/admin/pedidos`, { headers: { cookie } })).text(), /P-1001/);

  await fetch(`${base}/admin/pedidos/${o.id}/estado`, { method: 'POST', headers: { ...FORM, cookie }, body: 'status=pagado', redirect: 'manual' });
  assert.strictEqual(db.orders.get(o.id).status, 'pagado');
}));

test('no se puede comprar un producto agotado', () => withServer(async (base, db) => {
  const cookie = await login(base);
  await addProduct(base, cookie);
  await configurePayments(base, cookie);
  const [p] = db.products.all();
  await fetch(`${base}/admin/productos/${p.id}/stock`, { method: 'POST', headers: { cookie }, redirect: 'manual' });
  const r = await checkout(base, { name: 'A', phone: '987111222', shipping: 'lima', address: 'x', district: 'y', payment: 'yape', items: JSON.stringify([{ id: p.id, qty: 1 }]) });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(db.orders.items.length, 0);
}));

test('pagos: valida CCI y guarda bancos y enlace de tarjeta', () => withServer(async (base, db) => {
  const cookie = await login(base);
  assert.strictEqual((await configurePayments(base, cookie, { bank_0_bank: 'BCP', bank_0_cci: '123' })).status, 400);
  assert.strictEqual((await configurePayments(base, cookie, { card_link: 'http://inseguro' })).status, 400);
  const ok = await configurePayments(base, cookie, {
    bank_0_bank: 'BCP', bank_0_holder: 'Stef', bank_0_account: '191-1234567-0-12', bank_0_cci: '00219100123456701256',
    card_link: 'https://link.mercadopago.com.pe/mitienda',
  });
  assert.strictEqual(ok.status, 303);
  const s = db.settings.get();
  assert.strictEqual(s.banks.length, 1);
  assert.strictEqual(s.cardLink, 'https://link.mercadopago.com.pe/mitienda');
  const cart = await (await fetch(`${base}/carrito`)).text();
  assert.match(cart, /value="transferencia"/);
  assert.match(cart, /value="tarjeta"/);
}));

test('pedidos personalizados', () => withServer(async (base, db) => {
  const f = new FormData();
  f.append('name', 'Luis');
  f.append('phone', '+51 999 888 777');
  f.append('category', 'Ropa');
  f.append('description', 'Polo con mi logo, talla M, 10 unidades');
  f.append('budget', '300');
  f.append('photo', png(), 'ref.png');
  const r = await fetch(`${base}/personalizados`, { method: 'POST', body: f });
  assert.strictEqual(r.status, 200);
  const [req] = db.customRequests.all();
  assert.strictEqual(req.phone, '999888777');
  assert.strictEqual(req.status, 'nuevo');
  assert.ok(req.photo);
  assert.strictEqual((await fetch(`${base}/uploads/${req.photo}`)).status, 404);

  const bad = new FormData();
  bad.append('name', 'X'); bad.append('phone', '123'); bad.append('description', 'algo');
  assert.strictEqual((await fetch(`${base}/personalizados`, { method: 'POST', body: bad })).status, 400);
}));

test('descuentos: precio antes, ofertas, feed y edición', () => withServer(async (base, db) => {
  const cookie = await login(base);
  assert.strictEqual((await addProduct(base, cookie, { price: '100', extra: { compareAtPrice: '90' } })).status, 400);
  await addProduct(base, cookie, { description: 'Hoodie Oversize', price: '69.90', category: 'Ropa', extra: { compareAtPrice: '99.90', featured: 'on' } });
  await addProduct(base, cookie, { description: 'Vitamina D3', price: '39.90', category: 'Vitaminas' });
  const hoodie = db.products.all().find((p) => p.title === 'Hoodie Oversize');
  assert.strictEqual(hoodie.featured, true);

  const home = await (await fetch(`${base}/`)).text();
  assert.match(home, /-30%/);
  assert.match(home, /Hasta<\/span><strong class="pct">30%/);
  const offers = await (await fetch(`${base}/ofertas`)).text();
  assert.match(offers, /Hoodie Oversize/);
  assert.doesNotMatch(offers, /Vitamina D3/);

  const csv = await (await fetch(`${base}/feeds/tiktok.csv`)).text();
  assert.match(csv, /,99\.90 PEN,69\.90 PEN,/);
  assert.match(csv, /,Ropa\n/);

  const f = new FormData();
  f.append('description', 'Hoodie Oversize negro'); f.append('price', '59.90'); f.append('compareAtPrice', '');
  f.append('category', 'Ropa'); f.append('title', 'Hoodie negro');
  const r = await fetch(`${base}/admin/productos/${hoodie.id}/editar`, { method: 'POST', body: f, headers: { cookie }, redirect: 'manual' });
  assert.strictEqual(r.status, 303);
  const edited = db.products.get(hoodie.id);
  assert.strictEqual(edited.title, 'Hoodie negro');
  assert.strictEqual(edited.compareAtPrice, 0);
  assert.strictEqual(edited.featured, false);
  assert.strictEqual(edited.image, hoodie.image);
}));

test('envío gratis desde cierto monto', () => withServer(async (base, db) => {
  const cookie = await login(base);
  await addProduct(base, cookie, { price: '60' });
  await configurePayments(base, cookie, { ship_free_from: '99' });
  const [p] = db.products.all();
  const fields = { name: 'Ana', phone: '987111222', shipping: 'lima', address: 'x', district: 'y', payment: 'yape' };
  await checkout(base, { ...fields, items: JSON.stringify([{ id: p.id, qty: 1 }]) });
  await checkout(base, { ...fields, items: JSON.stringify([{ id: p.id, qty: 2 }]) });
  const [second, first] = db.orders.all().sort((a, b) => b.code.localeCompare(a.code));
  assert.strictEqual(first.total, 70);
  assert.strictEqual(second.shippingCost, 0);
  assert.strictEqual(second.total, 120);
  assert.match(await (await fetch(`${base}/`)).text(), /Envío gratis/);
}));

test('buscar, favoritos, mis pedidos y páginas del menú', () => withServer(async (base, db) => {
  const cookie = await login(base);
  await addProduct(base, cookie, { description: 'Collar dorado con corazón', price: '45', category: 'Joyas' });
  await configurePayments(base, cookie);
  const [p] = db.products.all();
  assert.match(await (await fetch(`${base}/buscar?q=CORAZON`)).text(), /Collar dorado/);
  assert.doesNotMatch(await (await fetch(`${base}/buscar?q=hoodie`)).text(), /Collar dorado/);
  assert.match(await (await fetch(`${base}/favoritos?ids=${p.id}`)).text(), /Collar dorado/);
  for (const path of ['/categorias', '/ofertas', '/soporte', '/favoritos', '/mis-pedidos', '/productos']) {
    assert.strictEqual((await fetch(base + path)).status, 200, path);
  }
  await checkout(base, { name: 'Ana', phone: '987111222', shipping: 'lima', address: 'x', district: 'y', payment: 'yape', items: JSON.stringify([{ id: p.id, qty: 1 }]) });
  const [o] = db.orders.all();
  const look = (code, phone) => fetch(`${base}/mis-pedidos`, { method: 'POST', headers: FORM, redirect: 'manual', body: new URLSearchParams({ code, phone }).toString() });
  const ok = await look('p-1001', '+51 987 111 222');
  assert.strictEqual(ok.status, 303);
  assert.strictEqual(ok.headers.get('location'), `/pedido/${o.id}`);
  assert.strictEqual((await look('1001', '987111222')).status, 303);
  assert.strictEqual((await look('P-1001', '999999999')).status, 404);
}));

test('portada: imágenes del carrusel', () => withServer(async (base, db) => {
  const cookie = await login(base);
  assert.match(await (await fetch(`${base}/`)).text(), /Tu estilo, tu <em>poder<\/em>/);
  const f = new FormData();
  f.append('banner_0_image', png(), 'b.png');
  f.append('banner_0_title', 'Nueva *colección*');
  f.append('banner_0_link', '/ofertas');
  f.append('banner_1_title', 'Vitaminas');
  f.append('banner_1_link', 'javascript:alert(1)');
  assert.strictEqual((await fetch(`${base}/admin/portada`, { method: 'POST', body: f, headers: { cookie }, redirect: 'manual' })).status, 400);
  f.set('banner_1_link', '/productos?categoria=Vitaminas');
  assert.strictEqual((await fetch(`${base}/admin/portada`, { method: 'POST', body: f, headers: { cookie }, redirect: 'manual' })).status, 303);
  const { banners } = db.settings.get();
  assert.strictEqual(banners.length, 2);
  assert.ok(banners[0].image.startsWith('/uploads/'));
  const home = await (await fetch(`${base}/`)).text();
  assert.match(home, /Nueva <em>colección<\/em>/);
  assert.match(home, /class="dots"/);
}));

test('feed marca productos agotados', () => {
  const csv = buildCsv([{ id: 'a', title: 't', description: 'd', price: 5, image: '/uploads/a.png', inStock: false }],
    { currency: 'PEN', baseUrl: 'https://x', brand: 'B' });
  assert.ok(csv.includes('out of stock'));
  assert.ok(csv.includes('5.00 PEN'));
});
