/**
 * ====================================================================
 * LIQ SAAS - LANDING PAGE SCRIPT (landing.js)
 * Interatividade da Landing Page Completa:
 * - Menu Hamburger Mobile & Dropdown com Efeito de Vidro
 * - Toggle de planos de preços (Mensal / Anual)
 * - FAQ Accordion dinâmico
 * - Smooth scroll para âncoras (#funcionalidades, #precos, #faq)
 * - Animação 3D Tilt dinâmica no hero-img.png conforme o mouse se move
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 0. Redirecionamento rápido se acessado via app.liq.ao na raiz
  if (window.location.hostname.startsWith('app.liq.ao')) {
    window.location.replace('/auth/login/index.html');
    return;
  }

  // 1. FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });

  // 2. Toggle de Preços (Mensal vs Anual)
  const pricingToggle = document.getElementById('pricing-plan-toggle');
  const priceStarter = document.getElementById('price-val-starter');
  const pricePro = document.getElementById('price-val-pro');

  if (pricingToggle && priceStarter && pricePro) {
    pricingToggle.addEventListener('click', () => {
      const isAnnual = pricingToggle.classList.toggle('active');
      if (isAnnual) {
        priceStarter.innerHTML = '14.450,00 AKZ <span>/ Mês (Anual -15%)</span>';
        pricePro.innerHTML = '39.730,00 AKZ <span>/ Mês (Anual -15%)</span>';
        useAlert.info('Exibindo valores com 15% de desconto no plano anual.', 'Faturamento Anual');
      } else {
        priceStarter.innerHTML = '17.000,00 AKZ <span>/ Mês</span>';
        pricePro.innerHTML = '46.750,00 AKZ <span>/ Mês</span>';
        useAlert.info('Exibindo faturamento mensal sem fidelidade.', 'Faturamento Mensal');
      }
    });
  }

  // 3. Smooth scroll para os links do header
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // 4. Animação 3D Tilt no hero-img.png dependendo de onde o mouse está sobre a imagem
  const heroContainer = document.getElementById('hero-mockup-container');
  const heroImg = document.getElementById('hero-mockup-img');

  if (heroContainer && heroImg) {
    let isTicking = false;

    heroContainer.addEventListener('mousemove', (e) => {
      if (!isTicking) {
        requestAnimationFrame(() => {
          const rect = heroContainer.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          // Normalização entre -1 e +1
          const normX = Math.max(-1, Math.min(1, (mouseX - centerX) / centerX));
          const normY = Math.max(-1, Math.min(1, (mouseY - centerY) / centerY));

          // Cálculo dos ângulos de inclinação 3D
          const rotateX = (-normY * 16).toFixed(2);
          const rotateY = (normX * 16).toFixed(2);

          // Efeito de sombra dinâmica coerente com a inclinação
          const shadowX = (-normX * 18).toFixed(1);
          const shadowY = (24 - normY * 12).toFixed(1);

          heroImg.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
          heroImg.style.filter = `drop-shadow(${shadowX}px ${shadowY}px 48px rgba(3, 34, 4, 0.22))`;
          isTicking = false;
        });
        isTicking = true;
      }
    });

    heroContainer.addEventListener('mouseleave', () => {
      heroImg.style.transition = 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), filter 600ms ease';
      heroImg.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      heroImg.style.filter = 'drop-shadow(0 20px 45px rgba(3, 34, 4, 0.18))';
      setTimeout(() => {
        heroImg.style.transition = 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1), filter 160ms ease';
      }, 600);
    });

    heroContainer.addEventListener('mouseenter', () => {
      heroImg.style.transition = 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1), filter 160ms ease';
    });
  }

  // 5. Menu Hamburger e Dropdown Mobile com Vidro Desfocado
  const mobileToggleBtn = document.getElementById('btn-mobile-menu-toggle');
  const mobileDropdown = document.getElementById('mobile-nav-dropdown');

  if (mobileToggleBtn && mobileDropdown) {
    const toggleMobileMenu = (forceOpen = null) => {
      const isOpen = forceOpen !== null ? forceOpen : !mobileDropdown.classList.contains('is-open');
      mobileDropdown.classList.toggle('is-open', isOpen);
      mobileToggleBtn.setAttribute('aria-expanded', String(isOpen));
      mobileDropdown.setAttribute('aria-hidden', String(!isOpen));

      // Atualiza ícone: 'x' se aberto, 'menu' se fechado
      mobileToggleBtn.innerHTML = AppIcons.render(isOpen ? 'x' : 'menu', 20);
    };

    mobileToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileMenu();
    });

    // Fecha ao clicar em qualquer link dentro do dropdown
    mobileDropdown.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggleMobileMenu(false);
      });
    });

    // Fecha ao clicar fora do navbar
    document.addEventListener('click', (e) => {
      if (!mobileDropdown.contains(e.target) && !mobileToggleBtn.contains(e.target)) {
        if (mobileDropdown.classList.contains('is-open')) {
          toggleMobileMenu(false);
        }
      }
    });

    // Fecha ao pressionar Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDropdown.classList.contains('is-open')) {
        toggleMobileMenu(false);
      }
    });

    // Fecha automaticamente se redimensionar a tela para desktop (> 820px)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 820 && mobileDropdown.classList.contains('is-open')) {
        toggleMobileMenu(false);
      }
    });
  }
});
