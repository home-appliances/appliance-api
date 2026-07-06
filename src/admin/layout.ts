/**
 * 管理后台公共布局模板
 */

export const layout = (title: string, content: string, activeMenu = '') => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Appliance Admin</title>
  <link rel="stylesheet" href="/admin/css/variables.css">
  <link rel="stylesheet" href="/admin/css/base.css">
  <link rel="stylesheet" href="/admin/css/layout.css">
  <style>
    .layout { display: flex; min-height: 100vh; }
    .sidebar {
      width: 240px; background: var(--primary-900); color: #fff;
      display: flex; flex-direction: column; flex-shrink: 0;
    }
    .sidebar-header {
      padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);
      display: flex; align-items: center; gap: 12px;
    }
    .sidebar-logo {
      width: 36px; height: 36px; border-radius: 8px;
      background: rgba(255,255,255,0.15); display: flex;
      align-items: center; justify-content: center; font-size: 18px;
    }
    .sidebar-title { font-size: 16px; font-weight: 600; }
    .sidebar-nav { flex: 1; padding: 12px 0; }
    .nav-section { padding: 8px 20px; font-size: 11px; text-transform: uppercase; color: rgba(255,255,255,0.4); letter-spacing: 1px; }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 20px; color: rgba(255,255,255,0.7);
      text-decoration: none; font-size: 14px; transition: all 0.2s;
    }
    .nav-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .nav-item.active { background: rgba(255,255,255,0.12); color: #fff; border-right: 3px solid var(--accent); }
    .nav-icon { width: 20px; text-align: center; }
    .sidebar-footer {
      padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 12px; color: rgba(255,255,255,0.4);
    }
    .main { flex: 1; display: flex; flex-direction: column; background: var(--bg-body); }
    .header {
      height: 56px; background: #fff; border-bottom: 1px solid var(--gray-100);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; flex-shrink: 0;
    }
    .header-title { font-size: 18px; font-weight: 600; color: var(--gray-900); }
    .header-user {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; color: var(--gray-600);
    }
    .header-user-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--primary-50); color: var(--primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 600;
    }
    .btn-logout {
      padding: 6px 12px; border: 1px solid var(--gray-200);
      border-radius: 6px; background: #fff; color: var(--gray-600);
      font-size: 13px; cursor: pointer; text-decoration: none;
    }
    .btn-logout:hover { border-color: var(--danger); color: var(--danger); }
    .content { flex: 1; padding: 24px; overflow-y: auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-title { font-size: 22px; font-weight: 700; color: var(--gray-900); }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">⚙</div>
        <div class="sidebar-title">Appliance Admin</div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">主菜单</div>
        <a href="/admin/" class="nav-item ${activeMenu === 'dashboard' ? 'active' : ''}">
          <span class="nav-icon">📊</span> 仪表盘
        </a>
        <a href="/admin/users" class="nav-item ${activeMenu === 'users' ? 'active' : ''}">
          <span class="nav-icon">👥</span> 用户管理
        </a>
        <a href="/admin/products" class="nav-item ${activeMenu === 'products' ? 'active' : ''}">
          <span class="nav-icon">📦</span> 产品管理
        </a>
        <a href="/admin/logs" class="nav-item ${activeMenu === 'logs' ? 'active' : ''}">
          <span class="nav-icon">📋</span> 操作日志
        </a>
      </nav>
      <div class="sidebar-footer">
        © 2026 Appliance Admin
      </div>
    </aside>
    <main class="main">
      <header class="header">
        <div class="header-title">${title}</div>
        <div class="header-user">
          <div class="header-user-avatar">A</div>
          <span>管理员</span>
          <a href="/admin/logout" class="btn-logout">退出</a>
        </div>
      </header>
      <div class="content">
        ${content}
      </div>
    </main>
  </div>
</body>
</html>`
