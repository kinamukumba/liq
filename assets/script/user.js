/**
 * ====================================================================
 * LIQ SAAS - RESTAURANT USER DASHBOARD CONTROLLER (user.js)
 * Sistema Completo da Plataforma do Restaurante:
 * - KPIs e Gráficos SVG Nativos (Área de Vendas, Donut de Status, Horários de Pico)
 * - Quadro Operacional KDS em Tempo Real com Cronômetro de Pedidos
 * - Gestão de Mesas, Status e Totens de QR Code para Impressão
 * - Cardápio Digital, Toggles de Disponibilidade e Cadastro de Produtos
 * - CRM de Clientes, Extrato de Fidelidade e Conversas WhatsApp
 * - Cupons Promocionais e Validação de Campanhas
 * - Modais, Diálogos de Confirmação e Lançamento de Pedidos Manuais
 * ====================================================================
 */

const UserDashboard = {
  restaurantId: 1,
  restaurantName: 'Café Central',
  restaurantSlug: 'cafe-central',
  autoRefreshTimer: null,

  // Cache em memória
  state: {
    period: 'today',
    kdsFilter: 'ALL',
    metrics: null,
    kitchenOrders: [],
    tables: [],
    products: [],
    categories: [],
    customers: [],
    coupons: [],
    manualOrderCart: [],
    currentOrderViewing: null
  },

  async init() {
    this.resolveRestaurant();
    this.bindNavigation();
    this.bindModals();
    this.bindFilterButtons();
    this.bindForms();

    // Carrega dados iniciais do Dashboard e KDS
    await Promise.all([
      this.loadMetrics(),
      this.loadKitchenOrders(),
      this.loadTables(),
      this.loadProducts()
    ]);

    this.startAutoRefresh();
  },

  /* ----------------------------------------------------
     1. IDENTIFICAÇÃO DO RESTAURANTE & SESSÃO
     ---------------------------------------------------- */
  resolveRestaurant() {
    // 1. Tenta identificar do caminho da URL (ex: app.liq.ao/user/{nome-restaurante})
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const userIdx = pathParts.indexOf('user');
    if (userIdx !== -1 && pathParts[userIdx + 1]) {
      const slugCandidate = pathParts[userIdx + 1].replace(/\.html$/i, '');
      if (slugCandidate && slugCandidate !== 'index') {
        this.restaurantSlug = slugCandidate;
      }
    }

    // 2. Tenta identificar de query string: ?restaurant=slug
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('restaurant')) {
      this.restaurantSlug = urlParams.get('restaurant');
    }

    // 3. Tenta carregar da sessão autenticada em localStorage
    try {
      const authData = JSON.parse(localStorage.getItem('liq_auth_user') || '{}');
      if (authData.restaurant_id) {
        this.restaurantId = parseInt(authData.restaurant_id, 10);
      }
      if (authData.restaurant_name) {
        this.restaurantName = authData.restaurant_name;
        const brandNameEl = document.getElementById('header-restaurant-name');
        if (brandNameEl) brandNameEl.textContent = this.restaurantName;
      }
      if (authData.name) {
        const userNameEl = document.getElementById('sidebar-user-name');
        if (userNameEl) userNameEl.textContent = authData.name;
        const avatarEl = document.getElementById('sidebar-user-avatar');
        if (avatarEl) {
          const initials = authData.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
          avatarEl.textContent = initials;
        }
      }
      if (authData.role) {
        const userRoleEl = document.getElementById('sidebar-user-role');
        if (userRoleEl) userRoleEl.textContent = authData.role === 'RESTAURANT_OWNER' ? 'Restaurateur (Owner)' : authData.role;
      }
    } catch (e) {
      console.warn('Falha ao restaurar dados da sessão:', e);
    }
  },

  /* ----------------------------------------------------
     2. NAVEGAÇÃO & CHAVEAMENTO DE PAINÉIS
     ---------------------------------------------------- */
  bindNavigation() {
    const titles = {
      'panel-dashboard': 'Visão Geral & Indicadores',
      'panel-kitchen': 'Cozinha & Salão (KDS em Tempo Real)',
      'panel-tables': 'Gestão de Mesas & QR Codes',
      'panel-menu': 'Cardápio & Gestão de Produtos',
      'panel-crm': 'Clientes & Base CRM',
      'panel-coupons': 'Cupons & Campanhas Promocionais',
      'panel-settings': 'Configurações do Restaurante'
    };

    document.querySelectorAll('.app-sidebar-nav .nav-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPanelId = btn.getAttribute('data-target-panel');
        if (!targetPanelId) return;

        usePanels.show(targetPanelId, '.app-sidebar-nav .nav-link');

        const titleEl = document.getElementById('page-header-title');
        if (titleEl) {
          titleEl.textContent = titles[targetPanelId] || 'Painel de Gestão';
        }

        // Carrega sob demanda os dados específicos da aba
        if (targetPanelId === 'panel-dashboard') {
          this.loadMetrics();
        } else if (targetPanelId === 'panel-kitchen') {
          this.loadKitchenOrders();
        } else if (targetPanelId === 'panel-tables') {
          this.loadTables();
        } else if (targetPanelId === 'panel-menu') {
          this.loadProducts();
        } else if (targetPanelId === 'panel-crm') {
          this.loadCrm();
        } else if (targetPanelId === 'panel-coupons') {
          this.loadCoupons();
        }
      });
    });

    // Botão de atalho "Ver Todos no KDS" do Dashboard
    const btnSeeAllKds = document.getElementById('btn-see-all-kds');
    if (btnSeeAllKds) {
      btnSeeAllKds.addEventListener('click', () => {
        const kdsNavBtn = document.querySelector('[data-target-panel="panel-kitchen"]');
        if (kdsNavBtn) kdsNavBtn.click();
      });
    }

    // Botão de atualização manual
    const refreshBtn = document.getElementById('btn-manual-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.setAttribute('disabled', 'disabled');
        await Promise.all([
          this.loadMetrics(),
          this.loadKitchenOrders(),
          this.loadTables()
        ]);
        useAlert.info('Dados sincronizados em tempo real com o servidor.', 'Atualização Concluída');
        refreshBtn.removeAttribute('disabled');
      });
    }

    // Logout
    const logoutBtn = document.getElementById('btn-sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.openConfirmDialog('Encerrar Sessão', 'Deseja realmente sair da plataforma do restaurante?', async () => {
          await useApi.post('/auth/logout');
          localStorage.removeItem('liq_auth_user');
          window.location.href = '../auth/login/index.html';
        });
      });
    }
  },

  /* ----------------------------------------------------
     3. FILTROS & AUTO REFRESH
     ---------------------------------------------------- */
  bindFilterButtons() {
    // Filtro de período do Dashboard
    document.querySelectorAll('.filter-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.period = btn.getAttribute('data-period');
        this.loadMetrics();
      });
    });

    // Filtro de status do KDS
    document.querySelectorAll('.kds-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.kds-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.kdsFilter = btn.getAttribute('data-filter-status');
        this.renderKitchenOrders();
      });
    });

    // Filtros de Cardápio (Busca & Categoria)
    const menuSearchInput = document.getElementById('menu-search-input');
    if (menuSearchInput) {
      menuSearchInput.addEventListener('input', () => this.filterProductsList());
    }

    const menuCatFilter = document.getElementById('menu-category-filter');
    if (menuCatFilter) {
      menuCatFilter.addEventListener('change', () => this.filterProductsList());
    }
  },

  startAutoRefresh() {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    // Atualiza KDS a cada 10 segundos silenciosamente
    this.autoRefreshTimer = setInterval(async () => {
      const activePanel = document.querySelector('.tab-panel.active');
      if (activePanel && activePanel.id === 'panel-kitchen') {
        await this.loadKitchenOrders(true);
      } else if (activePanel && activePanel.id === 'panel-dashboard') {
        await this.loadMetrics(true);
      }
    }, 10000);
  },

  /* ----------------------------------------------------
     4. PAINEL 1: DASHBOARD, MÉTRICAS & GRÁFICOS
     ---------------------------------------------------- */
  async loadMetrics(silent = false) {
    const res = await useApi.get(`/dashboard?restaurant_id=${this.restaurantId}&period=${this.state.period}`);
    if (res.success && res.data) {
      this.state.metrics = res.data;
      this.renderMetrics(res.data);
      if (!silent) {
        const syncEl = document.getElementById('dashboard-last-sync');
        if (syncEl) syncEl.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-PT')}`;
      }
    }
  },

  renderMetrics(data) {
    const { sales, orders, customers, tables, top_products, peak_hours, sales_trend, recent_orders } = data;

    // 1. KPIs de Vendas
    const salesEl = document.getElementById('kpi-sales-today');
    if (salesEl) salesEl.textContent = useFormatters.currency(sales.today, sales.currency);

    const growthEl = document.getElementById('kpi-growth');
    if (growthEl) {
      const isPos = sales.growth_percent >= 0;
      growthEl.className = `card-metric-trend ${isPos ? 'trend-up' : 'trend-down'}`;
      growthEl.innerHTML = `<span>${AppIcons.render(isPos ? 'trendingUp' : 'trendingDown', 14)} ${isPos ? '+' : ''}${sales.growth_percent}% vs ontem</span>`;
    }

    const ordersEl = document.getElementById('kpi-orders-today');
    if (ordersEl) ordersEl.textContent = sales.orders_today;

    const prepTimeEl = document.getElementById('kpi-prep-time');
    if (prepTimeEl) prepTimeEl.textContent = `${sales.avg_prep_time_minutes || 18} min`;

    const ticketEl = document.getElementById('kpi-avg-ticket');
    if (ticketEl) ticketEl.textContent = useFormatters.currency(sales.avg_ticket, sales.currency);

    const clientsEl = document.getElementById('kpi-total-clients');
    if (clientsEl) clientsEl.textContent = customers.total;

    const returnRateEl = document.getElementById('kpi-return-rate');
    if (returnRateEl) returnRateEl.textContent = `${customers.return_rate_percent}% taxa de retorno`;

    // Atualiza contadores da sidebar
    const tablesCountEl = document.getElementById('sidebar-tables-counter');
    if (tablesCountEl && tables) {
      tablesCountEl.textContent = `${tables.occupied || 0}/${tables.total || 0}`;
    }

    // 2. Gráfico de Área: Tendência de Vendas (7 Dias)
    this.renderSalesAreaChart(sales_trend || []);

    // 3. Gráfico Donut de Status
    this.renderOrdersDonutChart(orders.by_status || {}, sales.orders_today || 0);

    // 4. Ranking de Produtos Mais Vendidos
    this.renderTopProductsList(top_products || []);

    // 5. Horários de Pico (Barras SVG)
    this.renderPeakHoursChart(peak_hours || []);

    // 6. Tabela de Pedidos Recentes
    this.renderDashboardRecentOrders(recent_orders || []);
  },

  renderSalesAreaChart(trendData) {
    const container = document.getElementById('sales-area-chart-container');
    if (!container) return;

    if (!trendData || trendData.length === 0) {
      container.innerHTML = '<div class="d-flex items-center justify-center h-full text-muted text-xs">Dados insuficientes para gerar a curva.</div>';
      return;
    }

    const width = 640;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 35, left: 60 };

    const maxSales = Math.max(...trendData.map(d => d.sales), 5000);
    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;

    // Constrói pontos
    const points = trendData.map((d, i) => {
      const x = padding.left + (i / (trendData.length - 1)) * usableWidth;
      const y = padding.top + usableHeight - (d.sales / maxSales) * usableHeight;
      return { x, y, data: d };
    });

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

    // Linhas de Grade
    const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => {
      const y = padding.top + usableHeight * (1 - ratio);
      const val = Math.round(maxSales * ratio);
      return `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid-line" />
        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-text">${useFormatters.currency(val, 'Kz').replace(' Kz', '')}</text>
      `;
    }).join('');

    // Rótulos do Eixo X
    const axisLabels = points.map(p => `
      <text x="${p.x}" y="${height - 10}" text-anchor="middle" class="chart-axis-text">${p.data.label}</text>
    `).join('');

    // Círculos de Destaque
    const circles = points.map(p => `
      <circle cx="${p.x}" cy="${p.y}" r="4" class="chart-point" data-sales="${p.data.sales}" data-label="${p.data.label}">
        <title>${p.data.label}: ${useFormatters.currency(p.data.sales, 'Kz')} (${p.data.orders} pedidos)</title>
      </circle>
    `).join('');

    container.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="salesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#26cd59" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#26cd59" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${areaD}" class="chart-area-path" />
        <path d="${pathD}" class="chart-line-path" />
        ${circles}
        ${axisLabels}
      </svg>
    `;
  },

  renderOrdersDonutChart(byStatus, totalOrders) {
    const container = document.getElementById('orders-donut-chart-container');
    const legendContainer = document.getElementById('orders-status-pills');
    if (!container || !legendContainer) return;

    const statusConfig = [
      { key: 'PENDING', label: 'Pendentes', color: '#f59e0b' },
      { key: 'CONFIRMED', label: 'Confirmados', color: '#3b82f6' },
      { key: 'PREPARING', label: 'Em Preparo', color: '#8b5cf6' },
      { key: 'READY', label: 'Prontos', color: '#149036' },
      { key: 'COMPLETED', label: 'Concluídos', color: '#26cd59' },
      { key: 'CANCELLED', label: 'Cancelados', color: '#ef4444' }
    ];

    const r = 60;
    const circumference = 2 * Math.PI * r;
    let accumulatedAngle = 0;

    const totalCount = Object.values(byStatus).reduce((a, b) => a + b, 0);

    const segmentsSvg = statusConfig.map(cfg => {
      const count = byStatus[cfg.key] || 0;
      if (count === 0 || totalCount === 0) return '';

      const percent = count / totalCount;
      const strokeLength = percent * circumference;
      const strokeDashoffset = -accumulatedAngle;
      accumulatedAngle += strokeLength;

      return `
        <circle cx="80" cy="80" r="${r}" class="donut-segment"
                stroke="${cfg.color}"
                stroke-dasharray="${strokeLength} ${circumference}"
                stroke-dashoffset="${strokeDashoffset}">
          <title>${cfg.label}: ${count} (${Math.round(percent * 100)}%)</title>
        </circle>
      `;
    }).join('');

    container.innerHTML = `
      <svg class="donut-svg" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="${r}" stroke="#eef4f0" stroke-width="24" fill="transparent"/>
        ${segmentsSvg}
      </svg>
      <div class="donut-center-text">
        <div class="donut-center-val">${totalCount}</div>
        <div class="donut-center-lbl">Total Pedidos</div>
      </div>
    `;

    // Legenda
    legendContainer.innerHTML = statusConfig.map(cfg => {
      const count = byStatus[cfg.key] || 0;
      return `
        <div class="legend-item">
          <span class="legend-dot" style="background-color: ${cfg.color};"></span>
          <span class="legend-item-name">${cfg.label}</span>
          <span class="legend-item-count">${count}</span>
        </div>
      `;
    }).join('');
  },

  renderTopProductsList(topProducts) {
    const container = document.getElementById('top-products-list');
    if (!container) return;

    if (!topProducts || topProducts.length === 0) {
      container.innerHTML = '<div class="text-xs text-muted py-6 text-center">Nenhum produto vendido no período selecionado.</div>';
      return;
    }

    const maxSold = Math.max(...topProducts.map(p => parseInt(p.total_sold, 10)), 1);

    container.innerHTML = topProducts.map((p, idx) => {
      const sold = parseInt(p.total_sold, 10);
      const percent = Math.min(100, Math.round((sold / maxSold) * 100));
      return `
        <div class="top-product-item">
          <span class="top-product-rank">#${idx + 1}</span>
          <div class="top-product-info">
            <div class="top-product-title">${p.product_name_snapshot}</div>
            <div class="top-product-progress-bg">
              <div class="top-product-progress-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
          <div class="top-product-stat">
            <div class="top-product-qty">${sold} un</div>
            <div class="top-product-rev">${useFormatters.currency(p.revenue, 'Kz')}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderPeakHoursChart(peakHours) {
    const container = document.getElementById('peak-hours-chart');
    if (!container) return;

    if (!peakHours || peakHours.length === 0) {
      container.innerHTML = '<div class="text-xs text-muted py-6 text-center">Sem dados de horário registrados para hoje.</div>';
      return;
    }

    const maxCount = Math.max(...peakHours.map(h => parseInt(h.order_count, 10)), 1);
    const height = 180;
    const barWidth = 24;

    const bars = peakHours.map((h, i) => {
      const count = parseInt(h.order_count, 10);
      const barH = (count / maxCount) * (height - 40);
      const x = 30 + i * 44;
      const y = height - 25 - barH;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" class="bar-rect">
          <title>${h.hour_of_day}h: ${count} pedidos</title>
        </rect>
        <text x="${x + barWidth / 2}" y="${y - 4}" class="chart-axis-text" text-anchor="middle">${count}</text>
        <text x="${x + barWidth / 2}" y="${height - 8}" class="bar-label">${h.hour_of_day}h</text>
      `;
    }).join('');

    container.innerHTML = `
      <svg class="peak-hours-svg" viewBox="0 0 ${Math.max(400, 30 + peakHours.length * 44 + 20)} ${height}">
        ${bars}
      </svg>
    `;
  },

  renderDashboardRecentOrders(orders) {
    const tbody = document.getElementById('dashboard-recent-orders-tbody');
    if (!tbody) return;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted text-xs py-4">Nenhum pedido recente registrado.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(ord => {
      const statusBadges = {
        'PENDING': '<span class="badge badge-warning">Pendente</span>',
        'CONFIRMED': '<span class="badge badge-info">Confirmado</span>',
        'PREPARING': '<span class="badge badge-preparing">Em Preparo</span>',
        'READY': '<span class="badge badge-ready">Pronto</span>',
        'COMPLETED': '<span class="badge badge-completed">Concluído</span>',
        'CANCELLED': '<span class="badge badge-cancelled">Cancelado</span>'
      };

      const dateStr = new Date(ord.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

      return `
        <tr>
          <td class="font-bold">#${ord.id}</td>
          <td><span class="badge badge-available">Mesa ${ord.table_number || '--'}</span></td>
          <td class="font-medium">${ord.customer_name || 'Cliente na Mesa'}</td>
          <td class="font-bold text-green">${useFormatters.currency(ord.total, 'Kz')}</td>
          <td>${statusBadges[ord.status] || ord.status}</td>
          <td class="text-xs text-muted">${dateStr}</td>
          <td class="text-right">
            <button type="button" class="btn btn-outline btn-xs" onclick="UserDashboard.viewOrderDetails(${ord.id})">
              <span>Detalhes</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  /* ----------------------------------------------------
     5. PAINEL 2: QUADRO OPERACIONAL KDS (COZINHA)
     ---------------------------------------------------- */
  async loadKitchenOrders(silent = false) {
    const res = await useApi.get(`/orders/kitchen?restaurant_id=${this.restaurantId}`);
    if (res.success && res.data) {
      this.state.kitchenOrders = res.data;
      this.renderKitchenOrders();

      // Atualiza contador da sidebar
      const sidebarBadge = document.getElementById('sidebar-kds-counter');
      if (sidebarBadge) {
        sidebarBadge.textContent = res.data.length;
      }
    }
  },

  renderKitchenOrders() {
    const grid = document.getElementById('kitchen-orders-grid');
    if (!grid) return;

    let orders = this.state.kitchenOrders || [];

    // Atualiza contadores dos tabs KDS
    const counts = { ALL: orders.length, PENDING: 0, CONFIRMED: 0, PREPARING: 0, READY: 0 };
    orders.forEach(o => {
      if (counts[o.status] !== undefined) counts[o.status]++;
    });

    const cAll = document.getElementById('count-kds-all');
    if (cAll) cAll.textContent = counts.ALL;
    const cPend = document.getElementById('count-kds-pending');
    if (cPend) cPend.textContent = counts.PENDING;
    const cConf = document.getElementById('count-kds-confirmed');
    if (cConf) cConf.textContent = counts.CONFIRMED;
    const cPrep = document.getElementById('count-kds-preparing');
    if (cPrep) cPrep.textContent = counts.PREPARING;
    const cReady = document.getElementById('count-kds-ready');
    if (cReady) cReady.textContent = counts.READY;

    // Filtra pela aba selecionada
    if (this.state.kdsFilter !== 'ALL') {
      orders = orders.filter(o => o.status === this.state.kdsFilter);
    }

    if (orders.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 bg-white rounded-lg border">
          <div class="text-muted text-sm">${AppIcons.render('check', 32, 'mb-2 text-green')}</div>
          <p class="font-bold text-sm">Nenhum pedido em espera nesta etapa!</p>
          <p class="text-xs text-muted mt-1">Todos os pedidos estão em dia.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = orders.map(ord => {
      // Cálculo de minutos decorridos
      const elapsedMins = Math.max(0, Math.floor((Date.now() - new Date(ord.created_at).getTime()) / 60000));
      let timerClass = '';
      if (elapsedMins > 20) timerClass = 'timer-danger';
      else if (elapsedMins > 10) timerClass = 'timer-warning';

      // Itens da comanda
      const itemsHtml = (ord.items || []).map(item => `
        <div class="kds-item-row">
          <span class="kds-item-qty">${item.quantity}x</span>
          <div class="kds-item-name">
            ${item.product_name_snapshot}
            ${item.notes ? `<div class="kds-item-notes">${item.notes}</div>` : ''}
          </div>
        </div>
      `).join('');

      // Botões de ação contextual pelo status atual
      let actionButtons = '';
      if (ord.status === 'PENDING') {
        actionButtons = `
          <button type="button" class="btn btn-outline btn-xs" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'CANCELLED')">Rejeitar</button>
          <button type="button" class="btn btn-primary btn-xs" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'CONFIRMED')">Confirmar</button>
        `;
      } else if (ord.status === 'CONFIRMED') {
        actionButtons = `
          <button type="button" class="btn btn-primary btn-xs" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'PREPARING')">Iniciar Preparo</button>
        `;
      } else if (ord.status === 'PREPARING') {
        actionButtons = `
          <button type="button" class="btn btn-ready btn-xs" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'READY')">Pronto p/ Servir</button>
        `;
      } else if (ord.status === 'READY') {
        actionButtons = `
          <button type="button" class="btn btn-primary btn-xs" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'COMPLETED')">Finalizar Entrega</button>
        `;
      }

      return `
        <div class="kds-card status-${ord.status.toLowerCase()}">
          <div class="kds-card-header">
            <div>
              <h3 class="kds-card-table-title">Mesa ${ord.table_number || '--'} &bull; Pedido #${ord.id}</h3>
              <div class="kds-card-customer-sub">${ord.customer_name || 'Cliente'} &bull; ${useFormatters.currency(ord.total, 'Kz')}</div>
            </div>
            <span class="kds-timer-badge ${timerClass}">
              <span data-icon="clock" data-icon-size="12"></span>
              <span>${elapsedMins} min</span>
            </span>
          </div>

          <div class="kds-card-body">
            <div class="kds-items-list">
              ${itemsHtml}
            </div>
            ${ord.notes ? `<div class="mt-3 text-xs bg-gray-50 p-2 rounded text-muted"><strong>Obs:</strong> ${ord.notes}</div>` : ''}
          </div>

          <div class="kds-card-footer">
            <button type="button" class="btn btn-secondary btn-xs" onclick="UserDashboard.viewOrderDetails(${ord.id})">
              <span>Ver Comanda</span>
            </button>
            <div class="d-flex items-center gap-2">
              ${actionButtons}
            </div>
          </div>
        </div>
      `;
    }).join('');

    AppIcons.replacePlaceholders();
  },

  async updateOrderStatus(orderId, newStatus) {
    const res = await useApi.patch(`/orders/${orderId}/status`, {
      restaurant_id: this.restaurantId,
      status: newStatus
    });

    if (res.success) {
      useAlert.sucesso(`Pedido #${orderId} atualizado para ${newStatus}.`, 'Status Atualizado');
      await Promise.all([
        this.loadKitchenOrders(true),
        this.loadMetrics(true)
      ]);
      this.closeModal('modal-order-details');
    } else {
      useAlert.erro(res.message || 'Falha ao atualizar o pedido.', 'Erro Operacional');
    }
  },

  async viewOrderDetails(orderId) {
    const res = await useApi.get(`/orders/${orderId}`);
    if (res.success && res.data) {
      const ord = res.data;
      this.state.currentOrderViewing = ord;

      const titleEl = document.getElementById('order-modal-title');
      if (titleEl) titleEl.textContent = `Comanda #${ord.id} - Mesa ${ord.table_number || '--'}`;

      const dateStr = new Date(ord.created_at).toLocaleString('pt-PT');
      const subtitleEl = document.getElementById('order-modal-subtitle');
      if (subtitleEl) subtitleEl.textContent = `Recebido às ${dateStr} &bull; Status: ${ord.status}`;

      // Cliente
      const custEl = document.getElementById('order-modal-customer-info');
      if (custEl) {
        custEl.innerHTML = `
          <div class="d-flex justify-between items-center">
            <div>
              <div class="font-bold">${ord.customer_name || 'Cliente Anônimo'}</div>
              <div class="text-xs text-muted">${ord.customer_phone || 'Sem telefone registrado'}</div>
            </div>
            <span class="badge badge-ready">Mesa ${ord.table_number || '--'}</span>
          </div>
        `;
      }

      // Itens
      const itemsEl = document.getElementById('order-modal-items');
      if (itemsEl) {
        itemsEl.innerHTML = (ord.items || []).map(i => `
          <div class="order-modal-item-row">
            <div>
              <span class="font-bold">${i.quantity}x</span>
              <span>${i.product_name_snapshot}</span>
              ${i.notes ? `<div class="text-xs text-orange">${i.notes}</div>` : ''}
            </div>
            <div class="font-medium">${useFormatters.currency(i.subtotal, 'Kz')}</div>
          </div>
        `).join('');
      }

      // Financeiro
      const finEl = document.getElementById('order-modal-financials');
      if (finEl) {
        finEl.innerHTML = `
          <div class="order-financial-row">
            <span>Subtotal:</span>
            <span>${useFormatters.currency(ord.subtotal, 'Kz')}</span>
          </div>
          ${parseFloat(ord.discount) > 0 ? `
            <div class="order-financial-row text-green">
              <span>Desconto Cupom:</span>
              <span>-${useFormatters.currency(ord.discount, 'Kz')}</span>
            </div>
          ` : ''}
          <div class="order-financial-row total">
            <span>Total da Comanda:</span>
            <span>${useFormatters.currency(ord.total, 'Kz')}</span>
          </div>
        `;
      }

      // Botões contextuais de avanço
      const actionsEl = document.getElementById('order-modal-actions');
      if (actionsEl) {
        if (ord.status === 'PENDING') {
          actionsEl.innerHTML = `<button type="button" class="btn btn-primary btn-sm" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'CONFIRMED')">Confirmar Pedido</button>`;
        } else if (ord.status === 'CONFIRMED') {
          actionsEl.innerHTML = `<button type="button" class="btn btn-primary btn-sm" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'PREPARING')">Iniciar Preparo</button>`;
        } else if (ord.status === 'PREPARING') {
          actionsEl.innerHTML = `<button type="button" class="btn btn-ready btn-sm" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'READY')">Marcar Pronto</button>`;
        } else if (ord.status === 'READY') {
          actionsEl.innerHTML = `<button type="button" class="btn btn-primary btn-sm" onclick="UserDashboard.updateOrderStatus(${ord.id}, 'COMPLETED')">Concluir Entrega</button>`;
        } else {
          actionsEl.innerHTML = `<span class="badge badge-completed">Comanda Finalizada</span>`;
        }
      }

      this.openModal('modal-order-details');
    }
  },

  /* ----------------------------------------------------
     6. PAINEL 3: GESTÃO DE MESAS & QR CODES
     ---------------------------------------------------- */
  async loadTables() {
    const res = await useApi.get(`/tables?restaurant_id=${this.restaurantId}`);
    if (res.success && res.data) {
      this.state.tables = res.data.tables || [];
      this.renderTables(res.data);
    }
  },

  renderTables(data) {
    const { tables, summary } = data;

    // Resumo dos Cards Superiores
    const sTotal = document.getElementById('stat-tables-total');
    if (sTotal) sTotal.textContent = summary.total;
    const sAvail = document.getElementById('stat-tables-available');
    if (sAvail) sAvail.textContent = summary.available;
    const sOccup = document.getElementById('stat-tables-occupied');
    if (sOccup) sOccup.textContent = summary.occupied;
    const sClean = document.getElementById('stat-tables-cleaning');
    if (sClean) sClean.textContent = summary.cleaning;

    const container = document.getElementById('tables-cards-container');
    if (!container) return;

    if (tables.length === 0) {
      container.innerHTML = '<div class="col-span-full text-center py-8 text-muted">Nenhuma mesa cadastrada. Clique em "Cadastrar Mesa".</div>';
      return;
    }

    container.innerHTML = tables.map(t => {
      const statusLabels = {
        'AVAILABLE': '<span class="badge badge-available">Disponível</span>',
        'OCCUPIED': '<span class="badge badge-warning">Ocupada</span>',
        'CLEANING': '<span class="badge badge-default">Em Limpeza</span>'
      };

      return `
        <div class="table-card">
          <div class="table-card-header">
            <div>
              <h3 class="table-card-number">Mesa ${t.number}</h3>
              <span class="table-card-code">Código: ${t.code}</span>
            </div>
            ${statusLabels[t.status] || t.status}
          </div>
          <div class="table-card-body">
            <div class="text-xs text-muted">Acesso Digital do Cliente:</div>
            <div class="text-xs font-bold text-green mt-1">/client/?t=${t.qr_token || t.number}</div>

            ${t.active_order_id ? `
              <div class="table-active-order-box">
                <div class="d-flex justify-between font-bold">
                  <span>Comanda Ativa #${t.active_order_id}</span>
                  <span class="text-green">${useFormatters.currency(t.active_order_total, 'Kz')}</span>
                </div>
                <div class="text-muted text-xs mt-1">Status: ${t.active_order_status}</div>
              </div>
            ` : '<div class="text-xs text-muted mt-3">Sem pedido ativo no momento</div>'}
          </div>
          <div class="table-card-footer">
            <button type="button" class="btn btn-outline btn-xs" onclick="UserDashboard.openQrModal('${t.number}', '${t.code}', '${t.qr_token}')">
              <span data-icon="qr" data-icon-size="12"></span>
              <span>Totem QR</span>
            </button>
            ${t.status === 'OCCUPIED' ? `
              <button type="button" class="btn btn-secondary btn-xs" onclick="UserDashboard.updateTableStatus(${t.id}, 'CLEANING')">Liberar Mesa</button>
            ` : t.status === 'CLEANING' ? `
              <button type="button" class="btn btn-primary btn-xs" onclick="UserDashboard.updateTableStatus(${t.id}, 'AVAILABLE')">Pronta</button>
            ` : `
              <a href="../client/index.html?t=${t.qr_token || t.number}" target="_blank" class="btn btn-secondary btn-xs">Abrir Menu</a>
            `}
          </div>
        </div>
      `;
    }).join('');

    AppIcons.replacePlaceholders();
  },

  async updateTableStatus(tableId, newStatus) {
    const res = await useApi.patch(`/tables/${tableId}/status`, {
      restaurant_id: this.restaurantId,
      status: newStatus
    });

    if (res.success) {
      useAlert.sucesso('Estado da mesa atualizado com sucesso.', 'Mesa Atualizada');
      await this.loadTables();
    } else {
      useAlert.erro(res.message || 'Falha ao atualizar mesa.', 'Erro');
    }
  },

  openQrModal(number, code, token) {
    const titleEl = document.getElementById('qr-modal-title');
    if (titleEl) titleEl.textContent = `Totem Mesa ${number} (${code})`;

    const cardTableEl = document.getElementById('qr-card-table-text');
    if (cardTableEl) cardTableEl.textContent = `Mesa ${number}`;

    const hostSelect = document.getElementById('qr-host-mode-select');
    const urlBadgeEl = document.getElementById('qr-card-url-text');
    const qrSvgWrapper = document.getElementById('qr-code-svg-render');
    const btnOpenQr = document.getElementById('btn-open-qr-url');
    const btnCopyQr = document.getElementById('btn-copy-qr-url');

    const renderQr = () => {
      const mode = hostSelect ? hostSelect.value : 'WIFI';
      let targetUrl = '';

      if (mode === 'PROD') {
        targetUrl = `https://app.liq.ao/client/?t=${encodeURIComponent(token)}`;
      } else if (mode === 'LOCALHOST') {
        const isSub = window.location.pathname.includes('/liq');
        targetUrl = `${window.location.protocol}//localhost${window.location.port ? ':' + window.location.port : ''}${isSub ? '/liq' : ''}/client/index.html?t=${encodeURIComponent(token)}`;
      } else {
        // WIFI / Rede Local (Permite que o smartphone na mesma rede acesse de imediato)
        const hostIp = '192.168.100.11';
        const isSub = window.location.pathname.includes('/liq');
        targetUrl = `http://${hostIp}${window.location.port ? ':' + window.location.port : ''}${isSub ? '/liq' : ''}/client/index.html?t=${encodeURIComponent(token)}`;
      }

      if (urlBadgeEl) urlBadgeEl.textContent = targetUrl;
      if (btnOpenQr) btnOpenQr.setAttribute('href', targetUrl);

      if (qrSvgWrapper && typeof QRCodeGenerator !== 'undefined') {
        qrSvgWrapper.innerHTML = QRCodeGenerator.generateSVG(targetUrl, {
          size: 210,
          margin: 4,
          colorDark: '#032204',
          colorLight: '#ffffff',
          errorCorrection: 'M'
        });
      }
    };

    if (hostSelect) {
      hostSelect.onchange = renderQr;
    }

    if (btnCopyQr) {
      btnCopyQr.onclick = () => {
        const urlToCopy = urlBadgeEl ? urlBadgeEl.textContent : '';
        if (navigator.clipboard && urlToCopy) {
          navigator.clipboard.writeText(urlToCopy).then(() => {
            useAlert.sucesso('Link do menu copiado para a área de transferência!', 'Copiado');
          }).catch(() => {
            prompt('Copie o link abaixo:', urlToCopy);
          });
        }
      };
    }

    renderQr();
    this.openModal('modal-qr-preview');
  },

  /* ----------------------------------------------------
     7. PAINEL 4: CARDÁPIO & PRODUTOS
     ---------------------------------------------------- */
  async loadProducts() {
    const res = await useApi.get(`/products?restaurant_id=${this.restaurantId}`);
    if (res.success && res.data) {
      this.state.products = res.data.products || [];
      this.state.categories = res.data.categories || [];

      // Preenche select de filtro de categoria
      const catFilterSelect = document.getElementById('menu-category-filter');
      if (catFilterSelect) {
        catFilterSelect.innerHTML = '<option value="ALL">Todas as Categorias</option>' + 
          this.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }

      // Preenche select do modal de novo produto
      const catModalSelect = document.getElementById('product-category');
      if (catModalSelect) {
        catModalSelect.innerHTML = this.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }

      this.filterProductsList();
    }
  },

  filterProductsList() {
    const searchVal = (document.getElementById('menu-search-input')?.value || '').toLowerCase().trim();
    const catVal = document.getElementById('menu-category-filter')?.value || 'ALL';

    let filtered = this.state.products;

    if (catVal !== 'ALL') {
      filtered = filtered.filter(p => String(p.category_id) === catVal);
    }

    if (searchVal) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
    }

    this.renderProductsTable(filtered);
  },

  renderProductsTable(products) {
    const tbody = document.getElementById('menu-products-tbody');
    if (!tbody) return;

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted text-xs py-6">Nenhum produto encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => {
      const isAvail = parseInt(p.is_available, 10) === 1;

      return `
        <tr>
          <td>
            <img src="${useFormatters.productImage(p.image)}" alt="${p.name}" class="product-thumb" onerror="this.onerror=null; this.src='../assets/images/default-product.svg';">
          </td>
          <td>
            <div class="font-bold">${p.name}</div>
            <div class="text-xs text-muted">${p.description ? p.description.substring(0, 48) + '...' : ''}</div>
          </td>
          <td><span class="badge badge-default">${p.category_name}</span></td>
          <td class="font-bold text-green">${useFormatters.currency(p.price, 'Kz')}</td>
          <td>
            <label class="toggle-switch">
              <input type="checkbox" ${isAvail ? 'checked' : ''} onchange="UserDashboard.toggleProductAvailability(${p.id}, this)">
              <span class="toggle-slider"></span>
            </label>
          </td>
          <td class="text-right">
            <span class="badge ${isAvail ? 'badge-available' : 'badge-default'}">
              ${isAvail ? 'Disponível' : 'Pausado'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  },

  async toggleProductAvailability(productId, checkbox) {
    const res = await useApi.patch(`/products/${productId}/toggle`, {
      restaurant_id: this.restaurantId
    });

    if (res.success) {
      useAlert.sucesso(res.message, 'Cardápio Atualizado');
      // Atualiza estado local
      const prod = this.state.products.find(p => p.id === productId);
      if (prod) prod.is_available = res.data.is_available;
      this.filterProductsList();
    } else {
      useAlert.erro(res.message || 'Falha ao alterar produto.', 'Erro');
      checkbox.checked = !checkbox.checked;
    }
  },

  /* ----------------------------------------------------
     8. PAINEL 5: CRM & CLIENTES
     ---------------------------------------------------- */
  async loadCrm() {
    const res = await useApi.get(`/crm/customers?restaurant_id=${this.restaurantId}`);
    if (res.success && res.data) {
      this.state.customers = res.data.customers || [];
      this.renderCrm(res.data);
    }
  },

  renderCrm(data) {
    const { customers, kpis } = data;

    const sTot = document.getElementById('crm-stat-total');
    if (sTot) sTot.textContent = kpis.total_customers;
    const sRec = document.getElementById('crm-stat-recurrent');
    if (sRec) sRec.textContent = kpis.recurrent_customers;
    const sRecPct = document.getElementById('crm-stat-recurrent-percent');
    if (sRecPct) sRecPct.textContent = `${kpis.recurrent_percent}% taxa de retorno`;
    const sPts = document.getElementById('crm-stat-points');
    if (sPts) sPts.textContent = `${kpis.total_points_issued} pts`;
    const sLtv = document.getElementById('crm-stat-ltv');
    if (sLtv) sLtv.textContent = useFormatters.currency(kpis.average_ltv, 'Kz');

    const tbody = document.getElementById('crm-table-tbody');
    if (!tbody) return;

    if (customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted text-xs py-6">Nenhum cliente registrado na base CRM ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = customers.map(c => {
      const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
      const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';

      return `
        <tr>
          <td class="font-bold">${c.name}</td>
          <td>
            <a href="${waLink}" target="_blank" class="crm-phone-link d-inline-flex items-center gap-1 text-green font-medium">
              <span data-icon="whatsapp" data-icon-size="14"></span>
              <span>${c.phone || 'Sem telefone'}</span>
            </a>
          </td>
          <td class="font-bold">${c.total_orders} pedidos</td>
          <td class="font-bold text-green">${useFormatters.currency(c.total_spent, 'Kz')}</td>
          <td><span class="badge badge-ready font-bold">${c.loyalty_points || 0} pts</span></td>
          <td class="text-xs text-muted">${c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('pt-PT') : 'Hoje'}</td>
          <td class="text-right">
            <button type="button" class="btn btn-outline btn-xs" onclick="UserDashboard.viewCustomerDetails(${c.id})">
              <span>Ver Histórico</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    AppIcons.replacePlaceholders();
  },

  async viewCustomerDetails(customerId) {
    const res = await useApi.get(`/crm/customers/${customerId}?restaurant_id=${this.restaurantId}`);
    if (res.success && res.data) {
      const cust = res.data;
      const nameEl = document.getElementById('crm-modal-customer-name');
      if (nameEl) nameEl.textContent = cust.name;
      const phoneEl = document.getElementById('crm-modal-customer-phone');
      if (phoneEl) phoneEl.textContent = cust.phone || 'Sem telefone';
      const ptsEl = document.getElementById('crm-modal-points');
      if (ptsEl) ptsEl.textContent = `${cust.loyalty_points || 0} pontos`;

      const waLink = document.getElementById('crm-modal-wa-link');
      if (waLink) {
        const cleanPhone = (cust.phone || '').replace(/[^0-9]/g, '');
        waLink.href = cleanPhone ? `https://wa.me/${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(cust.name)}%2C%20agradecemos%20a%20sua%20prefer%C3%AAncia%20no%20Caf%C3%A9%20Central!` : '#';
      }

      const listEl = document.getElementById('crm-modal-orders-list');
      if (listEl) {
        if (!cust.orders || cust.orders.length === 0) {
          listEl.innerHTML = '<div class="text-xs text-muted text-center py-4">Sem pedidos concluídos.</div>';
        } else {
          listEl.innerHTML = cust.orders.map(o => `
            <div class="crm-order-card">
              <div>
                <span class="font-bold">Comanda #${o.id} &bull; Mesa ${o.table_number || '--'}</span>
                <div class="text-xs text-muted">${new Date(o.created_at).toLocaleString('pt-PT')}</div>
              </div>
              <div class="text-right">
                <span class="font-bold text-green">${useFormatters.currency(o.total, 'Kz')}</span>
                <div><span class="badge badge-ready text-xs">${o.status}</span></div>
              </div>
            </div>
          `).join('');
        }
      }

      this.openModal('modal-customer-details');
    }
  },

  /* ----------------------------------------------------
     9. PAINEL 6: CUPONS & CAMPANHAS
     ---------------------------------------------------- */
  async loadCoupons() {
    const res = await useApi.get(`/coupons?restaurant_id=${this.restaurantId}`);
    if (res.success && res.data) {
      this.state.coupons = res.data || [];
      this.renderCoupons(this.state.coupons);
    }
  },

  renderCoupons(coupons) {
    const container = document.getElementById('coupons-cards-container');
    if (!container) return;

    if (coupons.length === 0) {
      container.innerHTML = '<div class="col-span-full text-center py-8 text-muted">Nenhum cupom cadastrado. Clique em "Criar Cupom".</div>';
      return;
    }

    container.innerHTML = coupons.map(c => {
      const isActive = parseInt(c.active, 10) === 1;
      const discountFormatted = c.type === 'PERCENTAGE' ? `${c.value}% OFF` : `${useFormatters.currency(c.value, 'Kz')} OFF`;

      return `
        <div class="card">
          <div class="card-header">
            <div>
              <span class="card-title font-bold text-green">${c.code}</span>
              <div class="card-subtitle">${discountFormatted}</div>
            </div>
            <span class="badge ${isActive ? 'badge-ready' : 'badge-default'}">
              ${isActive ? 'Ativo' : 'Pausado'}
            </span>
          </div>
          <div class="card-body">
            <div class="d-flex flex-col gap-1 text-xs">
              <div><strong>Tipo:</strong> ${c.type === 'PERCENTAGE' ? 'Percentual' : 'Valor Fixo'}</div>
              <div><strong>Pedido Mínimo:</strong> ${useFormatters.currency(c.minimum_order, 'Kz')}</div>
              ${parseFloat(c.maximum_discount) > 0 ? `<div><strong>Desconto Máx:</strong> ${useFormatters.currency(c.maximum_discount, 'Kz')}</div>` : ''}
              <div><strong>Total de Resgates:</strong> ${c.total_redemptions || 0} vezes</div>
              <div><strong>Economia Gerada:</strong> ${useFormatters.currency(c.total_discount_given, 'Kz')}</div>
            </div>
          </div>
          <div class="card-footer d-flex justify-between items-center">
            <span class="text-xs text-muted">Válido até ${new Date(c.expires_at).toLocaleDateString('pt-PT')}</span>
            <button type="button" class="btn ${isActive ? 'btn-outline' : 'btn-primary'} btn-xs" onclick="UserDashboard.toggleCoupon(${c.id})">
              <span>${isActive ? 'Desativar' : 'Ativar'}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async toggleCoupon(couponId) {
    const res = await useApi.patch(`/coupons/${couponId}/toggle`, {
      restaurant_id: this.restaurantId
    });

    if (res.success) {
      useAlert.sucesso(res.message, 'Campanha Atualizada');
      await this.loadCoupons();
    } else {
      useAlert.erro(res.message || 'Falha ao alterar cupom.', 'Erro');
    }
  },

  /* ----------------------------------------------------
     10. FORMULÁRIOS & MODAIS
     ---------------------------------------------------- */
  bindForms() {
    // 1. Novo Pedido Manual
    const btnOpenNewOrder = document.getElementById('btn-open-new-order-modal');
    if (btnOpenNewOrder) {
      btnOpenNewOrder.addEventListener('click', () => {
        this.openNewOrderModal();
      });
    }

    const btnAddItem = document.getElementById('btn-add-item-to-manual-order');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => this.addItemToManualOrder());
    }

    const formNewOrder = document.getElementById('form-new-order');
    if (formNewOrder) {
      formNewOrder.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitManualOrder();
      });
    }

    // 2. Nova Mesa
    const btnOpenTableModal = document.getElementById('btn-open-new-table-modal');
    if (btnOpenTableModal) {
      btnOpenTableModal.addEventListener('click', () => this.openModal('modal-table-form'));
    }

    const formNewTable = document.getElementById('form-new-table');
    if (formNewTable) {
      formNewTable.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitNewTable();
      });
    }

    // 3. Novo Produto
    this.initProductFileInput();

    const btnOpenProductModal = document.getElementById('btn-open-product-modal');
    if (btnOpenProductModal) {
      btnOpenProductModal.addEventListener('click', () => {
        this.resetProductFilePreview();
        this.openModal('modal-product-form');
      });
    }

    const formNewProduct = document.getElementById('form-new-product');
    if (formNewProduct) {
      formNewProduct.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitNewProduct();
      });
    }

    // 4. Nova Categoria
    const btnOpenCategoryModal = document.getElementById('btn-open-category-modal');
    if (btnOpenCategoryModal) {
      btnOpenCategoryModal.addEventListener('click', () => this.openModal('modal-category-form'));
    }

    const formNewCategory = document.getElementById('form-new-category');
    if (formNewCategory) {
      formNewCategory.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitNewCategory();
      });
    }

    // 5. Novo Cupom
    const btnOpenCouponModal = document.getElementById('btn-open-coupon-modal');
    if (btnOpenCouponModal) {
      btnOpenCouponModal.addEventListener('click', () => this.openModal('modal-coupon-form'));
    }

    const formNewCoupon = document.getElementById('form-new-coupon');
    if (formNewCoupon) {
      formNewCoupon.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitNewCoupon();
      });
    }

    // 6. Impressão de Totem QR Code
    const btnPrintQr = document.getElementById('btn-print-qr-code');
    if (btnPrintQr) {
      btnPrintQr.addEventListener('click', () => window.print());
    }

    // 7. Impressão de Comanda
    const btnPrintOrder = document.getElementById('btn-print-order');
    if (btnPrintOrder) {
      btnPrintOrder.addEventListener('click', () => window.print());
    }

    // 8. Salvar Configurações
    const formSettings = document.getElementById('form-restaurant-settings');
    if (formSettings) {
      formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        useAlert.sucesso('Configurações salvas com sucesso na plataforma!', 'Configurações Atualizadas');
      });
    }
  },

  openNewOrderModal() {
    this.state.manualOrderCart = [];
    this.renderManualOrderCart();

    // Popula mesas
    const tableSelect = document.getElementById('manual-order-table');
    if (tableSelect) {
      tableSelect.innerHTML = this.state.tables.map(t => `<option value="${t.id}">Mesa ${t.number} (${t.code})</option>`).join('');
    }

    // Popula produtos
    const prodSelect = document.getElementById('manual-order-product-select');
    if (prodSelect) {
      prodSelect.innerHTML = this.state.products
        .filter(p => parseInt(p.is_available, 10) === 1)
        .map(p => `<option value="${p.id}" data-price="${p.price}" data-name="${p.name}">${p.name} - ${useFormatters.currency(p.price, 'Kz')}</option>`).join('');
    }

    this.openModal('modal-new-order');
  },

  addItemToManualOrder() {
    const prodSelect = document.getElementById('manual-order-product-select');
    const qtyInput = document.getElementById('manual-order-qty');
    if (!prodSelect || !qtyInput) return;

    const opt = prodSelect.options[prodSelect.selectedIndex];
    if (!opt) return;

    const pId = parseInt(opt.value, 10);
    const pName = opt.getAttribute('data-name');
    const pPrice = parseFloat(opt.getAttribute('data-price'));
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);

    const existing = this.state.manualOrderCart.find(i => i.product_id === pId);
    if (existing) {
      existing.quantity += qty;
      existing.subtotal = existing.quantity * existing.unit_price;
    } else {
      this.state.manualOrderCart.push({
        product_id: pId,
        name: pName,
        unit_price: pPrice,
        quantity: qty,
        subtotal: pPrice * qty
      });
    }

    this.renderManualOrderCart();
  },

  renderManualOrderCart() {
    const tbody = document.getElementById('manual-order-items-tbody');
    const totalEl = document.getElementById('manual-order-total-val');
    if (!tbody) return;

    if (this.state.manualOrderCart.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted text-xs py-4">Nenhum item adicionado ainda.</td></tr>';
      if (totalEl) totalEl.textContent = '0,00 Kz';
      return;
    }

    let total = 0;
    tbody.innerHTML = this.state.manualOrderCart.map((item, idx) => {
      total += item.subtotal;
      return `
        <tr>
          <td class="font-bold">${item.name}</td>
          <td>${item.quantity}</td>
          <td>${useFormatters.currency(item.unit_price, 'Kz')}</td>
          <td class="font-bold text-green">${useFormatters.currency(item.subtotal, 'Kz')}</td>
          <td>
            <button type="button" class="btn btn-outline btn-xs" onclick="UserDashboard.removeManualOrderItem(${idx})">
              <span data-icon="trash" data-icon-size="12"></span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (totalEl) totalEl.textContent = useFormatters.currency(total, 'Kz');
    AppIcons.replacePlaceholders();
  },

  removeManualOrderItem(idx) {
    this.state.manualOrderCart.splice(idx, 1);
    this.renderManualOrderCart();
  },

  async submitManualOrder() {
    if (this.state.manualOrderCart.length === 0) {
      useAlert.aviso('Adicione pelo menos um item à comanda.', 'Comanda Vazia');
      return;
    }

    const tableId = parseInt(document.getElementById('manual-order-table').value, 10);
    const customerName = document.getElementById('manual-order-customer-name').value.trim();
    const notes = document.getElementById('manual-order-notes').value.trim();

    const submitBtn = document.getElementById('btn-submit-manual-order');
    submitBtn.setAttribute('disabled', 'disabled');
    submitBtn.classList.add('is-loading');

    // 1. Identifica cliente ou usa existente
    const custRes = await useApi.post('/customer/identify', {
      restaurant_id: this.restaurantId,
      name: customerName,
      phone: '+244900000000'
    });

    const customerId = custRes.success && custRes.data.customer ? custRes.data.customer.id : 1;

    // 2. Cria pedido
    const orderRes = await useApi.post('/orders', {
      restaurant_id: this.restaurantId,
      customer_id: customerId,
      table_id: tableId,
      items: this.state.manualOrderCart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity
      })),
      notes: notes
    });

    submitBtn.removeAttribute('disabled');
    submitBtn.classList.remove('is-loading');

    if (orderRes.success) {
      useAlert.sucesso(`Pedido #${orderRes.data.order_id} enviado para a cozinha!`, 'Pedido Aberto');
      this.closeModal('modal-new-order');
      await Promise.all([
        this.loadKitchenOrders(),
        this.loadMetrics(),
        this.loadTables()
      ]);
    } else {
      useAlert.erro(orderRes.message || 'Falha ao abrir comanda manual.', 'Erro');
    }
  },

  async submitNewTable() {
    const number = document.getElementById('table-input-number').value.trim();
    const code = document.getElementById('table-input-code').value.trim();

    const btn = document.getElementById('btn-submit-table');
    btn.setAttribute('disabled', 'disabled');

    const res = await useApi.post('/tables', {
      restaurant_id: this.restaurantId,
      number: number,
      code: code
    });

    btn.removeAttribute('disabled');

    if (res.success) {
      useAlert.sucesso(`Mesa ${number} cadastrada com sucesso!`, 'Mesa Criada');
      this.closeModal('modal-table-form');
      document.getElementById('form-new-table').reset();
      await this.loadTables();
    } else {
      useAlert.erro(res.message || 'Erro ao cadastrar mesa.', 'Falha');
    }
  },

  initProductFileInput() {
    const dropzone = document.getElementById('product-file-dropzone');
    const fileInput = document.getElementById('product-file-input');
    const triggerBtn = document.getElementById('btn-trigger-file-browser');
    const previewImg = document.getElementById('product-file-preview-img');
    const nameLabel = document.getElementById('product-file-name-label');

    if (!fileInput) return;

    if (dropzone) {
      dropzone.onclick = (e) => {
        if (e.target !== fileInput) {
          fileInput.click();
        }
      };
    }

    if (triggerBtn) {
      triggerBtn.onclick = (e) => {
        e.stopPropagation();
        fileInput.click();
      };
    }

    fileInput.onchange = () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (nameLabel) {
          nameLabel.textContent = file.name;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          if (previewImg) {
            previewImg.src = e.target.result;
          }
        };
        reader.readAsDataURL(file);
      }
    };
  },

  resetProductFilePreview() {
    const previewImg = document.getElementById('product-file-preview-img');
    const nameLabel = document.getElementById('product-file-name-label');
    const fileInput = document.getElementById('product-file-input');
    if (previewImg) previewImg.src = '../assets/images/default-product.svg';
    if (nameLabel) nameLabel.textContent = 'Clique para carregar uma imagem';
    if (fileInput) fileInput.value = '';
  },

  async submitNewProduct() {
    const name = document.getElementById('product-name').value.trim();
    const categoryId = parseInt(document.getElementById('product-category').value, 10);
    const price = parseFloat(document.getElementById('product-price').value);
    const descr = document.getElementById('product-description').value.trim();
    const fileInput = document.getElementById('product-file-input');

    const btn = document.getElementById('btn-submit-product');
    btn.setAttribute('disabled', 'disabled');

    const formData = new FormData();
    formData.append('restaurant_id', this.restaurantId);
    formData.append('category_id', categoryId);
    formData.append('name', name);
    formData.append('price', price);
    formData.append('description', descr);

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      formData.append('image', fileInput.files[0]);
    }

    const res = await useApi.postFormData('/products', formData);

    btn.removeAttribute('disabled');

    if (res.success) {
      useAlert.sucesso(`Produto "${name}" cadastrado com sucesso!`, 'Cardápio Atualizado');
      this.closeModal('modal-product-form');
      document.getElementById('form-new-product').reset();
      this.resetProductFilePreview();
      await this.loadProducts();
    } else {
      useAlert.erro(res.message || 'Erro ao cadastrar produto.', 'Falha');
    }
  },

  async submitNewCategory() {
    const name = document.getElementById('category-name').value.trim();
    const btn = document.getElementById('btn-submit-category');
    btn.setAttribute('disabled', 'disabled');

    const res = await useApi.post('/categories', {
      restaurant_id: this.restaurantId,
      name: name
    });

    btn.removeAttribute('disabled');

    if (res.success) {
      useAlert.sucesso(`Categoria "${name}" cadastrada com sucesso!`, 'Categoria Criada');
      this.closeModal('modal-category-form');
      document.getElementById('form-new-category').reset();
      await this.loadProducts();
    } else {
      useAlert.erro(res.message || 'Erro ao cadastrar categoria.', 'Falha');
    }
  },

  async submitNewCoupon() {
    const code = document.getElementById('coupon-code').value.trim();
    const type = document.getElementById('coupon-type').value;
    const val = parseFloat(document.getElementById('coupon-value').value);
    const minOrd = parseFloat(document.getElementById('coupon-min-order').value || 0);
    const maxDisc = parseFloat(document.getElementById('coupon-max-discount').value || 0);

    const btn = document.getElementById('btn-submit-coupon');
    btn.setAttribute('disabled', 'disabled');

    const res = await useApi.post('/coupons', {
      restaurant_id: this.restaurantId,
      code: code,
      type: type,
      value: val,
      minimum_order: minOrd,
      maximum_discount: maxDisc
    });

    btn.removeAttribute('disabled');

    if (res.success) {
      useAlert.sucesso(`Cupom ${code} publicado com sucesso!`, 'Campanha Ativa');
      this.closeModal('modal-coupon-form');
      document.getElementById('form-new-coupon').reset();
      await this.loadCoupons();
    } else {
      useAlert.erro(res.message || 'Erro ao criar cupom.', 'Falha');
    }
  },

  /* ----------------------------------------------------
     11. CONTROLADORIA DE MODAIS & DIÁLOGOS
     ---------------------------------------------------- */
  bindModals() {
    // Fecha modal clicando no backdrop ou no botão com data-close-modal
    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => {
        const modalId = el.getAttribute('data-close-modal');
        this.closeModal(modalId);
      });
    });

    // Fecha modal no Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModalEl = document.querySelector('.app-modal.is-open');
        if (openModalEl) {
          openModalEl.classList.remove('is-open');
          openModalEl.setAttribute('aria-hidden', 'true');
        }
      }
    });
  },

  openModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      modalEl.classList.add('is-open');
      modalEl.setAttribute('aria-hidden', 'false');
      AppIcons.replacePlaceholders();
    }
  },

  closeModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      modalEl.classList.remove('is-open');
      modalEl.setAttribute('aria-hidden', 'true');
    }
  },

  openConfirmDialog(title, message, onConfirm) {
    const titleEl = document.getElementById('confirm-dialog-title');
    if (titleEl) titleEl.textContent = title;

    const msgEl = document.getElementById('confirm-dialog-message');
    if (msgEl) msgEl.textContent = message;

    const confirmBtn = document.getElementById('btn-confirm-dialog-action');
    if (confirmBtn) {
      // Clona botão para limpar listeners anteriores
      const newBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

      newBtn.addEventListener('click', async () => {
        this.closeModal('modal-confirm-dialog');
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
      });
    }

    this.openModal('modal-confirm-dialog');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  UserDashboard.init();
});
