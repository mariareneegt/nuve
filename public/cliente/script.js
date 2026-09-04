const cart = new Map();
let products = [], currentCategory;
const $ = (s) => document.querySelector(s);
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money = (v) => `Q${Number(v || 0).toFixed(2)}`;
const image = (p) => p.imagen ? encodeURI(p.imagen) : 'logoNube.png';

$('#menuToggle')?.addEventListener('click', () => $('#mainNav').classList.toggle('open'));
$('#cartButton')?.addEventListener('click', () => { $('#cartPanel').hidden = false; });
document.querySelectorAll('[data-cart-close]').forEach(b => b.onclick = () => { $('#cartPanel').hidden = true; });
document.querySelectorAll('[data-account-close]').forEach(b => b.onclick = () => { $('#accountPanel').hidden = true; });

function renderFeatured() {
  const list = products.filter(p => p.destacado).slice(0, 3);
  const shown = list.length ? list : products.slice(0, 3);
  $('#productos-destacados .product-grid').innerHTML = shown.map(card).join('');
}
function card(p) {
  const out = Number(p.stock) <= 0;
  return `<article class="product-card"><img src="${image(p)}" alt="${escapeHtml(p.nombre)}" class="product-image"><div class="product-tag">${escapeHtml(p.categoria)}</div><h3>${escapeHtml(p.nombre)}</h3><p>${escapeHtml(p.descripcion || 'Disponible para ordenar en Nuve.')}</p><span class="price">${money(p.precio)}</span><button class="btn btn-secondary add-cart" data-product-id="${p.id_producto}" ${out ? 'disabled' : ''}>${out ? 'Agotado' : 'Agregar al carrito'}</button></article>`;
}
function renderTabs() {
  const categories = [...new Set(products.map(p => p.categoria))];
  if (!categories.includes(currentCategory)) currentCategory = categories[0];
  $('.category-tabs').innerHTML = categories.map(c => `<button class="category-tab ${c === currentCategory ? 'active' : ''}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
}
function renderCatalog() {
  const shown = products.filter(p => p.categoria === currentCategory);
  $('.showcase-grid').innerHTML = shown.length ? shown.map(p => {
    const out = Number(p.stock) <= 0;
    return `<article class="showcase-card"><img src="${image(p)}" alt="${escapeHtml(p.nombre)}" class="showcase-image"><div class="showcase-badge">${escapeHtml(p.categoria)}</div><h3>${escapeHtml(p.nombre)}</h3><p>${escapeHtml(p.descripcion || 'Disponible para ordenar en Nuve.')}</p><span class="showcase-price">${money(p.precio)}</span><button class="btn btn-secondary add-cart" data-product-id="${p.id_producto}" ${out ? 'disabled' : ''}>${out ? 'Agotado' : 'Agregar al carrito'}</button></article>`;
  }).join('') : '<p>No hay productos activos en esta categoría.</p>';
}
async function loadCatalog() {
  try {
    $('.showcase-grid').innerHTML = '<p>Cargando productos…</p>';
    const response = await fetch('/api/productos'); const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el catálogo.');
    products = data.filter(p => p.estado === 'ACTIVO'); renderTabs(); renderFeatured(); renderCatalog();
  } catch (error) { $('.showcase-grid').innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}
$('.category-tabs')?.addEventListener('click', e => { const tab = e.target.closest('[data-category]'); if (tab) { currentCategory = tab.dataset.category; renderTabs(); renderCatalog(); } });
document.addEventListener('click', e => {
  const button = e.target.closest('.add-cart[data-product-id]'); if (!button || button.disabled) return;
  const product = products.find(p => String(p.id_producto) === button.dataset.productId); if (!product || !Number(product.stock)) return;
  const item = cart.get(product.id_producto) || {...product, quantity: 0}; item.quantity = Math.min(item.quantity + 1, Number(product.stock)); cart.set(product.id_producto, item); renderCart(); $('#cartPanel').hidden = false;
});
function renderCart() {
  const items = [...cart.values()]; $('#cartCount').textContent = items.reduce((n,p) => n + p.quantity, 0);
  $('#cartItemsList').innerHTML = items.map(p => `<article class="cart-item"><img src="${image(p)}" alt="${escapeHtml(p.nombre)}"><div class="cart-item-info"><h3>${escapeHtml(p.nombre)}</h3><span>${money(p.precio)}</span></div><div class="cart-quantity"><button data-cart="-" data-id="${p.id_producto}">-</button><input type="number" min="1" max="${p.stock}" value="${p.quantity}" data-id="${p.id_producto}"><button data-cart="+" data-id="${p.id_producto}">+</button></div></article>`).join('');
  $('#cartEmpty').hidden = Boolean(items.length); $('#cartSummary').hidden = !items.length; $('#cartTotal').textContent = money(items.reduce((n,p) => n + Number(p.precio) * p.quantity, 0));
}
$('#cartItemsList')?.addEventListener('click', e => { const b=e.target.closest('[data-cart]'); if(!b)return; const p=cart.get(Number(b.dataset.id)); p.quantity += b.dataset.cart==='+' ? 1 : -1; if(p.quantity<=0)cart.delete(p.id_producto); else p.quantity=Math.min(p.quantity,Number(p.stock)); renderCart(); });
$('#cartItemsList')?.addEventListener('change', e => { const i=e.target.closest('input[data-id]'); if(!i)return; const p=cart.get(Number(i.dataset.id)); p.quantity=Math.max(1,Math.min(Number(p.stock),Number(i.value)||1)); renderCart(); });
async function client() {
  const s=await fetch('/api/sesion'); if(!s.ok)throw new Error('Debes iniciar sesión como cliente para realizar un pedido.'); const {usuario}=await s.json(); if(usuario.rol!=='CLIENTE')throw new Error('Solo una cuenta de cliente puede realizar pedidos.');
  const r=await fetch('/api/clientes/perfil'); const p=await r.json(); if(!r.ok)throw new Error(p.error || 'No se encontró tu perfil.'); return p;
}
async function initializeAccount() {
  try {
    const response = await fetch('/api/sesion');
    if (!response.ok) return;
    const { usuario } = await response.json();
    if (usuario.rol !== 'CLIENTE') return;
    $('#accountButton').hidden = false;
    $('#storeLogout').hidden = false;
  } catch (_) { /* La tienda permanece disponible sin iniciar sesión. */ }
}
$('#accountButton')?.addEventListener('click', async () => {
  try {
    const profile = await client();
    $('#accountName').value = profile.nombre || '';
    $('#accountPhone').value = profile.telefono || '';
    $('#accountAddress').value = profile.direccion || '';
    $('#accountEmail').textContent = profile.correo;
    $('#accountPanel').hidden = false;
  } catch (error) { alert(error.message); }
});
$('#accountForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await fetch('/api/clientes/perfil', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({nombre:$('#accountName').value, telefono:$('#accountPhone').value, direccion:$('#accountAddress').value}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el perfil.');
    alert('Datos actualizados correctamente.');
    $('#accountPanel').hidden = true;
  } catch (error) { alert(error.message); }
});
$('#storeLogout')?.addEventListener('click', async () => { await fetch('/api/logout', {method:'POST'}); sessionStorage.removeItem('nuveUser'); location.assign('/'); });
$('#clientChangePassword')?.addEventListener('click', () => window.openPasswordDialog());
$('#completeOrder')?.addEventListener('click', async () => {
  if (!cart.size) return alert('Agrega al menos un producto al carrito.');
  try {
    const profile = await client();
    const payment = $('#cartPaymentMethod').value;
    const modalidad = $('#cartModalidad').value;
    if (!payment) throw new Error('Selecciona un método de pago en el carrito.');
    if (!modalidad) throw new Error('Selecciona cómo recibirás tu pedido.');
    const response = await fetch('/api/pedidos', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        id_cliente: profile.id_cliente,
        modalidad_pago: modalidad,
        forma_pago: payment,
        productos: [...cart.values()].map(item => ({id_producto:item.id_producto, cantidad:item.quantity}))
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo crear el pedido.');
    alert(`¡Pedido #${data.pedido.id_pedido} creado correctamente!`);
    cart.clear(); renderCart(); $('#cartPanel').hidden = true; await loadCatalog();
  } catch (error) {
    alert(error.message);
    if (error.message.startsWith('Debes iniciar sesión')) location.assign('/');
  }
});
renderCart(); loadCatalog(); initializeAccount();
