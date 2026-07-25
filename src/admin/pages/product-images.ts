/**
 * 产品图片管理页面
 * 按图片记录列出（每行一张图，带产品信息和类型）
 */

import { layout } from '../layout.js'

interface ImageRow {
  id: number
  image_url: string
  image_type: string
  sort_order: number
  created_at: string
  product_id: number
  product_name: string
  brand: string | null
  model: string | null
}

const typeLabel = (t: string) => t === 'display' ? '展示图' : (t === 'main' ? '主图' : t)
const typeBadgeColor = (t: string) => t === 'display' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'

export const productImagesPage = (
  images: ImageRow[],
  allProducts: any[],
  role = 'admin',
  filterProductId?: number,
  total = 0,
  page = 1,
  pageSize = 50,
) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const rows = images.map(img => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 text-sm text-gray-700">${img.id}</td>
      <td class="px-4 py-3 text-sm text-gray-700">
        <a href="/admin/products/${img.product_id}/edit" class="text-primary-600 hover:underline" title="编辑产品">
          #${img.product_id} ${img.product_name}
        </a>
      </td>
      <td class="px-4 py-3">
        ${img.image_url
          ? `<img src="${img.image_url}" alt="${typeLabel(img.image_type)}" class="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onclick="showImage('${img.image_url}', '${img.product_name} - ${typeLabel(img.image_type)}')" title="点击查看大图">`
          : '<div class="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">无图</div>'}
      </td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeColor(img.image_type)}">${typeLabel(img.image_type)}</span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-700">${img.sort_order}</td>
      <td class="px-4 py-3 text-sm text-gray-500 max-w-xs">
        ${img.image_url
          ? `<span class="inline-block truncate align-middle" title="${img.image_url}">${img.image_url}</span>`
          : '<span class="text-gray-400">-</span>'}
      </td>
      <td class="px-4 py-3 text-sm text-gray-700">${new Date(img.created_at).toLocaleString('zh-CN')}</td>
      <td class="px-4 py-3 text-right">
        <div class="flex items-center justify-end gap-2">
          <a href="/admin/products/${img.product_id}/edit" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑产品</a>
          <form method="POST" action="/admin/product-images/${img.id}/delete" class="inline delete-image-form">
            <input type="hidden" class="product-name" value="${(img.product_name || '').replace(/"/g, '&quot;')}">
            <input type="hidden" class="image-type" value="${typeLabel(img.image_type)}">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
          </form>
        </div>
      </td>
    </tr>
  `).join('')

  const pagination = totalPages > 1 ? `
    <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
      <div class="text-sm text-gray-500">共 ${total} 条，第 ${page} / ${totalPages} 页</div>
      <div class="flex items-center gap-1">
        ${page > 1 ? `<a href="?page=${page - 1}${filterProductId ? '&product_id=' + filterProductId : ''}" class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-white transition-colors">上一页</a>` : ''}
        ${page < totalPages ? `<a href="?page=${page + 1}${filterProductId ? '&product_id=' + filterProductId : ''}" class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-white transition-colors">下一页</a>` : ''}
      </div>
    </div>
  ` : ''

  const content = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">图片管理</h1>
        <p class="text-sm text-gray-500 mt-1">管理产品图片（主图 / 展示图），按图片记录列出</p>
      </div>
      <div class="flex items-center gap-3">
        <select id="productFilter" onchange="filterByProduct()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">
          <option value="">全部产品</option>
          ${allProducts.map(p => `<option value="${p.id}" ${filterProductId === p.id ? 'selected' : ''}>#${p.id} ${p.name}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div class="text-sm text-gray-500">图片总数</div>
        <div class="text-2xl font-bold text-gray-900 mt-1">${total}</div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">图片ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">所属产品</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">预览</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">类型</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">排序</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">图片路径</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">创建时间</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows || '<tr><td colspan="8" class="px-4 py-12 text-center text-gray-400">暂无图片数据</td></tr>'}
          </tbody>
        </table>
      </div>
      ${pagination}
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
        <div class="px-4 py-3 border-t border-gray-200 flex justify-end">
          <a id="imageModalLink" href="" target="_blank" class="px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors">新窗口打开</a>
        </div>
      </div>
    </div>

    <script>
      // 删除图片确认
      document.querySelectorAll('.delete-image-form').forEach(function(form) {
        form.addEventListener('submit', function(e) {
          var nameInput = form.querySelector('.product-name')
          var typeInput = form.querySelector('.image-type')
          var productName = nameInput ? nameInput.value : '该产品'
          var imageType = typeInput ? typeInput.value : '图片'
          if (!confirm('确定删除「' + productName + '」的' + imageType + '？')) {
            e.preventDefault()
          }
        })
      })

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
        const link = document.getElementById('imageModalLink')

        img.src = url
        img.alt = title
        titleEl.textContent = title || '图片预览'
        link.href = url

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
