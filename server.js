const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const cfg = require('./lib/config');
const shop = require('./lib/views/shop');
const adminViews = require('./lib/views/admin');
const { openDb, deriveTitle } = require('./lib/store');
const { buildCsv } = require('./lib/tiktok-feed');
const { parseTiktokLinks } = require('./lib/media');
const { ORDER_STATUS, CUSTOM_STATUS, normalizePhone, buildOrder, str } = require('./lib/peru');

// ---------- Subida de imágenes ----------
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
function imageUpload(dir) {
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype]),
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: 4, fields: 60 },
    fileFilter: (req, file, cb) =>
      EXT[file.mimetype] ? cb(null, true) : cb(new Error('La imagen debe ser JPG, PNG o WebP.')),
  });
}
// Subida de producto: foto + video corto opcional.
const VIDEO_EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const MAX_PHOTO = 8 * 1024 * 1024;
function productMediaUpload(dir) {
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + (EXT[file.mimetype] || VIDEO_EXT[file.mimetype])),
    }),
    limits: { fileSize: 50 * 1024 * 1024, files: 2, fields: 60 },
    fileFilter: (req, file, cb) => {
      if (file.fieldname === 'photo') return EXT[file.mimetype] ? cb(null, true) : cb(new Error('La foto debe ser JPG, PNG o WebP.'));
      if (file.fieldname === 'video') return VIDEO_EXT[file.mimetype] ? cb(null, true) : cb(new Error('El video debe ser MP4, WebM o MOV.'));
      cb(new Error('Archivo no esperado.'));
    },
  });
}
const run = (mw, req, res) => new Promise((resolve) => mw(req, res, (err) => resolve(err)));
const uploadError = (err) =>
  err.code === 'LIMIT_FILE_SIZE' ? (err.field === 'video' ? 'El video pesa más de 50 MB.' : 'La imagen pesa más de 8 MB.') : err.message;
const rmFile = (dir, name) => name && fs.rm(path.join(dir, path.basename(name)), { force: true }, () => {});

function createApp(db = openDb(cfg.dataDir), { fetchImpl = fetch } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use((req, res, next) => {
    req.body = req.body || {};
    next();
  });
  app.use('/static', express.static(path.join(__dirname, 'public')));
  app.use('/uploads', express.static(db.uploadsDir, { maxAge: '7d' }));

  const publicUpload = imageUpload(db.uploadsDir);
  const privateUpload = imageUpload(db.privateDir);

  // ---------- Sesión de administrador (cookie firmada) ----------
  const COOKIE = 'tienda_admin';
  const sign = (exp) => crypto.createHmac('sha256', cfg.adminPassword).update(String(exp)).digest('hex');
  const isAdmin = (req) => {
    if (!cfg.adminPassword) return false;
    const raw = (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim().split('='))
      .find(([k]) => k === COOKIE);
    if (!raw) return false;
    const [exp, sig] = decodeURIComponent(raw[1] || '').split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    const good = sign(exp);
    return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
  };
  const requireAdmin = (req, res, next) => (isAdmin(req) ? next() : res.redirect('/admin/entrar'));
  const counts = () => ({
    orders: db.orders.items.filter((o) => o.status === 'por_verificar').length,
    custom: db.customRequests.items.filter((r) => r.status === 'nuevo').length,
  });

  // ---------- Catálogo con calificaciones ----------
  const publishedReviews = () => db.reviews.all().filter((r) => r.status === 'publicada');
  const catalog = () => {
    const stats = {};
    for (const r of publishedReviews()) {
      const s = (stats[r.productId] = stats[r.productId] || { sum: 0, count: 0 });
      s.sum += r.rating;
      s.count += 1;
    }
    return db.products.all().map((p) => {
      const s = stats[p.id];
      return s ? { ...p, rating: { avg: Math.round((s.sum / s.count) * 10) / 10, count: s.count } } : p;
    });
  };

  // ---------- Tienda pública ----------
  app.get('/', (req, res) => res.send(shop.home(catalog(), db.settings.get(), publishedReviews().slice(0, 8))));
  app.get('/videos', (req, res) => res.send(shop.videosPage(catalog())));

  app.get('/productos', (req, res) => {
    const cat = cfg.categories.includes(req.query.categoria) ? req.query.categoria : '';
    res.send(shop.productsPage(catalog(), cat));
  });
  app.get('/categorias', (req, res) => res.send(shop.categoriesPage(catalog())));
  app.get('/ofertas', (req, res) => res.send(shop.offersPage(catalog())));
  app.get('/buscar', (req, res) => res.send(shop.searchPage(catalog(), str(req.query.q, 80))));
  app.get('/soporte', (req, res) => res.send(shop.supportPage(db.settings.get())));

  // Favoritos y "Mis pedidos" se guardan en el celular del cliente y se
  // envían aquí como ?ids=a,b,c para mostrarlos.
  const idList = (q) => String(q || '').split(',').filter((x) => /^[a-f0-9]{12,32}$/.test(x)).slice(0, 100);
  app.get('/favoritos', (req, res) => {
    const ids = idList(req.query.ids);
    const all = catalog();
    res.send(shop.favoritesPage(ids.map((id) => all.find((p) => p.id === id)).filter(Boolean), ids.length > 0));
  });
  app.get('/mis-pedidos', (req, res) => {
    const orders = idList(req.query.ids).map((id) => db.orders.get(id)).filter(Boolean);
    res.send(shop.myOrdersPage(orders));
  });
  app.post('/mis-pedidos', (req, res) => {
    const code = str(req.body.code, 20).toUpperCase().replace(/^P?-?(\d+)$/, 'P-$1');
    const phone = normalizePhone(req.body.phone);
    const o = db.orders.items.find((x) => x.code === code && x.customer.phone === phone);
    if (!o) return res.status(404).send(shop.myOrdersPage([], 'No encontramos un pedido con ese código y celular.'));
    res.redirect(303, `/pedido/${o.id}`);
  });

  app.get('/producto/:id', (req, res) => {
    const all = catalog();
    const p = all.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).send(shop.notFound('Ese producto no existe.'));
    const related = all.filter((x) => x.id !== p.id && x.inStock && x.category === p.category).slice(0, 8);
    const reviews = publishedReviews().filter((r) => r.productId === p.id);
    res.send(shop.productPage(p, related, reviews));
  });

  app.get('/carrito', (req, res) => res.send(shop.cartPage(db.settings.get())));

  app.post('/checkout', (req, res) => {
    const settings = db.settings.get();
    const { order, error } = buildOrder(req.body, db.products, settings);
    if (error) return res.status(400).send(shop.cartPage(settings, error));
    const code = `P-${1001 + db.orders.items.length}`;
    const saved = db.orders.insert({ code, ...order });
    res.redirect(303, `/pedido/${saved.id}?nuevo=1`);
  });

  app.get('/pedido/:id', (req, res) => {
    const o = db.orders.get(req.params.id);
    if (!o) return res.status(404).send(shop.notFound('Ese pedido no existe.'));
    res.send(
      shop.orderPage(o, db.settings.get(), {
        isNew: req.query.nuevo === '1',
        uploaded: req.query.ok === '1',
        reviewed: req.query.gracias === '1',
        reviews: db.reviews.items.filter((r) => r.orderId === o.id),
      })
    );
  });

  app.post('/pedido/:id/comprobante', async (req, res) => {
    const o = db.orders.get(req.params.id);
    if (!o) return res.status(404).send(shop.notFound('Ese pedido no existe.'));
    const err = await run(privateUpload.single('voucher'), req, res);
    const fail = (msg) =>
      res.status(400).send(shop.orderPage(o, db.settings.get(), { error: msg, reviews: db.reviews.items.filter((r) => r.orderId === o.id) }));
    if (err) return fail(uploadError(err));
    if (!req.file) return fail('Elige la imagen de tu comprobante.');
    if (!['pendiente', 'por_verificar'].includes(o.status)) {
      rmFile(db.privateDir, req.file.filename);
      return fail('Este pedido ya no acepta comprobantes.');
    }
    rmFile(db.privateDir, o.voucher);
    db.orders.update(o.id, { voucher: req.file.filename, status: 'por_verificar' });
    res.redirect(303, `/pedido/${o.id}?ok=1`);
  });

  // Reseñas: solo quien recibió su pedido puede calificar sus productos.
  app.post('/pedido/:id/resena', async (req, res) => {
    const o = db.orders.get(req.params.id);
    if (!o) return res.status(404).send(shop.notFound('Ese pedido no existe.'));
    const err = await run(publicUpload.single('photo'), req, res);
    const own = () => db.reviews.items.filter((r) => r.orderId === o.id);
    const fail = (msg) => {
      if (req.file) rmFile(db.uploadsDir, req.file.filename);
      res.status(400).send(shop.orderPage(o, db.settings.get(), { error: msg, reviews: own() }));
    };
    if (err) return fail(uploadError(err));
    if (o.status !== 'entregado') return fail('Podrás dejar tu reseña cuando recibas tu pedido.');
    const item = o.items.find((i) => i.productId === req.body.productId);
    if (!item) return fail('Ese producto no está en tu pedido.');
    if (own().some((r) => r.productId === item.productId)) return fail('Ya dejaste una reseña para este producto. ¡Gracias!');
    const rating = Math.trunc(Number(req.body.rating));
    if (!(rating >= 1 && rating <= 5)) return fail('Elige de 1 a 5 estrellas.');
    const [first = '', last = ''] = o.customer.name.split(/\s+/);
    db.reviews.insert({
      productId: item.productId,
      productTitle: item.title,
      orderId: o.id,
      name: `${first}${last ? ` ${last[0]}.` : ''}`,
      rating,
      comment: str(req.body.comment, 1000),
      photo: req.file ? `/uploads/${req.file.filename}` : '',
      status: 'publicada',
    });
    res.redirect(303, `/pedido/${o.id}?gracias=1#resenas`);
  });

  app.get('/personalizados', (req, res) => res.send(shop.customForm()));

  app.post('/personalizados', async (req, res) => {
    const err = await run(privateUpload.single('photo'), req, res);
    const body = req.body || {};
    const fail = (msg) => {
      if (req.file) rmFile(db.privateDir, req.file.filename);
      res.status(400).send(shop.customForm({ error: msg, values: body }));
    };
    if (err) return fail(uploadError(err));
    const name = str(body.name, 120);
    const phone = normalizePhone(body.phone);
    const description = str(body.description, 2000);
    const category = cfg.categories.concat('Otro').includes(body.category) ? body.category : 'Otro';
    const budget = Number(body.budget);
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate || '') ? body.dueDate : '';
    if (!name) return fail('Escribe tu nombre.');
    if (!phone) return fail('Escribe un celular válido (9 dígitos, empieza con 9).');
    if (!description) return fail('Cuéntanos qué te gustaría.');
    const saved = db.customRequests.insert({
      name,
      phone,
      category,
      description,
      budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget) : 0,
      dueDate,
      photo: req.file ? req.file.filename : '',
      status: 'nuevo',
    });
    res.send(shop.customThanks(saved));
  });

  // Catálogo que TikTok descarga de forma programada.
  app.get('/feeds/tiktok.csv', (req, res) => {
    res.type('text/csv; charset=utf-8').send(buildCsv(db.products.all(), cfg));
  });

  // ---------- Panel ----------
  app.get('/admin/entrar', (req, res) => {
    if (isAdmin(req)) return res.redirect('/admin');
    res.send(adminViews.login(cfg.adminPassword ? '' : 'Falta configurar ADMIN_PASSWORD en el archivo .env'));
  });

  app.post('/admin/entrar', (req, res) => {
    const given = Buffer.from(String(req.body.password || ''));
    const real = Buffer.from(cfg.adminPassword);
    const ok = cfg.adminPassword && given.length === real.length && crypto.timingSafeEqual(given, real);
    if (!ok) return res.status(401).send(adminViews.login('Contraseña incorrecta.'));
    const exp = Date.now() + 30 * 24 * 3600 * 1000;
    const secure = cfg.baseUrl.startsWith('https://') ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${encodeURIComponent(`${exp}.${sign(exp)}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${secure}`
    );
    res.redirect('/admin');
  });

  app.post('/admin/salir', (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.redirect('/');
  });

  app.use('/admin', (req, res, next) => (req.path === '/entrar' ? next() : requireAdmin(req, res, next)));

  app.get('/admin', (req, res) => {
    res.send(adminViews.products(db.products.all(), counts(), { ok: req.query.ok ? 'Producto publicado.' : '' }));
  });

  // Valida los campos del formulario de producto (crear y editar).
  const productInput = async (b) => {
    const description = str(b.description, 10000);
    const price = Number(b.price);
    const before = b.compareAtPrice === '' || b.compareAtPrice == null ? 0 : Number(b.compareAtPrice);
    if (!description) return { error: 'Falta la descripción.' };
    if (!Number.isFinite(price) || price < 0) return { error: 'El precio no es válido.' };
    if (!Number.isFinite(before) || before < 0) return { error: 'El precio antes no es válido.' };
    if (before && before <= price) return { error: 'El “precio antes” debe ser mayor que el precio actual.' };
    if (!cfg.categories.includes(b.category)) return { error: 'Elige una categoría.' };
    const tiktok = await parseTiktokLinks(b.tiktok, fetchImpl);
    if (tiktok.error) return { error: tiktok.error };
    return {
      value: {
        title: str(b.title, 255) || deriveTitle(description),
        description,
        price: Math.round(price * 100) / 100,
        compareAtPrice: Math.round(before * 100) / 100,
        category: b.category,
        featured: Boolean(b.featured),
        tiktok: tiktok.ids,
      },
    };
  };

  // Foto (hasta 8 MB) y video opcional (hasta 50 MB) del producto.
  const productUpload = productMediaUpload(db.uploadsDir).fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]);
  const productFiles = (req) => {
    const f = req.files || {};
    return { photo: f.photo && f.photo[0], video: f.video && f.video[0] };
  };
  const dropFiles = (files) => Object.values(files).forEach((f) => f && rmFile(db.uploadsDir, f.filename));

  app.post('/admin/productos', async (req, res) => {
    const err = await run(productUpload, req, res);
    const files = productFiles(req);
    const fail = (msg) => {
      dropFiles(files);
      res.status(400).send(adminViews.products(db.products.all(), counts(), { error: msg }));
    };
    if (err) return fail(uploadError(err));
    if (!files.photo) return fail('Falta la foto.');
    if (files.photo.size > MAX_PHOTO) return fail('La foto pesa más de 8 MB.');
    const input = await productInput(req.body);
    if (input.error) return fail(input.error);
    db.products.insert({
      ...input.value,
      image: `/uploads/${files.photo.filename}`,
      video: files.video ? `/uploads/${files.video.filename}` : '',
      inStock: true,
    });
    res.redirect(303, '/admin?ok=1');
  });

  app.get('/admin/productos/:id/editar', (req, res) => {
    const p = db.products.get(req.params.id);
    if (!p) return res.redirect('/admin');
    res.send(adminViews.editProduct(p, counts()));
  });

  app.post('/admin/productos/:id/editar', async (req, res) => {
    const p = db.products.get(req.params.id);
    if (!p) return res.redirect(303, '/admin');
    const err = await run(productUpload, req, res);
    const files = productFiles(req);
    const fail = (msg) => {
      dropFiles(files);
      res.status(400).send(adminViews.editProduct(p, counts(), { error: msg }));
    };
    if (err) return fail(uploadError(err));
    if (files.photo && files.photo.size > MAX_PHOTO) return fail('La foto pesa más de 8 MB.');
    const input = await productInput(req.body);
    if (input.error) return fail(input.error);
    const changes = { ...input.value };
    if (files.photo) {
      const usedInOrders = db.orders.items.some((o) => o.items.some((i) => i.image === p.image));
      if (!usedInOrders) rmFile(db.uploadsDir, p.image);
      changes.image = `/uploads/${files.photo.filename}`;
    }
    if (files.video || req.body.video_remove) {
      if (p.video) rmFile(db.uploadsDir, p.video);
      changes.video = files.video ? `/uploads/${files.video.filename}` : '';
    }
    db.products.update(p.id, changes);
    res.redirect(303, '/admin?ok=1');
  });

  app.get('/admin/portada', (req, res) => {
    res.send(adminViews.banners(db.settings.get().banners, counts(), { ok: req.query.ok ? 'Portada guardada.' : '' }));
  });

  app.post('/admin/portada', async (req, res) => {
    const fields = Array.from({ length: adminViews.MAX_BANNERS }, (_, i) => ({ name: `banner_${i}_image`, maxCount: 1 }));
    const upload = publicUpload.fields(fields);
    const err = await run(upload, req, res);
    const settings = db.settings.get();
    const files = req.files || {};
    const fail = (msg) => {
      Object.values(files).flat().forEach((f) => rmFile(db.uploadsDir, f.filename));
      res.status(400).send(adminViews.banners(settings.banners, counts(), { error: msg }));
    };
    if (err) return fail(uploadError(err));
    const b = req.body;
    const list = [];
    const removed = [];
    for (let i = 0; i < adminViews.MAX_BANNERS; i++) {
      const prev = settings.banners[i] || {};
      const upl = files[`banner_${i}_image`] && files[`banner_${i}_image`][0];
      let image = prev.image || '';
      if (upl || b[`banner_${i}_remove`]) {
        if (image) removed.push(image);
        image = upl ? `/uploads/${upl.filename}` : '';
      }
      const link = str(b[`banner_${i}_link`], 300);
      if (link && !/^(\/(?!\/)\S*|https:\/\/\S+)$/.test(link)) {
        return fail(`El enlace de la imagen ${i + 1} debe empezar con / o https://`);
      }
      const banner = {
        image,
        title: str(b[`banner_${i}_title`], 60),
        subtitle: str(b[`banner_${i}_subtitle`], 120),
        button: str(b[`banner_${i}_button`], 30),
        link: link || '/productos',
      };
      if (banner.image || banner.title || banner.subtitle) list.push(banner);
    }
    removed.forEach((img) => rmFile(db.uploadsDir, img));
    db.settings.set({ ...settings, banners: list });
    res.redirect(303, '/admin/portada?ok=1');
  });

  app.post('/admin/productos/:id/stock', (req, res) => {
    const p = db.products.get(req.params.id);
    if (p) db.products.update(p.id, { inStock: !p.inStock });
    res.redirect(303, '/admin');
  });

  app.post('/admin/productos/:id/borrar', (req, res) => {
    const p = db.products.get(req.params.id);
    if (p) {
      db.products.remove(p.id);
      // Las fotos de productos con pedidos se conservan para el historial.
      if (!db.orders.items.some((o) => o.items.some((i) => i.productId === p.id))) rmFile(db.uploadsDir, p.image);
      rmFile(db.uploadsDir, p.video);
    }
    res.redirect(303, '/admin');
  });

  app.get('/admin/pedidos', (req, res) => {
    res.send(adminViews.orders(db.orders.all(), counts(), { ok: req.query.ok ? 'Estado actualizado.' : '' }));
  });

  app.post('/admin/pedidos/:id/estado', (req, res) => {
    if (ORDER_STATUS[req.body.status]) db.orders.update(req.params.id, { status: req.body.status });
    res.redirect(303, '/admin/pedidos?ok=1');
  });

  app.get('/admin/resenas', (req, res) => {
    res.send(adminViews.reviews(db.reviews.all(), counts(), { ok: req.query.ok ? 'Reseña actualizada.' : '' }));
  });

  app.post('/admin/resenas/:id/estado', (req, res) => {
    if (['publicada', 'oculta'].includes(req.body.status)) db.reviews.update(req.params.id, { status: req.body.status });
    res.redirect(303, '/admin/resenas?ok=1');
  });

  app.post('/admin/resenas/:id/borrar', (req, res) => {
    const r = db.reviews.get(req.params.id);
    if (r) {
      db.reviews.remove(r.id);
      rmFile(db.uploadsDir, r.photo);
    }
    res.redirect(303, '/admin/resenas?ok=1');
  });

  app.get('/admin/personalizados', (req, res) => {
    res.send(adminViews.customRequests(db.customRequests.all(), counts(), { ok: req.query.ok ? 'Estado actualizado.' : '' }));
  });

  app.post('/admin/personalizados/:id/estado', (req, res) => {
    if (CUSTOM_STATUS[req.body.status]) db.customRequests.update(req.params.id, { status: req.body.status });
    res.redirect(303, '/admin/personalizados?ok=1');
  });

  // Comprobantes y fotos de clientes: solo visibles para el administrador.
  app.get('/admin/archivo/:name', (req, res) => {
    const name = path.basename(req.params.name);
    const file = path.join(db.privateDir, name);
    if (!/^[a-f0-9]+\.(jpg|png|webp)$/.test(name) || !fs.existsSync(file)) return res.sendStatus(404);
    res.sendFile(file);
  });

  app.get('/admin/pagos', (req, res) => {
    res.send(adminViews.payments(db.settings.get(), counts(), { ok: req.query.ok ? 'Guardado.' : '' }));
  });

  app.post('/admin/pagos', async (req, res) => {
    const upload = publicUpload.fields([
      { name: 'yape_qr', maxCount: 1 },
      { name: 'plin_qr', maxCount: 1 },
    ]);
    const err = await run(upload, req, res);
    const current = db.settings.get();
    const files = req.files || {};
    const fail = (msg) => {
      Object.values(files).flat().forEach((f) => rmFile(db.uploadsDir, f.filename));
      res.status(400).send(adminViews.payments(current, counts(), { error: msg }));
    };
    if (err) return fail(uploadError(err));
    const b = req.body;

    const wallet = (key) => {
      const raw = str(b[`${key}_number`], 20);
      const number = raw ? normalizePhone(raw) : '';
      if (number === null) return { error: `El número de ${key === 'yape' ? 'Yape' : 'Plin'} no es un celular válido.` };
      let qr = current[key].qr;
      const upl = files[`${key}_qr`] && files[`${key}_qr`][0];
      if (upl || b[`${key}_qr_remove`]) {
        if (qr) rmFile(db.uploadsDir, qr);
        qr = upl ? `/uploads/${upl.filename}` : '';
      }
      return { value: { number, name: str(b[`${key}_name`], 80), qr } };
    };
    const yape = wallet('yape');
    if (yape.error) return fail(yape.error);
    const plin = wallet('plin');
    if (plin.error) return fail(plin.error);

    const banks = [];
    for (let i = 0; i < adminViews.MAX_BANKS; i++) {
      const bank = {
        bank: str(b[`bank_${i}_bank`], 60),
        holder: str(b[`bank_${i}_holder`], 80),
        account: str(b[`bank_${i}_account`], 30),
        cci: str(b[`bank_${i}_cci`], 30).replace(/[\s-]/g, ''),
      };
      if (!bank.bank && !bank.account && !bank.cci) continue;
      if (!bank.bank) return fail(`Escribe el nombre del banco en la cuenta ${i + 1}.`);
      if (!bank.account && !bank.cci) return fail(`Escribe el número de cuenta o CCI de ${bank.bank}.`);
      if (bank.cci && !/^\d{20}$/.test(bank.cci)) return fail(`El CCI de ${bank.bank} debe tener 20 dígitos.`);
      banks.push(bank);
    }

    const cardLink = str(b.card_link, 500);
    if (cardLink && !/^https:\/\/\S+$/.test(cardLink)) return fail('El enlace de pago con tarjeta debe empezar con https://');

    const money = (v) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
    db.settings.set({
      ...current,
      yape: yape.value,
      plin: plin.value,
      banks,
      cardLink,
      shipping: {
        lima: money(b.ship_lima),
        provincia: money(b.ship_provincia),
        freeFrom: money(b.ship_free_from),
        pickup: Boolean(b.ship_pickup),
        pickupNote: str(b.ship_pickup_note, 200),
        note: str(b.ship_note, 300),
      },
    });
    res.redirect(303, '/admin/pagos?ok=1');
  });

  return app;
}

if (require.main === module) {
  createApp().listen(cfg.port, () => {
    console.log(`Tienda en ${cfg.baseUrl}  ·  Panel en ${cfg.baseUrl}/admin`);
    console.log(`Catálogo TikTok: ${cfg.baseUrl}/feeds/tiktok.csv`);
  });
}

module.exports = { createApp };
