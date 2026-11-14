// Interacciones de la tienda: carrito, favoritos, carrusel y formularios.
// El carrito vive en el navegador; el servidor recalcula precios al hacer el pedido.
(function () {
  var CART = 'tienda_carrito', FAVS = 'tienda_favoritos';
  var currency = (window.STORE && window.STORE.currency) || 'PEN';
  var fmt = function (n) {
    try { return new Intl.NumberFormat('es-PE', { style: 'currency', currency: currency }).format(n); }
    catch (e) { return n.toFixed(2); }
  };
  function load(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ----- Carrito -----
  function saveCart(c) { store(CART, c); badge(); renderCart(); }
  function badge() {
    var n = load(CART).reduce(function (s, i) { return s + i.qty; }, 0);
    $$('[data-cart-count]').forEach(function (el) { el.textContent = n > 99 ? '99+' : n; el.hidden = !n; });
  }
  function addToCart(btn) {
    var p = JSON.parse(btn.getAttribute('data-add-to-cart'));
    var q = btn.hasAttribute('data-use-qty') && document.getElementById('qty');
    var qty = Math.min(99, Math.max(1, parseInt(q ? q.value : '1', 10) || 1));
    var c = load(CART), ex = c.find(function (i) { return i.id === p.id; });
    if (ex) ex.qty = Math.min(99, ex.qty + qty); else { p.qty = qty; c.push(p); }
    saveCart(c);
    if (window.ttq) ttq.track('AddToCart', { content_id: p.id, content_type: 'product', quantity: qty, value: p.price * qty, currency: currency });
    if (btn.getAttribute('data-go')) { location.href = btn.getAttribute('data-go'); return; }
    var old = btn.innerHTML;
    btn.classList.add('added'); btn.innerHTML = '¡Agregado! ✓';
    setTimeout(function () { btn.classList.remove('added'); btn.innerHTML = old; }, 1400);
    var cartIcon = document.querySelector('.top .icon-btn');
    if (cartIcon) { cartIcon.classList.remove('bump'); void cartIcon.offsetWidth; cartIcon.classList.add('bump'); }
  }

  // ----- Favoritos -----
  function paintFavs() {
    var f = load(FAVS);
    $$('[data-fav]').forEach(function (b) {
      var on = f.indexOf(b.getAttribute('data-fav')) >= 0;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
  }
  function toggleFav(btn) {
    var id = btn.getAttribute('data-fav'), f = load(FAVS), i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else { f.unshift(id); if (window.ttq) ttq.track('AddToWishlist', { content_id: id }); }
    store(FAVS, f.slice(0, 100)); paintFavs();
  }

  document.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-add-to-cart]'))) return addToCart(t);
    if ((t = e.target.closest('[data-fav]'))) { e.preventDefault(); return toggleFav(t); }
    if ((t = e.target.closest('[data-step]'))) {
      var input = t.parentNode.querySelector('input');
      input.value = Math.min(99, Math.max(1, (parseInt(input.value, 10) || 1) + Number(t.getAttribute('data-step'))));
      return;
    }
    if ((t = e.target.closest('[data-change]'))) {
      var c = load(CART), item = c.find(function (i) { return i.id === t.getAttribute('data-id'); });
      if (!item) return;
      item.qty = Math.min(99, item.qty + Number(t.getAttribute('data-change')));
      saveCart(c.filter(function (i) { return i.qty > 0; }));
    }
  });

  // ----- Página del carrito -----
  function renderCart() {
    var box = document.getElementById('cart-items');
    if (!box) return;
    var c = load(CART), form = document.getElementById('checkout');
    if (form) form.hidden = !c.length;
    if (!c.length) { box.innerHTML = '<p class="empty">Tu carrito está vacío. <a href="/productos">Ver productos</a></p>'; return; }
    box.innerHTML = '<h2>Productos</h2><div data-free-progress></div><ul class="lines">' + c.map(function (i) {
      return '<li><img class="thumb" src="' + esc(i.image) + '" alt=""><span>' + esc(i.title) +
        '<br><span class="stepper"><button type="button" data-change="-1" data-id="' + esc(i.id) + '" aria-label="Quitar uno">−</button><b>' + i.qty +
        '</b><button type="button" data-change="1" data-id="' + esc(i.id) + '" aria-label="Agregar uno">+</button></span></span><b>' + fmt(i.price * i.qty) + '</b></li>';
    }).join('') + '</ul>';
    totals();
  }
  function totals() {
    var form = document.getElementById('checkout');
    if (!form) return;
    var c = load(CART);
    var sub = c.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var freeFrom = Number(form.getAttribute('data-free-from')) || 0;
    var free = freeFrom > 0 && sub >= freeFrom;
    var opt = form.querySelector('input[name=shipping]:checked');
    var ship = opt && !free ? Number(opt.getAttribute('data-cost')) : 0;
    form.querySelector('[data-subtotal]').textContent = fmt(sub);
    form.querySelector('[data-shipping-cost]').textContent = ship ? fmt(ship) : 'Gratis';
    form.querySelector('[data-total]').textContent = fmt(sub + ship);
    $$('input[name=shipping]', form).forEach(function (r) {
      var cost = Number(r.getAttribute('data-cost'));
      r.parentNode.querySelector('[data-ship-label]').textContent = cost && !free ? fmt(cost) : 'Gratis';
    });
    var prog = document.querySelector('[data-free-progress]');
    if (prog && freeFrom > 0) {
      prog.innerHTML = free
        ? '<p class="free-bar done">🎉 ¡Tienes envío gratis!</p>'
        : '<p class="free-bar">Te faltan <b>' + fmt(freeFrom - sub) + '</b> para envío gratis<span style="--p:' + Math.round(sub / freeFrom * 100) + '%"></span></p>';
    }
    form.querySelector('input[name=items]').value = JSON.stringify(c.map(function (i) { return { id: i.id, qty: i.qty }; }));
    var mode = opt ? opt.value : '';
    $$('[data-show-for]', form).forEach(function (el) { el.hidden = el.getAttribute('data-show-for') !== mode; });
    $$('[data-hide-for]', form).forEach(function (el) {
      var hide = el.getAttribute('data-hide-for') === mode;
      el.hidden = hide;
      $$('input', el).forEach(function (i) { i.required = !hide; });
    });
    var dni = form.querySelector('input[name=dni]');
    if (dni) dni.required = mode === 'provincia';
  }
  document.addEventListener('change', function (e) {
    if (e.target.name === 'shipping') totals();
    // Vista previa de imágenes elegidas
    if (e.target.type === 'file') {
      var prev = e.target.parentNode.querySelector('.preview'), f = e.target.files[0];
      if (prev && f) { prev.src = URL.createObjectURL(f); prev.style.display = 'block'; }
    }
  });

  // ----- Carrusel -----
  function carousel(root) {
    var track = root.querySelector('.slides'), dots = $$('.dots button', root), slides = $$('.slide', root);
    if (slides.length < 2) return;
    var idx = 0, timer;
    function go(i) { idx = (i + slides.length) % slides.length; track.scrollTo({ left: track.clientWidth * idx, behavior: 'smooth' }); }
    function sync() {
      idx = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
      slides.forEach(function (s, i) { s.setAttribute('aria-hidden', i !== idx); s.tabIndex = i === idx ? 0 : -1; });
    }
    function play() { clearInterval(timer); timer = setInterval(function () { go(idx + 1); }, 5000); }
    track.addEventListener('scroll', function () { clearTimeout(track._t); track._t = setTimeout(sync, 80); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); play(); }); });
    root.addEventListener('pointerdown', play);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) play();
  }

  document.addEventListener('DOMContentLoaded', function () {
    badge(); paintFavs(); renderCart();
    $$('[data-carousel]').forEach(carousel);
  });
})();
