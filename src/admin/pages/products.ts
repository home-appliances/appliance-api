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
  price?: number | string | null
  original_price?: number | string | null
  rating?: number | string | null
  review_count?: number | null
  created_at: string | null
  updated_at: string | null
  image_url?: string | null
}

export const productsPage = (products: Product[], page: number, total: number, pageSize: number, role = 'admin', filters: { keyword?: string; brand?: string; category?: string; sort?: 'created_at' | 'updated_at'; order?: 'asc' | 'desc' } = {}, brands: string[] = []) => {
  const totalPages = Math.ceil(total / pageSize)

  // 分类选项
  const categoryOptions = [
    { value: '', label: '全部分类' },
    { value: 'air_condition', label: '空调' },
    { value: 'icebox', label: '冰箱/冰柜' },
    { value: 'washer', label: '洗衣机' },
    { value: 'gas_water', label: '热水器' },
    { value: 'lcd_tv', label: '电视' },
    { value: 'heater', label: '取暖器' },
    { value: 'rice_cooker', label: '电饭煲/油烟机' },
  ]

  // 品牌中文名映射
  const brandChineseNames: Record<string, string> = {
    'xiaomi': '小米', 'haier': '海尔', 'midea': '美的', 'panasonic': '松下',
    'siemens': '西门子', 'samsung': '三星', 'hisense': '海信', 'rongsheng': '容声',
    'casarte': '卡萨帝', 'electrolux': '伊莱克斯', 'whirlpool': '惠而浦',
    'bocsh': '博世', 'tcl': 'TCL', 'chigo': '志高', 'xinfei': '新飞',
    'mitsubishi': '三菱', 'aux': '奥克斯', 'lg': 'LG',
    'gree': '格力', 'daikin': '大金', 'kelon': '科龙',
    'little_swan': '小天鹅',
    'noritz': '林内', 'a/o_smith': 'A.O.史密斯', 'macro': '万和', 'ariston': '阿里斯顿',
    'sony': '索尼', 'sharp': '夏普', 'philips': '飞利浦', 'changhong': '长虹',
    'konka': '康佳', 'letv': '乐视', 'huawei': '华为',
    'robam': '老板', 'fotile': '方太', 'vatti': '华帝',
  }

  // 构建查询字符串（保留搜索、筛选和排序参数）
  const buildUrl = (pageNum: number, sortField?: string, orderDir?: string) => {
    const params = new URLSearchParams()
    params.set('page', pageNum.toString())
    if (filters.keyword) params.set('keyword', filters.keyword)
    if (filters.brand) params.set('brand', filters.brand)
    if (filters.category) params.set('category', filters.category)
    const finalSort = sortField || filters.sort || 'created_at'
    const finalOrder = orderDir || filters.order || 'desc'
    params.set('sort', finalSort)
    params.set('order', finalOrder)
    return `/admin/products?${params.toString()}`
  }

  // 构建当前页的查询字符串（用于 return_to，包含 page/keyword/brand/category/sort/order）
  const currentQuery = new URLSearchParams()
  currentQuery.set('page', page.toString())
  if (filters.keyword) currentQuery.set('keyword', filters.keyword)
  if (filters.brand) currentQuery.set('brand', filters.brand)
  if (filters.category) currentQuery.set('category', filters.category)
  if (filters.sort) currentQuery.set('sort', filters.sort)
  if (filters.order) currentQuery.set('order', filters.order)
  const returnTo = `/admin/products?${currentQuery.toString()}`
  const editUrl = (id: number) => `/admin/products/${id}/edit?return_to=${encodeURIComponent(returnTo)}`

  // 排序链接辅助函数
  const currentSort = filters.sort || 'created_at'
  const currentOrder = filters.order || 'desc'
  const sortHeader = (field: 'created_at' | 'updated_at', label: string) => {
    const isActive = currentSort === field
    const nextOrder = isActive && currentOrder === 'desc' ? 'asc' : 'desc'
    const arrow = isActive ? (currentOrder === 'desc' ? ' ↓' : ' ↑') : ''
    const color = isActive ? 'text-primary-600' : 'text-gray-600'
    return `<a href="${buildUrl(page, field, nextOrder)}" class="${color} hover:text-primary-700 transition-colors cursor-pointer">${label}${arrow}</a>`
  }

  const rows = products.map(p => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-3 py-3 text-sm text-gray-700">${p.id}</td>
      <td class="px-3 py-3">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.title}" class="w-20 h-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onclick="showImage('${p.image_url}', '${p.title.replace(/'/g, "\\'")}')" title="点击查看大图">`
          : '<div class="w-20 h-20 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">无</div>'}
      </td>
      <td class="px-3 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate" title="${p.title}">${p.title}</td>
      <td class="px-3 py-3 text-sm text-gray-700">${p.brand || '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-700">${p.model || '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-700">${p.category || '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-500">${p.created_at ? new Date(p.created_at).toLocaleDateString('zh-CN') : '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-500">${p.updated_at ? new Date(p.updated_at).toLocaleDateString('zh-CN') : '-'}</td>
      <td class="px-3 py-3 text-right">
        <div class="flex items-center justify-end gap-2">
          <a href="${editUrl(p.id)}" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑</a>
          <form method="POST" action="/admin/products/${p.id}/delete" class="inline delete-product-form">
            <input type="hidden" class="product-name" value="${(p.title || '').replace(/"/g, '&quot;')}">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
          </form>
        </div>
      </td>
    </tr>
  `).join('')

  const pagination = totalPages > 1 ? `
    <div class="flex items-center justify-center gap-3 py-4">
      ${page > 1 ? `<a href="${buildUrl(page - 1)}" class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">上一页</a>` : ''}
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500">第</span>
        <input type="number" id="pageJump" value="${page}" min="1" max="${totalPages}"
          class="w-14 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:border-primary-500"
          onkeydown="if(event.key==='Enter')jumpToPage()">
        <span class="text-sm text-gray-500">/ ${totalPages} 页</span>
        <button onclick="jumpToPage()" class="px-2 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors cursor-pointer">跳转</button>
      </div>
      ${page < totalPages ? `<a href="${buildUrl(page + 1)}" class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">下一页</a>` : ''}
    </div>
    <script>
      function jumpToPage() {
        const input = document.getElementById('pageJump')
        const page = parseInt(input.value)
        if (page >= 1 && page <= ${totalPages}) {
          window.location.href = '${buildUrl(0)}'.replace('page=0', 'page=' + page)
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

    <!-- 搜索和筛选 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <form method="GET" action="/admin/products" class="flex items-center gap-4">
        <input type="hidden" name="sort" value="${filters.sort || 'created_at'}">
        <input type="hidden" name="order" value="${filters.order || 'desc'}">
        <div class="flex-1">
          <input type="text" name="keyword" value="${filters.keyword || ''}" placeholder="搜索产品名称、品牌、型号...（如：格力空调、美的小天鹅）"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
        </div>
        <div class="w-40">
          <select name="brand" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
            <option value="">全部品牌</option>
            ${brands.map(b => `<option value="${b}" ${filters.brand === b ? 'selected' : ''}>${brandChineseNames[b] || b}</option>`).join('')}
          </select>
        </div>
        <div class="w-36">
          <select name="category" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
            ${categoryOptions.map(c => `<option value="${c.value}" ${filters.category === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer border-0">搜索</button>
        ${filters.keyword || filters.brand || filters.category ? `<a href="/admin/products?sort=${filters.sort || 'created_at'}&order=${filters.order || 'desc'}" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">清除</a>` : ''}
      </form>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">图片</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">产品名称</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">品牌</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">型号</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">分类</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">${sortHeader('created_at', '创建时间')}</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">${sortHeader('updated_at', '修改时间')}</th>
              <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
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
      // 删除产品确认：用事件监听，避免 HTML 属性引号冲突，并展示产品名
      document.querySelectorAll('.delete-product-form').forEach(function(form) {
        form.addEventListener('submit', function(e) {
          var nameInput = form.querySelector('.product-name')
          var productName = nameInput && nameInput.value ? nameInput.value : '该产品'
          if (!confirm('确定删除产品「' + productName + '」？')) {
            e.preventDefault()
          }
        })
      })

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

export const productFormPage = (product?: any, error?: string, role = 'admin', categories: any[] = [], returnTo: string = '/admin/products') => {
  const isEdit = !!product
  const title = isEdit ? '编辑产品' : '新增产品'
  const safeReturnTo = returnTo.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;')

  const content = `
    <style>
      /* 隐藏原生日期控件尾部图标，改用左侧自定义日历按钮 */
      .date-input-front::-webkit-calendar-picker-indicator {
        opacity: 0;
        width: 0;
        padding: 0;
        margin: 0;
        position: absolute;
        pointer-events: none;
      }
      .date-input-front::-webkit-datetime-edit {
        padding: 0;
      }
    </style>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      <a href="${safeReturnTo}" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">← 返回</a>
    </div>

    ${error ? `<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg text-sm text-red-700">${error}</div>` : ''}

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <form method="POST" action="${isEdit ? `/admin/products/${product.id}/edit` : '/admin/products/create'}">
        <input type="hidden" name="return_to" value="${safeReturnTo}">
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
            <select name="category_id" id="category-select" onchange="loadCategoryParams(this.value)"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="">请选择分类</option>
              ${categories.map(c => `<option value="${c.id}" ${product?.categoryId === c.id || product?.category_id === c.id ? 'selected' : ''}>${c.icon || ''} ${c.displayName || c.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">数据源站来源</label>
          <input type="text" name="source_platform" value="${product?.sourcePlatform || product?.source_platform || ''}"
            placeholder="可选，如：pconline / zol / admin"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          ${product?.sourceUrl || product?.source_url ? `
          <p class="mt-1.5 text-sm text-gray-500 truncate">
            来源链接：
            <a href="${product.sourceUrl || product.source_url}" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:underline">${product.sourceUrl || product.source_url}</a>
          </p>` : ''}
        </div>

        <!-- 价格/原价：隐藏但保留值，后续再做处理 -->
        <input type="hidden" name="price" value="${product?.price || ''}">
        <input type="hidden" name="original_price" value="${product?.originalPrice || product?.original_price || ''}">

        <!-- 主图区域 -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-3">产品主图</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4" id="image-list">
            ${product?.images && product.images.length > 0 ? product.images.map((img: any, idx: number) => `
              <div class="relative group" data-image-id="${img.id || ''}">
                <img src="${img.imageUrl || img.url}" alt="产品主图" class="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer" onclick="showImage(this.src, '产品主图')">
                <span class="absolute top-2 left-2 px-2 py-0.5 text-xs bg-black/50 text-white rounded">主图</span>
                <button type="button" onclick="deleteMainImage(${product?.id || 0}, this)" class="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">✕</button>
              </div>
            `).join('') : ''}
          </div>

          <!-- 上传区域 -->
          <div id="upload-area" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer" onclick="document.getElementById('file-input').click()">
            <input type="file" id="file-input" accept="image/*" class="hidden" onchange="handleFileSelect(this.files)">
            <div class="text-gray-400">
              <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              <p class="text-sm">点击或拖拽图片到此处（先暂存，提交时上传）</p>
              <p class="text-xs text-gray-400 mt-1">支持 JPG、PNG、GIF、WebP，最大 5MB</p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">产品描述</label>
          <textarea name="description" rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-vertical">${product?.params?.description || ''}</textarea>
        </div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-3">产品参数</label>
          <div id="params-container" class="space-y-3">
            <div class="text-sm text-gray-400">请先选择分类，参数将自动生成</div>
          </div>
          <!-- 所有参数值通过 p_{paramKey} 字段名提交 -->
        </div>
        <div class="flex gap-3">
          <button type="submit" class="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer border-0">${isEdit ? '保存' : '创建'}</button>
          <a href="${safeReturnTo}" class="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">取消</a>
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

      // ====== 产品参数: 根据所选分类动态渲染参数输入 ======
      // 编辑时已有值, 从 product.params 读取
      const existingParams = ${JSON.stringify(product?.params || {})}

      // 模糊匹配参数值: 规范 key 可能与产品 params key 不完全一致
      // 例如规范是"匹数", 产品 params 是"空调匹数"
      // 注意: 不能用 includes —— "电辅加热" 会误匹配到 "电辅加热功率"
      function matchParamValue(specKey, params) {
        // 1. 精确匹配
        if (params[specKey] !== undefined) return params[specKey]
        // 2. 仅后缀匹配: 规范 key 是产品 key 的后缀（匹数 → 空调匹数）
        for (const k in params) {
          if (k !== specKey && k.endsWith(specKey)) return params[k]
        }
        return ''
      }

      // 归一化参数值: 把爬虫抓取的原始值转换为标准枚举格式
      // 例如 1.5P → 1.5匹, 三级能效 → 三级, 新一级能效 → 一级
      function normalizeValue(val) {
        if (!val) return ''
        let v = String(val).trim()
        // 单位转换: 数字+P → 数字+匹 (空调匹数)
        // 注意: 模板字符串中反斜杠需双写, \\d 输出为 \d, \\b 输出为 \b
        v = v.replace(/(\\d+(?:\\.\\d+)?)P\\b/i, '$1匹')
        // 去掉"能效"后缀: 三级能效 → 三级
        v = v.replace(/能效$/, '')
        // 去掉"新"前缀: 新一级 → 一级
        v = v.replace(/^新/, '')
        // 去掉多余空格
        v = v.trim()
        return v
      }

      function escapeAttr(s) {
        return String(s == null ? '' : s)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      }

      // 仅纯数字才适合 type=number；3500W / 802*555*350mm 等必须用 text 才能回显
      function isPureNumber(val) {
        return /^-?\\d+(\\.\\d+)?$/.test(String(val).trim())
      }

      // 解析为日期选择器可用的 YYYY-MM-DD（精确到天）
      function parseDateForInput(val) {
        if (!val) return { mode: 'empty', value: '' }
        const s = String(val).trim()
        if (/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return { mode: 'date', value: s }
        if (/^\\d{4}-\\d{2}$/.test(s)) return { mode: 'date', value: s + '-01' }
        const m = s.match(/(\\d{4})[年.\\-/](\\d{1,2})[月.\\-/]?(\\d{1,2})?/)
        if (m) {
          const y = m[1]
          const mo = m[2].padStart(2, '0')
          const day = m[3] ? m[3].padStart(2, '0') : '01'
          return { mode: 'date', value: y + '-' + mo + '-' + day }
        }
        return { mode: 'text', value: s }
      }

      // 日历图标放在日期文字前，点击打开原生选择器；隐藏尾部原生图标
      function wrapDatePicker(type, name, value) {
        const inputCls = 'date-input-front flex-1 min-w-0 border-0 p-0 text-sm bg-transparent focus:outline-none'
        return (
          '<div class="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">' +
            '<button type="button" title="选择日期" class="flex-shrink-0 text-primary-600 hover:text-primary-700 cursor-pointer p-0.5" ' +
              'onclick="(function(btn){var i=btn.parentElement.querySelector(\\'input\\');if(!i)return;i.focus();if(i.showPicker){try{i.showPicker()}catch(e){}}})(this)">' +
              '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>' +
              '</svg>' +
            '</button>' +
            '<input type="' + type + '" name="' + name + '" value="' + escapeAttr(value) + '" class="' + inputCls + '">' +
          '</div>'
        )
      }

      async function loadCategoryParams(categoryId) {
        const container = document.getElementById('params-container')
        if (!categoryId) {
          container.innerHTML = '<div class="text-sm text-gray-400">请先选择分类，参数将自动生成</div>'
          return
        }
        container.innerHTML = '<div class="text-sm text-gray-400">加载中...</div>'
        try {
          const res = await fetch('/api/admin/category-params?category_id=' + categoryId)
          if (!res.ok) {
            throw new Error('请求失败 (HTTP ' + res.status + ')')
          }
          const data = await res.json()
          container.innerHTML = ''

          // 渲染参数规范定义的字段
          if (data.code === 0 && data.data && data.data.length > 0) {
            // 编辑模式（产品已有参数）: 只显示有值的参数，空参数折叠
            // 新增模式（无参数）: 显示全部参数
            const hasExisting = Object.keys(existingParams).length > 0
            let filledCount = 0
            let emptyCount = 0

            data.data.forEach(p => {
              const div = document.createElement('div')
              div.className = 'flex items-center gap-3'
              const key = p.paramKey
              const val = matchParamValue(key, existingParams)
              const displayName = p.displayName || key
              const label = '<label class="w-24 text-sm text-gray-600 text-right flex-shrink-0">' + (p.icon || '') + ' ' + displayName + '</label>'
              const safeVal = escapeAttr(val)

              let input = ''
              if (p.paramType === 'enum' && p.enumValues) {
                // 枚举: 下拉选择
                const opts = typeof p.enumValues === 'string' ? JSON.parse(p.enumValues) : p.enumValues
                // 四级匹配: 精确 → 模糊(包含关系) → 归一化匹配 → 保留原值选项
                let selectedOpt = opts.find(o => o === val)
                if (!selectedOpt && val) {
                  selectedOpt = opts.find(o => val.includes(o) || o.includes(val))
                }
                if (!selectedOpt && val) {
                  const normalized = normalizeValue(val)
                  selectedOpt = opts.find(o => o === normalized || normalized.includes(o) || o.includes(normalized))
                }
                let optionsHtml = '<option value="">请选择</option>'
                optionsHtml += opts.map(o => '<option value="' + escapeAttr(o) + '"' + (o === selectedOpt ? ' selected' : '') + '>' + escapeAttr(o) + '</option>').join('')
                // 原值不在枚举中时仍展示，便于编辑时看到并改选标准项（不再加「当前值」尾缀）
                if (val && !selectedOpt) {
                  optionsHtml += '<option value="' + safeVal + '" selected>' + safeVal + '</option>'
                }
                input = '<select name="p_' + key + '" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">' + optionsHtml + '</select>'
              } else if (p.paramType === 'enum') {
                input = '<input type="text" name="p_' + key + '" value="' + safeVal + '" placeholder="' + escapeAttr(displayName) + '" class="flex-1 px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:border-red-500">'
                input += '<span class="text-xs text-red-500 ml-2 whitespace-nowrap">⚠ 未配置枚举值</span>'
              } else if (p.paramType === 'number') {
                // 纯数字 → number；带单位/尺寸等旧数据 → text，保证完整回显
                if (val && !isPureNumber(val)) {
                  input = '<input type="text" name="p_' + key + '" value="' + safeVal + '" placeholder="请输入数值" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">'
                } else {
                  input = '<input type="number" name="p_' + key + '" value="' + safeVal + '" step="any" placeholder="请输入数值" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">'
                }
              } else if (p.paramType === 'boolean') {
                let boolHtml = '<option value="">请选择</option>'
                boolHtml += '<option value="是"' + (val === '是' || val === 'true' || val === '有' ? ' selected' : '') + '>是</option>'
                boolHtml += '<option value="否"' + (val === '否' || val === 'false' || val === '无' ? ' selected' : '') + '>否</option>'
                if (val && val !== '是' && val !== '否' && val !== 'true' && val !== 'false' && val !== '有' && val !== '无') {
                  boolHtml += '<option value="' + safeVal + '" selected>' + safeVal + '</option>'
                }
                input = '<select name="p_' + key + '" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">' + boolHtml + '</select>'
              } else if (p.paramType === 'date') {
                const parsed = parseDateForInput(val)
                if (parsed.mode === 'date') {
                  input = wrapDatePicker('date', 'p_' + key, parsed.value)
                } else if (parsed.mode === 'text') {
                  // 无法解析为日期时用文本完整回显，避免 type=date 空白
                  input = '<input type="text" name="p_' + key + '" value="' + safeVal + '" placeholder="YYYY-MM-DD" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">'
                } else {
                  input = wrapDatePicker('date', 'p_' + key, '')
                }
              } else {
                input = '<input type="text" name="p_' + key + '" value="' + safeVal + '" placeholder="请输入' + escapeAttr(displayName) + '" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">'
              }
              div.innerHTML = label + input

              // 编辑模式: 空值参数默认隐藏，标记为 empty-param 供切换
              if (hasExisting && !val) {
                div.style.display = 'none'
                div.classList.add('empty-param')
                emptyCount++
              } else {
                filledCount++
              }
              container.appendChild(div)
            })

            // 编辑模式下显示计数 + 切换按钮
            if (hasExisting) {
              // 顶部计数提示
              const summary = document.createElement('div')
              summary.className = 'text-xs text-gray-500 mb-2 pb-1 border-b border-gray-200'
              summary.textContent = '已有参数（' + filledCount + ' 项）'
              container.insertBefore(summary, container.firstChild)

              // 底部展开/收起按钮（仅当有空参数时）
              if (emptyCount > 0) {
                const toggleDiv = document.createElement('div')
                toggleDiv.className = 'mt-2 pt-2 border-t border-gray-100'
                const toggleBtn = document.createElement('button')
                toggleBtn.type = 'button'
                toggleBtn.className = 'text-xs text-primary-600 hover:text-primary-700 hover:underline cursor-pointer'
                toggleBtn.textContent = '+ 展开空参数（' + emptyCount + ' 项）'
                toggleBtn.addEventListener('click', function() {
                  const isCollapsed = this.textContent.startsWith('+')
                  document.querySelectorAll('#params-container .empty-param').forEach(function(el) {
                    el.style.display = isCollapsed ? '' : 'none'
                  })
                  this.textContent = isCollapsed
                    ? '− 收起空参数（' + emptyCount + ' 项）'
                    : '+ 展开空参数（' + emptyCount + ' 项）'
                })
                toggleDiv.appendChild(toggleBtn)
                container.appendChild(toggleDiv)
              }
            }
          }

          // 无任何参数时的提示
          if (container.children.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-400">该分类暂无参数规范，可在「参数规范」中配置</div>'
          }
        } catch (err) {
          container.innerHTML = '<div class="text-sm text-red-500">加载参数失败: ' + err.message + '</div>'
        }
      }

      // 页面加载时, 如果已选分类则自动加载参数(编辑模式)
      const initCategory = document.getElementById('category-select').value
      if (initCategory) loadCategoryParams(initCategory)

      // ====== 暂存图片(前端, 提交时才上传) ======
      const pendingImages = []
      let pendingSeq = 0

      const uploadArea = document.getElementById('upload-area')
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault()
        uploadArea.classList.add('border-primary-500', 'bg-primary-50')
      })
      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('border-primary-500', 'bg-primary-50')
      })
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault()
        uploadArea.classList.remove('border-primary-500', 'bg-primary-50')
        if (e.dataTransfer.files.length > 0) {
          handleFileSelect(e.dataTransfer.files)
        }
      })

      // 图片格式白名单(MIME + 扩展名必须同时匹配, 防止改扩展名绕过)
      const ALLOWED = [
        { ext: '.jpg', mime: 'image/jpeg' },
        { ext: '.jpeg', mime: 'image/jpeg' },
        { ext: '.png', mime: 'image/png' },
        { ext: '.gif', mime: 'image/gif' },
        { ext: '.webp', mime: 'image/webp' },
      ]
      const MAX_SIZE = 5 * 1024 * 1024 // 5MB

      // 文件转 Base64(去掉 data:xxx;base64, 前缀)
      function fileToBase64(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      // 选择文件 -> 先校验, 通过才暂存(本地预览), 不上传
      async function handleFileSelect(files) {
        const imageType = 'main'
        for (const file of files) {
          // 1. 扩展名
          const dotIdx = file.name.lastIndexOf('.')
          const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : ''
          const extMatch = ALLOWED.find(a => a.ext === ext)
          if (!extMatch) {
            alert(file.name + ': 不支持的格式, 只支持 JPG、PNG、GIF、WebP')
            continue
          }
          // 2. MIME 类型
          if (!file.type || !ALLOWED.find(a => a.mime === file.type)) {
            alert(file.name + ': 文件类型不被允许 (' + (file.type || '未知') + ')')
            continue
          }
          // 3. 扩展名与 MIME 必须一致
          if (file.type !== extMatch.mime) {
            alert(file.name + ': 扩展名与文件类型不匹配')
            continue
          }
          // 4. 大小
          if (file.size === 0) {
            alert(file.name + ': 文件为空')
            continue
          }
          if (file.size > MAX_SIZE) {
            alert(file.name + ': 超过 5MB 限制')
            continue
          }
          // 转 Base64 用于纯文本提交(绕过 FC multipart 二进制损坏)
          const base64 = await fileToBase64(file)
          const seq = pendingSeq++
          const previewUrl = URL.createObjectURL(file)
          pendingImages.length = 0
          document.querySelectorAll('#image-list [data-pending-seq]').forEach(el => el.remove())
          pendingImages.push({ seq, fileName: file.name, mimeType: file.type, base64, imageType, previewUrl, sort: 0 })
          addPendingToDOM(seq, previewUrl, imageType)
        }
        document.getElementById('file-input').value = ''
      }

      // 暂存图加到列表(虚线边框 + 待上传标记 + 删除)
      function addPendingToDOM(seq, previewUrl, imageType) {
        const list = document.getElementById('image-list')
        const div = document.createElement('div')
        div.className = 'relative group'
        div.dataset.pendingSeq = seq
        div.innerHTML =
          '<img src="' + previewUrl + '" alt="待上传" class="w-full h-32 object-cover rounded-lg border-2 border-dashed border-primary-400">' +
          '<span class="absolute top-7 left-2 px-2 py-0.5 text-xs bg-primary-500 text-white rounded">待上传</span>' +
          '<span class="absolute top-2 left-2 px-2 py-0.5 text-xs bg-black/50 text-white rounded">主图</span>' +
          '<button type="button" onclick="removePending(' + seq + ', this)" class="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">✕</button>'
        list.appendChild(div)
      }

      function setPendingType(seq, type) {
        const p = pendingImages.find(x => x.seq === seq)
        if (p) p.imageType = type
      }

      function removePending(seq, btn) {
        const idx = pendingImages.findIndex(x => x.seq === seq)
        if (idx >= 0) {
          URL.revokeObjectURL(pendingImages[idx].previewUrl)
          pendingImages.splice(idx, 1)
        }
        btn.parentElement.remove()
      }

      // ====== 表单提交: 一次性把产品资料 + 图片一起发, 后端一个接口处理 ======
      const productForm = document.querySelector('form[method="POST"]')
      productForm.addEventListener('submit', async function(e) {
        e.preventDefault()
        const submitBtn = productForm.querySelector('button[type="submit"]')
        const origText = submitBtn.textContent
        submitBtn.disabled = true
        submitBtn.textContent = pendingImages.length > 0 ? '正在上传...' : '保存中...'

        try {
          // 用 FormData 把产品字段 + 暂存图片文件一起发
          const fd = new FormData(productForm)
          // 用 Base64 纯文本提交(绕过 FC multipart 二进制损坏)
          pendingImages.forEach((p, i) => {
            fd.append('image_data[]', p.base64)
            fd.append('image_names[]', p.fileName)
            fd.append('image_mimes[]', p.mimeType)
            fd.append('image_types[]', p.imageType)
            fd.append('image_sorts[]', String(p.sort))
          })

          const res = await fetch(productForm.action, { method: 'POST', body: fd })
          // 后端成功会返回重定向URL, 失败返回JSON
          const ct = res.headers.get('content-type') || ''
          if (ct.includes('application/json')) {
            const data = await res.json()
            alert(data.message || '保存失败')
            submitBtn.disabled = false
            submitBtn.textContent = origText
            return
          }
          // 成功: 跟随后端重定向
          if (res.redirected) {
            window.location.href = res.url
          } else {
            // 从隐藏字段读取 return_to
            const returnInput = productForm.querySelector('input[name="return_to"]')
            window.location.href = returnInput ? returnInput.value : '/admin/products'
          }
        } catch (err) {
          alert('保存失败: ' + err.message)
          submitBtn.disabled = false
          submitBtn.textContent = origText
        }
      })

      // 已有主图(编辑时): 删除（调用后端清除 products.main_image）
      async function deleteMainImage(productId, btn) {
        if (!confirm('确定删除主图？')) return
        const container = btn.parentElement
        try {
          const res = await fetch('/api/admin/products/' + productId + '/main-image', { method: 'DELETE' })
          const data = await res.json()
          if (data.code === 0) {
            container.remove()
          } else {
            alert(data.message || '删除失败')
          }
        } catch (err) {
          alert('删除失败: ' + err.message)
        }
      }
    </script>
  `

  return layout(title, content, 'products', role)
}
