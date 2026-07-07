/**
 * 产品管理页面 - Tailwind CSS
 */

import { layout } from '../layout.js'

interface Product {
  id: number
  title: string
  brand: string | null
  model: string | null
  category: string | null
  created_at: string | null
  image_url?: string | null
}

export const productsPage = (products: Product[], page: number, total: number, pageSize: number, role = 'admin') => {
  const totalPages = Math.ceil(total / pageSize)

  const rows = products.map(p => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 text-sm text-gray-700">${p.id}</td>
      <td class="px-4 py-3">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.title}" class="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onclick="showImage('${p.image_url}', '${p.title.replace(/'/g, "\\'")}')" title="点击查看大图">`
          : '<div class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">无</div>'}
      </td>
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${p.title}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.brand || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.model || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.category || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${p.created_at ? new Date(p.created_at).toLocaleDateString('zh-CN') : '-'}</td>
      <td class="px-4 py-3 text-right">
        <div class="flex items-center justify-end gap-2">
          <a href="/admin/products/${p.id}/edit" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑</a>
          <form method="POST" action="/admin/products/${p.id}/delete" class="inline" onsubmit="return confirm('确定删除该产品？')">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
          </form>
        </div>
      </td>
    </tr>
  `).join('')

  const pagination = totalPages > 1 ? `
    <div class="flex items-center justify-center gap-3 py-4">
      ${page > 1 ? `<a href="/admin/products?page=${page - 1}" class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">上一页</a>` : ''}
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500">第</span>
        <input type="number" id="pageJump" value="${page}" min="1" max="${totalPages}"
          class="w-14 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:border-primary-500"
          onkeydown="if(event.key==='Enter')jumpToPage()">
        <span class="text-sm text-gray-500">/ ${totalPages} 页</span>
        <button onclick="jumpToPage()" class="px-2 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors cursor-pointer">跳转</button>
      </div>
      ${page < totalPages ? `<a href="/admin/products?page=${page + 1}" class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">下一页</a>` : ''}
    </div>
    <script>
      function jumpToPage() {
        const input = document.getElementById('pageJump')
        const page = parseInt(input.value)
        if (page >= 1 && page <= ${totalPages}) {
          window.location.href = '/admin/products?page=' + page
        }
      }
    </script>
  ` : ''

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">产品管理</h1>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">共 ${total} 个产品</span>
        <a href="/admin/products/create" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">+ 新增产品</a>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">图片</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">产品名称</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">品牌</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">型号</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">分类</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">创建时间</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows}
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
        <div class="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
          <span id="imageModalUrl" class="text-xs text-gray-500 truncate mr-4"></span>
          <a id="imageModalLink" href="" target="_blank" class="px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors">新窗口打开</a>
        </div>
      </div>
    </div>

    <script>
      function showImage(url, title) {
        const modal = document.getElementById('imageModal')
        const img = document.getElementById('imageModalImg')
        const titleEl = document.getElementById('imageModalTitle')
        const urlEl = document.getElementById('imageModalUrl')
        const link = document.getElementById('imageModalLink')

        img.src = url
        img.alt = title
        titleEl.textContent = title
        urlEl.textContent = url
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

  return layout('产品管理', content, 'products', role)
}

export const productFormPage = (product?: any, error?: string, role = 'admin') => {
  const isEdit = !!product
  const title = isEdit ? '编辑产品' : '新增产品'

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      <a href="/admin/products" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">← 返回</a>
    </div>

    ${error ? `<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg text-sm text-red-700">${error}</div>` : ''}

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <form method="POST" action="${isEdit ? `/admin/products/${product.id}/edit` : '/admin/products/create'}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">产品名称 <span class="text-red-500">*</span></label>
            <input type="text" name="name" value="${product?.name || product?.title || ''}" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">品牌</label>
            <input type="text" name="brand" value="${product?.brand || ''}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">型号</label>
            <input type="text" name="model" value="${product?.model || ''}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">分类</label>
            <input type="text" name="category" value="${product?.category || ''}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">价格</label>
            <input type="number" name="price" step="0.01" value="${product?.price || ''}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">图片 URL</label>
            <input type="text" name="image_url" id="image_url_input" value="${product?.images?.[0] || ''}" oninput="previewImage(this.value)"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
            ${product?.images?.[0] ? `
            <div class="mt-2">
              <img id="image_preview" src="${product.images[0]}" alt="产品图片" class="w-24 h-24 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" onclick="showImage('${product.images[0].replace(/'/g, "\\'")}', '${(product.name || product.title || '').replace(/'/g, "\\'")}')">
              <p class="text-xs text-gray-500 mt-1">点击可查看大图</p>
            </div>` : `
            <div class="mt-2">
              <img id="image_preview" src="" alt="产品图片" class="w-24 h-24 object-cover rounded border border-gray-200 hidden">
            </div>`}
          </div>
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">产品描述</label>
          <textarea name="description" rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-vertical">${product?.params?.description || ''}</textarea>
        </div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-3">产品参数</label>
          <div id="params-container" class="space-y-2">
            ${product?.params ? Object.entries(product.params).filter(([k]) => k !== 'description').map(([key, value], index) => `
              <div class="flex items-center gap-2 param-row">
                <input type="text" name="param_key_${index}" value="${key}" placeholder="参数名"
                  class="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20">
                <input type="text" name="param_value_${index}" value="${value}" placeholder="参数值"
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20">
                <button type="button" onclick="this.parentElement.remove()" class="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            `).join('') : ''}
          </div>
          <input type="hidden" id="params_count" name="params_count" value="${product?.params ? Object.keys(product.params).filter(k => k !== 'description').length : 0}">
          <button type="button" onclick="addParam()" class="mt-2 px-3 py-1.5 text-sm border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-primary-500 hover:text-primary-600 transition-colors">
            + 添加参数
          </button>
        </div>

        <script>
          function addParam() {
            var container = document.getElementById('params-container');
            var countInput = document.getElementById('params_count');
            var index = parseInt(countInput.value);
            countInput.value = index + 1;

            var div = document.createElement('div');
            div.className = 'flex items-center gap-2 param-row';
            var html = '<input type="text" name="param_key_' + index + '" value="" placeholder="参数名" class="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20">';
            html += '<input type="text" name="param_value_' + index + '" value="" placeholder="参数值" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20">';
            html += '<button type="button" onclick="this.parentElement.remove()" class="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>';
            div.innerHTML = html;
            container.appendChild(div);
          }
        </script>
        <div class="flex gap-3">
          <button type="submit" class="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer border-0">${isEdit ? '保存' : '创建'}</button>
          <a href="/admin/products" class="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">取消</a>
        </div>
      </form>
    </div>

    <!-- 图片预览弹窗 -->
    <div id="imageModal" class="fixed inset-0 bg-black/70 z-50 hidden items-center justify-center p-4" onclick="closeImageModal(event)">
      <div class="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 id="imageModalTitle" class="text-sm font-medium text-gray-700 truncate">图片预览</h3>
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
      function previewImage(url) {
        const preview = document.getElementById('image_preview')
        if (url && url.trim()) {
          preview.src = url
          preview.classList.remove('hidden')
          preview.onclick = () => showImage(url, '产品图片')
        } else {
          preview.src = ''
          preview.classList.add('hidden')
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

  return layout(title, content, 'products', role)
}
