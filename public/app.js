const form = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const message = document.querySelector('#message');
const destinations = { ADMIN: '/admin/', EMPLEADO: '/empleado/', CLIENTE: '/cliente/' };

async function comprobarSesion() {
  try {
    const response = await fetch('/api/sesion');
    if (response.ok) {
      const { usuario } = await response.json();
      sessionStorage.setItem('nuveUser', JSON.stringify(usuario));
      window.location.replace(destinations[usuario.rol] || '/cliente/');
      return;
    }
  } catch (_) {
    // Si el servidor no está disponible, se muestra el formulario para informar al usuario.
  }
  document.body.classList.remove('app-loading');
}

comprobarSesion();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = 'Verificando…';
  const data = Object.fromEntries(new FormData(form));
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión');
    sessionStorage.setItem('nuveUser', JSON.stringify(result.usuario));
    window.location.assign(destinations[result.usuario.rol] || '/cliente/');
  } catch (error) { message.textContent = error.message; }
});

function showLoginOrRegister(registering) {
  registerForm.hidden = !registering;
  form.hidden = registering;
  document.querySelector('#formTitle').textContent = registering ? 'Crea tu cuenta' : 'Inicia sesión';
  document.querySelector('#formDescription').textContent = registering ? 'Podrás comprar y consultar tus pedidos.' : 'Accede según tu perfil.';
  document.querySelector('#switchText').innerHTML = registering
    ? '¿Ya tienes cuenta? <button class="link-button" id="showLogin" type="button">Iniciar sesión</button>'
    : '¿Aún no tienes cuenta? <button class="link-button" id="showRegister" type="button">Crear cuenta</button>';
  document.querySelector('#showRegister')?.addEventListener('click', () => showLoginOrRegister(true));
  document.querySelector('#showLogin')?.addEventListener('click', () => showLoginOrRegister(false));
}

document.querySelector('#showRegister')?.addEventListener('click', () => showLoginOrRegister(true));

document.querySelectorAll('.toggle-password').forEach((button) => button.addEventListener('click', () => {
  const input = button.closest('.password-field').querySelector('input');
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  button.textContent = visible ? 'Ver' : 'Ocultar';
}));

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = 'Creando cuenta…';
  try {
    const response = await fetch('/api/clientes/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(registerForm))) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo crear la cuenta');
    sessionStorage.setItem('nuveUser', JSON.stringify(result.usuario));
    window.location.assign('/cliente/');
  } catch (error) { message.textContent = error.message; }
});
