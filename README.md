# Tienda TikTok · Perú

Tienda en línea mínima para vender en Perú: **subes una foto, escribes la descripción y el precio, y listo**.
El producto aparece en tu tienda y en tu **catálogo de TikTok**, y tus clientes pagan con
**Yape, Plin, transferencia bancaria o tarjeta**.

## Qué incluye

**Para ti (panel `/admin`, desde el celular)**
- **Productos**: foto + descripción + precio en soles + categoría (Accesorios, Carteras, Ropa, Vitaminas).
  La primera línea de la descripción es el título. Marcar agotado / borrar.
- **Pedidos**: cada compra con su código (P-1001…), datos del cliente, dirección, DNI (provincia),
  la **captura del pago** que subió el cliente y el estado:
  Esperando pago → Comprobante por verificar → Pago confirmado → Enviado → Entregado.
- **Personalizados**: solicitudes de clientes con descripción, foto de referencia, presupuesto y fecha.
- **Pagos y envíos**: tu número de Yape y Plin (con QR), hasta 4 cuentas bancarias con CCI,
  enlace de pago con tarjeta (Mercado Pago, Izipay, Culqi o Niubiz), costo de delivery en Lima,
  envío a provincia y recojo en tienda. Solo los métodos que llenes se muestran al cliente.

**Para tus clientes**
- Tienda con filtros por categoría, carrito y compra sin crear cuenta.
- Al pedir, ven exactamente cuánto pagar y a dónde (número de Yape/Plin, QR o cuentas),
  suben la captura del pago y te avisan por WhatsApp con un toque.
- Formulario de **pedidos personalizados** en `/personalizados`.

**Conexión con TikTok**
- `/feeds/tiktok.csv`: catálogo en el formato de *data feed* de TikTok, en soles (PEN).
  Se configura una vez en TikTok Catalog Manager (*Catálogos → Agregar productos → Fuente de datos → Programado*).
- **Pixel de TikTok** (opcional): mide `ViewContent`, `AddToCart`, `PlaceAnOrder` y `SubmitForm`
  para optimizar tus anuncios.

## Ponerla en marcha

```bash
npm install
cp .env.example .env   # edita nombre, contraseña, TikTok y WhatsApp
npm start
```

Abre `http://localhost:3000/admin` → **Pagos y envíos** para poner tus números y cuentas.
Pruebas: `npm test`.

Para que TikTok lea el catálogo, la tienda debe estar publicada en internet (Render, Railway o un VPS)
con `BASE_URL` en `https`. Usa un disco persistente para `data/` (productos, pedidos, fotos y comprobantes).

## Notas

- Yape, Plin y transferencias se verifican a mano: el cliente sube su captura y tú confirmas en tu app
  del banco antes de enviar. Confirmar pagos automáticamente requiere una cuenta comercial
  (p. ej. Yape Empresas, Mercado Pago o Izipay) y su integración por API.
- Los comprobantes y fotos de clientes son privados: solo se ven desde el panel.
- Vender suplementos/vitaminas en Perú requiere que los productos tengan registro sanitario (DIGESA/DIGEMID).
