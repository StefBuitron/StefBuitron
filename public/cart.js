// Carrito guardado en el navegador del cliente. El servidor vuelve a calcular
// precios y totales al hacer el pedido.
(function () {
  var KEY = 'tienda_carrito';
  var currency = (window.STORE && window.STORE.currency) || 'PEN';
  var fmt = function (n) {
    try { return new Intl.NumberFormat('es-PE', { style: 'currency', currency: currency }).format(n); }
    catch (e) { return n.toFixed(2); }
  };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} badge(); render(); }
  function badge() {
    var n = load().reduce(function (s, i) { return s + i.qty; }, 0);
    document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = n; el.hidden = !n; });
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add-to-cart]');
    if (add) {
      var p = JSON.parse(add.getAttribute('data-add-to-cart'));
      var q = document.getElementById('qty');
      var qty = Math.min(99, Math.max(1, parseInt(q ? q.value : '1', 10) || 1));
      var c = load(), ex = c.find(function (i) { return i.id === p.id; });
      if (ex) ex.qty = Math.min(99, ex.qty + qty); else { p.qty = qty; c.push(p); }
      save(c);
      if (window.ttq) ttq.track('AddToCart', { content_id: p.id, content_type: 'product', quantity: qty, value: p.price * qty, currency: currency });
      add.textContent = '¡Agregado! ✓';
      setTimeout(function () { add.textContent = 'Agregar al carrito'; }, 1500);
      return;
    }
    var ch = e.target.closest('[data-change]');
    if (ch) {
      var c2 = load(), item = c2.find(function (i) { return i.id === ch.getAttribute('data-id'); });
      if (!item) return;
      item.qty += Number(ch.getAttribute('data-change'));
      save(c2.filter(function (i) { return i.qty > 0 && (i.qty = Math.min(99, i.qty)); }));
    }
  });

  // ----- Página del carrito -----
  function render() {
    var box = document.getElementById('cart-items');
    if (!box) return;
    var c = load(), form = document.getElementById('checkout');
    if (form) form.hidden = !c.length;
    if (!c.length) { box.innerHTML = '<p class="empty">Tu carrito está vacío. <a href="/">Ver productos</a></p>'; return; }
    box.innerHTML = '<h2>Productos</h2><ul class="lines">' + c.map(function (i) {
      return '<li><img class="thumb" src="' + esc(i.image) + '" alt=""><span>' + esc(i.title) +
        '<br><span class="stepper"><button type="button" data-change="-1" data-id="' + esc(i.id) + '">−</button> ' + i.qty +
        ' <button type="button" data-change="1" data-id="' + esc(i.id) + '">+</button></span></span><b>' + fmt(i.price * i.qty) + '</b></li>';
    }).join('') + '</ul>';
    totals();
  }
  function totals() {
    var form = document.getElementById('checkout');
    if (!form) return;
    var c = load();
    var sub = c.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var opt = form.querySelector('input[name=shipping]:checked');
    var ship = opt ? Number(opt.getAttribute('data-cost')) : 0;
    form.querySelector('[data-subtotal]').textContent = fmt(sub);
    form.querySelector('[data-shipping-cost]').textContent = ship ? fmt(ship) : 'Gratis';
    form.querySelector('[data-total]').textContent = fmt(sub + ship);
    form.querySelector('input[name=items]').value = JSON.stringify(c.map(function (i) { return { id: i.id, qty: i.qty }; }));
    var mode = opt ? opt.value : '';
    form.querySelectorAll('[data-show-for]').forEach(function (el) { el.hidden = el.getAttribute('data-show-for') !== mode; });
    form.querySelectorAll('[data-hide-for]').forEach(function (el) {
      var hide = el.getAttribute('data-hide-for') === mode;
      el.hidden = hide;
      el.querySelectorAll('input').forEach(function (i) { i.required = !hide; });
    });
    var dni = form.querySelector('input[name=dni]');
    if (dni) dni.required = mode === 'provincia';
  }
  document.addEventListener('change', function (e) { if (e.target.name === 'shipping') totals(); });
  document.addEventListener('DOMContentLoaded', function () { badge(); render(); });
})();
