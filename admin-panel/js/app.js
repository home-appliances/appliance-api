// ===== 管理后台核心应用（重写版） =====

const App = {
  currentPage: 'dashboard',
  token: '',

  // ===== 初始化 =====
  init() {
    const user = Store.currentUser;
    if (!user) { window.location.href = 'login.html'; return; }
    this.token = localStorage.getItem('admin_token') || '';
    document.documentElement.setAttribute('data-theme', Store.theme);
    this.renderLayout();
    this.bindGlobalEvents();
    this.navigateTo('dashboard');
    console.log('[App] 初始化完成，用户:', user.username);
  },

  // ===== API 请求 =====
  async api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    try {
      const resp = await fetch('http://localhost:3000/api/admin' + path, { ...options, headers });
      const data = await resp.json();
      if (resp.status === 401) { localStorage.clear(); window.location.href = 'login.html'; return null; }
      if (!resp.ok) throw new Error(data.message || '请求失败');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') throw new Error('无法连接服务器');
      throw err;
    }
  },

  // ===== 布局渲染 =====
  renderLayout() {
    const user = Store.currentUser;
    const isSuper = Store.isSuperAdmin;
    const isViewer = Store.isViewer;
    document.getElementById('headerAvatar').textContent = user.avatar || user.name?.[0] || 'U';
    document.getElementById('headerUserName').textContent = user.name || user.username;
    document.getElementById('headerUserRole').textContent = isSuper ? '超级管理员' : isViewer ? '只读用户' : '数据管理员';
    document.getElementById('menuUserName').textContent = user.name || user.username;
    document.getElementById('menuUserEmail').textContent = user.email || '';

    // 侧边栏导航
    const nav = document.getElementById('sidebarNav');
    const groups = [
      { title: '概览', items: [{ key: 'dashboard', icon: '📊', text: '系统概览' }] },
      ...(isSuper ? [{ title: '系统管理', items: [
        { key: 'users', icon: '👥', text: '用户管理' },
      ]}] : []),
      { title: '数据', items: [
        { key: 'products', icon: '📦', text: '产品管理' },
        { key: 'brands', icon: '🏷', text: '品牌管理' },
        { key: 'categories', icon: '📂', text: '分类管理' },
      ]},
      ...(!isViewer ? [{ title: '审计', items: [{ key: 'logs', icon: '📝', text: '操作日志' }] }] : []),
    ];
    nav.innerHTML = groups.map(g => `
      <div class="nav-group">
        <div class="nav-group-title">${g.title}</div>
        ${g.items.map(item => `
          <a class="nav-item" data-nav="${item.key}">
            <span class="nav-item-icon">${item.icon}</span>
            <span class="nav-item-text">${item.text}</span>
          </a>
        `).join('')}
      </div>
    `).join('');

    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed', Store.sidebarCollapsed);
  },

  // ===== 全局事件 =====
  bindGlobalEvents() {
    // 侧边栏导航
    document.getElementById('sidebarNav').addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { e.preventDefault(); this.navigateTo(nav.dataset.nav); }
    });

    // 侧边栏折叠
    document.getElementById('btnCollapseSidebar').addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      Store.sidebarCollapsed = sidebar.classList.contains('collapsed');
      document.getElementById('collapseIcon').textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
    });

    // 主题切换
    document.getElementById('btnTheme').addEventListener('click', () => {
      Store.theme = Store.theme === 'dark' ? 'light' : 'dark';
      document.getElementById('btnTheme').textContent = Store.theme === 'dark' ? '☀️' : '🌙';
    });

    // 全屏
    document.getElementById('btnFullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    // 用户菜单
    document.getElementById('btnUser').addEventListener('click', () => {
      document.getElementById('userDropdown').classList.toggle('open');
    });

    // 用户菜单操作
    document.getElementById('userMenu').addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (!action) return;
      if (action.dataset.action === 'logout') { localStorage.clear(); window.location.href = 'login.html'; }
      else if (action.dataset.action === 'profile' || action.dataset.action === 'password') { this.navigateTo('profile'); }
      document.getElementById('userDropdown').classList.remove('open');
    });

    // 通知
    document.getElementById('btnNotification').addEventListener('click', () => {
      document.getElementById('notificationWrapper').classList.toggle('open');
    });

    // 点击空白关闭下拉
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-dropdown')) document.getElementById('userDropdown')?.classList.remove('open');
      if (!e.target.closest('.notification-wrapper')) document.getElementById('notificationWrapper')?.classList.remove('open');
    });

    // ESC 关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.getElementById('modalOverlay').classList.remove('visible');
    });
  },

  // ===== 页面导航 =====
  navigateTo(page) {
    this.currentPage = page;
    // 更新侧边栏高亮
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === page);
    });
    // 更新面包屑
    this.renderBreadcrumb(page);
    // 更新标签栏
    this.renderTabs(page);
    // 渲染页面
    this.renderPage(page);
  },

  renderBreadcrumb(page) {
    const map = {
      dashboard: ['系统概览'],
      users: ['系统管理', '用户管理'],
      settings: ['系统管理', '系统设置'],
      products: ['数据管理', '产品管理'],
      brands: ['数据管理', '品牌管理'],
      categories: ['数据管理', '分类管理'],
      logs: ['审计日志', '操作日志'],
      profile: ['个人中心'],
    };
    const crumbs = map[page] || ['首页'];
    document.getElementById('breadcrumb').innerHTML =
      '<span class="breadcrumb-item"><a href="#" data-nav="dashboard">首页</a></span>' +
      crumbs.map((c, i) => `<span class="breadcrumb-sep">›</span><span class="breadcrumb-item${i === crumbs.length - 1 ? ' current' : ''}">${c}</span>`).join('');
  },

  _tabs: [{ key: 'dashboard', title: '系统概览', icon: '📊' }],
  renderTabs(page) {
    const titles = { dashboard: '系统概览', users: '用户管理', settings: '系统设置', products: '产品管理', brands: '品牌管理', categories: '分类管理', logs: '操作日志', profile: '个人中心' };
    const icons = { dashboard: '📊', users: '👥', settings: '⚙', products: '📦', brands: '🏷', categories: '📂', logs: '📝', profile: '👤' };
    if (!this._tabs.find(t => t.key === page)) {
      this._tabs.push({ key: page, title: titles[page] || page, icon: icons[page] || '📄' });
    }
    const bar = document.getElementById('tabsBar');
    bar.innerHTML = this._tabs.map(t => `
      <div class="tab-item${page === t.key ? ' active' : ''}" data-tab="${t.key}">
        <span>${t.icon} ${t.title}</span>
        ${t.key !== 'dashboard' ? `<span class="tab-close" data-close-tab="${t.key}">×</span>` : ''}
      </div>
    `).join('');
    // 标签点击
    bar.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-close-tab]')) {
          const key = e.target.closest('[data-close-tab]').dataset.closeTab;
          this._tabs = this._tabs.filter(t => t.key !== key);
          if (this.currentPage === key) this.navigateTo(this._tabs[this._tabs.length - 1]?.key || 'dashboard');
          else this.renderTabs(this.currentPage);
          return;
        }
        this.navigateTo(el.dataset.tab);
      });
    });
  },

  // ===== 弹窗 =====
  showModal(title, bodyHtml, okText, onOk, closeOnly = false) {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modalContent');
    modal.className = closeOnly ? 'modal modal-lg' : 'modal';
    modal.innerHTML = `
      <div class="modal-header"><div class="modal-title">${title}</div><button class="modal-close" id="modalCloseBtn">×</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        ${closeOnly ? `<button class="btn btn-primary" id="modalCloseBtn2">${okText || '关闭'}</button>` :
          `<button class="btn btn-outline" id="modalCancelBtn">取消</button>
           <button class="btn btn-primary" id="modalOkBtn">${okText || '确认'}</button>`}
      </div>
    `;
    overlay.classList.add('visible');
    document.getElementById('modalCloseBtn').onclick = () => overlay.classList.remove('visible');
    if (closeOnly) {
      document.getElementById('modalCloseBtn2')?.addEventListener('click', () => overlay.classList.remove('visible'));
    } else {
      document.getElementById('modalCancelBtn').onclick = () => overlay.classList.remove('visible');
      if (onOk) document.getElementById('modalOkBtn').onclick = onOk;
    }
  },

  hideModal() { document.getElementById('modalOverlay').classList.remove('visible'); },

  // ===== Toast =====
  showToast(msg, type) {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'success');
    el.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 3000);
  },

  // ===== 页面路由 =====
  renderPage(page) {
    const content = document.getElementById('pageContent');
    switch (page) {
      case 'dashboard': this.renderDashboard(content); break;
      case 'users': this.renderUsers(content); break;
      case 'products': this.renderProducts(content); break;
      case 'brands': this.renderBrands(content); break;
      case 'categories': this.renderCategories(content); break;
      case 'logs': this.renderLogs(content); break;
      case 'settings': this.renderSettings(content); break;
      case 'profile': this.renderProfile(content); break;
      default: content.innerHTML = '<div class="error-page"><div class="error-code">404</div><div class="error-title">页面未找到</div></div>';
    }
  },

  // ===== 仪表盘 =====
  async renderDashboard(el) {
    el.innerHTML = `
      <div class="page-header"><div><div class="page-title">系统概览</div><div class="page-subtitle">欢迎回来，${Store.currentUser.name || Store.currentUser.username}</div></div></div>
      <div class="stats-grid" id="statsGrid"><div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-content"><div class="stat-label">加载中...</div></div></div></div>
      <div class="charts-grid"><div class="chart-card"><div class="chart-header"><div class="chart-title">最近7天搜索趋势</div></div><div class="chart-body"><canvas id="lineChart"></canvas></div></div>
      <div class="chart-card"><div class="chart-header"><div class="chart-title">品牌分布 Top 5</div></div><div class="chart-body" id="brandChart"></div></div></div>
      <div class="card"><div class="card-header"><div class="card-title">最近操作记录</div></div><div class="table-wrapper" style="border:none;box-shadow:none" id="recentLogs"><div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">加载中...</div></div></div></div>
    `;
    try {
      const [overview, brands, logs] = await Promise.all([
        this.api('/stats/overview').catch(() => null),
        this.api('/stats/brands').catch(() => null),
        this.api('/logs?page=1&limit=10').catch(() => null),
      ]);
      if (overview?.data) {
        const d = overview.data;
        document.getElementById('statsGrid').innerHTML = `
          <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-content"><div class="stat-label">产品总数</div><div class="stat-value">${(d.totalProducts||0).toLocaleString()}</div></div></div>
          <div class="stat-card"><div class="stat-icon cyan">🖼</div><div class="stat-content"><div class="stat-label">图片总数</div><div class="stat-value">${(d.totalImages||0).toLocaleString()}</div></div></div>
          <div class="stat-card"><div class="stat-icon orange">🔍</div><div class="stat-content"><div class="stat-label">搜索关键词</div><div class="stat-value">${(d.totalSearchKeywords||0).toLocaleString()}</div></div></div>
          <div class="stat-card"><div class="stat-icon green">🏷</div><div class="stat-content"><div class="stat-label">品牌数量</div><div class="stat-value">${(d.totalBrands||0).toLocaleString()}</div></div></div>
        `;
      }
      if (brands?.data) {
        const top5 = brands.data.slice(0, 5);
        const max = top5[0]?.count || 1;
        document.getElementById('brandChart').innerHTML = '<div class="bar-chart">' + top5.map(b => `<div class="bar-group"><div class="bar" style="height:${(b.count/max)*100}%"></div><div class="bar-label">${b.brand}</div></div>`).join('') + '</div>';
      }
      if (logs?.data) {
        const el2 = document.getElementById('recentLogs');
        if (logs.data.length === 0) { el2.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">暂无操作记录</div></div>'; return; }
        el2.innerHTML = '<table class="table"><thead><tr><th>时间</th><th>操作人</th><th>类型</th><th>对象</th><th>结果</th></tr></thead><tbody>' +
          logs.data.map(l => `<tr><td class="nowrap text-sm">${new Date(l.created_at).toLocaleString()}</td><td>${l.operator}</td><td><span class="tag tag-info">${l.type}</span></td><td>${l.target||'-'}</td><td><span class="tag ${l.result==='success'?'tag-success':'tag-danger'}">${l.result==='success'?'成功':'失败'}</span></td></tr>`).join('') + '</tbody></table>';
      }
    } catch (err) { console.error('仪表盘加载失败:', err); }
  },

  // ===== 用户管理 =====
  async renderUsers(el) {
    if (!Store.isSuperAdmin) { el.innerHTML = '<div class="error-page"><div class="error-code">403</div><div class="error-title">无权访问</div></div>'; return; }
    el.innerHTML = '<div class="page-header"><div class="page-title">用户管理</div></div><div class="card"><div class="card-body"><div class="skeleton skeleton-card"></div></div></div>';
    try {
      const res = await this.api('/users');
      const users = res.data || [];
      el.innerHTML = `
        <div class="page-header"><div><div class="page-title">用户管理</div><div class="page-subtitle">共 ${users.length} 个用户</div></div>
          <div class="page-actions"><button class="btn btn-primary" id="btnAddUser">+ 新增用户</button></div></div>
        <div class="table-wrapper"><table class="table"><thead><tr><th>ID</th><th>用户</th><th>邮箱</th><th>角色</th><th>状态</th><th>最后登录</th><th class="col-actions">操作</th></tr></thead><tbody>
          ${users.length === 0 ? '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">暂无用户</div></div></td></tr>' :
            users.map(u => `<tr>
              <td>${u.id}</td>
              <td><div class="flex items-center gap-2"><span class="header-avatar" style="width:28px;height:28px;font-size:11px">${u.avatar||'U'}</span><span class="font-medium">${u.name||u.username}</span><span class="text-gray-400 text-sm">@${u.username}</span></div></td>
              <td>${u.email||'-'}</td>
              <td><span class="tag ${u.role==='super_admin'?'tag-primary':u.role==='viewer'?'tag-gray':'tag-accent'}">${u.role==='super_admin'?'超级管理员':u.role==='viewer'?'只读用户':'数据管理员'}</span></td>
              <td><span class="tag ${u.status==='active'?'tag-success':'tag-gray'}"><span class="dot ${u.status==='active'?'dot-green':'dot-gray'}"></span>${u.status==='active'?'启用':'禁用'}</span></td>
              <td class="text-sm text-gray-500">${u.last_login ? new Date(u.last_login).toLocaleString() : '-'}</td>
              <td class="col-actions">
                <button class="btn btn-ghost btn-sm btn-edit-user" data-id="${u.id}">✏️</button>
                <button class="btn btn-ghost btn-sm btn-delete-user" data-id="${u.id}">🗑</button>
              </td>
            </tr>`).join('')}
        </tbody></table></div>
      `;
      // 绑定事件
      document.getElementById('btnAddUser')?.addEventListener('click', () => this.showAddUserModal());
      el.querySelectorAll('.btn-edit-user').forEach(btn => btn.addEventListener('click', () => this.showEditUserModal(+btn.dataset.id)));
      el.querySelectorAll('.btn-delete-user').forEach(btn => btn.addEventListener('click', () => this.deleteUser(+btn.dataset.id)));
    } catch (err) {
      el.innerHTML = '<div class="page-header"><div class="page-title">用户管理</div></div><div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">加载失败: ' + err.message + '</div></div>';
    }
  },

  showAddUserModal() {
    this.showModal('新增用户', `
      <div class="form-group"><label class="form-label">用户名 <span class="required">*</span></label><input class="form-input" id="f_username" placeholder="请输入用户名"></div>
      <div class="form-group"><label class="form-label">姓名 <span class="required">*</span></label><input class="form-input" id="f_name" placeholder="请输入姓名"></div>
      <div class="form-group"><label class="form-label">邮箱</label><input class="form-input" id="f_email" placeholder="请输入邮箱"></div>
      <div class="form-group"><label class="form-label">密码 <span class="required">*</span></label><input class="form-input" id="f_password" type="password" placeholder="请输入密码"></div>
      <div class="form-group"><label class="form-label">角色</label><select class="form-select" id="f_role"><option value="viewer">只读用户</option><option value="admin">数据管理员</option><option value="super_admin">超级管理员</option></select></div>
    `, '创建用户', async () => {
      const data = { username: document.getElementById('f_username').value, name: document.getElementById('f_name').value, email: document.getElementById('f_email').value, password: document.getElementById('f_password').value, role: document.getElementById('f_role').value };
      if (!data.username || !data.name || !data.password) { this.showToast('请填写必填项', 'warning'); return; }
      try { await this.api('/users', { method: 'POST', body: JSON.stringify(data) }); this.hideModal(); this.showToast('用户创建成功'); this.renderUsers(document.getElementById('pageContent')); } catch (err) { this.showToast(err.message, 'error'); }
    });
  },

  async showEditUserModal(id) {
    try {
      const res = await this.api('/users/' + id);
      const u = res.data;
      this.showModal('编辑用户', `
        <div class="form-group"><label class="form-label">用户名</label><input class="form-input" value="${u.username}" disabled></div>
        <div class="form-group"><label class="form-label">姓名 <span class="required">*</span></label><input class="form-input" id="f_name" value="${u.name||''}"></div>
        <div class="form-group"><label class="form-label">邮箱</label><input class="form-input" id="f_email" value="${u.email||''}"></div>
        <div class="form-group"><label class="form-label">角色</label><select class="form-select" id="f_role"><option value="viewer" ${u.role==='viewer'?'selected':''}>只读用户</option><option value="admin" ${u.role==='admin'?'selected':''}>数据管理员</option><option value="super_admin" ${u.role==='super_admin'?'selected':''}>超级管理员</option></select></div>
        <div class="form-group"><label class="form-label">状态</label><select class="form-select" id="f_status"><option value="active" ${u.status==='active'?'selected':''}>启用</option><option value="disabled" ${u.status==='disabled'?'selected':''}>禁用</option></select></div>
      `, '保存修改', async () => {
        try { await this.api('/users/' + id, { method: 'PUT', body: JSON.stringify({ name: document.getElementById('f_name').value, email: document.getElementById('f_email').value, role: document.getElementById('f_role').value, status: document.getElementById('f_status').value })}); this.hideModal(); this.showToast('用户更新成功'); this.renderUsers(document.getElementById('pageContent')); } catch (err) { this.showToast(err.message, 'error'); }
      });
    } catch (err) { this.showToast(err.message, 'error'); }
  },

  deleteUser(id) {
    if (!confirm('确定要删除该用户吗？此操作不可撤销。')) return;
    this.api('/users/' + id, { method: 'DELETE' }).then(() => {
      this.showToast('用户已删除');
      this.renderUsers(document.getElementById('pageContent'));
    }).catch(err => this.showToast(err.message, 'error'));
  },

  // ===== 产品管理 =====
  _productSearch: '',
  _productBrand: '',
  _productCategory: '',

  async renderProducts(el) {
    el.innerHTML = '<div class="page-header"><div class="page-title">产品管理</div></div><div class="card"><div class="card-body"><div class="skeleton skeleton-card"></div></div></div>';
    try {
      const page = this._productPage || 1;
      const limit = 50;
      let params = `limit=${limit}&page=${page}`;
      if (this._productSearch) params += '&keyword=' + encodeURIComponent(this._productSearch);
      if (this._productBrand) params += '&brand=' + encodeURIComponent(this._productBrand);
      if (this._productCategory) params += '&category=' + encodeURIComponent(this._productCategory);
      const res = await this.api('/products?' + params);
      const payload = res.data || {};
      const products = Array.isArray(payload) ? payload : (payload.list || []);
      const pagination = payload.pagination || {};
      const total = pagination.total || products.length;
      const totalPages = pagination.totalPages || 1;
      const currentPage = pagination.page || 1;
      const filterInfo = this._productBrand ? ` · 品牌: ${this._productBrand}` : '';
      const filterInfo2 = this._productCategory ? ` · 分类: ${this._productCategory}` : '';

      // 生成分页按钮
      const paginationHtml = totalPages > 1 ? `
        <div class="pagination">
          <button class="btn btn-outline btn-sm" ${currentPage <= 1 ? 'disabled' : ''} id="btnPrevPage">上一页</button>
          <span class="page-info">第 ${currentPage} / ${totalPages} 页</span>
          <button class="btn btn-outline btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} id="btnNextPage">下一页</button>
          <span class="page-jump">跳转到 <input type="number" class="form-input form-input-sm" id="pageJumpInput" min="1" max="${totalPages}" value="${currentPage}"> 页</span>
          <button class="btn btn-outline btn-sm" id="btnJumpPage">GO</button>
        </div>
      ` : '';

      el.innerHTML = `
        <div class="page-header"><div><div class="page-title">产品管理</div><div class="page-subtitle">共 ${total} 个产品${filterInfo}${filterInfo2}</div></div>
          <div class="page-actions">
            ${(this._productBrand || this._productCategory || this._productSearch) ? '<button class="btn btn-outline btn-sm" id="btnClearFilter">✕ 清除筛选</button>' : ''}
            <div class="search-box"><span class="search-icon">🔍</span><input class="form-input" id="productSearchInput" placeholder="搜索产品名称/型号/品牌" value="${this._productSearch}"></div>
            ${!Store.isViewer ? '<button class="btn btn-primary" id="btnAddProduct">+ 新增产品</button>' : ''}
          </div></div>
        <div class="table-wrapper"><table class="table"><thead><tr><th>ID</th><th>图片</th><th>名称</th><th>品牌</th><th>分类</th><th>型号</th><th class="col-actions">操作</th></tr></thead><tbody>
          ${products.length === 0 ? '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">暂无产品</div></div></td></tr>' :
            products.map(p => `<tr>
              <td>${p.id}</td>
              <td>${p.image_id ? '<img src="/api/image/' + p.image_id + '" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #eee" onerror="this.style.display=\'none\'" loading="lazy">' : '<div style="width:48px;height:48px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center">📦</div>'}</td>
              <td class="truncate" style="max-width:200px" title="${p.name||''}">${p.name||'-'}</td>
              <td><a href="#" class="brand-link" data-brand="${p.brand||''}">${p.brand||'-'}</a></td>
              <td>${p.category||'-'}</td>
              <td>${p.model||'-'}</td>
              <td class="col-actions">
                <button class="btn btn-ghost btn-sm btn-view-product" data-id="${p.id}" title="查看详情">👁</button>
                ${!Store.isViewer ? `
                  <button class="btn btn-ghost btn-sm btn-edit-product" data-id="${p.id}" title="编辑">✏️</button>
                  <button class="btn btn-ghost btn-sm btn-delete-product" data-id="${p.id}" title="删除">🗑</button>
                ` : ''}
              </td>
            </tr>`).join('')}
        </tbody></table></div>
        ${paginationHtml}
      `;
      // 搜索事件
      let searchTimer;
      document.getElementById('productSearchInput')?.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { this._productSearch = e.target.value; this._productPage = 1; this.renderProducts(el); }, 500);
      });
      // 清除筛选
      document.getElementById('btnClearFilter')?.addEventListener('click', () => {
        this._productSearch = ''; this._productBrand = ''; this._productCategory = ''; this._productPage = 1;
        this.renderProducts(el);
      });
      // 新增产品
      document.getElementById('btnAddProduct')?.addEventListener('click', () => this.showAddProductModal());
      // 品牌链接点击
      el.querySelectorAll('.brand-link').forEach(link => link.addEventListener('click', (e) => {
        e.preventDefault();
        this._productBrand = link.dataset.brand;
        this._productSearch = '';
        this._productPage = 1;
        this.renderProducts(el);
      }));
      el.querySelectorAll('.btn-edit-product').forEach(btn => btn.addEventListener('click', () => this.showEditProductModal(+btn.dataset.id)));
      el.querySelectorAll('.btn-delete-product').forEach(btn => btn.addEventListener('click', () => this.deleteProduct(+btn.dataset.id)));
      el.querySelectorAll('.btn-view-product').forEach(btn => btn.addEventListener('click', () => this.showProductDetail(+btn.dataset.id)));
      // 分页事件
      document.getElementById('btnPrevPage')?.addEventListener('click', () => { this._productPage = currentPage - 1; this.renderProducts(el); });
      document.getElementById('btnNextPage')?.addEventListener('click', () => { this._productPage = currentPage + 1; this.renderProducts(el); });
      document.getElementById('btnJumpPage')?.addEventListener('click', () => {
        const jumpTo = parseInt(document.getElementById('pageJumpInput')?.value);
        if (jumpTo >= 1 && jumpTo <= totalPages) { this._productPage = jumpTo; this.renderProducts(el); }
      });
      document.getElementById('pageJumpInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const jumpTo = parseInt(e.target.value);
          if (jumpTo >= 1 && jumpTo <= totalPages) { this._productPage = jumpTo; this.renderProducts(el); }
        }
      });
    } catch (err) {
      el.innerHTML = '<div class="page-header"><div class="page-title">产品管理</div></div><div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">加载失败: ' + err.message + '</div></div>';
    }
  },

  async showEditProductModal(id) {
    try {
      const res = await this.api('/products/' + id);
      const p = res.data;
      this.showModal('编辑产品', `
        <div class="form-group"><label class="form-label">产品名称 <span class="required">*</span></label><input class="form-input" id="f_pname" value="${p.name||''}"></div>
        <div class="form-group"><label class="form-label">品牌 <span class="required">*</span></label><input class="form-input" id="f_pbrand" value="${p.brand||''}"></div>
        <div class="form-group"><label class="form-label">分类</label><input class="form-input" id="f_pcategory" value="${p.category||''}"></div>
        <div class="form-group"><label class="form-label">型号</label><input class="form-input" id="f_pmodel" value="${p.model||''}"></div>
      `, '保存修改', async () => {
        const data = {
          name: document.getElementById('f_pname').value,
          brand: document.getElementById('f_pbrand').value,
          category: document.getElementById('f_pcategory').value,
          model: document.getElementById('f_pmodel').value,
        };
        if (!data.name || !data.brand) { this.showToast('请填写产品名称和品牌', 'warning'); return; }
        try {
          await this.api('/products/' + id, { method: 'PUT', body: JSON.stringify(data) });
          this.hideModal();
          this.showToast('产品更新成功');
          this.renderProducts(document.getElementById('pageContent'));
        } catch (err) { this.showToast(err.message, 'error'); }
      });
    } catch (err) { this.showToast(err.message, 'error'); }
  },

  async showProductDetail(id) {
    try {
      const res = await this.api('/products/' + id);
      const p = res.data;

      // 解析 params 字段（可能是 JSON 字符串或对象）
      let params = {};
      if (p.params) {
        try {
          params = typeof p.params === 'string' ? JSON.parse(p.params) : p.params;
        } catch (e) { params = {}; }
      }

      // 分类名称映射
      const categoryNames = {
        'air_condition': '空调', 'icebox': '冰箱', 'washer': '洗衣机',
        'gas_water': '燃气热水器', 'central_water': '空气能热水器', 'lcd_tv': '电视',
        'rice_cooker': '电饭煲/厨电', 'heater': '取暖器'
      };

      // 构建参数表格
      const paramsHtml = Object.keys(params).length > 0 ? `
        <div class="detail-section">
          <div class="detail-section-title">产品参数</div>
          <table class="detail-params-table">
            ${Object.entries(params).map(([key, val]) => `
              <tr><td class="param-key">${key}</td><td class="param-value">${val || '-'}</td></tr>
            `).join('')}
          </table>
        </div>
      ` : '';

      // 图片展示
      const imageHtml = p.image_id ? `
        <div class="detail-section">
          <div class="detail-section-title">产品图片</div>
          <div class="detail-image">
            <img src="/api/image/${p.image_id}" onerror="this.style.display='none'" loading="lazy">
          </div>
        </div>
      ` : '';

      this.showModal('产品详情', `
        <div class="product-detail">
          <div class="detail-header">
            <div class="detail-image-wrapper">
              ${p.image_id ? `<img src="/api/image/${p.image_id}" onerror="this.parentElement.innerHTML='📦'" loading="lazy">` : '<div class="detail-placeholder">📦</div>'}
            </div>
            <div class="detail-info">
              <h2 class="detail-title">${p.name || '-'}</h2>
              <div class="detail-meta">
                <span class="detail-badge">${p.brand || '-'}</span>
                <span class="detail-badge secondary">${categoryNames[p.category] || p.category || '-'}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">基本信息</div>
            <div class="detail-grid">
              <div class="detail-item"><span class="detail-label">ID</span><span class="detail-value">${p.id}</span></div>
              <div class="detail-item"><span class="detail-label">品牌</span><span class="detail-value">${p.brand || '-'}</span></div>
              <div class="detail-item"><span class="detail-label">分类</span><span class="detail-value">${categoryNames[p.category] || p.category || '-'}</span></div>
              <div class="detail-item"><span class="detail-label">型号</span><span class="detail-value">${p.model || '-'}</span></div>
              <div class="detail-item"><span class="detail-label">价格</span><span class="detail-value">${p.price ? '¥' + p.price : '-'}</span></div>
              <div class="detail-item"><span class="detail-label">评分</span><span class="detail-value">${p.rating || '-'}</span></div>
              <div class="detail-item"><span class="detail-label">来源</span><span class="detail-value">${p.source_platform || '-'}</span></div>
              <div class="detail-item"><span class="detail-label">创建时间</span><span class="detail-value">${p.created_at ? new Date(p.created_at).toLocaleString('zh-CN') : '-'}</span></div>
              <div class="detail-item"><span class="detail-label">更新时间</span><span class="detail-value">${p.updated_at ? new Date(p.updated_at).toLocaleString('zh-CN') : '-'}</span></div>
            </div>
          </div>

          ${paramsHtml}
          ${imageHtml}

          ${p.source_url ? `
            <div class="detail-section">
              <div class="detail-section-title">来源链接</div>
              <a href="${p.source_url}" target="_blank" class="detail-link">${p.source_url}</a>
            </div>
          ` : ''}
        </div>
      `, '关闭', () => this.hideModal(), true);
    } catch (err) { this.showToast('加载详情失败: ' + err.message, 'error'); }
  },

  showAddProductModal() {
    this.showModal('新增产品', `
      <div class="form-group"><label class="form-label">产品名称 <span class="required">*</span></label><input class="form-input" id="f_pname" placeholder="请输入产品名称"></div>
      <div class="form-group"><label class="form-label">品牌 <span class="required">*</span></label><input class="form-input" id="f_pbrand" placeholder="请输入品牌名称"></div>
      <div class="form-group"><label class="form-label">分类</label>
        <select class="form-select" id="f_pcategory">
          <option value="">请选择分类</option>
          <option value="air_condition">空调</option>
          <option value="icebox">冰箱</option>
          <option value="washer">洗衣机</option>
          <option value="gas_water">燃气热水器</option>
          <option value="lcd_tv">电视</option>
          <option value="rice_cooker">电饭煲/厨电</option>
          <option value="__custom__">自定义...</option>
        </select>
        <input class="form-input" id="f_pcategory_custom" placeholder="请输入自定义分类" style="display:none;margin-top:8px">
      </div>
      <div class="form-group"><label class="form-label">型号</label><input class="form-input" id="f_pmodel" placeholder="请输入型号"></div>
    `, '创建产品', async () => {
      let category = document.getElementById('f_pcategory').value;
      if (category === '__custom__') {
        category = document.getElementById('f_pcategory_custom').value.trim();
        if (!category) { this.showToast('请输入自定义分类', 'warning'); return; }
      }
      const data = {
        name: document.getElementById('f_pname').value,
        brand: document.getElementById('f_pbrand').value,
        category: category,
        model: document.getElementById('f_pmodel').value,
      };
      if (!data.name || !data.brand) { this.showToast('请填写产品名称和品牌', 'warning'); return; }
      try {
        await this.api('/products', { method: 'POST', body: JSON.stringify(data) });
        this.hideModal();
        this.showToast('产品创建成功');
        this.renderProducts(document.getElementById('pageContent'));
      } catch (err) { this.showToast(err.message, 'error'); }
    });
    // 自定义分类显示/隐藏
    document.getElementById('f_pcategory')?.addEventListener('change', (e) => {
      document.getElementById('f_pcategory_custom').style.display = e.target.value === '__custom__' ? 'block' : 'none';
    });
  },

  deleteProduct(id) {
    if (!confirm('确定要删除该产品吗？')) return;
    this.api('/products/' + id, { method: 'DELETE' }).then(() => {
      this.showToast('产品已删除');
      this.renderProducts(document.getElementById('pageContent'));
    }).catch(err => this.showToast(err.message, 'error'));
  },

  // ===== 品牌管理 =====
  async renderBrands(el) {
    el.innerHTML = '<div class="page-header"><div class="page-title">品牌管理</div></div><div class="card"><div class="card-body"><div class="skeleton skeleton-card"></div></div></div>';
    try {
      // 用统计 API 获取品牌+数量
      const res = await this.api('/stats/brands');
      const brands = res.data || [];
      // 同时获取完整品牌列表
      const allRes = await this.api('/brands');
      const allBrands = allRes.data || [];
      el.innerHTML = `
        <div class="page-header"><div><div class="page-title">品牌管理</div><div class="page-subtitle">共 ${allBrands.length} 个品牌（Top ${brands.length} 有产品）</div></div></div>
        <div class="card" style="margin-bottom:16px"><div class="card-header"><div class="card-title">🏆 Top 10 品牌</div></div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
              ${brands.map((b, i) => `
                <div class="card brand-card" style="cursor:pointer;border:1.5px solid var(--gray-200)" data-brand="${b.brand}">
                  <div class="card-body" style="padding:14px;display:flex;align-items:center;gap:12px">
                    <div style="width:32px;height:32px;border-radius:8px;background:var(--primary-50);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">${i+1}</div>
                    <div><div style="font-size:14px;font-weight:600;color:var(--gray-800)">${b.brand}</div><div style="font-size:12px;color:var(--gray-500)">${Number(b.count).toLocaleString()} 个产品</div></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="card"><div class="card-header"><div class="card-title">全部品牌 (${allBrands.length})</div></div>
          <div class="card-body">
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${allBrands.map(b => `<span class="tag tag-gray brand-tag" style="cursor:pointer;padding:6px 12px;font-size:13px" data-brand="${b}">${b} ${!Store.isViewer ? `<span class="brand-edit-btn" data-brand="${b}" style="margin-left:4px;opacity:0.5">✏️</span>` : ''}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
      // 点击品牌标签跳转到产品列表（排除编辑按钮的点击）
      el.querySelectorAll('.brand-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
          if (e.target.classList.contains('brand-edit-btn')) return;
          this._productBrand = tag.dataset.brand; this._productSearch = ''; this._productCategory = '';
          this.navigateTo('products');
        });
      });
      // 品牌卡片点击跳转
      el.querySelectorAll('.brand-card').forEach(card => {
        card.addEventListener('click', () => { this._productBrand = card.dataset.brand; this._productSearch = ''; this._productCategory = ''; this.navigateTo('products'); });
      });
      // 品牌编辑按钮
      el.querySelectorAll('.brand-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.showEditBrandModal(btn.dataset.brand, allBrands); });
      });
    } catch (err) {
      el.innerHTML = '<div class="page-header"><div class="page-title">品牌管理</div></div><div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">加载失败: ' + err.message + '</div></div>';
    }
  },

  showEditBrandModal(oldBrand, allBrands) {
    this.showModal('编辑品牌', `
      <div class="form-group"><label class="form-label">当前品牌名</label><input class="form-input" value="${oldBrand}" disabled></div>
      <div class="form-group"><label class="form-label">新品牌名 <span class="required">*</span></label><input class="form-input" id="f_new_brand" value="${oldBrand}" placeholder="请输入新的品牌名"></div>
      <div style="padding:12px;background:var(--warning-light);border-radius:var(--radius-md);font-size:13px;color:var(--warning)">
        ⚠️ 修改后，所有"${oldBrand}"品牌下的产品都会更新为新品牌名
      </div>
    `, '确认修改', async () => {
      const newBrand = document.getElementById('f_new_brand').value.trim();
      if (!newBrand) { this.showToast('请输入新品牌名', 'warning'); return; }
      if (newBrand === oldBrand) { this.hideModal(); return; }
      try {
        // 获取该品牌下所有产品并批量更新
        const res = await this.api('/products?brand=' + encodeURIComponent(oldBrand) + '&limit=10000');
        const products = (res.data?.list || []);
        let updated = 0;
        for (const p of products) {
          try {
            await this.api('/products/' + p.id, { method: 'PUT', body: JSON.stringify({ name: p.name, brand: newBrand, category: p.category, model: p.model }) });
            updated++;
          } catch {}
        }
        this.hideModal();
        this.showToast(`品牌已从"${oldBrand}"修改为"${newBrand}"，更新了${updated}个产品`);
        this.renderBrands(document.getElementById('pageContent'));
      } catch (err) { this.showToast(err.message, 'error'); }
    });
  },

  // ===== 分类管理 =====
  async renderCategories(el) {
    el.innerHTML = '<div class="page-header"><div class="page-title">分类管理</div></div><div class="card"><div class="card-body"><div class="skeleton skeleton-card"></div></div></div>';
    try {
      // 用公开 API 获取完整分类信息（带产品数量）
      const resp = await fetch('http://localhost:3000/api/categories');
      const res = await resp.json();
      const categories = res.data || [];
      el.innerHTML = `
        <div class="page-header"><div><div class="page-title">分类管理</div><div class="page-subtitle">共 ${categories.length} 个分类</div></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">
          ${categories.map(c => `
            <div class="card category-card" style="cursor:pointer;transition:box-shadow 0.2s" data-category="${c.code}">
              <div class="card-body" style="padding:20px;text-align:center">
                <div style="font-size:32px;margin-bottom:12px">${c.code==='icebox'?'🧊':c.code==='air_condition'?'❄️':c.code==='washer'?'👕':c.code==='gas_water'?'🔥':c.code==='lcd_tv'?'📺':c.code==='rice_cooker'?'🍚':'📂'}</div>
                <div style="font-size:16px;font-weight:600;color:var(--gray-800)">${c.name}</div>
                <div style="font-size:13px;color:var(--gray-500);margin-top:6px">${Number(c.product_count).toLocaleString()} 个产品</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      el.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => { this._productCategory = card.dataset.category; this._productSearch = ''; this._productBrand = ''; this.navigateTo('products'); });
        card.addEventListener('mouseenter', () => card.style.boxShadow = 'var(--shadow-md)');
        card.addEventListener('mouseleave', () => card.style.boxShadow = '');
      });
    } catch (err) {
      el.innerHTML = '<div class="page-header"><div class="page-title">分类管理</div></div><div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">加载失败: ' + err.message + '</div></div>';
    }
  },

  // ===== 操作日志 =====
  async renderLogs(el) {
    el.innerHTML = '<div class="page-header"><div class="page-title">操作日志</div></div><div class="card"><div class="card-body"><div class="skeleton skeleton-card"></div></div></div>';
    try {
      const res = await this.api('/logs?page=1&limit=50');
      const logs = res.data || [];
      el.innerHTML = `
        <div class="page-header"><div><div class="page-title">操作日志</div><div class="page-subtitle">共 ${res.pagination?.total || logs.length} 条记录</div></div></div>
        <div class="table-wrapper"><table class="table"><thead><tr><th>时间</th><th>操作人</th><th>类型</th><th>操作对象</th><th>结果</th></tr></thead><tbody>
          ${logs.length === 0 ? '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">暂无日志</div></div></td></tr>' :
            logs.map(l => `<tr>
              <td class="nowrap text-sm">${new Date(l.created_at).toLocaleString()}</td>
              <td>${l.operator}</td>
              <td><span class="tag tag-info">${l.type}</span></td>
              <td>${l.target||'-'}</td>
              <td><span class="tag ${l.result==='success'?'tag-success':'tag-danger'}">${l.result==='success'?'成功':'失败'}</span></td>
            </tr>`).join('')}
        </tbody></table></div>
      `;
    } catch (err) {
      el.innerHTML = '<div class="page-header"><div class="page-title">操作日志</div></div><div class="empty-state"><div class="empty-icon">❌</div><div class="empty-title">加载失败: ' + err.message + '</div></div>';
    }
  },

  // ===== 系统设置 =====
  _settingsTab: 'basic',
  _settingsData: { basic: {}, security: {}, data: {} },

  async renderSettings(el) {
    if (!Store.isSuperAdmin) { el.innerHTML = '<div class="error-page"><div class="error-code">403</div><div class="error-title">无权访问</div></div>'; return; }
    try { const res = await this.api('/settings'); if (res?.data) this._settingsData = { ...this._settingsData, ...res.data }; } catch {}
    const s = this._settingsData;
    const tabs = [
      { key: 'basic', icon: '⚙', text: '基础设置' },
      { key: 'security', icon: '🛡', text: '安全设置' },
      { key: 'data', icon: '📊', text: '数据设置' }
    ];

    let content = '';
    if (this._settingsTab === 'basic') content = `
      <div class="settings-section">
        <div class="settings-section-title">基本配置</div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">系统名称</div>
            <div class="settings-field-desc">显示在页面标题和侧边栏的名称</div>
            <input class="form-input" id="setSystemName" value="${s.basic.systemName || 'Appliance Admin'}">
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">默认语言</div>
            <select class="form-select" id="setLanguage">
              <option value="zh-CN" ${s.basic.language === 'zh-CN' ? 'selected' : ''}>中文</option>
              <option value="en" ${s.basic.language === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">时区</div>
            <select class="form-select" id="setTimezone">
              <option value="Asia/Shanghai" ${s.basic.timezone === 'Asia/Shanghai' ? 'selected' : ''}>Asia/Shanghai (UTC+8)</option>
              <option value="UTC" ${s.basic.timezone === 'UTC' ? 'selected' : ''}>UTC</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">日期格式</div>
            <select class="form-select" id="setDateFormat">
              <option value="YYYY-MM-DD HH:mm:ss" ${s.basic.dateFormat === 'YYYY-MM-DD HH:mm:ss' ? 'selected' : ''}>YYYY-MM-DD HH:mm:ss</option>
              <option value="YYYY/MM/DD" ${s.basic.dateFormat === 'YYYY/MM/DD' ? 'selected' : ''}>YYYY/MM/DD</option>
              <option value="MM/DD/YYYY" ${s.basic.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
            </select>
          </div>
        </div>
      </div>`;
    else if (this._settingsTab === 'security') content = `
      <div class="settings-section">
        <div class="settings-section-title">密码策略</div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">最小密码长度</div>
            <div class="settings-field-desc">用户密码的最小字符数</div>
            <input class="form-input" type="number" id="setPwdMinLen" min="6" max="32" value="${s.security.pwdMinLength || 8}">
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">密码复杂度要求</div>
            <div class="settings-field-desc">要求包含大小写字母、数字和特殊字符</div>
            <select class="form-select" id="setPwdComplexity">
              <option value="true" ${s.security.pwdComplexity ? 'selected' : ''}>启用</option>
              <option value="false" ${!s.security.pwdComplexity ? 'selected' : ''}>禁用</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">密码有效期（天）</div>
            <div class="settings-field-desc">超过天数后提示用户修改密码，0表示永不过期</div>
            <input class="form-input" type="number" id="setPwdExpiry" min="0" max="365" value="${s.security.pwdExpiry || 0}">
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">登录安全</div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">登录失败锁定次数</div>
            <div class="settings-field-desc">连续登录失败后锁定账号，0表示不锁定</div>
            <input class="form-input" type="number" id="setLoginFailLock" min="0" max="20" value="${s.security.loginFailLock || 5}">
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">锁定时长（分钟）</div>
            <input class="form-input" type="number" id="setLockDuration" min="5" max="1440" value="${s.security.lockDuration || 30}">
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">会话超时（分钟）</div>
            <div class="settings-field-desc">用户无操作后自动退出登录的时间</div>
            <input class="form-input" type="number" id="setSessionTimeout" min="5" max="1440" value="${s.security.sessionTimeout || 60}">
          </div>
        </div>
      </div>`;
    else if (this._settingsTab === 'data') content = `
      <div class="settings-section">
        <div class="settings-section-title">显示设置</div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">默认分页条数</div>
            <div class="settings-field-desc">列表页面每页默认显示的数据条数</div>
            <select class="form-select" id="setPageSize">
              <option value="10" ${s.data.defaultPageSize === 10 ? 'selected' : ''}>10 条</option>
              <option value="20" ${s.data.defaultPageSize === 20 ? 'selected' : ''}>20 条</option>
              <option value="50" ${s.data.defaultPageSize === 50 ? 'selected' : ''}>50 条</option>
              <option value="100" ${s.data.defaultPageSize === 100 ? 'selected' : ''}>100 条</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">导出最大条数</div>
            <div class="settings-field-desc">单次导出数据的最大条数限制</div>
            <input class="form-input" type="number" id="setExportLimit" min="100" max="100000" step="100" value="${s.data.exportMaxLimit || 10000}">
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">数据维护</div>
        <div class="settings-row">
          <div class="settings-field">
            <div class="settings-field-label">回收站保留天数</div>
            <div class="settings-field-desc">已删除数据在回收站保留的天数，超过后自动清理</div>
            <input class="form-input" type="number" id="setRecycleDays" min="1" max="365" value="${s.data.recycleCleanDays || 30}">
          </div>
        </div>
      </div>`;

    el.innerHTML = `
      <div class="page-header"><div class="page-title">系统设置</div></div>
      <div class="settings-layout">
        <div class="settings-tabs">${tabs.map(t => `<div class="settings-tab${this._settingsTab === t.key ? ' active' : ''}" data-stab="${t.key}">${t.icon} ${t.text}</div>`).join('')}</div>
        <div class="settings-content">
          ${content}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--gray-100);display:flex;gap:12px">
            <button class="btn btn-primary" id="btnSaveSettings">保存设置</button>
            <button class="btn btn-outline" id="btnResetSettings">恢复默认</button>
          </div>
        </div>
      </div>
    `;

    // 切换标签
    el.querySelectorAll('[data-stab]').forEach(tab => {
      tab.addEventListener('click', () => { this._settingsTab = tab.dataset.stab; this.renderSettings(el); });
    });

    // 保存设置
    document.getElementById('btnSaveSettings')?.addEventListener('click', async () => {
      try {
        // 收集当前标签的表单数据
        const tab = this._settingsTab;
        if (tab === 'basic') {
          this._settingsData.basic = {
            systemName: document.getElementById('setSystemName').value,
            language: document.getElementById('setLanguage').value,
            timezone: document.getElementById('setTimezone').value,
            dateFormat: document.getElementById('setDateFormat').value
          };
        } else if (tab === 'security') {
          this._settingsData.security = {
            pwdMinLength: parseInt(document.getElementById('setPwdMinLen').value),
            pwdComplexity: document.getElementById('setPwdComplexity').value === 'true',
            pwdExpiry: parseInt(document.getElementById('setPwdExpiry').value),
            loginFailLock: parseInt(document.getElementById('setLoginFailLock').value),
            lockDuration: parseInt(document.getElementById('setLockDuration').value),
            sessionTimeout: parseInt(document.getElementById('setSessionTimeout').value)
          };
        } else if (tab === 'data') {
          this._settingsData.data = {
            defaultPageSize: parseInt(document.getElementById('setPageSize').value),
            exportMaxLimit: parseInt(document.getElementById('setExportLimit').value),
            recycleCleanDays: parseInt(document.getElementById('setRecycleDays').value)
          };
        }

        await this.api('/settings', {
          method: 'PUT',
          body: JSON.stringify({ key: tab, value: this._settingsData[tab] })
        });
        this.showToast('设置已保存');
      } catch (err) { this.showToast(err.message, 'error'); }
    });

    // 恢复默认
    document.getElementById('btnResetSettings')?.addEventListener('click', async () => {
      if (!confirm('确定要恢复默认设置吗？')) return;
      const defaults = {
        basic: { systemName: 'Appliance Admin', language: 'zh-CN', timezone: 'Asia/Shanghai', dateFormat: 'YYYY-MM-DD HH:mm:ss' },
        security: { pwdMinLength: 8, pwdComplexity: false, pwdExpiry: 0, loginFailLock: 5, lockDuration: 30, sessionTimeout: 60 },
        data: { defaultPageSize: 20, exportMaxLimit: 10000, recycleCleanDays: 30 }
      };
      try {
        for (const [key, value] of Object.entries(defaults)) {
          await this.api('/settings', { method: 'PUT', body: JSON.stringify({ key, value }) });
        }
        this._settingsData = defaults;
        this.renderSettings(el);
        this.showToast('已恢复默认设置');
      } catch (err) { this.showToast(err.message, 'error'); }
    });
  },

  // ===== 个人中心 =====
  _profileTab: 'basic',

  async renderProfile(el) {
    const u = Store.currentUser;
    const tabs = [{ key: 'basic', icon: '👤', text: '基本资料' }, { key: 'password', icon: '🔒', text: '修改密码' }];
    let content = '';
    if (this._profileTab === 'basic') content = `
      <div class="profile-avatar-section"><div class="profile-avatar-large">${u.avatar||'U'}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group"><label class="form-label">用户名</label><input class="form-input" value="${u.username}" disabled></div>
        <div class="form-group"><label class="form-label">姓名</label><input class="form-input" id="p_name" value="${u.name||''}"></div>
        <div class="form-group"><label class="form-label">邮箱</label><input class="form-input" id="p_email" value="${u.email||''}"></div>
        <div class="form-group"><label class="form-label">角色</label><input class="form-input" value="${u.role==='super_admin'?'超级管理员':'数据管理员'}" disabled></div>
      </div>
      <div style="margin-top:20px"><button class="btn btn-primary" id="btnSaveProfile">保存修改</button></div>`;
    else content = `
      <div style="max-width:400px">
        <div class="form-group"><label class="form-label">当前密码 *</label><input class="form-input" id="p_oldPwd" type="password"></div>
        <div class="form-group"><label class="form-label">新密码 *</label><input class="form-input" id="p_newPwd" type="password"></div>
        <div class="form-group"><label class="form-label">确认新密码 *</label><input class="form-input" id="p_confirmPwd" type="password"></div>
        <button class="btn btn-primary" id="btnChangePwd">修改密码</button>
      </div>`;

    el.innerHTML = `
      <div class="page-header"><div class="page-title">个人中心</div></div>
      <div class="profile-layout">
        <div class="profile-tabs">${tabs.map(t => `<div class="profile-tab${this._profileTab===t.key?' active':''}" data-ptab="${t.key}">${t.icon} ${t.text}</div>`).join('')}</div>
        <div class="profile-content">${content}</div>
      </div>
    `;
    el.querySelectorAll('[data-ptab]').forEach(tab => tab.addEventListener('click', () => { this._profileTab = tab.dataset.ptab; this.renderProfile(el); }));
    document.getElementById('btnSaveProfile')?.addEventListener('click', async () => {
      try { await this.api('/profile', { method: 'PUT', body: JSON.stringify({ name: document.getElementById('p_name').value, email: document.getElementById('p_email').value })}); this.showToast('资料已保存'); } catch (err) { this.showToast(err.message, 'error'); }
    });
    document.getElementById('btnChangePwd')?.addEventListener('click', async () => {
      const oldPwd = document.getElementById('p_oldPwd').value;
      const newPwd = document.getElementById('p_newPwd').value;
      const confirm = document.getElementById('p_confirmPwd').value;
      if (!oldPwd || !newPwd) { this.showToast('请填写所有字段', 'warning'); return; }
      if (newPwd !== confirm) { this.showToast('两次密码不一致', 'warning'); return; }
      try { await this.api('/password', { method: 'PUT', body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })}); this.showToast('密码已修改，请重新登录'); setTimeout(() => { localStorage.clear(); window.location.href = 'login.html'; }, 1500); } catch (err) { this.showToast(err.message, 'error'); }
    });
  },
};

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
