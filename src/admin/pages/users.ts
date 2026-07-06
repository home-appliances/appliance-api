/**
 * 用户管理页面 - 服务端渲染
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

export const usersPage = (users: AdminUser[]) => {
  const rows = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td><strong>${u.username}</strong></td>
      <td>${u.name || '-'}</td>
      <td>${u.email || '-'}</td>
      <td><span class="tag ${u.role === 'super_admin' ? 'tag-primary' : 'tag-gray'}">${u.role === 'super_admin' ? '超级管理员' : '管理员'}</span></td>
      <td><span class="tag ${u.status === 'active' ? 'tag-success' : 'tag-danger'}">${u.status === 'active' ? '正常' : '禁用'}</span></td>
      <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}</td>
      <td>
        <form method="POST" action="/admin/users/${u.id}/toggle-status" style="display:inline;">
          <button type="submit" class="btn btn-sm ${u.status === 'active' ? 'btn-warning' : 'btn-success'}">
            ${u.status === 'active' ? '禁用' : '启用'}
          </button>
        </form>
        <form method="POST" action="/admin/users/${u.id}/delete" style="display:inline;" onsubmit="return confirm('确定删除该用户？')">
          <button type="submit" class="btn btn-sm btn-danger">删除</button>
        </form>
      </td>
    </tr>
  `).join('')

  const content = `
    <div class="page-header">
      <h1 class="page-title">用户管理</h1>
      <a href="/admin/users/create" class="btn btn-primary">+ 新增用户</a>
    </div>

    <div class="card">
      <div class="card-body" style="padding: 0;">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>姓名</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `

  return layout('用户管理', content, 'users')
}

export const userFormPage = (user?: AdminUser, error?: string) => {
  const isEdit = !!user
  const title = isEdit ? '编辑用户' : '新增用户'

  const content = `
    <div class="page-header">
      <h1 class="page-title">${title}</h1>
      <a href="/admin/users" class="btn btn-outline">← 返回</a>
    </div>

    ${error ? `<div class="card" style="margin-bottom:16px;padding:12px 16px;border-left:4px solid var(--danger);color:var(--danger);">${error}</div>` : ''}

    <div class="card">
      <div class="card-body">
        <form method="POST" action="${isEdit ? `/admin/users/${user!.id}/edit` : '/admin/users/create'}">
          <div class="form-group">
            <label class="form-label">用户名 <span style="color:var(--danger)">*</span></label>
            <input type="text" name="username" class="form-input" value="${user?.username || ''}" ${isEdit ? 'readonly' : ''} required>
          </div>
          ${!isEdit ? `
          <div class="form-group">
            <label class="form-label">密码 <span style="color:var(--danger)">*</span></label>
            <input type="password" name="password" class="form-input" required>
          </div>` : ''}
          <div class="form-group">
            <label class="form-label">姓名</label>
            <input type="text" name="name" class="form-input" value="${user?.name || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input type="email" name="email" class="form-input" value="${user?.email || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input type="text" name="phone" class="form-input" value="${user?.phone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">角色</label>
            <select name="role" class="form-input">
              <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>管理员</option>
              <option value="super_admin" ${user?.role === 'super_admin' ? 'selected' : ''}>超级管理员</option>
            </select>
          </div>
          <div style="display:flex;gap:12px;">
            <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
            <a href="/admin/users" class="btn btn-outline">取消</a>
          </div>
        </form>
      </div>
    </div>
  `

  return layout(title, content, 'users')
}
