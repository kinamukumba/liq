/**
 * ====================================================================
 * LIQ SAAS - CLIENT CONTROLLER (client.js)
 * Fluxo PWA Mobile-First: Cardápio, Carrinho, Onboarding e Rastreamento
 * ====================================================================
 */

const ClientApp = {
  state: {
    restaurant: null,
    table: null,
    categories: [],
    cart: [],
    customer: null,
    activeOrder: null,
    appliedCoupon: null,
    selectedCategory: null
  },

  async init() {
    this.bindEvents();
    await this.checkSession();
    await this.loadMenu();
    this.restoreActiveOrder();
  },

  bindEvents() {
    // Abrir/Fechar Carrinho
    const openCartBtn = document.getElementById('btn-open-cart');
    if (openCartBtn) {
      openCartBtn.addEventListener('click', () => usePanels.toggle('modal-cart', true));
    }

    const closeCartBtn = document.getElementById('btn-close-cart');
    if (closeCartBtn) {
      closeCartBtn.addEventListener('click', () => usePanels.toggle('modal-cart', false));
    }

    // Aplicar Cupom
    const applyCouponBtn = document.getElementById('btn-apply-coupon');
    if (applyCouponBtn) {
      applyCouponBtn.addEventListener('click', () => this.applyCoupon());
    }

    // Finalizar Pedido
    const checkoutBtn = document.getElementById('btn-checkout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.handleCheckout());
    }

    // Submissão de identificação do cliente
    const identifyForm = document.getElementById('form-customer-identify');
    if (identifyForm) {
      identifyForm.addEventListener('submit', (e) => this.submitIdentification(e));
    }
  },

  async checkSession() {
    const res = await useApi.post('/customer/session', { restaurant_id: 1 });
    if (res.authenticated && res.customer) {
      this.state.customer = res.customer;
      this.renderCustomerChip();
    } else {
      this.renderGuestChip();
    }
  },

  async loadMenu() {
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('t') || '07';

    const res = await useApi.get(`/menu?restaurant=cafe-central&t=${encodeURIComponent(tableParam)}`);
    if (res.success && res.data) {
      this.state.restaurant = res.data.restaurant;
      this.state.table = res.data.table;
      this.state.categories = res.data.categories;

      this.renderHeader();
      this.renderCategoriesBar();
      this.renderMenuList();
    }
  },

  renderHeader() {
    const nameEl = document.getElementById('header-restaurant-name');
    if (nameEl && this.state.restaurant) {
      nameEl.textContent = this.state.restaurant.name;
    }

    const tableEl = document.getElementById('header-table-badge');
    if (tableEl && this.state.table) {
      tableEl.innerHTML = `<span class="badge-dot"></span> Mesa ${this.state.table.number}`;
    }
  },

  renderCustomerChip() {
    const chipContainer = document.getElementById('customer-chip-slot');
    if (chipContainer && this.state.customer) {
      chipContainer.innerHTML = `
        <span class="user-chip" id="btn-wallet-trigger">
          <span class="user-chip-icon">${AppIcons.render('user', 14)}</span>
          <span class="user-chip-name">${useFormatters.escapeHtml(this.state.customer.name)}</span>
          <span class="user-chip-points">${AppIcons.render('loyalty', 12)} Fidelidade</span>
        </span>
      `;
      const btn = chipContainer.querySelector('#btn-wallet-trigger');
      if (btn) btn.addEventListener('click', () => this.openWallet());
    }
  },

  renderGuestChip() {
    const chipContainer = document.getElementById('customer-chip-slot');
    if (chipContainer) {
      chipContainer.innerHTML = `
        <span class="guest-chip" id="btn-guest-trigger">
          <span class="user-chip-icon">${AppIcons.render('user', 14)}</span>
          <span>Identificar</span>
        </span>
      `;
      const btn = chipContainer.querySelector('#btn-guest-trigger');
      if (btn) btn.addEventListener('click', () => usePanels.toggle('modal-customer-identify', true));
    }
  },

  renderCategoriesBar() {
    const bar = document.getElementById('categories-bar');
    if (!bar) return;

    let html = `<button type="button" class="category-pill ${!this.state.selectedCategory ? 'active' : ''}" data-cat-id="all">Todos</button>`;
    this.state.categories.forEach(cat => {
      const active = this.state.selectedCategory === cat.id ? 'active' : '';
      html += `<button type="button" class="category-pill ${active}" data-cat-id="${cat.id}">${useFormatters.escapeHtml(cat.name)}</button>`;
    });

    bar.innerHTML = html;

    bar.querySelectorAll('.category-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-id');
        this.state.selectedCategory = catId === 'all' ? null : parseInt(catId, 10);
        this.renderCategoriesBar();
        this.renderMenuList();
      });
    });
  },

  renderMenuList() {
    const container = document.getElementById('menu-items-list');
    if (!container) return;

    let items = [];
    if (this.state.selectedCategory) {
      const cat = this.state.categories.find(c => c.id === this.state.selectedCategory);
      if (cat) items = cat.items;
    } else {
      this.state.categories.forEach(c => items.push(...c.items));
    }

    if (items.length === 0) {
      container.innerHTML = `<div class="card p-5 text-center text-muted">Nenhum item disponível nesta categoria.</div>`;
      return;
    }

    let html = '';
    items.forEach(item => {
      const inCart = this.state.cart.find(c => c.product_id === item.id);
      const qty = inCart ? inCart.quantity : 0;

      html += `
        <div class="menu-card" data-product-id="${item.id}">
          <div class="menu-card-thumb">
            <img src="${useFormatters.productImage(item.image)}" alt="${useFormatters.escapeHtml(item.name)}" class="menu-card-img" onerror="this.onerror=null; this.src='../assets/images/default-product.svg';">
          </div>
          <div class="menu-card-content">
            <div>
              <div class="menu-card-title">${useFormatters.escapeHtml(item.name)}</div>
              <div class="menu-card-desc">${useFormatters.escapeHtml(item.description || '')}</div>
            </div>
            <div class="menu-card-footer">
              <span class="menu-card-price">${useFormatters.currency(item.price, 'Kz')}</span>
              <div>
                ${qty > 0 ? `
                  <div class="qty-stepper">
                    <button type="button" class="btn btn-sm btn-secondary btn-icon btn-dec" data-id="${item.id}">${AppIcons.render('x', 14)}</button>
                    <span class="qty-stepper-val">${qty}</span>
                    <button type="button" class="btn btn-sm btn-primary btn-icon btn-inc" data-id="${item.id}">${AppIcons.render('plus', 14)}</button>
                  </div>
                ` : `
                  <button type="button" class="btn btn-sm btn-primary btn-add" data-id="${item.id}">
                    ${AppIcons.render('plus', 14)} Adicionar
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.btn-add, .btn-inc').forEach(b => {
      b.addEventListener('click', () => this.addToCart(parseInt(b.getAttribute('data-id'), 10)));
    });

    container.querySelectorAll('.btn-dec').forEach(b => {
      b.addEventListener('click', () => this.removeFromCart(parseInt(b.getAttribute('data-id'), 10)));
    });
  },

  addToCart(productId) {
    let product = null;
    for (const c of this.state.categories) {
      const found = c.items.find(i => i.id === productId);
      if (found) { product = found; break; }
    }
    if (!product) return;

    const existing = this.state.cart.find(c => c.product_id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.state.cart.push({
        product_id: productId,
        name: product.name,
        price: product.price,
        quantity: 1
      });
    }

    this.updateCart();
    this.renderMenuList();
  },

  removeFromCart(productId) {
    const idx = this.state.cart.findIndex(c => c.product_id === productId);
    if (idx > -1) {
      if (this.state.cart[idx].quantity > 1) {
        this.state.cart[idx].quantity -= 1;
      } else {
        this.state.cart.splice(idx, 1);
      }
    }
    this.updateCart();
    this.renderMenuList();
  },

  updateCart() {
    const totalItems = this.state.cart.reduce((s, i) => s + i.quantity, 0);
    const subtotal = this.state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);

    const floatingBar = document.getElementById('client-cart-floating');
    if (floatingBar) {
      floatingBar.classList.toggle('d-none', totalItems === 0);
      const qtyEl = document.getElementById('floating-cart-qty');
      if (qtyEl) qtyEl.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;
      const totEl = document.getElementById('floating-cart-total');
      if (totEl) totEl.textContent = useFormatters.currency(subtotal, 'Kz');
    }

    this.renderCartDrawer(subtotal);
  },

  renderCartDrawer(subtotal) {
    const listEl = document.getElementById('cart-drawer-items');
    if (!listEl) return;

    if (this.state.cart.length === 0) {
      listEl.innerHTML = `<div class="text-center text-muted p-4">Seu carrinho está vazio.</div>`;
      this.renderCartTotals(0, 0, 0);
      return;
    }

    let html = '';
    this.state.cart.forEach(item => {
      const itemSub = item.price * item.quantity;
      html += `
        <div class="cart-drawer-item">
          <div>
            <div class="cart-drawer-item-title">${useFormatters.escapeHtml(item.name)}</div>
            <div class="cart-drawer-item-meta">${item.quantity}x ${useFormatters.currency(item.price, 'Kz')}</div>
          </div>
          <div class="d-flex items-center gap-3">
            <span class="cart-drawer-subtotal">${useFormatters.currency(itemSub, 'Kz')}</span>
            <div class="qty-stepper">
              <button type="button" class="btn btn-sm btn-secondary btn-icon btn-cart-dec" data-id="${item.product_id}">${AppIcons.render('x', 12)}</button>
              <span class="qty-stepper-val">${item.quantity}</span>
              <button type="button" class="btn btn-sm btn-primary btn-icon btn-cart-inc" data-id="${item.product_id}">${AppIcons.render('plus', 12)}</button>
            </div>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.btn-cart-inc').forEach(b => {
      b.addEventListener('click', () => this.addToCart(parseInt(b.getAttribute('data-id'), 10)));
    });

    listEl.querySelectorAll('.btn-cart-dec').forEach(b => {
      b.addEventListener('click', () => this.removeFromCart(parseInt(b.getAttribute('data-id'), 10)));
    });

    let discount = 0;
    if (this.state.appliedCoupon) {
      if (this.state.appliedCoupon.type === 'PERCENTAGE') {
        discount = Math.round((subtotal * this.state.appliedCoupon.value) / 100);
      } else {
        discount = Math.min(subtotal, this.state.appliedCoupon.value);
      }
    }

    const total = Math.max(0, subtotal - discount);
    this.renderCartTotals(subtotal, discount, total);
  },

  renderCartTotals(subtotal, discount, total) {
    const subEl = document.getElementById('cart-subtotal-val');
    if (subEl) subEl.textContent = useFormatters.currency(subtotal, 'Kz');

    const discRow = document.getElementById('cart-discount-row');
    const discEl = document.getElementById('cart-discount-val');
    if (discRow && discEl) {
      if (discount > 0) {
        discRow.classList.remove('d-none');
        discEl.textContent = `- ${useFormatters.currency(discount, 'Kz')}`;
      } else {
        discRow.classList.add('d-none');
      }
    }

    const totEl = document.getElementById('cart-total-val');
    if (totEl) totEl.textContent = useFormatters.currency(total, 'Kz');
  },

  async applyCoupon() {
    const input = document.getElementById('input-coupon-code');
    const msgEl = document.getElementById('coupon-feedback');
    if (!input || !msgEl) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
      msgEl.textContent = 'Digite o código do cupom.';
      msgEl.className = 'form-error';
      return;
    }

    const subtotal = this.state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    const customerId = this.state.customer ? this.state.customer.id : 0;

    const res = await useApi.post('/coupons/validate', {
      restaurant_id: this.state.restaurant ? this.state.restaurant.id : 1,
      customer_id: customerId,
      code: code,
      subtotal: subtotal
    });

    if (res.success && res.data.valid) {
      this.state.appliedCoupon = res.data;
      msgEl.textContent = `Cupom ${code} aplicado! Desconto de ${useFormatters.currency(res.data.discount, 'Kz')}`;
      msgEl.className = 'form-helper text-green';
      this.updateCart();
    } else {
      this.state.appliedCoupon = null;
      msgEl.textContent = res.message || 'Cupom inválido.';
      msgEl.className = 'form-error';
      this.updateCart();
    }
  },

  async handleCheckout() {
    if (this.state.cart.length === 0) {
      alert('Seu carrinho está vazio.');
      return;
    }

    if (!this.state.customer) {
      usePanels.toggle('modal-cart', false);
      usePanels.toggle('modal-customer-identify', true);
      return;
    }

    await this.submitOrder();
  },

  async submitOrder() {
    const notesInput = document.getElementById('input-order-notes');
    const notes = notesInput ? notesInput.value.trim() : '';

    const payload = {
      restaurant_id: this.state.restaurant.id,
      customer_id: this.state.customer.id,
      table_id: this.state.table ? this.state.table.id : 1,
      items: this.state.cart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity
      })),
      coupon_code: this.state.appliedCoupon ? this.state.appliedCoupon.code : null,
      notes: notes
    };

    const res = await useApi.post('/orders', payload);

    if (res.success) {
      this.state.cart = [];
      this.state.appliedCoupon = null;
      this.updateCart();
      usePanels.toggle('modal-cart', false);

      localStorage.setItem('liq_last_order_id', String(res.data.order_id));
      this.openTracking(res.data.order_id);
    } else {
      alert(res.message || 'Erro ao registrar pedido.');
    }
  },

  async submitIdentification(e) {
    e.preventDefault();
    const name = document.getElementById('input-cust-name').value.trim();
    const phone = document.getElementById('input-cust-phone').value.trim();
    const email = document.getElementById('input-cust-email').value.trim();

    const res = await useApi.post('/customer/identify', {
      restaurant_id: this.state.restaurant ? this.state.restaurant.id : 1,
      name,
      phone,
      email
    });

    if (res.success && res.data) {
      this.state.customer = res.data.customer;
      this.renderCustomerChip();
      usePanels.toggle('modal-customer-identify', false);

      if (this.state.cart.length > 0) {
        usePanels.toggle('modal-cart', true);
      }
    } else {
      alert(res.message || 'Erro ao identificar cliente.');
    }
  },

  async openWallet() {
    if (!this.state.customer) return;

    const res = await useApi.get(`/customer/wallet?customer_id=${this.state.customer.id}&restaurant_id=1`);
    if (res.success && res.data) {
      const w = res.data;
      document.getElementById('wallet-points-val').textContent = w.points;
      document.getElementById('wallet-orders-val').textContent = w.orders_completed;
      document.getElementById('wallet-next-target-val').textContent = `${w.next_benefit_target} pedidos`;
      document.getElementById('wallet-remaining-val').textContent = `${w.remaining_orders} pedidos`;

      usePanels.toggle('modal-wallet', true);
    }
  },

  async openTracking(orderId) {
    usePanels.toggle('modal-tracking', true);
    await this.pollOrderStatus(orderId);
  },

  async pollOrderStatus(orderId) {
    const res = await useApi.get(`/orders/${orderId}`);
    if (res.success && res.data) {
      const order = res.data;
      document.getElementById('track-order-num').textContent = `#${order.id}`;
      document.getElementById('track-order-table').textContent = `Mesa ${order.table_number}`;
      document.getElementById('track-order-total').textContent = useFormatters.currency(order.total, 'Kz');

      const statuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
      const currentIdx = statuses.indexOf(order.status);

      statuses.forEach((st, idx) => {
        const stepEl = document.getElementById(`track-step-${st.toLowerCase()}`);
        if (stepEl) {
          stepEl.classList.remove('completed', 'active');
          if (idx < currentIdx) stepEl.classList.add('completed');
          else if (idx === currentIdx) stepEl.classList.add('active');
        }
      });

      const badge = document.getElementById('track-status-badge');
      if (badge) {
        badge.className = `badge badge-${order.status.toLowerCase()}`;
        badge.innerHTML = `<span class="badge-dot"></span> ${useFormatters.orderStatus(order.status)}`;
      }
    }
  },

  restoreActiveOrder() {
    const lastId = localStorage.getItem('liq_last_order_id');
    if (lastId) {
      const banner = document.getElementById('active-order-banner');
      if (banner) {
        banner.classList.remove('d-none');
        banner.querySelector('#btn-view-active-order').addEventListener('click', () => {
          this.openTracking(parseInt(lastId, 10));
        });
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ClientApp.init();
});
