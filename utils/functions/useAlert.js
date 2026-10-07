/**
 * ====================================================================
 * LIQ SAAS - CUSTOM ALERT / TOAST SYSTEM (useAlert.js)
 * Sistema de alertas e notificações unificado para toda a plataforma.
 * Estados: Sucesso, Aviso, Erro e Informação.
 * Estilização 100% autônoma via JS, sem poluição de CSS inline no HTML.
 * ====================================================================
 */

const useAlert = (() => {
  let container = null;
  const activeAlerts = new Set();

  const ICONS = {
    sucesso: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    aviso: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    erro: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  const STYLES = `
    .liq-alert-host {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 420px;
      width: calc(100vw - 40px);
      pointer-events: none;
      font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    @media (max-width: 600px) {
      .liq-alert-host {
        top: 16px;
        right: 20px;
        left: 20px;
        width: auto;
      }
    }

    .liq-alert-card {
      pointer-events: auto;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px 16px 14px;
      background-color: #ffffff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 14px rgba(3, 34, 4, 0.10), 0 1px 3px rgba(3, 34, 4, 0.05);
      opacity: 0;
      transform: translateX(30px);
      transition: opacity 220ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .liq-alert-card.liq-alert-enter {
      opacity: 1;
      transform: translateX(0);
    }

    .liq-alert-card.liq-alert-exit {
      opacity: 0;
      transform: translateY(-10px) scale(0.96);
    }

    /* Estado: Sucesso */
    .liq-alert-card.liq-alert-sucesso {
      background-color: #f7fdf9;
      border-color: #a7f3d0;
    }
    .liq-alert-card.liq-alert-sucesso .liq-alert-icon-box {
      color: #149036;
      background-color: #e0fae9;
    }
    .liq-alert-card.liq-alert-sucesso .liq-alert-title {
      color: #032204;
    }
    .liq-alert-card.liq-alert-sucesso .liq-alert-progress {
      background-color: #149036;
    }

    /* Estado: Aviso */
    .liq-alert-card.liq-alert-aviso {
      background-color: #fffdf7;
      border-color: #fde68a;
    }
    .liq-alert-card.liq-alert-aviso .liq-alert-icon-box {
      color: #b45309;
      background-color: #fef3c7;
    }
    .liq-alert-card.liq-alert-aviso .liq-alert-title {
      color: #78350f;
    }
    .liq-alert-card.liq-alert-aviso .liq-alert-progress {
      background-color: #d97706;
    }

    /* Estado: Erro */
    .liq-alert-card.liq-alert-erro {
      background-color: #fefafb;
      border-color: #fecaca;
    }
    .liq-alert-card.liq-alert-erro .liq-alert-icon-box {
      color: #dc2626;
      background-color: #fee2e2;
    }
    .liq-alert-card.liq-alert-erro .liq-alert-title {
      color: #991b1b;
    }
    .liq-alert-card.liq-alert-erro .liq-alert-progress {
      background-color: #dc2626;
    }

    /* Estado: Informação */
    .liq-alert-card.liq-alert-info {
      background-color: #f8fbff;
      border-color: #bfdbfe;
    }
    .liq-alert-card.liq-alert-info .liq-alert-icon-box {
      color: #2563eb;
      background-color: #dbeafe;
    }
    .liq-alert-card.liq-alert-info .liq-alert-title {
      color: #1e3a8a;
    }
    .liq-alert-card.liq-alert-info .liq-alert-progress {
      background-color: #2563eb;
    }

    .liq-alert-icon-box {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .liq-alert-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 2px;
    }

    .liq-alert-title {
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .liq-alert-message {
      font-size: 0.8125rem;
      color: #37513b;
      line-height: 1.45;
      word-break: break-word;
    }

    .liq-alert-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 150ms ease, background-color 150ms ease;
      flex-shrink: 0;
    }

    .liq-alert-close-btn:hover {
      color: #032204;
      background-color: rgba(3, 34, 4, 0.06);
    }

    .liq-alert-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background-color: rgba(0, 0, 0, 0.05);
    }

    .liq-alert-progress {
      height: 100%;
      width: 100%;
      transform-origin: left;
      transition: transform linear;
    }
  `;

  const injectStyles = () => {
    if (document.getElementById('liq-use-alert-style')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'liq-use-alert-style';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  };

  const getHost = () => {
    if (!container || !document.body.contains(container)) {
      injectStyles();
      container = document.createElement('div');
      container.className = 'liq-alert-host';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  };

  const show = ({ type = 'info', title = null, message = '', duration = 4500 }) => {
    const host = getHost();
    const normalizedType = ['sucesso', 'aviso', 'erro', 'info'].includes(type) ? type : 'info';

    const defaultTitles = {
      sucesso: 'Sucesso',
      aviso: 'Atenção',
      erro: 'Aviso Importante',
      info: 'Notificação'
    };

    const finalTitle = title || defaultTitles[normalizedType];

    const card = document.createElement('div');
    card.className = `liq-alert-card liq-alert-${normalizedType}`;
    card.setAttribute('role', 'alert');

    card.innerHTML = `
      <div class="liq-alert-icon-box">
        ${ICONS[normalizedType]}
      </div>
      <div class="liq-alert-body">
        <div class="liq-alert-title">${escape(finalTitle)}</div>
        <div class="liq-alert-message">${escape(message)}</div>
      </div>
      <button type="button" class="liq-alert-close-btn" aria-label="Fechar notificação">
        ${ICONS.close}
      </button>
      <div class="liq-alert-progress-bar">
        <div class="liq-alert-progress"></div>
      </div>
    `;

    host.appendChild(card);
    activeAlerts.add(card);

    // Animação de entrada
    requestAnimationFrame(() => {
      card.classList.add('liq-alert-enter');
    });

    const progressEl = card.querySelector('.liq-alert-progress');
    let startTime = Date.now();
    let remaining = duration;
    let timerId = null;
    let isPaused = false;

    const startProgress = () => {
      if (progressEl) {
        progressEl.style.transitionDuration = `${remaining}ms`;
        progressEl.style.transform = 'scaleX(0)';
      }
      timerId = setTimeout(() => dismiss(), remaining);
    };

    const pauseProgress = () => {
      if (isPaused) return;
      isPaused = true;
      clearTimeout(timerId);
      const elapsed = Date.now() - startTime;
      remaining = Math.max(0, remaining - elapsed);
      if (progressEl) {
        const computedStyle = window.getComputedStyle(progressEl);
        progressEl.style.transition = 'none';
        progressEl.style.transform = computedStyle.transform;
      }
    };

    const resumeProgress = () => {
      if (!isPaused || remaining <= 0) return;
      isPaused = false;
      startTime = Date.now();
      if (progressEl) {
        progressEl.style.transition = `transform ${remaining}ms linear`;
        progressEl.style.transform = 'scaleX(0)';
      }
      timerId = setTimeout(() => dismiss(), remaining);
    };

    const dismiss = () => {
      clearTimeout(timerId);
      card.classList.remove('liq-alert-enter');
      card.classList.add('liq-alert-exit');
      setTimeout(() => {
        if (card.parentNode) card.parentNode.removeChild(card);
        activeAlerts.delete(card);
      }, 240);
    };

    card.querySelector('.liq-alert-close-btn').addEventListener('click', dismiss);
    card.addEventListener('mouseenter', pauseProgress);
    card.addEventListener('mouseleave', resumeProgress);

    if (duration > 0) {
      startProgress();
    } else if (progressEl) {
      progressEl.parentElement.style.display = 'none';
    }

    return { dismiss };
  };

  const escape = (str) => {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  };

  return {
    show,
    sucesso: (message, title = 'Sucesso', duration = 4500) => show({ type: 'sucesso', title, message, duration }),
    success: (message, title = 'Sucesso', duration = 4500) => show({ type: 'sucesso', title, message, duration }),
    aviso: (message, title = 'Aviso', duration = 5000) => show({ type: 'aviso', title, message, duration }),
    warning: (message, title = 'Aviso', duration = 5000) => show({ type: 'aviso', title, message, duration }),
    erro: (message, title = 'Erro', duration = 6000) => show({ type: 'erro', title, message, duration }),
    error: (message, title = 'Erro', duration = 6000) => show({ type: 'erro', title, message, duration }),
    info: (message, title = 'Informação', duration = 4500) => show({ type: 'info', title, message, duration }),
    clearAll: () => {
      activeAlerts.forEach(c => {
        if (c.parentNode) c.parentNode.removeChild(c);
      });
      activeAlerts.clear();
    }
  };
})();
