/**
 * ====================================================================
 * LIQ SAAS - OTP CONTROLLER (auth-otp.js)
 * Controle de foco de dígitos, colagem, temporizador de 10min,
 * notificações exclusivas via useAlert e estados do botão submit
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-otp');
  const digits = Array.from(document.querySelectorAll('.otp-digit'));
  const timerText = document.getElementById('otp-countdown-text');
  const resendBtn = document.getElementById('btn-resend-otp');
  const submitBtn = document.getElementById('btn-submit-otp');
  const flowStepTag = document.getElementById('otp-flow-step-tag');

  const params = new URLSearchParams(window.location.search);
  const currentFlow = params.get('flow') || 'register';

  if (flowStepTag && currentFlow === 'recovery') {
    flowStepTag.textContent = 'Recuperação de Senha \u2022 Verificação de Segurança';
  }

  // 1. Temporizador Regressivo de 10 Minutos (600 segundos)
  let remainingSeconds = 600;
  let timerInterval = null;

  const updateTimer = () => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    if (timerText) {
      timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    if (remainingSeconds > 0) {
      remainingSeconds--;
    } else {
      clearInterval(timerInterval);
      useAlert.erro('O código de 10 minutos expirou. Clique em "Reenviar código" para receber um novo.', 'Código Expirado');
      if (submitBtn) submitBtn.setAttribute('disabled', 'disabled');
    }
  };

  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);

  // 2. Navegação Automática e Tratamento de Dígitos
  digits.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.length >= 1) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        if (index < digits.length - 1) {
          digits[index + 1].focus();
        }
      } else {
        input.classList.remove('is-valid');
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        digits[index - 1].focus();
      }
    });

    // Suporte a colar código completo de 6 dígitos
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pasteData)) {
        pasteData.split('').forEach((char, i) => {
          if (digits[i]) {
            digits[i].value = char;
            digits[i].classList.remove('is-invalid');
            digits[i].classList.add('is-valid');
          }
        });
        digits[digits.length - 1].focus();
      }
    });
  });

  // 3. Reenvio de Código
  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      remainingSeconds = 600;
      if (submitBtn) submitBtn.removeAttribute('disabled');
      digits.forEach(d => {
        d.value = '';
        d.classList.remove('is-invalid', 'is-valid');
      });
      digits[0].focus();
      clearInterval(timerInterval);
      timerInterval = setInterval(updateTimer, 1000);
      updateTimer();

      useAlert.sucesso('Um novo código de verificação de 6 dígitos foi gerado e enviado!', 'Código Reenviado');
    });
  }

  // 4. Submissão do OTP
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const otpCode = digits.map(d => d.value).join('');

      if (otpCode.length < 6) {
        digits.forEach(d => {
          if (!d.value) d.classList.add('is-invalid');
        });
        const firstEmpty = digits.find(d => !d.value);
        if (firstEmpty) firstEmpty.focus();
        useAlert.aviso('Por favor, preencha todos os 6 dígitos do código de segurança.', 'Código Incompleto');
        return;
      }

      // Estado 3 do Botão: Clicado / Processando
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.classList.add('is-loading');
      const originalBtnContent = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn-spinner"></span><span>Validando código OTP...</span>';

      setTimeout(() => {
        clearInterval(timerInterval);

        if (currentFlow === 'recovery') {
          // Token com validade de 10 min para criação de nova senha
          const token = 'tok_' + Math.random().toString(36).substring(2, 10);
          useAlert.sucesso('Código confirmado! Prossiga para redefinir sua senha.', 'Acesso Liberado');
          setTimeout(() => {
            window.location.href = `../new-password/index.html?token=${token}`;
          }, 800);
        } else {
          // Fluxo de registro concluído
          useAlert.sucesso('Restaurante verificado com sucesso! Abrindo o painel...', 'Bem-vindo ao LIQ');
          setTimeout(() => {
            window.location.href = '../../user/index.html';
          }, 800);
        }
      }, 700);
    });
  }
});
