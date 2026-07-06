/**
 * 产品管理页面 - 服务端渲染
 */

import { layout } from '../layout.js'

interface Product {
  id: number
  title: string
  brand: string | null
  model: string | null
  category_name: string | null
  created_at: string
}

export const productsPage = (products: Product[], page: number, total: number, pageSize: number) => {
  const totalPages = Math.ceil(total / pageSize)

  const rows = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td><strong>${p.title}</strong></td>
      <td>${p.brand || '-'}</td>
      <td>${p.model || '-'}</td>
      <td>${p.category_name || '-'}</td>
      <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('zh-CN') : '-'}</td>
      <td>
        <form method="POST" action="/admin/products/${p.id}/delete" style="display:inline;" onsubmit="return confirm('确定删除该产品？')">
          <button type="submit" class="btn btn-sm btn-danger">删除</button>
        </form>
      </td>
    </tr>
  `).join('')

  const pagination = totalPages > 1 ? `
    <div style="display:flex;justify-content:center;gap:8px;padding:16px;">
      ${page > 1 ? `<a href="/admin/products?page=${page - 1}" class="btn btn-outline btn-sm">上一页</a>` : ''}
      <span style="line-height:32px;font-size:14px;color:var(--gray-500);">第 ${page} / ${totalPages} 页</span>
      ${page < totalPages ? `<a href="/admin/products?page=${page + 1}" class="btn btn-outline btn-sm">下一页</a>` : ''}
    </div>
  ` : ''

  const content = `
    <div class="page-header">
      <h1 class="page-title">产品管理</h1>
      <span style="font-size:14px;color:var(--gray-500);">共 ${total} 个产品</span>
    </div>

    <div class="card">
      <div class="card-body" style="padding: 0;">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>产品名称</th>
                <th>品牌</th>
                <th>型号</th>
                <th>分类</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        ${pagination}
      </div>
    </div>
  `

  return layout('产品管理', content, 'products')
}
