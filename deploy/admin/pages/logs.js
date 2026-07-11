"use strict";
/**
 * 操作日志页面 - Tailwind CSS
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsPage = void 0;
const layout_js_1 = require("../layout.js");
const logsPage = (logs, page, total, pageSize, role = 'admin') => {
    const totalPages = Math.ceil(total / pageSize);
    const typeLabels = {
        login: '登录',
        create: '创建',
        update: '更新',
        delete: '删除',
        export: '导出',
    };
    const rows = logs.map(l => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 text-sm text-gray-700">${l.id}</td>
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${l.operator}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">${typeLabels[l.type] || l.type}</span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-700">${l.target || '-'}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${l.result === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
          ${l.result === 'success' ? '成功' : '失败'}
        </span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-700">${l.ip || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${l.created_at ? new Date(l.created_at).toLocaleString('zh-CN') : '-'}</td>
      ${role === 'super_admin' ? `
      <td class="px-4 py-3 text-right">
        <form method="POST" action="/admin/logs/${l.id}/delete" class="inline" onsubmit="return confirm('确定删除该日志？')">
          <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
        </form>
      </td>` : ''}
    </tr>
  `).join('');
    const pagination = totalPages > 1 ? `
    <div class="flex items-center justify-center gap-3 py-4">
      ${page > 1 ? `<a href="/admin/logs?page=${page - 1}" class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">上一页</a>` : ''}
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500">第</span>
        <input type="number" id="pageJump" value="${page}" min="1" max="${totalPages}"
          class="w-14 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:border-primary-500"
          onkeydown="if(event.key==='Enter')jumpToPage()">
        <span class="text-sm text-gray-500">/ ${totalPages} 页</span>
        <button onclick="jumpToPage()" class="px-2 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors cursor-pointer">跳转</button>
      </div>
      ${page < totalPages ? `<a href="/admin/logs?page=${page + 1}" class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">下一页</a>` : ''}
    </div>
    <script>
      function jumpToPage() {
        const input = document.getElementById('pageJump')
        const page = parseInt(input.value)
        if (page >= 1 && page <= ${totalPages}) {
          window.location.href = '/admin/logs?page=' + page
        }
      }
    </script>
  ` : '';
    const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">操作日志</h1>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">共 ${total} 条记录</span>
        ${role === 'super_admin' && total > 0 ? `
        <form method="POST" action="/admin/logs/clear" onsubmit="return confirm('确定清空所有日志？此操作不可恢复！')">
          <button type="submit" class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer border-0">清空日志</button>
        </form>` : ''}
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作人</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">类型</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">目标</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">结果</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IP</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">时间</th>
              ${role === 'super_admin' ? '<th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>' : ''}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows}
          </tbody>
        </table>
      </div>
      ${pagination}
    </div>
  `;
    return (0, layout_js_1.layout)('操作日志', content, 'logs', role);
};
exports.logsPage = logsPage;
