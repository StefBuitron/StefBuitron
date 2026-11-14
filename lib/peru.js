// Reglas de negocio para vender en Perú: pagos, envíos y pedidos.

const PAYMENT_LABELS = {
  yape: 'Yape',
  plin: 'Plin',
  transferencia: 'Transferencia bancaria (BCP, Interbank, BBVA, Scotiabank...)',
  tarjeta: 'Tarjeta de crédito o débito',
};

const ORDER_STATUS = {
  pendiente: 'Esperando pago',
  por_verificar: 'Comprobante por verificar',
  pagado: 'Pago confirmado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const CUSTOM_STATUS = {
  nuevo: 'Nuevo',
  cotizado: 'Cotizado',
  aceptado: 'Aceptado',
  terminado: 'Terminado',
  descartado: 'Descartado',
};

function paymentMethods(s) {
  const out = [];
  if (s.yape.number) out.push('yape');
  if (s.plin.number) out.push('plin');
  if (s.banks.length) out.push('transferencia');
  if (s.cardLink) out.push('tarjeta');
  return out;
}

function shippingOptions(s) {
  const opts = [
    { id: 'lima', label: 'Delivery en Lima Metropolitana', cost: Number(s.shipping.lima) || 0 },
    { id: 'provincia', label: 'Envío a provincia por agencia (Shalom, Olva...)', cost: Number(s.shipping.provincia) || 0 },
  ];
  if (s.shipping.pickup) opts.push({ id: 'recojo', label: 'Recojo en tienda', cost: 0 });
  return opts;
}

// Celulares peruanos: 9 dígitos que empiezan con 9 (acepta +51 delante).
function normalizePhone(value) {
  let d = String(value || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('51')) d = d.slice(2);
  return /^9\d{8}$/.test(d) ? d : null;
}

const round2 = (n) => Math.round(n * 100) / 100;
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);

// Valida el formulario de compra y arma el pedido con precios del servidor
// (nunca se confía en los precios que manda el navegador).
function buildOrder(body, products, settings) {
  let lines;
  try {
    lines = JSON.parse(body.items || '[]');
  } catch {
    return { error: 'El carrito no es válido.' };
  }
  if (!Array.isArray(lines) || !lines.length) return { error: 'Tu carrito está vacío.' };

  const merged = new Map();
  for (const l of lines.slice(0, 50)) {
    const qty = Math.trunc(Number(l && l.qty));
    if (!l || typeof l.id !== 'string' || !(qty >= 1 && qty <= 99)) return { error: 'El carrito no es válido.' };
    merged.set(l.id, Math.min(99, (merged.get(l.id) || 0) + qty));
  }

  const items = [];
  for (const [id, qty] of merged) {
    const p = products.get(id);
    if (!p) return { error: 'Uno de los productos ya no existe. Revisa tu carrito.' };
    if (!p.inStock) return { error: `"${p.title}" está agotado. Quítalo del carrito para continuar.` };
    items.push({ productId: p.id, title: p.title, price: p.price, qty, image: p.image });
  }

  const name = str(body.name, 120);
  const phone = normalizePhone(body.phone);
  const dni = str(body.dni, 12).replace(/\D/g, '');
  if (!name) return { error: 'Escribe tu nombre.' };
  if (!phone) return { error: 'Escribe un celular válido (9 dígitos, empieza con 9).' };

  const shipping = shippingOptions(settings).find((o) => o.id === body.shipping);
  if (!shipping) return { error: 'Elige una forma de entrega.' };
  const address = str(body.address, 300);
  const district = str(body.district, 120);
  if (shipping.id !== 'recojo' && (!address || !district)) {
    return { error: 'Escribe la dirección y el distrito/ciudad de entrega.' };
  }
  if (shipping.id === 'provincia' && !/^\d{8}$/.test(dni)) {
    return { error: 'Para envíos a provincia la agencia pide tu DNI (8 dígitos).' };
  }

  const payment = body.payment;
  if (!paymentMethods(settings).includes(payment)) return { error: 'Elige un método de pago.' };

  const subtotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
  return {
    order: {
      items,
      subtotal,
      shippingCost: shipping.cost,
      total: round2(subtotal + shipping.cost),
      customer: { name, phone, dni, address, district, notes: str(body.notes, 500) },
      shipping: { id: shipping.id, label: shipping.label },
      payment,
      status: 'pendiente',
      voucher: '',
    },
  };
}

module.exports = {
  PAYMENT_LABELS,
  ORDER_STATUS,
  CUSTOM_STATUS,
  paymentMethods,
  shippingOptions,
  normalizePhone,
  buildOrder,
  str,
};
