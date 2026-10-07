/**
 * ====================================================================
 * LIQ SAAS - VALIDATION UTILITY (useValidation.js)
 * Super verificação estrita de campos no frontend
 * ====================================================================
 */

const useValidation = {
  // Regex oficial para emails conforme padrão RFC
  emailRegex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // Validação de telefone (suporta formato angolano +244 e geral)
  phoneRegex: /^(?:\+244\s?)?(?:9\d{8}|2\d{8})$|^(\+?\d{8,15})$/,

  validateEmail(email) {
    if (!email || email.trim() === '') {
      return { valid: false, message: 'O e-mail é obrigatório.' };
    }
    const clean = email.trim();
    if (!this.emailRegex.test(clean)) {
      return { valid: false, message: 'Por favor, insira um formato de e-mail válido (ex: nome@restaurante.ao).' };
    }
    return { valid: true, message: '' };
  },

  validatePhone(phone) {
    if (!phone || phone.trim() === '') {
      return { valid: false, message: 'O telefone/WhatsApp é obrigatório.' };
    }
    const clean = phone.replace(/[\s\-\(\)]/g, '');
    if (!this.phoneRegex.test(clean)) {
      return { valid: false, message: 'Insira um número de telefone válido (ex: +244 923 000 111).' };
    }
    return { valid: true, message: '' };
  },

  validatePassword(password) {
    if (!password) {
      return { valid: false, strength: 'empty', message: 'A senha é obrigatória.' };
    }

    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    let score = 0;
    if (minLength) score++;
    if (hasUpper) score++;
    if (hasLower) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;

    let strength = 'weak';
    if (score >= 4) {
      strength = 'strong';
    } else if (score >= 3) {
      strength = 'medium';
    }

    if (!minLength) {
      return { valid: false, strength, message: 'A senha deve conter no mínimo 8 caracteres.' };
    }
    if (!hasNumber || (!hasUpper && !hasLower)) {
      return { valid: false, strength, message: 'A senha deve conter letras e números.' };
    }

    return { valid: true, strength, message: '' };
  },

  validateRequired(value, fieldLabel = 'Este campo') {
    if (!value || value.trim() === '') {
      return { valid: false, message: `${fieldLabel} é obrigatório.` };
    }
    return { valid: true, message: '' };
  },

  validateMatch(val1, val2, errorMsg = 'Os valores não coincidem.') {
    if (val1 !== val2) {
      return { valid: false, message: errorMsg };
    }
    return { valid: true, message: '' };
  },

  // Vincula validação visual em tempo real em um input
  bindFieldValidation(inputId, errorId, validateFn) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (!input || !errorEl) return;

    const runValidation = () => {
      const res = validateFn(input.value);
      if (!res.valid) {
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
        errorEl.textContent = res.message;
        errorEl.classList.remove('d-none');
        return false;
      } else {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        errorEl.textContent = '';
        errorEl.classList.add('d-none');
        return true;
      }
    };

    input.addEventListener('blur', runValidation);
    input.addEventListener('input', () => {
      if (input.classList.contains('is-invalid')) {
        runValidation();
      }
    });

    return runValidation;
  }
};
