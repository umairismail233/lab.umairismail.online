// ID Workbench v2 - API Client
const Toast = {
  show(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-item';

    let icon = 'ℹ️';
    let borderColor = '#e2e8f0';
    if (type === 'success') {
      icon = '✓';
      borderColor = '#a7f3d0';
      toast.style.backgroundColor = '#f0fdf4';
      toast.style.color = '#166534';
    } else if (type === 'error') {
      icon = '✕';
      borderColor = '#fecdd3';
      toast.style.backgroundColor = '#fff1f2';
      toast.style.color = '#9f1239';
    }

    toast.style.borderColor = borderColor;
    toast.innerHTML = `
      <span style="font-weight: 700; font-size: 14px;">${icon}</span>
      <div style="flex: 1; font-weight: 500;">${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3500);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); }
};

const API = {
  csrfToken: null,

  async request(endpoint, options = {}) {
    const headers = {
      'Accept': 'application/json',
      'X-Client-Time': new Date().toISOString(),
      ...(options.headers || {})
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    if (res.status === 401) {
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
      return null;
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const err = (data && data.error) ? data.error : `Request failed (${res.status})`;
      throw new Error(err);
    }

    if (data && data.csrf_token) {
      this.csrfToken = data.csrf_token;
    }

    return data;
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body || {})
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body || {})
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
