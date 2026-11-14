const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Almacenamiento en un archivo JSON: suficiente para un catálogo pequeño
// y fácil de respaldar. Se puede cambiar por una base de datos más adelante.
class ProductStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'products.json');
    this.uploadsDir = path.join(dataDir, 'uploads');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    this.products = fs.existsSync(this.file)
      ? JSON.parse(fs.readFileSync(this.file, 'utf8'))
      : [];
  }

  save() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.products, null, 2));
    fs.renameSync(tmp, this.file); // escritura atómica
  }

  all() {
    return [...this.products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id) {
    return this.products.find((p) => p.id === id) || null;
  }

  create({ title, description, price, image, stock }) {
    const product = {
      id: crypto.randomBytes(6).toString('hex'),
      title: title || deriveTitle(description),
      description,
      price,
      image,
      inStock: stock !== false,
      createdAt: new Date().toISOString(),
    };
    this.products.push(product);
    this.save();
    return product;
  }

  update(id, changes) {
    const p = this.get(id);
    if (!p) return null;
    Object.assign(p, changes, { updatedAt: new Date().toISOString() });
    this.save();
    return p;
  }

  remove(id) {
    const p = this.get(id);
    if (!p) return false;
    this.products = this.products.filter((x) => x.id !== id);
    this.save();
    const img = path.join(this.uploadsDir, path.basename(p.image));
    fs.rm(img, { force: true }, () => {});
    return true;
  }
}

// Si no se escribe título, usamos la primera línea de la descripción.
function deriveTitle(description) {
  const first = String(description).split(/\r?\n/)[0].trim();
  return first.length > 80 ? `${first.slice(0, 77)}...` : first;
}

module.exports = { ProductStore, deriveTitle };
