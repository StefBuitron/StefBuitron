// Videos de productos: enlaces de TikTok (se muestran incrustados, sin costo de
// almacenamiento) o un video corto subido a la tienda.

const MAX_TIKTOKS = 3;

// Extrae el número de video de un enlace largo de TikTok.
function tiktokId(url) {
  const m = String(url).match(/tiktok\.com\/(?:@[\w.-]+\/video|embed(?:\/v2)?|player\/v1|v)\/(\d{10,25})/);
  return m ? m[1] : null;
}

const isShortLink = (url) => /^https:\/\/(vm|vt)\.tiktok\.com\/[\w-]+\/?$/.test(url) || /^https:\/\/www\.tiktok\.com\/t\/[\w-]+\/?$/.test(url);

// Los enlaces cortos (vm.tiktok.com/...) que da la app al "Compartir" se
// convierten al enlace largo siguiendo la redirección.
async function resolveTiktok(url, fetchImpl = fetch) {
  const direct = tiktokId(url);
  if (direct) return direct;
  if (!isShortLink(url)) return null;
  try {
    const r = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
    const loc = r.headers.get('location') || '';
    return tiktokId(loc);
  } catch {
    return null;
  }
}

// Devuelve { ids } o { error } a partir del texto del formulario (un enlace por línea).
async function parseTiktokLinks(text, fetchImpl) {
  const lines = String(text || '')
    .split(/[\s,]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > MAX_TIKTOKS) return { error: `Puedes poner hasta ${MAX_TIKTOKS} videos de TikTok por producto.` };
  const ids = [];
  for (const line of lines) {
    const id = await resolveTiktok(line, fetchImpl);
    if (!id) return { error: `No reconocemos este enlace de TikTok: ${line.slice(0, 80)}. Copia el enlace del video desde TikTok (Compartir → Copiar enlace).` };
    if (!ids.includes(id)) ids.push(id);
  }
  return { ids };
}

const hasVideo = (p) => Boolean(p.video || (p.tiktok && p.tiktok.length));

module.exports = { tiktokId, resolveTiktok, parseTiktokLinks, hasVideo, MAX_TIKTOKS };
