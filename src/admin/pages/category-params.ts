/**
 * 参数规范管理页面
 */

import { layout } from '../layout.js'

function escapeAttr(value: string): string {
  if (!value) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

interface CategoryParam {
  id: number
  category_id: number
  category_name?: string
  param_key: string
  display_name: string
  icon: string | null
  param_type: string
  is_core: boolean
  is_filter: boolean
  is_sortable: boolean
  enum_values: string[] | null
  sort_order: number
}

export const categoryParamsPage = (params: CategoryParam[], categories: any[], role = 'admin', filterCategoryId?: number) => {
  const formatOptions = (p: CategoryParam): string => {
    if (p.param_type === 'enum') {
      return p.enum_values && p.enum_values.length ? p.enum_values.join(', ') : '（未配置）'
    }
    if (p.param_type === 'boolean') return '是, 否'
    if (p.param_type === 'date') return '日期（精确到天）'
    if (p.param_type === 'number') return '数值'
    if (p.param_type === 'text') return '自由文本'
    return '-'
  }

  const rows = params.map(p => {
    const badges = [
      p.is_core ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">核心</span>' : '',
      p.is_filter ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 whitespace-nowrap">筛选</span>' : '',
      p.is_sortable ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap">排序</span>' : '',
    ].filter(Boolean).join('')
    const optionsText = formatOptions(p)
    return `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">${p.id}</td>
      <td class="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">${p.category_name || '-'}</td>
      <td class="px-3 py-3 text-sm font-mono text-gray-900 max-w-[160px] truncate" title="${escapeAttr(p.param_key)}">${p.param_key}</td>
      <td class="px-3 py-3 text-sm text-gray-700 max-w-[160px] truncate" title="${escapeAttr(p.display_name)}">${p.display_name}</td>
      <td class="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">${p.icon || '-'}</td>
      <td class="px-3 py-3 whitespace-nowrap">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          ${p.param_type}
        </span>
      </td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-1 flex-nowrap">${badges || '<span class="text-xs text-gray-400">-</span>'}</div>
      </td>
      <td class="px-3 py-3 text-sm text-gray-700 max-w-[220px] truncate" title="${escapeAttr(optionsText)}">${optionsText}</td>
      <td class="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">${p.sort_order}</td>
      <td class="px-3 py-3 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-2">
          <a href="/admin/category-params/${p.id}/edit" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑</a>
          <form method="POST" action="/admin/category-params/${p.id}/delete" class="inline" onsubmit="return confirm('确定删除该参数规范？')">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
          </form>
        </div>
      </td>
    </tr>
  `}).join('')

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">参数规范管理</h1>
      <div class="flex items-center gap-3">
        <select id="categoryFilter" onchange="filterByCategory()" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500">
          <option value="">全部分类</option>
          ${categories.map(c => `<option value="${c.id}" ${filterCategoryId === c.id ? 'selected' : ''}>${c.icon || ''} ${c.display_name || c.name}</option>`).join('')}
        </select>
        <a href="/admin/category-params/create" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">+ 新增参数</a>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">ID</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">分类</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">参数名</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">显示名</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">图标</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">类型</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">标记</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">可选值</th>
              <th class="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">排序</th>
              <th class="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>

    <script>
      function filterByCategory() {
        const categoryId = document.getElementById('categoryFilter').value
        if (categoryId) {
          window.location.href = '/admin/category-params?category_id=' + categoryId
        } else {
          window.location.href = '/admin/category-params'
        }
      }
    </script>
  `

  return layout('参数规范', content, 'category-params', role)
}

export const categoryParamFormPage = (param?: any, categories: any[] = [], error?: string, role = 'admin') => {
  const isEdit = !!param
  const title = isEdit ? '编辑参数规范' : '新增参数规范'

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      <a href="/admin/category-params" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">← 返回</a>
    </div>

    ${error ? `<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg text-sm text-red-700">${error}</div>` : ''}

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <form method="POST" action="${isEdit ? `/admin/category-params/${param.id}/edit` : '/admin/category-params/create'}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">所属分类 <span class="text-red-500">*</span></label>
            <select name="category_id" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="">请选择分类</option>
              ${categories.map(c => `<option value="${c.id}" ${param?.category_id === c.id ? 'selected' : ''}>${c.icon || ''} ${c.display_name || c.name}</option>`).join('')}
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">参数名 <span class="text-red-500">*</span></label>
            <input type="text" name="param_key" value="${escapeAttr(param?.param_key || '')}" required placeholder="如：匹数"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">显示名 <span class="text-red-500">*</span></label>
            <input type="text" name="display_name" value="${escapeAttr(param?.display_name || '')}" required placeholder="如：匹数"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">图标</label>
            <input type="text" name="icon" value="${escapeAttr(param?.icon || '')}" placeholder="如：⚡"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">参数类型 <span class="text-red-500">*</span></label>
            <select name="param_type" required id="param-type-select"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
              <option value="text" ${param?.param_type === 'text' ? 'selected' : ''}>文本（text）</option>
              <option value="number" ${param?.param_type === 'number' ? 'selected' : ''}>数字（number）</option>
              <option value="enum" ${param?.param_type === 'enum' ? 'selected' : ''}>枚举（enum）</option>
              <option value="boolean" ${param?.param_type === 'boolean' ? 'selected' : ''}>布尔（boolean）</option>
              <option value="date" ${param?.param_type === 'date' ? 'selected' : ''}>日期（date）</option>
            </select>
            <p class="mt-1 text-xs text-gray-500">
              text=普通文本｜number=数值｜enum=下拉选择｜boolean=是/否｜date=日期选择器
            </p>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">可选值说明</label>
            <input type="text" name="enum_values" id="enum-values-input" value="${escapeAttr(param?.enum_values ? JSON.stringify(param.enum_values) : '')}" placeholder='枚举时填写：["一级","二级","三级"]'
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
            <p id="options-hint" class="mt-1 text-xs text-gray-500">
              text=自由文本｜number=数值｜enum=JSON 数组必填｜boolean=固定「是 / 否」｜date=日期（精确到天）
            </p>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">排序</label>
            <input type="number" name="sort_order" value="${param?.sort_order || 0}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
          </div>
          <div class="mb-4">
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2">
                <input type="checkbox" name="is_core" value="true" ${param?.is_core ? 'checked' : ''}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                <span class="text-sm font-medium text-gray-700">核心参数</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" name="is_filter" value="true" ${param?.is_filter ? 'checked' : ''}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                <span class="text-sm font-medium text-gray-700">可筛选</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" name="is_sortable" value="true" ${param?.is_sortable ? 'checked' : ''}
                  class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                <span class="text-sm font-medium text-gray-700">可排序</span>
              </label>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <a href="/admin/category-params" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">取消</a>
          <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer border-0">${isEdit ? '保存' : '创建'}</button>
        </div>
      </form>
    </div>

    <script>
      var paramTypeSelect = document.getElementById('param-type-select')
      var enumInput = document.getElementById('enum-values-input')
      var optionsHint = document.getElementById('options-hint')
      function updateEnumHint() {
        var t = paramTypeSelect.value
        if (t === 'enum') {
          enumInput.disabled = false
          enumInput.style.borderColor = '#ef4444'
          enumInput.placeholder = '["一级","二级","三级"]'
          if (optionsHint) {
            optionsHint.innerHTML = '参数类型为枚举时<strong class="text-red-600">必填</strong>，JSON数组格式，如 ["一级","二级"]'
            optionsHint.className = 'mt-1 text-xs text-red-500'
          }
        } else if (t === 'boolean') {
          enumInput.disabled = true
          enumInput.style.borderColor = ''
          enumInput.placeholder = '无需填写（固定：是 / 否）'
          if (optionsHint) {
            optionsHint.innerHTML = '布尔类型固定可选值：<strong>是</strong>、<strong>否</strong>（编辑产品时以下拉展示）'
            optionsHint.className = 'mt-1 text-xs text-gray-500'
          }
        } else if (t === 'date') {
          enumInput.disabled = true
          enumInput.style.borderColor = ''
          enumInput.placeholder = '无需填写'
          if (optionsHint) {
            optionsHint.innerHTML = '日期类型使用日期选择器，精确到天（YYYY-MM-DD）'
            optionsHint.className = 'mt-1 text-xs text-gray-500'
          }
        } else if (t === 'number') {
          enumInput.disabled = true
          enumInput.style.borderColor = ''
          enumInput.placeholder = '无需填写'
          if (optionsHint) {
            optionsHint.innerHTML = '数字类型请录入纯数字；带单位的旧数据会以文本方式回显'
            optionsHint.className = 'mt-1 text-xs text-gray-500'
          }
        } else {
          enumInput.disabled = true
          enumInput.style.borderColor = ''
          enumInput.placeholder = '无需填写'
          if (optionsHint) {
            optionsHint.innerHTML = '文本类型为自由输入'
            optionsHint.className = 'mt-1 text-xs text-gray-500'
          }
        }
      }
      paramTypeSelect.addEventListener('change', updateEnumHint)
      updateEnumHint()

      var form = document.querySelector('form[method="POST"]')
      form.addEventListener('submit', function(e) {
        if (paramTypeSelect.value === 'enum') {
          var val = enumInput.value.trim()
          if (!val) {
            e.preventDefault()
            alert('参数类型为「枚举」时，枚举值不能为空！\\n请填写JSON数组，如：["一级","二级","三级"]')
            enumInput.focus()
            return
          }
          try {
            var parsed = JSON.parse(val)
            if (!Array.isArray(parsed) || parsed.length === 0) {
              throw new Error('not array')
            }
          } catch(err) {
            e.preventDefault()
            alert('枚举值格式错误！\\n请填写合法的JSON数组，如：["一级","二级","三级"]')
            enumInput.focus()
            return
          }
        } else {
          // 非 enum 提交空枚举值，避免脏数据
          enumInput.disabled = false
          enumInput.value = ''
        }
      })
    </script>
  `

  return layout(title, content, 'category-params', role)
}
