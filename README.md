# Tienda TikTok

Una tienda en línea mínima: **subes una foto, escribes la descripción y el precio, y listo**.
El producto aparece en tu tienda y en tu **catálogo de TikTok**, así puedes etiquetarlo en tus videos y anuncios.

## Cómo funciona

```
 Tú (celular)            Tu tienda                         TikTok
 ───────────            ─────────                         ──────
 /admin  ──foto+desc──▶  guarda producto ──▶ /producto/:id  ◀── clic desde video/anuncio
                         └──▶ /feeds/tiktok.csv  ◀── TikTok lo lee solo (cada hora/día)
```

- **Panel `/admin`**: foto (se puede tomar con la cámara del celular), descripción y precio.
  La primera línea de la descripción se usa como título.
- **Tienda pública `/`**: cuadrícula de productos y página de cada uno, con botón
  *Comprar por WhatsApp*.
- **Conexión con TikTok**:
  - `/feeds/tiktok.csv`: catálogo en el formato de *data feed* de TikTok. Se configura una sola vez
    en TikTok Catalog Manager (*Catálogos → Agregar productos → Fuente de datos → Programado*)
    y TikTok descarga los productos nuevos automáticamente.
  - **Pixel de TikTok** (opcional): mide visitas a productos (`ViewContent`) y clics en
    comprar (`Contact`) para optimizar anuncios.
  - Enlace a tu perfil de TikTok en el encabezado.

## Ponerla en marcha

```bash
npm install
cp .env.example .env   # y edita tus datos (contraseña, moneda, TikTok, WhatsApp)
npm start
```

Abre `http://localhost:3000/admin`. Pruebas: `npm test`.

Para que TikTok pueda leer el catálogo, la tienda debe estar publicada en internet
(por ejemplo en Render, Railway o un VPS) y `BASE_URL` debe ser esa dirección pública con `https`.
Usa un disco persistente para la carpeta `data/`, que es donde se guardan productos y fotos.

## Siguientes pasos posibles

- Pagos en línea (Mercado Pago / Stripe) en vez de WhatsApp.
- Conexión directa con la API de **TikTok Shop** (requiere cuenta de vendedor aprobada y app de desarrollador).
- Varias fotos por producto, variantes (talla/color) y categorías.
