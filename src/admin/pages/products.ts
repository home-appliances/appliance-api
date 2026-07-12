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
  image_url?: string | null
}

export const productsPage = (products: Product[], page: number, total: number, pageSize: number, role = 'admin', filters: { keyword?: string; brand?: string; category?: string } = {}, brands: string[] = []) => {
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

  const rows = products.map(p => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-3 py-3 text-sm text-gray-700">${p.id}</td>
      <td class="px-3 py-3">
        ${p.image_url
          ? `<img src="${p.image_url}" alt="${p.title}" class="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onclick="showImage('${p.image_url}', '${p.title.replace(/'/g, "\\'")}')" title="点击查看大图">`
          : '<div class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">无</div>'}
      </td>
      <td class="px-3 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate" title="${p.title}">${p.title}</td>
      <td class="px-3 py-3 text-sm text-gray-700">${p.brand || '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-700">${p.model || '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-700">${p.category || '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-700 text-right">${p.price ? '¥' + Number(p.price).toFixed(0) : '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-400 text-right line-through">${p.original_price ? '¥' + Number(p.original_price).toFixed(0) : ''}</td>
      <td class="px-3 py-3 text-sm text-gray-700 text-center">${p.rating ? '⭐' + p.rating : '-'}</td>
      <td class="px-3 py-3 text-sm text-gray-500 text-center">${p.review_count || 0}</td>
      <td class="px-3 py-3 text-sm text-gray-500">${p.created_at ? new Date(p.created_at).toLocaleDateString('zh-CN') : '-'}</td>
      <td class="px-3 py-3 text-right">
        <div class="flex items-center justify-end gap-2">
          <a href="/admin/products/${p.id}/edit" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑</a>
          <form method="POST" action="/admin/products/${p.id}/delete" class="inline" onsubmit="return confirm('确定删除该产品？')">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
          </form>
        </div>
      </td>
    </tr>
  `).join('')

  // 构建查询字符串（保留搜索和筛选参数）
  const buildUrl = (pageNum: number) => {
    const params = new URLSearchParams()
    params.set('page', pageNum.toString())
    if (filters.keyword) params.set('keyword', filters.keyword)
    if (filters.brand) params.set('brand', filters.brand)
    if (filters.category) params.set('category', filters.category)
    return `/admin/products?${params.toString()}`
  }

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
        ${filters.keyword || filters.brand || filters.category ? `<a href="/admin/products" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">清除</a>` : ''}
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
              <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">价格</th>
              <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">原价</th>
              <th class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">评分</th>
              <th class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">评价</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">创建时间</th>
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

export const productFormPage = (product?: any, error?: string, role = 'admin', categories: any[] = []) => {
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
            <select name="category_id"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="">请选择分类</option>
              ${categories.map(c => `<option value="${c.id}" ${product?.categoryId === c.id || product?.category_id === c.id ? 'selected' : ''}>${c.icon || ''} ${c.displayName || c.name}</option>`).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">价格</label>
            <input type="number" name="price" step="0.01" value="${product?.price || ''}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">原价</label>
            <input type="number" name="original_price" step="0.01" value="${product?.originalPrice || product?.original_price || ''}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
        </div>

        <!-- 图片上传区域 -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-3">产品图片</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4" id="image-list">
            ${product?.images ? product.images.map((img: any, idx: number) => `
              <div class="relative group" data-image-id="${img.id || ''}">
                <img src="${img.imageUrl || img.url}" alt="产品图片" class="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer" onclick="previewImage(this.src)">
                <select onchange="changeImageType(${img.id}, this)" class="absolute top-2 left-2 px-1 py-0.5 text-xs bg-black/50 text-white rounded border-none cursor-pointer" title="点击修改图片类型">
                  <option value="main" ${img.imageType === 'main' ? 'selected' : ''}>主图</option>
                  <option value="display" ${img.imageType === 'display' ? 'selected' : ''}>展示图</option>
                  <option value="detail" ${img.imageType === 'detail' ? 'selected' : ''}>细节图</option>
                  <option value="scene" ${img.imageType === 'scene' ? 'selected' : ''}>场景图</option>
                </select>
                <button type="button" onclick="deleteImage(${img.id}, this)" class="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">✕</button>
              </div>
            `).join('') : ''}
          </div>

          <!-- 上传区域 -->
          <div class="flex items-center gap-3 mb-3">
            <label class="text-sm text-gray-600 whitespace-nowrap">上传类型:</label>
            <select id="upload-image-type" class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">
              <option value="main">主图</option>
              <option value="display">展示图</option>
              <option value="detail">细节图</option>
              <option value="scene">场景图</option>
            </select>
            <span class="text-xs text-gray-400">拖拽/选择后先暂存，提交产品时一并上传</span>
          </div>
          <div id="upload-area" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer" onclick="document.getElementById('file-input').click()">
            <input type="file" id="file-input" multiple accept="image/*" class="hidden" onchange="handleFileSelect(this.files)">
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

      // 选择文件 -> 先校验, 通过才暂存(本地预览), 不上传
      function handleFileSelect(files) {
        const imageType = document.getElementById('upload-image-type').value
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
          const seq = pendingSeq++
          const previewUrl = URL.createObjectURL(file)
          pendingImages.push({ seq, file, imageType, previewUrl, sort: pendingImages.length })
          addPendingToDOM(seq, previewUrl, imageType)
        }
        document.getElementById('file-input').value = ''
      }

      // 暂存图加到列表(虚线边框 + 待上传标记 + 类型可改 + 删除)
      function addPendingToDOM(seq, previewUrl, imageType) {
        const list = document.getElementById('image-list')
        const div = document.createElement('div')
        div.className = 'relative group'
        div.dataset.pendingSeq = seq
        div.innerHTML =
          '<img src="' + previewUrl + '" alt="待上传" class="w-full h-32 object-cover rounded-lg border-2 border-dashed border-primary-400">' +
          '<span class="absolute top-7 left-2 px-2 py-0.5 text-xs bg-primary-500 text-white rounded">待上传</span>' +
          '<select onchange="setPendingType(' + seq + ', this.value)" class="absolute top-2 left-2 px-1 py-0.5 text-xs bg-black/50 text-white rounded border-none cursor-pointer" title="修改类型">' +
          '<option value="main" ' + (imageType === 'main' ? 'selected' : '') + '>主图</option>' +
          '<option value="display" ' + (imageType === 'display' ? 'selected' : '') + '>展示图</option>' +
          '<option value="detail" ' + (imageType === 'detail' ? 'selected' : '') + '>细节图</option>' +
          '<option value="scene" ' + (imageType === 'scene' ? 'selected' : '') + '>场景图</option>' +
          '</select>' +
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
          // 追加暂存图片文件及其类型
          pendingImages.forEach((p, i) => {
            fd.append('images', p.file, p.file.name)
            fd.append('image_types', p.imageType)
            fd.append('image_sorts', p.sort)
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
            window.location.href = '/admin/products'
          }
        } catch (err) {
          alert('保存失败: ' + err.message)
          submitBtn.disabled = false
          submitBtn.textContent = origText
        }
      })

      // 已有图片(编辑时): 改类型
      async function changeImageType(id, select) {
        const newType = select.value
        try {
          const res = await fetch('/api/admin/product-images/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_type: newType })
          })
          const data = await res.json()
          if (data.code !== 0) {
            alert(data.message || '修改类型失败')
          }
        } catch (err) {
          alert('修改类型失败: ' + err.message)
        }
      }

      // 已有图片(编辑时): 删除
      async function deleteImage(id, btn) {
        if (!confirm('确定删除这张图片？')) return

        try {
          const res = await fetch('/api/admin/upload/image/' + id, { method: 'DELETE' })
          const data = await res.json()

          if (data.code === 0) {
            btn.parentElement.remove()
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
