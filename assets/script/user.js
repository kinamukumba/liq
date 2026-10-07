/**
 * ====================================================================
 * LIQ SAAS - RESTAURANT USER DASHBOARD CONTROLLER (user.js)
 * Renderização dinâmica e chaveamento de painéis via usePanels
 * ====================================================================
 */

const UserDashboard = {
  restaurantId: 1,
  autoRefreshTimer: null,

  async init() {
    this.bindNavigation();
    await this.loadMetrics();
    await this.loadKitchenOrders();
    this.startAutoRefresh();
  },

  bindNavigation() {
    // Escuta cliques nos botões de navegação da sidebar
    document.querySelectorAll('.app-sidebar-nav .nav-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPanelId = btn.getAttribute('data-target-panel');
        if (!targetPanelId) return;

        // Oculta e mostra painel usando a função do usePanels
        usePanels.show(targetPanelId, '.app-sidebar-nav .nav-link');

        // Atualiza título do cabeçalho
        const titles = {
          'panel-dashboard': 'Visão Geral & Indicadores',
          'panel-kitchen': 'Pedidos em Tempo Real (Cozinha & Salão)',
          'panel-tables': 'Gestão de Mesas & QR Codes',
          'panel-crm': 'Clientes & Base CRM',
          'panel-coupons': 'Cupons & Campanhas Promocionais'
        };
        const titleEl = document.getElementById('page-header-title');
        if (titleEl) {
          titleEl.textContent = titles[targetPanelId] || 'Painel de Gestão';
        }

        // Se for para a cozinha ou dashboard, recarrega dados imediatamente
        if (targetPanelId === 'panel-kitchen') {
          this.loadKitchenOrders();
        } else if (targetPanelId === 'panel-dashboard') {
          this.loadMetrics();
        }
      });
    });

    // Botão de atualização manual
    const refreshBtn = document.getElementById('btn-manual-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.setAttribute('disabled', 'disabled');
        await this.loadMetrics();
        await this.loadKitchenOrders();
        useAlert.info('Dados operacionais sincronizados em tempo real.', 'Atualização Concluída');
        refreshBtn.removeAttribute('disabled');
      });
    }
  },

  async loadMetrics() {
    const res = await useApi.get(`/dashboard?restaurant_id=${this.restaurantId}`);
    if (res.success && res.data) {
      this.renderMetrics(res.data);
    }
  },

  renderMetrics(data) {
    const { sales, orders, customers, tables, top_products, peak_hours } = data;

    // 1. KPIs de Vendas
    const salesEl = document.getElementById('kpi-sales-today');
    if (salesEl) salesEl.textContent = useFormatters.currency(sales.today, sales.currency);

    const growthEl = document.getElementById('kpi-growth');
    if (growthEl) {
      const isPos = sales.growth_percent >= 0;
      growthEl.className = `card-metric-trend ${isPos ? 'trend-up' : 'trend-down'}`;
      growthEl.innerHTML = `${AppIcons.render('trendingUp', 14)} ${isPos ? '+' : ''}${sales.growth_percent}% vs ontem`;
    }

    const ordersEl = document.getElementById('kpi-orders-today');
    if (ordersEl) ordersEl.textContent = sales.orders_today;

    const ticketEl = document.getElementById('kpi-avg-ticket');
    if (ticketEl) ticketEl.textContent = useFormatters.currency(sales.avg_ticket, sales.currency);

    const clientsEl = document.getElementById('kpi-total-clients');
    if (clientsEl) clientsEl.textContent = customers.total;

    const returnRateEl = document.getElementById('kpi-return-rate');
    if (returnRateEl) returnRateEl.textContent = `${customers.return_rate_percent}% recorrentes`;

    // 2. Distribuição dos Pedidos por Estado
    const statusContainer = document.getElementById('orders-status-pills');
    if (statusContainer) {
      const byStatus = orders.by_status || {};
      statusContainer.innerHTML = `
        <span class="badge badge-pending"><span class="badge-dot"></span> ${byStatus.PENDING || 0} Pendentes</span>
        <span class="badge badge-confirmed"><span class="badge-dot"></span> ${byStatus.CONFIRMED || 0} Confirmados</span>
        <span class="badge badge-preparing"><span class="badge-dot"></span> ${byStatus.PREPARING || 0} Em Preparação</span>
        <span class="badge badge-ready"><span class="badge-dot"></span> ${byStatus.READY || 0} Prontos</span>
        <span class="badge badge-completed"><span class="badge-dot"></span> ${byStatus.COMPLETED || 0} Concluídos</span>
        <span class="badge badge-cancelled"><span class="badge-dot"></span> ${byStatus.CANCELLED || 0} Cancelados</span>
      `;
    }

    // 3. Ranking de Mais Vendidos (Regra 36)
    const topContainer = document.getElementById('top-products-list');
    if (topContainer) {
      if (!top_products || top_products.length === 0) {
        topContainer.innerHTML = `<div class="text-sm text-muted">Ainda não há vendas registradas para o ranking.</div>`;
      } else {
        const maxSold = Math.max(...top_products.map(p => parseInt(p.total_sold, 10)), 1);
        let html = '';
        top_products.forEach((prod, idx) => {
          const percent = Math.round((parseInt(prod.total_sold, 10) / maxSold) * 100);
          html += `
            <div class="product-rank-row">
              <div class="product-rank-meta">
                <span>${idx + 1}. ${useFormatters.escapeHtml(prod.product_name_snapshot)}</span>
                <span class="text-muted">${prod.total_sold} pedidos (${useFormatters.currency(prod.revenue, 'Kz')})</span>
              </div>
              <div class="product-rank-bar-bg">
                <div class="product-rank-bar-fill" style="width: ${percent}%;"></div>
              </div>
            </div>
          `;
        });
        topContainer.innerHTML = html;
      }
    }

    // 4. Horários de Pico (Regra 37)
    const peakContainer = document.getElementById('peak-hours-chart');
    if (peakContainer) {
      const hourMap = {};
      (peak_hours || []).forEach(ph => {
        hourMap[ph.hour_of_day] = parseInt(ph.order_count, 10);
      });

      const displayHours = [8, 9, 10, 11, 12, 13, 14, 15, 16];
      let maxOrdersInHour = 1;
      displayHours.forEach(h => {
        if ((hourMap[h] || 0) > maxOrdersInHour) maxOrdersInHour = hourMap[h];
      });

      let html = '';
      displayHours.forEach(h => {
        const count = hourMap[h] || 0;
        const barPercent = Math.max(6, Math.round((count / maxOrdersInHour) * 100));
        const hourLabel = String(h).padStart(2, '0') + 'h';
        html += `
          <div class="peak-hour-row">
            <span class="peak-hour-label">${hourLabel}</span>
            <div class="peak-hour-bar-bg">
              <div class="peak-hour-bar-fill" style="width: ${count > 0 ? barPercent : 0}%;"></div>
            </div>
            <span class="peak-hour-count">${count}</span>
          </div>
        `;
      });
      peakContainer.innerHTML = html;
    }

    // 5. Resumo das Mesas
    const tablesEl = document.getElementById('tables-summary-stat');
    if (tablesEl && tables) {
      tablesEl.innerHTML = `
        <div class="d-flex gap-4 text-xs font-medium">
          <span><strong>${tables.total}</strong> Mesas</span>
          <span class="text-green"><strong>${tables.available}</strong> Livres</span>
          <span class="text-danger"><strong>${tables.occupied}</strong> Ocupadas</span>
        </div>
      `;
    }
  },

  async loadKitchenOrders() {
    const res = await useApi.get(`/orders/kitchen?restaurant_id=${this.restaurantId}`);
    if (res.success && res.data) {
      this.renderKitchenBoard(res.data);
    }
  },

  renderKitchenBoard(orders) {
    const container = document.getElementById('kitchen-orders-grid');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="card p-6 text-center text-muted" style="grid-column: 1 / -1;">
          <span data-icon="check" data-icon-size="32" class="mb-3 d-block"></span>
          <p>Nenhum pedido ativo no momento. Todos os pedidos estão concluídos!</p>
        </div>
      `;
      AppIcons.replacePlaceholders();
      return;
    }

    let html = '';
    orders.forEach(order => {
      let itemsListHtml = '';
      order.items.forEach(i => {
        itemsListHtml += `
          <div class="kds-item-row">
            <span><strong>${i.quantity}x</strong> ${useFormatters.escapeHtml(i.product_name_snapshot)}</span>
          </div>
        `;
      });

      const nextBtn = this.getNextStatusButton(order.id, order.status);

      html += `
        <div class="card kds-card">
          <div class="card-header">
            <div>
              <div class="d-flex items-center gap-2">
                <span class="card-title text-sm">Pedido #${order.id}</span>
                <span class="badge badge-available">Mesa ${order.table_number}</span>
              </div>
              <div class="card-subtitle">${useFormatters.escapeHtml(order.customer_name)} &bull; ${useFormatters.time(order.created_at)}</div>
            </div>
            <span class="badge badge-${order.status.toLowerCase()}">${useFormatters.orderStatus(order.status)}</span>
          </div>

          <div class="card-body flex-1 p-3">
            ${order.notes ? `
              <div class="alert alert-warning p-2 text-xs mb-2">
                <strong>Obs:</strong> ${useFormatters.escapeHtml(order.notes)}
              </div>
            ` : ''}
            <div>${itemsListHtml}</div>
          </div>

          <div class="card-footer p-3 justify-between">
            <span class="text-sm font-bold">${useFormatters.currency(order.total, 'Kz')}</span>
            <div class="d-flex gap-2">
              ${nextBtn}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    AppIcons.replacePlaceholders();

    container.querySelectorAll('.btn-advance-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = parseInt(btn.getAttribute('data-order-id'), 10);
        const nextStatus = btn.getAttribute('data-next-status');
        this.updateOrderStatus(orderId, nextStatus);
      });
    });
  },

  getNextStatusButton(orderId, currentStatus) {
    if (currentStatus === 'PENDING') {
      return `<button type="button" class="btn btn-sm btn-primary btn-advance-status" data-order-id="${orderId}" data-next-status="CONFIRMED">Confirmar</button>`;
    } else if (currentStatus === 'CONFIRMED') {
      return `<button type="button" class="btn btn-sm btn-primary btn-advance-status" data-order-id="${orderId}" data-next-status="PREPARING">Preparar</button>`;
    } else if (currentStatus === 'PREPARING') {
      return `<button type="button" class="btn btn-sm btn-primary btn-advance-status" data-order-id="${orderId}" data-next-status="READY">Pronto</button>`;
    } else if (currentStatus === 'READY') {
      return `<button type="button" class="btn btn-sm btn-primary btn-advance-status" data-order-id="${orderId}" data-next-status="COMPLETED">Entregue</button>`;
    }
    return '';
  },

  async updateOrderStatus(orderId, newStatus) {
    const res = await useApi.patch(`/orders/${orderId}/status`, {
      restaurant_id: this.restaurantId,
      status: newStatus
    });

    if (res.success) {
      useAlert.sucesso(`Pedido #${orderId} atualizado para "${useFormatters.orderStatus(newStatus)}"`, 'Status Atualizado');
      await this.loadKitchenOrders();
      await this.loadMetrics();
    } else {
      useAlert.erro(res.message || 'Erro ao atualizar pedido.', 'Falha na Atualização');
    }
  },

  startAutoRefresh() {
    this.autoRefreshTimer = setInterval(() => {
      if (usePanels.activePanelId === 'panel-kitchen') {
        this.loadKitchenOrders();
      } else if (usePanels.activePanelId === 'panel-dashboard') {
        this.loadMetrics();
      }
    }, 10000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  UserDashboard.init();
});
