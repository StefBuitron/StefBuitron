const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ADMIN_PASSWORD = 'secreto';
process.env.BASE_URL = 'https://tienda.example';
process.env.CURRENCY = 'MXN';
const { createApp } = require('../server');
const { ProductStore } = require('../lib/store');
const { buildCsv } = require('../lib/tiktok-feed');

// PNG de 1x1
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tienda-'));
  const store = new ProductStore(dir);
  const server = createApp(store).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, store); } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

async function login(base) {
  const r = await fetch(`${base}/admin/entrar`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'password=secreto',
  });
  assert.strictEqual(r.status, 302);
  return r.headers.get('set-cookie').split(';')[0];
}

test('rechaza contraseña incorrecta y protege el panel', () => withServer(async (base) => {
  const bad = await fetch(`${base}/admin/entrar`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=no' });
  assert.strictEqual(bad.status, 401);
  const r = await fetch(`${base}/admin`, { redirect: 'manual' });
  assert.strictEqual(r.status, 302);
  const up = await fetch(`${base}/admin/productos`, { method: 'POST', redirect: 'manual' });
  assert.strictEqual(up.status, 302);
}));

test('subir foto + descripción publica en tienda y en el feed de TikTok', () => withServer(async (base, store) => {
  const cookie = await login(base);
  const form = new FormData();
  form.append('photo', new Blob([PNG], { type: 'image/png' }), 'x.png');
  form.append('description', 'Bolso "miel", de piel\nHecho a mano <b>');
  form.append('price', '450');
  const r = await fetch(`${base}/admin/productos`, { method: 'POST', body: form, headers: { cookie }, redirect: 'manual' });
  assert.strictEqual(r.status, 302);

  const [p] = store.all();
  assert.strictEqual(p.title, 'Bolso "miel", de piel');

  const page = await (await fetch(`${base}/producto/${p.id}`)).text();
  assert.match(page, /Hecho a mano &lt;b&gt;/);
  const img = await fetch(`${base}${p.image}`);
  assert.strictEqual(img.status, 200);

  const csv = await (await fetch(`${base}/feeds/tiktok.csv`)).text();
  assert.match(csv, /^sku_id,title,description,availability,condition,price,link,image_link,brand\n/);
  assert.ok(csv.includes('"Bolso ""miel"", de piel"'));
  assert.ok(csv.includes('450.00 MXN'));
  assert.ok(csv.includes(`https://tienda.example/producto/${p.id}`));
  assert.ok(csv.includes(`https://tienda.example${p.image}`));
}));

test('rechaza archivos que no son imagen', () => withServer(async (base, store) => {
  const cookie = await login(base);
  const form = new FormData();
  form.append('photo', new Blob(['hola'], { type: 'text/plain' }), 'x.txt');
  form.append('description', 'x');
  form.append('price', '1');
  const r = await fetch(`${base}/admin/productos`, { method: 'POST', body: form, headers: { cookie } });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(store.all().length, 0);
}));

test('feed marca productos agotados', () => {
  const csv = buildCsv([{ id: 'a', title: 't', description: 'd', price: 5, image: '/uploads/a.png', inStock: false }],
    { currency: 'USD', baseUrl: 'https://x', brand: 'B' });
  assert.ok(csv.includes('out of stock'));
});
