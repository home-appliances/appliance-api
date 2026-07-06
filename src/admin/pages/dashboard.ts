/**
 * 仪表盘页面 - 服务端渲染
 */

import { layout } from '../layout.js'

export const dashboardPage = (stats: {
  totalProducts: number
  totalBrands: number
  totalCategories: number
  totalSearches: number
}) => {
  const content = `
    <div class="page-header">
      <h1 class="page-title">仪表盘</h1>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px;">
      <div class="card" style="padding: 20px;">
        <div style="font-size: 14px; color: var(--gray-500); margin-bottom: 8px;">📦 产品总数</div>
        <div style="font-size: 32px; font-weight: 700; color: var(--gray-900);">${stats.totalProducts}</div>
      </div>
      <div class="card" style="padding: 20px;">
        <div style="font-size: 14px; color: var(--gray-500); margin-bottom: 8px;">🏷 品牌数量</div>
        <div style="font-size: 32px; font-weight: 700; color: var(--gray-900);">${stats.totalBrands}</div>
      </div>
      <div class="card" style="padding: 20px;">
        <div style="font-size: 14px; color: var(--gray-500); margin-bottom: 8px;">📂 分类数量</div>
        <div style="font-size: 32px; font-weight: 700; color: var(--gray-900);">${stats.totalCategories}</div>
      </div>
      <div class="card" style="padding: 20px;">
        <div style="font-size: 14px; color: var(--gray-500); margin-bottom: 8px;">🔍 搜索次数</div>
        <div style="font-size: 32px; font-weight: 700; color: var(--gray-900);">${stats.totalSearches}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">快速操作</div>
      </div>
      <div class="card-body">
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <a href="/admin/users" class="btn btn-primary">👥 用户管理</a>
          <a href="/admin/products" class="btn btn-outline">📦 产品管理</a>
          <a href="/admin/logs" class="btn btn-outline">📋 操作日志</a>
        </div>
      </div>
    </div>
  `

  return layout('仪表盘', content, 'dashboard')
}
