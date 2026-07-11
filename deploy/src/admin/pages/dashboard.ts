/**
 * 仪表盘页面 - Tailwind CSS
 */

import { layout } from '../layout.js'

export const dashboardPage = (stats: {
  totalProducts: number
  totalBrands: number
  totalCategories: number
  totalSearches: number
}, role = 'admin') => {
  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">仪表盘</h1>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="text-sm text-gray-500 mb-2">📦 产品总数</div>
        <div class="text-3xl font-bold text-gray-900">${stats.totalProducts}</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="text-sm text-gray-500 mb-2">🏷 品牌数量</div>
        <div class="text-3xl font-bold text-gray-900">${stats.totalBrands}</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="text-sm text-gray-500 mb-2">📂 分类数量</div>
        <div class="text-3xl font-bold text-gray-900">${stats.totalCategories}</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="text-sm text-gray-500 mb-2">🔍 搜索次数</div>
        <div class="text-3xl font-bold text-gray-900">${stats.totalSearches}</div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div class="text-lg font-semibold text-gray-900">快速操作</div>
      </div>
      <div class="p-5">
        <div class="flex gap-3 flex-wrap">
          ${role === 'super_admin' ? '<a href="/admin/users" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">👥 用户管理</a>' : ''}
          <a href="/admin/products" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">📦 产品管理</a>
          <a href="/admin/logs" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">📋 操作日志</a>
        </div>
      </div>
    </div>
  `

  return layout('仪表盘', content, 'dashboard', role)
}
