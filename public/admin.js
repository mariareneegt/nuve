const user = JSON.parse(sessionStorage.getItem('nuveUser') || 'null');
if (user && user.rol !== 'ADMIN') window.location.replace('/');
document.querySelector('#userName').textContent = user?.nombre || 'administrador';
document.querySelector('#logout').onclick = async () => {
  await fetch('/api/logout', { method: 'POST' });
  sessionStorage.removeItem('nuveUser');
  location.assign('/');
};
document.querySelector('#changePassword').onclick = () => window.openPasswordDialog();
const money = (value) => new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value || 0));
const states = ['PENDIENTE','CONFIRMADO','EN PREPARACION','LISTO','EN CAMINO','ENTREGADO','CANCELADO'];
const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[character]));

async function request(url, options) { const res = await fetch(url, options); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los datos'); return data; }
async function load() {
  try {
    const [dashboard, orders, inventory] = await Promise.all([request('/api/dashboard'), request('/api/pedidos'), request('/api/inventario')]);
    document.querySelector('#sales').textContent = money(dashboard.total_ventas);
    document.querySelector('#orders').textContent = dashboard.total_pedidos;
    document.querySelector('#products').textContent = dashboard.total_productos;
    document.querySelector('#clients').textContent = dashboard.total_clientes;
    document.querySelector('#updated').textContent = `Actualizado: ${new Date().toLocaleString('es-GT')}`;
    const body = document.querySelector('#ordersBody'); body.innerHTML = '';
    if (!orders.length) body.append(document.querySelector('#empty').content.cloneNode(true));
    orders.slice(0, 8).forEach(order => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>#${order.id_pedido}</td><td>${order.cliente}</td><td>${money(order.total)}</td><td><span class="status" data-state="${order.estado_pedido}">${order.estado_pedido}</span></td><td><select class="state-select" data-id="${order.id_pedido}">${states.map(state => `<option ${state === order.estado_pedido ? 'selected' : ''}>${state}</option>`).join('')}</select></td>`;
      body.append(row);
    });
    const list = document.querySelector('#inventory'); list.innerHTML = '';
    inventory.slice(0, 8).forEach(item => { const low = Number(item.stock) <= Number(item.stock_minimo); list.insertAdjacentHTML('beforeend', `<li><span>${item.producto}<small>${item.categoria}</small></span><b class="${low ? 'low' : ''}">${item.stock} en stock</b></li>`); });
  } catch (error) { document.querySelector('#updated').textContent = error.message; }
}
async function loadUsers() {
  try {
    const users = await request('/api/usuarios');
    document.querySelector('#usersBody').innerHTML = users.map(item => `<tr><td>${escapeHtml(item.nombre)}</td><td>${escapeHtml(item.correo)}</td><td>${escapeHtml(item.estado)}</td><td><span class="role-badge">${escapeHtml(item.rol)}</span></td></tr>`).join('') || '<tr><td colspan="4">No hay usuarios.</td></tr>';
  } catch (error) { alert(error.message); }
}
document.querySelector('#refresh').onclick = load;
document.querySelector('#refreshUsers').onclick = loadUsers;
async function loadProductsAdmin() {
  try {
    const products = await request('/api/admin/productos');
    document.querySelector('#productsAdminBody').innerHTML = products.map(product => `<tr><td>${product.nombre}</td><td class="product-category">${product.categoria}</td><td><input class="product-price" data-id="${product.id_producto}" type="number" min="0" step="0.01" value="${product.precio}"></td><td>${product.stock}</td><td><input class="product-stock" data-id="${product.id_producto}" type="number" min="0" value="0"></td><td><select class="product-state" data-id="${product.id_producto}"><option ${product.estado === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option><option ${product.estado === 'INACTIVO' ? 'selected' : ''}>INACTIVO</option></select></td><td><button class="save-product" data-id="${product.id_producto}">Guardar</button></td></tr>`).join('');
  } catch (error) { alert(error.message); }
}
document.querySelector('#refreshProducts').onclick = loadProductsAdmin;
document.querySelector('#productsAdminBody').addEventListener('click', async (event) => { const button = event.target.closest('.save-product'); if (!button) return; const id = button.dataset.id; try { await request(`/api/admin/productos/${id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({precio:document.querySelector(`.product-price[data-id="${id}"]`).value, sumar_stock:Number(document.querySelector(`.product-stock[data-id="${id}"]`).value || 0), estado:document.querySelector(`.product-state[data-id="${id}"]`).value})}); await loadProductsAdmin(); await load(); } catch (error) { alert(error.message); } });
const staffForm = document.querySelector('#staffForm');
const staffRole = document.querySelector('#staffRole');
const staffMessage = document.querySelector('#staffMessage');
function updateStaffFields() {
  const isEmployee = staffRole.value === 'EMPLEADO';
  document.querySelectorAll('.employee-only').forEach(field => field.hidden = !isEmployee);
  document.querySelector('#staffPosition').required = isEmployee;
}
staffRole.addEventListener('change', updateStaffFields);
staffForm.addEventListener('submit', async event => {
  event.preventDefault();
  staffMessage.textContent = 'Creando cuenta…';
  staffMessage.classList.remove('error');
  try {
    const result = await request('/api/admin/usuarios', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(Object.fromEntries(new FormData(staffForm))) });
    staffMessage.textContent = result.mensaje;
    staffForm.reset();
    updateStaffFields();
    await Promise.all([loadUsers(), load()]);
  } catch (error) {
    staffMessage.textContent = error.message;
    staffMessage.classList.add('error');
  }
});
document.querySelector('#ordersBody').addEventListener('change', async (event) => { if (!event.target.matches('.state-select')) return; try { await request(`/api/pedidos/${event.target.dataset.id}/estado`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({estado_pedido:event.target.value}) }); await load(); } catch (error) { alert(error.message); } });
document.querySelectorAll('.admin-nav-item').forEach(button => button.addEventListener('click', () => {
  const view = button.dataset.adminView;
  document.querySelectorAll('.admin-nav-item').forEach(item => item.classList.toggle('active', item === button));
  document.querySelectorAll('.admin-view').forEach(section => section.classList.toggle('active', section.id === `admin-view-${view}`));
  if (view === 'usuarios') loadUsers();
  if (view === 'productos') loadProductsAdmin();
}));
load();
loadUsers();
loadProductsAdmin();
updateStaffFields();
