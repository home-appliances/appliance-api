/**
 * 产品图片管理页面
 */

import { layout } from '../layout.js'

interface ProductImage {
  id: number
  product_id: number
  product_name?: string
  image_url: string | null
  image_type: string
  sort_order: number
  created_at: string
}

export const productImagesPage = (images: ProductImage[], products: any[], role = 'admin', filterProductId?: number) => {
  const imageTypeLabels: Record<string, string> = {
    'main': '主图',
    'display': '展示图',
    'detail': '细节图',
    'scene': '场景图'
  }

  const rows = images.map(img => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 text-sm text-gray-700">${img.id}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${img.product_id}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${img.product_name || '-'}</td>
      <td class="px-4 py-3">
        ${img.image_url
          ? `<img src="${img.image_url}" alt="图片" class="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onclick="showImage('${img.image_url}', '图片 #${img.id}')" title="点击查看大图">`
          : '<div class="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">无图</div>'}
      </td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${imageTypeLabels[img.image_type] || img.image_type}
        </span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-700">${img.sort_order}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${new Date(img.created_at).toLocaleDateString('zh-CN')}</td>
      <td class="px-4 py-3 text-right">
        <div class="flex items-center justify-end gap-2">
          <a href="/admin/product-images/${img.id}/edit" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑</a>
          <form method="POST" action="/admin/product-images/${img.id}/delete" class="inline" onsubmit="return confirm('确定删除该图片？')">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
          </form>
        </div>
      </td>
    </tr>
  `).join('')

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">图片管理</h1>
      <div class="flex items-center gap-3">
        <select id="productFilter" onchange="filterByProduct()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">
          <option value="">全部产品</option>
          ${products.map(p => `<option value="${p.id}" ${filterProductId === p.id ? 'selected' : ''}>#${p.id} ${p.name}</option>`).join('')}
        </select>
        <a href="/admin/product-images/create" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">+ 添加图片</a>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">产品ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">产品名称</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">图片</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">类型</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">排序</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">创建时间</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <div id="imageModal" class="fixed inset-0 bg-black/70 z-50 hidden items-center justify-center p-4" onclick="closeImageModal(event)">
      <div class="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 id="imageModalTitle" class="text-sm font-medium text-gray-700 truncate"></h3>
          <button onclick="closeImageModal()" class="p-1 hover:bg-gray-100 rounded transition-colors">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="p-4 flex items-center justify-center bg-gray-50">
          <img id="imageModalImg" src="" alt="" class="max-w-full max-h-[75vh] object-contain">
        </div>
      </div>
    </div>

    <script>
      function filterByProduct() {
        const productId = document.getElementById('productFilter').value
        if (productId) {
          window.location.href = '/admin/product-images?product_id=' + productId
        } else {
          window.location.href = '/admin/product-images'
        }
      }

      function showImage(url, title) {
        const modal = document.getElementById('imageModal')
        const img = document.getElementById('imageModalImg')
        const titleEl = document.getElementById('imageModalTitle')

        img.src = url
        img.alt = title
        titleEl.textContent = title

        modal.classList.remove('hidden')
        modal.classList.add('flex')
        document.body.style.overflow = 'hidden'
      }

      function closeImageModal(event) {
        if (event && event.target !== event.currentTarget) return
        const modal = document.getElementById('imageModal')
        modal.classList.add('hidden')
        modal.classList.remove('flex')
        document.body.style.overflow = ''
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeImageModal()
      })
    </script>
  `

  return layout('图片管理', content, 'product-images', role)
}

export const productImageFormPage = (image?: any, products: any[] = [], error?: string, role = 'admin') => {
  const isEdit = !!image
  const title = isEdit ? '编辑图片' : '添加图片'

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      <a href="/admin/product-images" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">← 返回</a>
    </div>

    ${error ? `<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg text-sm text-red-700">${error}</div>` : ''}

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <form method="POST" action="${isEdit ? `/admin/product-images/${image.id}/edit` : '/admin/product-images/create'}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">产品 <span class="text-red-500">*</span></label>
            <select name="product_id" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="">请选择产品</option>
              ${products.map(p => `<option value="${p.id}" ${image?.product_id === p.id ? 'selected' : ''}>#${p.id} ${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">图片类型 <span class="text-red-500">*</span></label>
            <select name="image_type" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="main" ${image?.image_type === 'main' ? 'selected' : ''}>主图</option>
              <option value="display" ${image?.image_type === 'display' ? 'selected' : ''}>展示图</option>
              <option value="detail" ${image?.image_type === 'detail' ? 'selected' : ''}>细节图</option>
              <option value="scene" ${image?.image_type === 'scene' ? 'selected' : ''}>场景图</option>
            </select>
          </div>
          <div class="mb-4 md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">图片URL <span class="text-red-500">*</span></label>
            <input type="url" name="image_url" value="${image?.image_url || ''}" required placeholder="https://example.com/image.jpg"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">排序</label>
            <input type="number" name="sort_order" value="${image?.sort_order || 0}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <a href="/admin/product-images" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">取消</a>
          <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer border-0">${isEdit ? '保存' : '添加'}</button>
        </div>
      </form>
    </div>
  `

  return layout(title, content, 'product-images', role)
}
