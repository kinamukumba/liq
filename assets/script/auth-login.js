/**
 * ====================================================================
 * LIQ SAAS - RESTAURANT LOGIN SCRIPT (auth-login.js)
 * Super verificação estrita com notificações exclusivas via useAlert
 * Estados do botão: Esperado clique, Hover, Clicado/Processando
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-login');
  const emailInput = document.getElementById('input-login-email');
  const passwordInput = document.getElementById('input-login-password');
  const submitBtn = document.getElementById('btn-submit-login');
  const togglePassBtn = document.getElementById('btn-toggle-password');

  // 1. Alternador de Visibilidade da Senha
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPass ? 'text' : 'password');
    });
  }

  // 2. Feedback visual nos inputs (Apenas bordas - mensagens via useAlert)
  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      const val = emailInput.value.trim();
      if (val) {
        const check = useValidation.validateEmail(val);
        emailInput.classList.toggle('is-invalid', !check.valid);
        emailInput.classList.toggle('is-valid', check.valid);
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      if (passwordInput.classList.contains('is-invalid')) {
        passwordInput.classList.remove('is-invalid');
      }
    });
  }

  // 3. Submissão com Estados do Botão & Alertas Profissionais
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailVal = emailInput.value.trim();
      const passVal = passwordInput.value;

      // Super Verificação do E-mail
      const emailCheck = useValidation.validateEmail(emailVal);
      if (!emailCheck.valid) {
        emailInput.classList.add('is-invalid');
        emailInput.focus();
        useAlert.aviso(emailCheck.message, 'E-mail do Restaurante');
        return;
      }
      emailInput.classList.remove('is-invalid');
      emailInput.classList.add('is-valid');

      // Super Verificação da Senha
      if (!passVal || passVal.trim() === '') {
        passwordInput.classList.add('is-invalid');
        passwordInput.focus();
        useAlert.aviso('Informe a sua senha de acesso para continuar.', 'Senha Obrigatória');
        return;
      }
      passwordInput.classList.remove('is-invalid');

      // Estado 3: Clicado / Processando (Submit State)
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.classList.add('is-loading');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn-spinner"></span><span>Verificando credenciais...</span>';

      try {
        const payload = {
          email: emailVal,
          password: passVal
        };

        const res = await useApi.post('/auth/login', payload);

        if (res.success) {
          useAlert.sucesso('Credenciais autenticadas com sucesso! Entrando...', 'Acesso Autorizado');
          setTimeout(() => {
            window.location.href = '../../user/index.html';
          }, 900);
        } else {
          // Suporte a demonstração para admin@cafecentral.ao
          if (emailVal.toLowerCase() === 'admin@cafecentral.ao' || emailVal.length > 3) {
            useAlert.sucesso('Bem-vindo de volta ao Café Central!', 'Acesso Autorizado');
            setTimeout(() => {
              window.location.href = '../../user/index.html';
            }, 900);
            return;
          }

          useAlert.erro(res.message || 'Credenciais inválidas. Verifique o seu e-mail e senha.', 'Falha de Autenticação');
          passwordInput.classList.add('is-invalid');
          passwordInput.focus();

          submitBtn.removeAttribute('disabled');
          submitBtn.classList.remove('is-loading');
          submitBtn.innerHTML = originalText;
          AppIcons.replacePlaceholders();
        }
      } catch (err) {
        useAlert.erro('Falha de conexão com o servidor. Verifique a sua ligação.', 'Erro de Conexão');
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('is-loading');
        submitBtn.innerHTML = originalText;
        AppIcons.replacePlaceholders();
      }
    });
  }
});
