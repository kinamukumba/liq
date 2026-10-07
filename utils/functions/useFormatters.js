/**
 * Utility Formatter Functions (useFormatters)
 */

const useFormatters = {
  currency(value, symbol = 'Kz') {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('pt-AO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ' + symbol;
  },

  time(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });
  },

  date(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  orderStatus(status) {
    const map = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      PREPARING: 'Em Preparação',
      READY: 'Pronto',
      DELIVERING: 'A Caminho',
      COMPLETED: 'Concluído',
      CANCELLED: 'Cancelado'
    };
    return map[status] || status;
  },

  tableStatus(status) {
    const map = {
      AVAILABLE: 'Disponível',
      OCCUPIED: 'Ocupada',
      WAITING_ORDER: 'Aguardando Pedido',
      ORDERING: 'Em Pedido',
      WAITING_PAYMENT: 'Conta Solicitada',
      CLEANING: 'Aguardando Limpeza',
      INACTIVE: 'Inativa'
    };
    return map[status] || status;
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
