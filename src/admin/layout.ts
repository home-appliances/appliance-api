/**
 * 管理后台公共布局模板 - Tailwind CSS
 */

export const layout = (title: string, content: string, activeMenu = '', role = 'admin') => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Appliance Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50: '#e8eaf6', 100: '#c5cae9', 200: '#9fa8da', 300: '#7986cb', 400: '#5c6bc0', 500: '#3f51b5', 600: '#3949ab', 700: '#303f9f', 800: '#283593', 900: '#1a237e' },
          }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-50 text-gray-800 antialiased">
  <div class="flex h-screen overflow-hidden">
    <!-- 侧边栏 -->
    <aside class="w-64 bg-primary-900 text-white flex flex-col flex-shrink-0">
      <div class="p-5 border-b border-white/10 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center text-lg">⚙</div>
        <div class="text-base font-semibold">Appliance Admin</div>
      </div>
      <nav class="flex-1 py-3 overflow-y-auto">
        <div class="px-5 py-2 text-[11px] uppercase text-white/40 tracking-wider">主菜单</div>
        <a href="/admin/" class="flex items-center gap-3 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors ${activeMenu === 'dashboard' ? 'bg-white/15 text-white border-r-3 border-amber-400' : ''}">
          <span class="w-5 text-center">📊</span> 仪表盘
        </a>
        ${role === 'super_admin' ? `
        <a href="/admin/users" class="flex items-center gap-3 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors ${activeMenu === 'users' ? 'bg-white/15 text-white border-r-3 border-amber-400' : ''}">
          <span class="w-5 text-center">👥</span> 用户管理
        </a>` : ''}
        <a href="/admin/products" class="flex items-center gap-3 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors ${activeMenu === 'products' ? 'bg-white/15 text-white border-r-3 border-amber-400' : ''}">
          <span class="w-5 text-center">📦</span> 产品管理
        </a>
        <a href="/admin/categories" class="flex items-center gap-3 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors ${activeMenu === 'categories' ? 'bg-white/15 text-white border-r-3 border-amber-400' : ''}">
          <span class="w-5 text-center">📂</span> 分类管理
        </a>
        <a href="/admin/category-params" class="flex items-center gap-3 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors ${activeMenu === 'category-params' ? 'bg-white/15 text-white border-r-3 border-amber-400' : ''}">
          <span class="w-5 text-center">⚙️</span> 参数规范
        </a>
        <a href="/admin/product-images" class="flex items-center gap-3 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors ${activeMenu === 'product-images' ? 'bg-white/15 text-white border-r-3 border-amber-400' : ''}">
          <span class="w-5 text-center">🖼️</span> 图片管理
        </a>
        <a href="/admin/logs" class="flex items-center gap-3 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors ${activeMenu === 'logs' ? 'bg-white/15 text-white border-r-3 border-amber-400' : ''}">
          <span class="w-5 text-center">📋</span> 操作日志
        </a>
      </nav>
      <div class="px-5 py-4 border-t border-white/10 text-xs text-white/40">
        © 2026 Appliance Admin
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <header class="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
        <div class="text-lg font-semibold text-gray-900">${title}</div>
        <div class="flex items-center gap-3 text-sm text-gray-600">
          <div class="w-8 h-8 rounded-full bg-primary-50 text-primary flex items-center justify-center text-sm font-semibold">A</div>
          <span>${role === 'super_admin' ? '超级管理员' : '管理员'}</span>
          <a href="/admin/logout" class="px-3 py-1.5 border border-gray-200 rounded text-xs text-gray-600 hover:border-red-500 hover:text-red-500 transition-colors">退出</a>
        </div>
      </header>
      <div class="flex-1 overflow-y-auto p-6">
        ${content}
      </div>
    </main>
  </div>
</body>
</html>`
