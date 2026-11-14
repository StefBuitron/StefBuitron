const fs = require('node:fs');
const path = require('node:path');

// Carga .env sin dependencias externas.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const env = process.env;
const port = Number(env.PORT) || 3000;

module.exports = {
  port,
  storeName: env.STORE_NAME || 'Mi Tienda',
  baseUrl: (env.BASE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  adminPassword: env.ADMIN_PASSWORD || '',
  // La tienda vende solo en Perú: soles por defecto.
  currency: (env.CURRENCY || 'PEN').toUpperCase(),
  brand: env.BRAND || env.STORE_NAME || 'Mi Tienda',
  categories: (env.CATEGORIES || 'Accesorios,Carteras,Ropa,Vitaminas')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean),
  tiktokUsername: (env.TIKTOK_USERNAME || '').replace(/^@/, ''),
  tiktokPixelId: env.TIKTOK_PIXEL_ID || '',
  whatsappNumber: (env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  dataDir: env.DATA_DIR || path.join(__dirname, '..', 'data'),
};
