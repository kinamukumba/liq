/**
 * Panel Switcher Utility (usePanels)
 * Oculta e mostra painéis mantendo o DOM estruturado e sem recarregamento
 */

const usePanels = {
  activePanelId: null,

  show(panelId, navSelector = null) {
    // 1. Ocultar todos os painéis
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => {
      panel.classList.remove('active');
    });

    // 2. Mostrar o painel solicitado
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
      targetPanel.classList.add('active');
      this.activePanelId = panelId;
    }

    // 3. Atualizar link ativo na navegação se fornecido
    if (navSelector) {
      document.querySelectorAll(navSelector).forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-target-panel') === panelId) {
          btn.classList.add('active');
        }
      });
    }
  },

  toggle(elementId, forceState = null) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (forceState !== null) {
      el.classList.toggle('d-none', !forceState);
    } else {
      el.classList.toggle('d-none');
    }
  }
};
