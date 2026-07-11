/**
 * 分类管理页面
 */

import { layout } from '../layout.js'

interface Category {
  id: number
  code: string
  name: string
  display_name: string | null
  icon: string | null
  parent_id: number | null
  sort_order: number
  is_active: boolean
  product_count: number
  param_count: number
  children?: Category[]
}

export const categoriesPage = (categories: Category[], role = 'admin') => {
  // 构建树形结构
  const rootCategories = categories.filter(c => !c.parent_id)

  const renderCategoryRow = (cat: Category, level = 0) => {
    const indent = level * 2
    const children = categories.filter(c => c.parent_id === cat.id)
    const hasChildren = children.length > 0

    return `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3 text-sm text-gray-700">${cat.id}</td>
        <td class="px-4 py-3">
          <div class="flex items-center" style="padding-left: ${indent}rem">
            ${hasChildren ? '<span class="text-gray-400 mr-2">├</span>' : ''}
            <span class="text-lg mr-2">${cat.icon || '📦'}</span>
            <span class="text-sm font-medium text-gray-900">${cat.display_name || cat.name}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-gray-700 font-mono">${cat.code}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${cat.name}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${cat.sort_order}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cat.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
            ${cat.is_active ? '启用' : '禁用'}
          </span>
        </td>
        <td class="px-4 py-3 text-sm text-gray-700">${cat.product_count}</td>
        <td class="px-4 py-3 text-sm text-gray-700">${cat.param_count}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex items-center justify-end gap-2">
            <a href="/admin/categories/${cat.id}/edit" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑</a>
            <form method="POST" action="/admin/categories/${cat.id}/delete" class="inline" onsubmit="return confirm('确定删除该分类？')">
              <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
            </form>
          </div>
        </td>
      </tr>
      ${children.map(child => renderCategoryRow(child, level + 1)).join('')}
    `
  }

  const rows = rootCategories.map(cat => renderCategoryRow(cat)).join('')

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">分类管理</h1>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">共 ${categories.length} 个分类</span>
        <a href="/admin/categories/create" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">+ 新增分类</a>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">分类名称</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">编码</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">原始名称</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">排序</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">产品数</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">参数数</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `

  return layout('分类管理', content, 'categories', role)
}

export const categoryFormPage = (category?: any, categories: any[] = [], error?: string, role = 'admin') => {
  const isEdit = !!category
  const title = isEdit ? '编辑分类' : '新增分类'

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      <a href="/admin/categories" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">← 返回</a>
    </div>

    ${error ? `<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg text-sm text-red-700">${error}</div>` : ''}

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <form method="POST" action="${isEdit ? `/admin/categories/${category.id}/edit` : '/admin/categories/create'}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">分类编码 <span class="text-red-500">*</span></label>
            <input type="text" name="code" value="${category?.code || ''}" required placeholder="如：air_condition"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
            <p class="mt-1 text-xs text-gray-500">英文编码，用于程序逻辑，创建后不可修改</p>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">分类名称 <span class="text-red-500">*</span></label>
            <input type="text" name="name" value="${category?.name || ''}" required placeholder="如：空调"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">展示名称</label>
            <input type="text" name="display_name" value="${category?.display_name || ''}" placeholder="如：空调"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">图标</label>
            <input type="text" name="icon" value="${category?.icon || ''}" placeholder="如：❄️"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">父分类</label>
            <select name="parent_id"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="">无（顶级分类）</option>
              ${categories.filter(c => !c.parent_id).map(c => `
                <option value="${c.id}" ${category?.parent_id === c.id ? 'selected' : ''}>${c.icon || ''} ${c.display_name || c.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">排序</label>
            <input type="number" name="sort_order" value="${category?.sort_order || 0}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="flex items-center gap-2">
              <input type="checkbox" name="is_active" value="true" ${category?.is_active !== false ? 'checked' : ''}
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
              <span class="text-sm font-medium text-gray-700">启用</span>
            </label>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <a href="/admin/categories" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">取消</a>
          <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer border-0">${isEdit ? '保存' : '创建'}</button>
        </div>
      </form>
    </div>
  `

  return layout(title, content, 'categories', role)
}
