/**
 * ====================================================================
 * LIQ SAAS - Central API Client Utility (useApi.js)
 * Adaptável para Ambiente Local (XAMPP) e Infraestrutura Multi-Subdomínio
 * (liq.ao, app.liq.ao, api.liq.ao/app-api, backoffice.liq.ao)
 * ====================================================================
 */

const useApi = {
  /**
   * Resolução dinâmica da Base URL da API com base no hostname
   */
  getBaseUrl() {
    if (window.APP_CONFIG && window.APP_CONFIG.apiUrl) {
      return window.APP_CONFIG.apiUrl;
    }

    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';

    if (isLocal) {
      // Local dev sob subpasta /liq ou raiz do virtual host
      const isSubdirectory = window.location.pathname.startsWith('/liq');
      return isSubdirectory ? '/liq/api' : '/api';
    }

    // Produção Multi-Subdomínio: api.liq.ao/app-api
    if (host.endsWith('liq.ao')) {
      return 'https://api.liq.ao/app-api';
    }

    // Fallback padrão
    return '/api';
  },

  get baseUrl() {
    return this.getBaseUrl();
  },

  async request(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.getBaseUrl()}${cleanEndpoint}`;

    const defaultHeaders = {
      'Accept': 'application/json'
    };

    if (options.body && typeof options.body === 'string') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      credentials: 'include', // Essencial para cookies de sessão e autenticação cross-subdomain
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const res = await fetch(url, config);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`[API ERROR] ${options.method || 'GET'} ${url}:`, err);
      return {
        success: false,
        message: 'Falha de comunicação com o servidor. Verifique sua conexão.'
      };
    }
  },

  async get(endpoint, headers = {}) {
    return this.request(endpoint, {
      method: 'GET',
      headers
    });
  },

  async post(endpoint, data = {}, headers = {}) {
    return this.request(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
  },

  async patch(endpoint, data = {}, headers = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });
  },

  async put(endpoint, data = {}, headers = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
  },

  async delete(endpoint, headers = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      headers
    });
  }
};
