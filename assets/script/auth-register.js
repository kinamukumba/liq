/**
 * ====================================================================
 * LIQ SAAS - RESTAURANT REGISTER SCRIPT (auth-register.js)
 * Super verificação estrita de cadastro, medidor de força de senha,
 * notificações exclusivas via useAlert e estados completos do botão submit
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-register');
  const nameInput = document.getElementById('input-reg-name');
  const emailInput = document.getElementById('input-reg-email');
  const phoneInput = document.getElementById('input-reg-phone');
  const locationInput = document.getElementById('input-reg-location');
  const passwordInput = document.getElementById('input-reg-password');
  const passStrengthMeter = document.getElementById('password-strength-meter');
  const passStrengthHint = document.getElementById('password-strength-hint');
  const submitBtn = document.getElementById('btn-submit-register');
  // 0. Pré-preenchimento do rascunho vindo da landing page
  const savedDraft = sessionStorage.getItem('liq_reg_draft');
  if (savedDraft) {
    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed.email && emailInput) {
        emailInput.value = parsed.email;
        emailInput.classList.add('is-valid');
      }
    } catch (e) {
      // Ignora erro de parse
    }
  }

  // 1. Toggle de Visibilidade da Senha
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPass ? 'text' : 'password');
    });
  }

  // 2. Medidor de Força da Senha em Tempo Real
  if (passwordInput && passStrengthMeter && passStrengthHint) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      const res = useValidation.validatePassword(val);

      passStrengthMeter.className = 'password-strength-fill';

      if (!val) {
        passStrengthHint.textContent = 'A senha deve ter pelo menos 8 caracteres.';
        return;
      }

      if (res.strength === 'weak') {
        passStrengthMeter.classList.add('strength-weak');
        passStrengthHint.textContent = 'Senha fraca (adicione letras maiúsculas, números ou símbolos).';
      } else if (res.strength === 'medium') {
        passStrengthMeter.classList.add('strength-medium');
        passStrengthHint.textContent = 'Senha média (adicione símbolos para maior proteção).';
      } else if (res.strength === 'strong') {
        passStrengthMeter.classList.add('strength-strong');
        passStrengthHint.textContent = 'Senha forte e segura!';
      }
    });
  }

  // 3. Feedback visual dinâmico nos inputs
  const setupFieldValidation = (input, validator) => {
    if (!input) return;
    input.addEventListener('blur', () => {
      const val = input.value.trim();
      if (val) {
        const res = validator(val);
        input.classList.toggle('is-invalid', !res.valid);
        input.classList.toggle('is-valid', res.valid);
      }
    });
    input.addEventListener('input', () => {
      if (input.classList.contains('is-invalid')) {
        input.classList.remove('is-invalid');
      }
    });
  };

  setupFieldValidation(nameInput, (val) => ({
    valid: val && val.length >= 3,
    message: 'O nome do restaurante deve ter pelo menos 3 caracteres.'
  }));
  setupFieldValidation(emailInput, (val) => useValidation.validateEmail(val));
  setupFieldValidation(phoneInput, (val) => useValidation.validatePhone(val));
  setupFieldValidation(locationInput, (val) => useValidation.validateRequired(val, 'A localização'));

  // 4. Submissão do Formulário com Alertas useAlert & Estados do Botão
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameVal = nameInput.value.trim();
      const emailVal = emailInput.value.trim();
      const phoneVal = phoneInput.value.trim();
      const locVal = locationInput.value.trim();
      const passVal = passwordInput.value;

      // Validação: Nome do Restaurante
      if (!nameVal || nameVal.length < 3) {
        nameInput.classList.add('is-invalid');
        nameInput.focus();
        useAlert.aviso('O nome do restaurante deve ter pelo menos 3 caracteres.', 'Nome do Restaurante');
        return;
      }
      nameInput.classList.remove('is-invalid');
      nameInput.classList.add('is-valid');

      // Validação: E-mail Corporativo
      const emailRes = useValidation.validateEmail(emailVal);
      if (!emailRes.valid) {
        emailInput.classList.add('is-invalid');
        emailInput.focus();
        useAlert.aviso(emailRes.message, 'E-mail de Contato');
        return;
      }
      emailInput.classList.remove('is-invalid');
      emailInput.classList.add('is-valid');

      // Validação: Telefone / WhatsApp
      const phoneRes = useValidation.validatePhone(phoneVal);
      if (!phoneRes.valid) {
        phoneInput.classList.add('is-invalid');
        phoneInput.focus();
        useAlert.aviso(phoneRes.message, 'Telefone / WhatsApp');
        return;
      }
      phoneInput.classList.remove('is-invalid');
      phoneInput.classList.add('is-valid');

      // Validação: Localização
      const locRes = useValidation.validateRequired(locVal, 'A localização');
      if (!locRes.valid) {
        locationInput.classList.add('is-invalid');
        locationInput.focus();
        useAlert.aviso(locRes.message, 'Localização');
        return;
      }
      locationInput.classList.remove('is-invalid');
      locationInput.classList.add('is-valid');

      // Validação: Senha
      const passRes = useValidation.validatePassword(passVal);
      if (!passRes.valid) {
        passwordInput.classList.add('is-invalid');
        passwordInput.focus();
        useAlert.aviso(passRes.message, 'Senha de Acesso');
        return;
      }
      passwordInput.classList.remove('is-invalid');

      // Estado 3 do Botão: Clicado / Processando
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.classList.add('is-loading');
      const originalBtnContent = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn-spinner"></span><span>Cadastrando restaurante...</span>';

      try {
        // Armazena dados no rascunho de sessão
        const regData = {
          name: nameVal,
          email: emailVal,
          phone: phoneVal,
          location: locVal,
          password: passVal
        };
        sessionStorage.setItem('liq_reg_draft', JSON.stringify(regData));

        useAlert.sucesso('Cadastro preliminar validado! Direcionando para calibração operacional...', 'Sucesso');

        setTimeout(() => {
          window.location.href = '../onboard/index.html';
        }, 900);
      } catch (err) {
        useAlert.erro('Ocorreu um erro inesperado ao salvar os dados. Tente novamente.', 'Erro Operacional');
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('is-loading');
        submitBtn.innerHTML = originalBtnContent;
        AppIcons.replacePlaceholders();
      }
    });
  }
});
