window.openPasswordDialog = function () {
  let modal = document.querySelector('#passwordModal');
  if (!modal) {
    modal = document.createElement('div'); modal.id = 'passwordModal'; modal.className = 'password-modal';
    modal.innerHTML = `<section class="password-dialog" role="dialog" aria-modal="true" aria-labelledby="passwordTitle"><h2 id="passwordTitle">Cambiar contraseña</h2><p>Usa una contraseña de al menos 8 caracteres.</p><form><label>Contraseña actual<input name="actual" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="nueva" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirmar nueva contraseña<input name="confirmacion" type="password" minlength="8" autocomplete="new-password" required></label><p class="password-error"></p><div class="password-actions"><button class="password-cancel" type="button">Cancelar</button><button class="password-save" type="submit">Guardar contraseña</button></div></form></section>`;
    document.body.append(modal);
  }
  modal.hidden = false; const form = modal.querySelector('form'); form.reset(); modal.querySelector('.password-error').textContent = '';
  return new Promise(resolve => {
    const close = () => { modal.hidden = true; resolve(); };
    modal.querySelector('.password-cancel').onclick = close;
    modal.onclick = event => { if (event.target === modal) close(); };
    form.onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); const error = modal.querySelector('.password-error'); if (data.nueva !== data.confirmacion) return error.textContent = 'Las contraseñas nuevas no coinciden.'; try { const response = await fetch('/api/mi-cuenta/password', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({password_actual:data.actual,password_nueva:data.nueva})}); const result = await response.json(); if (!response.ok) throw new Error(result.error); close(); alert(result.mensaje); } catch (e) { error.textContent = e.message; } };
  });
};
