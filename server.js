const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const cfg = require('./lib/config');
const views = require('./lib/views');
const { ProductStore } = require('./lib/store');
const { buildCsv } = require('./lib/tiktok-feed');

function createApp(store = new ProductStore(cfg.dataDir)) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use('/static', express.static(path.join(__dirname, 'public')));
  app.use('/uploads', express.static(store.uploadsDir, { maxAge: '7d' }));

  // ---------- Sesión de administrador (cookie firmada, sin dependencias) ----------
  const COOKIE = 'tienda_admin';
  const sign = (exp) =>
    crypto.createHmac('sha256', cfg.adminPassword).update(String(exp)).digest('hex');

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

  // ---------- Subida de fotos ----------
  const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  const upload = multer({
    storage: multer.diskStorage({
      destination: store.uploadsDir,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(10).toString('hex') + EXT[file.mimetype]),
    }),
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) =>
      EXT[file.mimetype] ? cb(null, true) : cb(new Error('La foto debe ser JPG, PNG o WebP.')),
  });

  // ---------- Tienda pública ----------
  app.get('/', (req, res) => res.send(views.home(store.all())));

  app.get('/producto/:id', (req, res) => {
    const p = store.get(req.params.id);
    if (!p) return res.status(404).send(views.notFound());
    res.send(views.productPage(p));
  });

  // Catálogo que TikTok descarga de forma programada.
  app.get('/feeds/tiktok.csv', (req, res) => {
    res.type('text/csv; charset=utf-8').send(buildCsv(store.all(), cfg));
  });

  // ---------- Panel ----------
  app.get('/admin/entrar', (req, res) => {
    if (isAdmin(req)) return res.redirect('/admin');
    res.send(views.login(cfg.adminPassword ? '' : 'Falta configurar ADMIN_PASSWORD en el archivo .env'));
  });

  app.post('/admin/entrar', (req, res) => {
    const given = Buffer.from(String(req.body.password || ''));
    const real = Buffer.from(cfg.adminPassword);
    const ok = cfg.adminPassword && given.length === real.length && crypto.timingSafeEqual(given, real);
    if (!ok) return res.status(401).send(views.login('Contraseña incorrecta.'));
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

  app.get('/admin', requireAdmin, (req, res) => {
    res.send(views.admin(store.all(), { ok: req.query.ok ? 'Producto publicado.' : '' }));
  });

  app.post('/admin/productos', requireAdmin, (req, res) => {
    upload.single('photo')(req, res, (err) => {
      const fail = (msg) => res.status(400).send(views.admin(store.all(), { error: msg }));
      if (err) return fail(err.code === 'LIMIT_FILE_SIZE' ? 'La foto pesa más de 8 MB.' : err.message);
      const description = String(req.body.description || '').trim();
      const price = Number(req.body.price);
      if (!req.file) return fail('Falta la foto.');
      if (!description) return fail('Falta la descripción.');
      if (!Number.isFinite(price) || price < 0) return fail('El precio no es válido.');
      store.create({
        title: String(req.body.title || '').trim(),
        description,
        price: Math.round(price * 100) / 100,
        image: `/uploads/${req.file.filename}`,
      });
      res.redirect('/admin?ok=1');
    });
  });

  app.post('/admin/productos/:id/stock', requireAdmin, (req, res) => {
    const p = store.get(req.params.id);
    if (p) store.update(p.id, { inStock: !p.inStock });
    res.redirect('/admin');
  });

  app.post('/admin/productos/:id/borrar', requireAdmin, (req, res) => {
    store.remove(req.params.id);
    res.redirect('/admin');
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
