/**
 * 仪表盘页面 - Tailwind CSS
 */

import { layout } from '../layout.js'

interface CategoryStat {
  id: number
  code: string
  name: string
  icon: string | null
  product_count: number
}

interface RecentProduct {
  id: number
  name: string
  brand: string
  category_name: string | null
  created_at: string
}

interface HotSearch {
  keyword: string
  search_count: number
}

export const dashboardPage = (data: {
  totalProducts: number
  totalBrands: number
  totalCategories: number
  totalSearches: number
  categoryStats: CategoryStat[]
  recentProducts: RecentProduct[]
  hotSearches: HotSearch[]
}, role = 'admin') => {
  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">仪表盘</h1>
      <div class="text-sm text-gray-500">欢迎回来，${role === 'super_admin' ? '超级管理员' : '管理员'}</div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      <a href="/admin/products" class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 mb-2">📦 产品总数</div>
            <div class="text-3xl font-bold text-gray-900">${data.totalProducts}</div>
          </div>
          <div class="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-2xl">📦</div>
        </div>
      </a>
      <a href="/admin/products" class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 mb-2">🏷️ 品牌数量</div>
            <div class="text-3xl font-bold text-gray-900">${data.totalBrands}</div>
          </div>
          <div class="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-2xl">🏷️</div>
        </div>
      </a>
      <a href="/admin/categories" class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 mb-2">📂 分类数量</div>
            <div class="text-3xl font-bold text-gray-900">${data.totalCategories}</div>
          </div>
          <div class="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-2xl">📂</div>
        </div>
      </a>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500 mb-2">🔍 搜索次数</div>
            <div class="text-3xl font-bold text-gray-900">${data.totalSearches}</div>
          </div>
          <div class="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center text-2xl">🔍</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- 分类统计 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="px-5 py-4 border-b border-gray-100">
          <div class="text-lg font-semibold text-gray-900">分类统计</div>
        </div>
        <div class="p-5">
          ${data.categoryStats.length > 0 ? `
            <div class="space-y-3">
              ${data.categoryStats.map(c => `
                <a href="/admin/products?category=${c.code}" class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div class="flex items-center gap-3">
                    <span class="text-xl">${c.icon || '📦'}</span>
                    <span class="text-sm font-medium text-gray-700">${c.name}</span>
                  </div>
                  <span class="text-sm font-semibold text-primary-600">${c.product_count} 个产品</span>
                </a>
              `).join('')}
            </div>
          ` : '<div class="text-sm text-gray-500 text-center py-8">暂无数据</div>'}
        </div>
      </div>

      <!-- 热门搜索 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="px-5 py-4 border-b border-gray-100">
          <div class="text-lg font-semibold text-gray-900">热门搜索</div>
        </div>
        <div class="p-5">
          ${data.hotSearches.length > 0 ? `
            <div class="space-y-3">
              ${data.hotSearches.map((s, i) => `
                <div class="flex items-center justify-between p-3 rounded-lg ${i < 3 ? 'bg-orange-50' : 'hover:bg-gray-50'} transition-colors">
                  <div class="flex items-center gap-3">
                    <span class="w-6 h-6 ${i < 3 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'} rounded-full flex items-center justify-center text-xs font-bold">${i + 1}</span>
                    <span class="text-sm font-medium text-gray-700">${s.keyword}</span>
                  </div>
                  <span class="text-sm text-gray-500">${s.search_count} 次</span>
                </div>
              `).join('')}
            </div>
          ` : '<div class="text-sm text-gray-500 text-center py-8">暂无搜索记录</div>'}
        </div>
      </div>
    </div>

    <!-- 最近添加的产品 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
      <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div class="text-lg font-semibold text-gray-900">最近添加的产品</div>
        <a href="/admin/products/create" class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">+ 添加产品</a>
      </div>
      <div class="overflow-x-auto">
        ${data.recentProducts.length > 0 ? `
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">产品名称</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">品牌</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">分类</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">添加时间</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${data.recentProducts.map(p => `
                <tr class="hover:bg-gray-50">
                  <td class="px-5 py-3 text-sm text-gray-700">${p.id}</td>
                  <td class="px-5 py-3 text-sm font-medium text-gray-900">${p.name}</td>
                  <td class="px-5 py-3 text-sm text-gray-700">${p.brand}</td>
                  <td class="px-5 py-3 text-sm text-gray-700">${p.category_name || '-'}</td>
                  <td class="px-5 py-3 text-sm text-gray-500">${new Date(p.created_at).toLocaleDateString('zh-CN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="text-sm text-gray-500 text-center py-8">暂无产品</div>'}
      </div>
    </div>

    <!-- 快速操作 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="px-5 py-4 border-b border-gray-100">
        <div class="text-lg font-semibold text-gray-900">快速操作</div>
      </div>
      <div class="p-5">
        <div class="flex gap-3 flex-wrap">
          ${role === 'super_admin' ? '<a href="/admin/users" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">👥 用户管理</a>' : ''}
          <a href="/admin/products/create" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">➕ 添加产品</a>
          <a href="/admin/categories" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">📂 分类管理</a>
          <a href="/admin/category-params" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">⚙️ 参数规范</a>
          <a href="/admin/product-images" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">🖼️ 图片管理</a>
          <a href="/admin/logs" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">📋 操作日志</a>
        </div>
      </div>
    </div>
  `

  return layout('仪表盘', content, 'dashboard', role)
}
