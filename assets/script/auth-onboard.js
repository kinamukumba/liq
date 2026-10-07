/**
 * ====================================================================
 * LIQ SAAS - ONBOARDING CONTROLLER (auth-onboard.js)
 * Gerenciamento de escolhas, calibração de perfil do restaurante,
 * notificações exclusivas via useAlert e estados do botão submit
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-onboard');
  const tablesSelect = document.getElementById('select-tables-capacity');
  const cuisineSelect = document.getElementById('select-cuisine-type');
  const submitBtn = document.getElementById('btn-submit-onboard');

  // Gerenciamento de Cards Selecionáveis
  const setupChoiceGroup = (groupId) => {
    const group = document.getElementById(groupId);
    if (!group) return;

    group.querySelectorAll('.onboard-choice-card').forEach(card => {
      card.addEventListener('click', () => {
        group.querySelectorAll('.onboard-choice-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  };

  setupChoiceGroup('group-pos-system');
  setupChoiceGroup('group-loyalty-activation');

  // Limpa estado de erro ao interagir com selects
  [tablesSelect, cuisineSelect].forEach(select => {
    if (!select) return;
    select.addEventListener('change', () => {
      if (select.value) {
        select.classList.remove('is-invalid');
        select.classList.add('is-valid');
      }
    });
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!tablesSelect.value) {
        tablesSelect.classList.add('is-invalid');
        tablesSelect.focus();
        useAlert.aviso('Selecione a capacidade de mesas do seu estabelecimento.', 'Capacidade de Mesas');
        return;
      }
      tablesSelect.classList.remove('is-invalid');
      tablesSelect.classList.add('is-valid');

      if (!cuisineSelect.value) {
        cuisineSelect.classList.add('is-invalid');
        cuisineSelect.focus();
        useAlert.aviso('Selecione o segmento culinário principal do restaurante.', 'Segmento Gastronômico');
        return;
      }
      cuisineSelect.classList.remove('is-invalid');
      cuisineSelect.classList.add('is-valid');

      const selectedPos = document.querySelector('#group-pos-system .onboard-choice-card.selected');
      const selectedLoyalty = document.querySelector('#group-loyalty-activation .onboard-choice-card.selected');

      // Estado 3 do Botão: Clicado / Processando
      submitBtn.setAttribute('disabled', 'disabled');
      submitBtn.classList.add('is-loading');
      const originalBtnContent = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn-spinner"></span><span>Salvando preferências...</span>';

      const onboardData = {
        posSystem: selectedPos ? selectedPos.getAttribute('data-val') : 'none',
        tablesCapacity: tablesSelect.value,
        cuisineType: cuisineSelect.value,
        loyaltyActive: selectedLoyalty ? selectedLoyalty.getAttribute('data-val') === 'active' : true
      };

      sessionStorage.setItem('liq_onboard_answers', JSON.stringify(onboardData));

      useAlert.sucesso('Perfil operacional configurado! Emitindo código de verificação OTP...', 'Configuração Concluída');

      setTimeout(() => {
        window.location.href = '../otp/index.html?flow=register';
      }, 900);
    });
  }
});
