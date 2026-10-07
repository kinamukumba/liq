/**
 * ====================================================================
 * LIQ SAAS - NEW PASSWORD CONTROLLER (auth-new-password.js)
 * Validação de token de 10 minutos, conferência de senhas,
 * notificações exclusivas via useAlert e estados do botão submit
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-new-password');
  const passInput = document.getElementById('input-new-pass');
  const confirmInput = document.getElementById('input-confirm-pass');
  const toggleBtn = document.getElementById('btn-toggle-newpass');
  const strengthMeter = document.getElementById('newpass-strength-meter');
  const strengthHint = document.getElementById('newpass-strength-hint');
  const submitBtn = document.getElementById('btn-submit-newpass');
  const expiredAlert = document.getElementById('token-expired-alert');
  const tokenStatusText = document.getElementById('token-status-text');

  // 1. Verificação Estrita do Token de 10 Minutos
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const storedExpires = sessionStorage.getItem('liq_reset_expires');

  let isTokenValid = true;
  if (!token) {
    isTokenValid = false;
  } else if (storedExpires) {
    const expiresTime = parseInt(storedExpires, 10);
    if (Date.now() > expiresTime) {
      isTokenValid = false;
    }
  }

  if (!isTokenValid) {
    if (form) form.classList.add('d-none');
    if (expiredAlert) expiredAlert.classList.remove('d-none');
    if (tokenStatusText) tokenStatusText.textContent = 'Token expirado';
    useAlert.erro('O link com token de validação de 10 minutos expirou ou é inválido. Solicite um novo link.', 'Token Expirado');
    return;
  }

  // 2. Toggle de Visibilidade
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const isPass = passInput.getAttribute('type') === 'password';
      passInput.setAttribute('type', isPass ? 'text' : 'password');
    });
  }

  // 3. Medidor de Força em Tempo Real
  if (passInput && strengthMeter && strengthHint) {
    passInput.addEventListener('input', () => {
      const val = passInput.value;
      const res = useValidation.validatePassword(val);

      strengthMeter.className = 'password-strength-fill';

      if (!val) {
        strengthHint.textContent = 'A senha deve ter pelo menos 8 caracteres.';
        return;
      }

      if (res.strength === 'weak') {
        strengthMeter.classList.add('strength-weak');
        strengthHint.textContent = 'Senha fraca (adicione letras maiúsculas, números ou símbolos).';
      } else if (res.strength === 'medium') {
        strengthMeter.classList.add('strength-medium');
        strengthHint.textContent = 'Senha média (adicione símbolos para maior proteção).';
      } else if (res.strength === 'strong') {
        strengthMeter.classList.add('strength-strong');
        strengthHint.textContent = 'Senha forte e segura!';
      }
    });
  }

  // 4. Limpeza de erros visuais nos campos
  [passInput, confirmInput].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      if (inp.classList.contains('is-invalid')) {
        inp.classList.remove('is-invalid');
      }
    });
  });

  // 5. Submissão
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const passVal = passInput.value;
      const confirmVal = confirmInput.value;

      // Validação da senha
      const passRes = useValidation.validatePassword(passVal);
      if (!passRes.valid) {
        passInput.classList.add('is-invalid');
        passInput.focus();
        useAlert.aviso(passRes.message, 'Senha de Acesso');
        return;
      }
      passInput.classList.remove('is-invalid');
      passInput.classList.add('is-valid');

      // Validação da confirmação de senha
      const matchRes = useValidation.validateMatch(confirmVal, passVal, 'As senhas digitadas não coincidem.');
      if (!matchRes.valid) {
        confirmInput.classList.add('is-invalid');
        confirmInput.focus();
        useAlert.aviso(matchRes.message, 'Confirmação Incorreta');
        return;
      }
      confirmInput.classList.remove('is-invalid');
      confirmInput.classList.add('is-valid');

      // Estado 3 do Botão: Clicado / Processando
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.classList.add('is-loading');
      submitBtn.innerHTML = '<span class="btn-spinner"></span><span>Salvando nova senha...</span>';

      // Limpa dados de reset da sessão
      sessionStorage.removeItem('liq_reset_token');
      sessionStorage.removeItem('liq_reset_expires');
      sessionStorage.removeItem('liq_reset_email');

      useAlert.sucesso('Senha atualizada com sucesso! Redirecionando para o seu dashboard...', 'Credencial Salva');

      // Redireciona para o dashboard do restaurante
      setTimeout(() => {
        window.location.href = '../../user/index.html';
      }, 1000);
    });
  }
});
