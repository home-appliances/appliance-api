// ===== 状态管理 =====

const Store = {
  // 当前用户
  get currentUser() {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  },

  // 是否超级管理员
  get isSuperAdmin() {
    return this.currentUser?.role === 'super_admin';
  },

  // 主题
  get theme() {
    return localStorage.getItem('theme') || 'light';
  },
  set theme(v) {
    localStorage.setItem('theme', v);
    document.documentElement.setAttribute('data-theme', v);
  },

  // 侧边栏折叠
  get sidebarCollapsed() {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  },
  set sidebarCollapsed(v) {
    localStorage.setItem('sidebarCollapsed', v);
  },

  // 打开的标签页
  _tabs: [{ key: 'dashboard', title: '系统概览', icon: '📊' }],
  _activeTab: 'dashboard',

  get tabs() { return this._tabs; },
  get activeTab() { return this._activeTab; },

  openTab(key, title, icon) {
    if (!this._tabs.find(t => t.key === key)) {
      this._tabs.push({ key, title, icon });
    }
    this._activeTab = key;
    App.renderTabs();
    App.renderPage(key);
  },

  closeTab(key) {
    const idx = this._tabs.findIndex(t => t.key === key);
    if (idx === -1) return;
    this._tabs.splice(idx, 1);
    if (this._activeTab === key) {
      this._activeTab = this._tabs[Math.max(0, idx - 1)]?.key || 'dashboard';
    }
    App.renderTabs();
    App.renderPage(this._activeTab);
  },

  switchTab(key) {
    this._activeTab = key;
    App.renderTabs();
    App.renderPage(key);
  },

  // 检查权限（简化版，直接用角色判断）
  hasPermission(perm) {
    if (this.isSuperAdmin) return true;
    const user = this.currentUser;
    if (!user) return false;
    // admin 角色拥有大部分权限
    if (user.role === 'admin') return true;
    // viewer 角色只有只读权限
    if (user.role === 'viewer') {
      // 只读用户只能查看，不能修改
      if (perm === 'read' || perm === 'view') return true;
      return false;
    }
    return false;
  },

  // 检查是否为只读用户
  get isViewer() {
    return this.currentUser?.role === 'viewer';
  },

  // Toast
  _toasts: [],
  showToast(message, type = 'success', duration = 3000) {
    const id = Date.now();
    this._toasts.push({ id, message, type, duration });
    App.renderToasts();
    setTimeout(() => this.removeToast(id), duration);
  },

  removeToast(id) {
    this._toasts = this._toasts.filter(t => t.id !== id);
    App.renderToasts();
  },

  // 确认弹窗
  _confirmResolve: null,
  showConfirm(options) {
    return new Promise(resolve => {
      this._confirmResolve = resolve;
      App.showConfirmModal(options);
    });
  },
};
