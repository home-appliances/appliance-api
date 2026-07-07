/**
 * 用户管理页面 - Tailwind CSS
 */

import { layout } from '../layout.js'

interface AdminUser {
  id: number
  username: string
  name: string | null
  email: string | null
  phone: string | null
  role: string
  status: string
  created_at: string
  last_login: string | null
}

export const usersPage = (users: AdminUser[], role = 'admin') => {
  const rows = users.map(u => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 text-sm text-gray-700">${u.id}</td>
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${u.username}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${u.name || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${u.email || '-'}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.role === 'super_admin' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-600'}">
          ${u.role === 'super_admin' ? '超级管理员' : '管理员'}
        </span>
      </td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
          ${u.status === 'active' ? '正常' : '禁用'}
        </span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-700">${u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}</td>
      <td class="px-4 py-3 text-right">
        <div class="flex items-center justify-end gap-2">
          <a href="/admin/users/${u.id}/edit" class="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded hover:border-primary-500 hover:text-primary-600 transition-colors">编辑</a>
          <form method="POST" action="/admin/users/${u.id}/toggle-status" class="inline">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium rounded text-white transition-colors cursor-pointer border-0 ${u.status === 'active' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-500 hover:bg-green-600'}">
              ${u.status === 'active' ? '禁用' : '启用'}
            </button>
          </form>
          <form method="POST" action="/admin/users/${u.id}/delete" class="inline" onsubmit="return confirm('确定删除该用户？')">
            <button type="submit" class="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer border-0">删除</button>
          </form>
        </div>
      </td>
    </tr>
  `).join('')

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">用户管理</h1>
      <a href="/admin/users/create" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">+ 新增用户</a>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">用户名</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">姓名</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">邮箱</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">角色</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
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
  `

  return layout('用户管理', content, 'users', role)
}

export const userFormPage = (user?: AdminUser, error?: string, role = 'admin') => {
  const isEdit = !!user
  const title = isEdit ? '编辑用户' : '新增用户'

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      <a href="/admin/users" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">← 返回</a>
    </div>

    ${error ? `<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg text-sm text-red-700">${error}</div>` : ''}

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <form method="POST" action="${isEdit ? `/admin/users/${user!.id}/edit` : '/admin/users/create'}">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">用户名 <span class="text-red-500">*</span></label>
          <input type="text" name="username" value="${user?.username || ''}" ${isEdit ? 'readonly' : ''} required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all ${isEdit ? 'bg-gray-50 text-gray-500' : ''}">
        </div>
        ${!isEdit ? `
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">密码 <span class="text-red-500">*</span></label>
          <input type="password" name="password" required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
        </div>` : ''}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">姓名</label>
          <input type="text" name="name" value="${user?.name || ''}"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
          <input type="email" name="email" value="${user?.email || ''}"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">手机号</label>
          <input type="text" name="phone" value="${user?.phone || ''}"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all">
        </div>
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1.5">角色</label>
          <select name="role" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all bg-white">
            <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>管理员</option>
            <option value="super_admin" ${user?.role === 'super_admin' ? 'selected' : ''}>超级管理员</option>
          </select>
        </div>
        <div class="flex gap-3">
          <button type="submit" class="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer border-0">${isEdit ? '保存' : '创建'}</button>
          <a href="/admin/users" class="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:border-primary-500 hover:text-primary-600 transition-colors">取消</a>
        </div>
      </form>
    </div>
  `

  return layout(title, content, 'users', role)
}
