/**
 * ====================================================================
 * LIQ SAAS - RESEND PASSWORD CONTROLLER (auth-resend.js)
 * Verificação de existência na base e geração de token de 10min
 * Notificações unificadas via useAlert e estados completos do botão
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-resend');
  const emailInput = document.getElementById('input-resend-email');
  const submitBtn = document.getElementById('btn-submit-resend');
  const successBox = document.getElementById('resend-success-box');
  const simulateEmailLink = document.getElementById('link-simulate-email-click');

  // Feedback visual no input
  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      const val = emailInput.value.trim();
      if (val) {
        const check = useValidation.validateEmail(val);
        emailInput.classList.toggle('is-invalid', !check.valid);
        emailInput.classList.toggle('is-valid', check.valid);
      }
    });

    emailInput.addEventListener('input', () => {
      if (emailInput.classList.contains('is-invalid')) {
        emailInput.classList.remove('is-invalid');
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (successBox) successBox.classList.add('d-none');

      const email = emailInput.value.trim().toLowerCase();
      const emailCheck = useValidation.validateEmail(email);

      if (!emailCheck.valid) {
        emailInput.classList.add('is-invalid');
        emailInput.focus();
        useAlert.aviso(emailCheck.message, 'E-mail do Restaurante');
        return;
      }
      emailInput.classList.remove('is-invalid');
      emailInput.classList.add('is-valid');

      // Estado 3 do Botão: Clicado / Processando
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.classList.add('is-loading');
      const originalBtnContent = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn-spinner"></span><span>Consultando base de dados...</span>';

      try {
        // Tenta validação via API backend
        const res = await useApi.post('/auth/verify-email', { email });

        // Lista de e-mails conhecidos para demonstração ou resposta do backend
        const knownEmails = [
          'admin@cafecentral.ao', 
          'staff@cafecentral.ao', 
          'contato@cafecentral.ao', 
          'gestor@restaurante.ao'
        ];
        const isRegistered = (res && res.success && res.registered) || knownEmails.includes(email);

        if (!isRegistered) {
          // REGRA ESTRITA: Se o e-mail não estiver cadastrado na base de dados, a plataforma DEVE BARRAR!
          emailInput.classList.add('is-invalid');
          emailInput.focus();
          useAlert.erro(`O e-mail "${email}" não consta na base de dados de restaurantes ativos. Operação barrada por motivos de segurança.`, 'Acesso Não Localizado');

          submitBtn.removeAttribute('disabled');
          submitBtn.classList.remove('is-loading');
          submitBtn.innerHTML = originalBtnContent;
          AppIcons.replacePlaceholders();
          return;
        }

        // Gera token temporário de 10 minutos
        const resetToken = 't10m_' + Math.random().toString(36).substring(2, 12);
        const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutos

        // Armazena no sessionStorage para validação estrita na página de nova senha
        sessionStorage.setItem('liq_reset_token', resetToken);
        sessionStorage.setItem('liq_reset_email', email);
        sessionStorage.setItem('liq_reset_expires', String(expiresAt));

        useAlert.sucesso('E-mail verificado! Link de redefinição com validade de 10 minutos emitido.', 'Link Enviado');

        // Exibe box informativo e link simulado
        if (successBox) {
          successBox.classList.remove('d-none');
        }

        if (simulateEmailLink) {
          const targetUrl = `../new-password/index.html?token=${resetToken}`;
          simulateEmailLink.setAttribute('href', targetUrl);
        }

        form.classList.add('d-none');
      } catch (err) {
        useAlert.erro('Não foi possível conectar ao servidor. Tente novamente mais tarde.', 'Erro de Conexão');
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('is-loading');
        submitBtn.innerHTML = originalBtnContent;
        AppIcons.replacePlaceholders();
      }
    });
  }
});
