// Genera el catálogo en el formato de "data feed" de TikTok Catalog Manager.
// En TikTok: Catálogos > Productos > Agregar productos > Fuente de datos >
// "Programado" y pega la URL  <BASE_URL>/feeds/tiktok.csv
// TikTok la volverá a leer automáticamente (cada hora / día, según elijas).

const COLUMNS = [
  'sku_id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
];

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function productRow(p, cfg) {
  return {
    sku_id: p.id,
    title: p.title.slice(0, 255),
    description: p.description.slice(0, 10000),
    availability: p.inStock ? 'in stock' : 'out of stock',
    condition: 'new',
    price: `${Number(p.price).toFixed(2)} ${cfg.currency}`,
    link: `${cfg.baseUrl}/producto/${p.id}`,
    image_link: `${cfg.baseUrl}${p.image}`,
    brand: cfg.brand,
  };
}

function buildCsv(products, cfg) {
  const lines = [COLUMNS.join(',')];
  for (const p of products) {
    const row = productRow(p, cfg);
    lines.push(COLUMNS.map((c) => csvCell(row[c])).join(','));
  }
  return lines.join('\n') + '\n';
}

module.exports = { buildCsv, productRow, csvCell, COLUMNS };
