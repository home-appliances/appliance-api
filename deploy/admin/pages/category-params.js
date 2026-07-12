"use strict";
/**
 * 参数规范管理页面
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryParamFormPage = exports.categoryParamsPage = void 0;
const layout_js_1 = require("../layout.js");
const categoryParamsPage = (params, categories, role = 'admin', filterCategoryId) => {
    const rows = params.map(p => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 text-sm text-gray-700">${p.id}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.category_name || '-'}</td>
      <td class="px-4 py-3 text-sm font-mono text-gray-900">${p.param_key}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.display_name}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.icon || '-'}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${p.param_type}
        </span>
      </td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          ${p.is_core ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">核心</span>' : ''}
          ${p.is_filter ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">可筛选</span>' : ''}
          ${p.is_sortable ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">可排序</span>' : ''}
        </div>
      </td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.enum_values ? p.enum_values.join(', ') : '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.sort_order}</td>
      <td class="px-4 py-3 text-right">
        <div class="flex items-center justify-end gap-2">
          <a href="/admin/category-params/${p.id}/edit" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑</a>
          <form method="POST" action="/admin/category-params/${p.id}/delete" class="inline" onsubmit="return confirm('确定删除该参数规范？')">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
          </form>
        </div>
      </td>
    </tr>
  `).join('');
    const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">参数规范管理</h1>
      <div class="flex items-center gap-3">
        <select id="categoryFilter" onchange="filterByCategory()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">
          <option value="">全部分类</option>
          ${categories.map(c => `<option value="${c.id}" ${filterCategoryId === c.id ? 'selected' : ''}>${c.icon || ''} ${c.display_name || c.name}</option>`).join('')}
        </select>
        <a href="/admin/category-params/create" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">+ 新增参数</a>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">分类</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">参数名</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">显示名</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">图标</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">类型</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">标记</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">枚举值</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">排序</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>

    <script>
      function filterByCategory() {
        const categoryId = document.getElementById('categoryFilter').value
        if (categoryId) {
          window.location.href = '/admin/category-params?category_id=' + categoryId
        } else {
          window.location.href = '/admin/category-params'
        }
      }
    </script>
  `;
    return (0, layout_js_1.layout)('参数规范', content, 'category-params', role);
};
exports.categoryParamsPage = categoryParamsPage;
const categoryParamFormPage = (param, categories = [], error, role = 'admin') => {
    const isEdit = !!param;
    const title = isEdit ? '编辑参数规范' : '新增参数规范';
    const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      <a href="/admin/category-params" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">← 返回</a>
    </div>

    ${error ? `<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg text-sm text-red-700">${error}</div>` : ''}

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <form method="POST" action="${isEdit ? `/admin/category-params/${param.id}/edit` : '/admin/category-params/create'}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">所属分类 <span class="text-red-500">*</span></label>
            <select name="category_id" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="">请选择分类</option>
              ${categories.map(c => `<option value="${c.id}" ${param?.category_id === c.id ? 'selected' : ''}>${c.icon || ''} ${c.display_name || c.name}</option>`).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">参数名 <span class="text-red-500">*</span></label>
            <input type="text" name="param_key" value="${param?.param_key || ''}" required placeholder="如：匹数"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">显示名 <span class="text-red-500">*</span></label>
            <input type="text" name="display_name" value="${param?.display_name || ''}" required placeholder="如：匹数"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">图标</label>
            <input type="text" name="icon" value="${param?.icon || ''}" placeholder="如：⚡"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">参数类型 <span class="text-red-500">*</span></label>
            <select name="param_type" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="text" ${param?.param_type === 'text' ? 'selected' : ''}>文本</option>
              <option value="number" ${param?.param_type === 'number' ? 'selected' : ''}>数字</option>
              <option value="enum" ${param?.param_type === 'enum' ? 'selected' : ''}>枚举</option>
              <option value="boolean" ${param?.param_type === 'boolean' ? 'selected' : ''}>布尔</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">枚举值（JSON数组）</label>
            <input type="text" name="enum_values" value="${param?.enum_values ? JSON.stringify(param.enum_values) : ''}" placeholder='["一级","二级","三级"]'
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
            <p class="mt-1 text-xs text-gray-500">参数类型为枚举时填写，JSON数组格式</p>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">排序</label>
            <input type="number" name="sort_order" value="${param?.sort_order || 0}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2">
                <input type="checkbox" name="is_core" value="true" ${param?.is_core ? 'checked' : ''}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                <span class="text-sm font-medium text-gray-700">核心参数</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" name="is_filter" value="true" ${param?.is_filter ? 'checked' : ''}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                <span class="text-sm font-medium text-gray-700">可筛选</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" name="is_sortable" value="true" ${param?.is_sortable ? 'checked' : ''}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                <span class="text-sm font-medium text-gray-700">可排序</span>
              </label>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <a href="/admin/category-params" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">取消</a>
          <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer border-0">${isEdit ? '保存' : '创建'}</button>
        </div>
      </form>
    </div>
  `;
    return (0, layout_js_1.layout)(title, content, 'category-params', role);
};
exports.categoryParamFormPage = categoryParamFormPage;
