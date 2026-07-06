// ===== API 请求封装 =====

const API_BASE = 'http://localhost:3000/api/admin';

const Api = {
  // 获取 token
  getToken() { return localStorage.getItem('admin_token') || ''; },

  // 通用请求
  async request(path, options = {}) {
    const url = API_BASE + path;
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const resp = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
      const data = await resp.json();

      if (resp.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'login.html';
        return null;
      }

      if (!resp.ok) throw new Error(data.message || `请求失败 (${resp.status})`);
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') throw new Error('无法连接服务器，请确认后端已启动');
      throw err;
    }
  },

  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
  del(path) { return this.request(path, { method: 'DELETE' }); },

  // ===== 认证 =====
  login(username, password) { return this.post('/login', { username, password }); },
  getProfile() { return this.get('/profile'); },
  changePassword(oldPassword, newPassword) { return this.put('/password', { oldPassword, newPassword }); },

  // ===== 用户管理 =====
  getUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get('/users' + (q ? '?' + q : ''));
  },
  getUser(id) { return this.get(`/users/${id}`); },
  createUser(data) { return this.post('/users', data); },
  updateUser(id, data) { return this.put(`/users/${id}`, data); },
  deleteUser(id) { return this.del(`/users/${id}`); },
  updateUserStatus(id, status) { return this.put(`/users/${id}/status`, { status }); },
  resetPassword(id) { return this.put(`/users/${id}/reset-password`); },

  // ===== 产品管理 =====
  getProducts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get('/products' + (q ? '?' + q : ''));
  },
  getProduct(id) { return this.get(`/products/${id}`); },
  updateProduct(id, data) { return this.put(`/products/${id}`, data); },
  deleteProduct(id) { return this.del(`/products/${id}`); },
  batchDeleteProducts(ids) { return this.post('/products/batch/delete', { ids }); },
  getBrands() { return this.get('/brands'); },
  getCategories() { return this.get('/categories'); },

  // ===== 统计 =====
  getStatsOverview() { return this.get('/stats/overview'); },
  getStatsBrands() { return this.get('/stats/brands'); },
  getStatsCategories() { return this.get('/stats/categories'); },
  getStatsSearch() { return this.get('/stats/search'); },
  getStatsSearchTrend() { return this.get('/stats/search-trend'); },

  // ===== 爬虫任务 =====
  getCrawlerTasks(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get('/crawler/tasks' + (q ? '?' + q : ''));
  },
  startCrawler(category) { return this.post('/crawler/start', { category }); },
  stopCrawler(id) { return this.post(`/crawler/tasks/${id}/stop`); },
  deleteCrawlerTask(id) { return this.del(`/crawler/tasks/${id}`); },

  // ===== 操作日志 =====
  getLogs(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get('/logs' + (q ? '?' + q : ''));
  },

  // ===== 系统设置 =====
  getSettings() { return this.get('/settings'); },
  updateSettings(key, value) { return this.put('/settings', { key, value }); },
};
