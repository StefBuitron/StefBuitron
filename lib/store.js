const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Almacenamiento en archivos JSON: suficiente para una tienda pequeña y
// fácil de respaldar (basta con copiar la carpeta data/).
function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file); // escritura atómica
}

class Collection {
  constructor(file) {
    this.file = file;
    this.items = readJson(file, []);
  }
  all() {
    return [...this.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  get(id) {
    return this.items.find((x) => x.id === id) || null;
  }
  insert(data) {
    const item = { id: crypto.randomBytes(8).toString('hex'), ...data, createdAt: new Date().toISOString() };
    this.items.push(item);
    writeJson(this.file, this.items);
    return item;
  }
  update(id, changes) {
    const item = this.get(id);
    if (!item) return null;
    Object.assign(item, changes, { updatedAt: new Date().toISOString() });
    writeJson(this.file, this.items);
    return item;
  }
  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((x) => x.id !== id);
    writeJson(this.file, this.items);
    return this.items.length < before;
  }
}

const DEFAULT_SETTINGS = {
  yape: { number: '', name: '', qr: '' },
  plin: { number: '', name: '', qr: '' },
  banks: [],
  cardLink: '',
  shipping: { lima: 10, provincia: 15, freeFrom: 0, pickup: false, pickupNote: '', note: '' },
  banners: [],
};

class Settings {
  constructor(file) {
    this.file = file;
    const saved = readJson(file, {});
    this.value = {
      ...DEFAULT_SETTINGS,
      ...saved,
      shipping: { ...DEFAULT_SETTINGS.shipping, ...(saved.shipping || {}) },
    };
  }
  get() {
    return this.value;
  }
  set(value) {
    this.value = value;
    writeJson(this.file, value);
  }
}

// Si no se escribe título, usamos la primera línea de la descripción.
function deriveTitle(description) {
  const first = String(description).split(/\r?\n/)[0].trim();
  return first.length > 80 ? `${first.slice(0, 77)}...` : first;
}

function openDb(dataDir) {
  const uploadsDir = path.join(dataDir, 'uploads'); // fotos públicas
  const privateDir = path.join(dataDir, 'private'); // comprobantes y fotos de clientes
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(privateDir, { recursive: true });
  return {
    uploadsDir,
    privateDir,
    products: new Collection(path.join(dataDir, 'products.json')),
    orders: new Collection(path.join(dataDir, 'orders.json')),
    customRequests: new Collection(path.join(dataDir, 'custom-requests.json')),
    reviews: new Collection(path.join(dataDir, 'reviews.json')),
    settings: new Settings(path.join(dataDir, 'settings.json')),
  };
}

module.exports = { openDb, deriveTitle, Collection, Settings, DEFAULT_SETTINGS };
