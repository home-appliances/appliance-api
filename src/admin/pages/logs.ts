/**
 * 操作日志页面 - 服务端渲染
 */

import { layout } from '../layout.js'

interface LogEntry {
  id: number
  operator: string
  type: string
  target: string | null
  result: string
  detail: string | null
  ip: string | null
  created_at: string
}

export const logsPage = (logs: LogEntry[], page: number, total: number, pageSize: number) => {
  const totalPages = Math.ceil(total / pageSize)

  const typeLabels: Record<string, string> = {
    login: '登录',
    create: '创建',
    update: '更新',
    delete: '删除',
    export: '导出',
  }

  const rows = logs.map(l => `
    <tr>
      <td>${l.id}</td>
      <td>${l.operator}</td>
      <td><span class="tag tag-info">${typeLabels[l.type] || l.type}</span></td>
      <td>${l.target || '-'}</td>
      <td><span class="tag ${l.result === 'success' ? 'tag-success' : 'tag-danger'}">${l.result === 'success' ? '成功' : '失败'}</span></td>
      <td>${l.ip || '-'}</td>
      <td>${l.created_at ? new Date(l.created_at).toLocaleString('zh-CN') : '-'}</td>
    </tr>
  `).join('')

  const pagination = totalPages > 1 ? `
    <div style="display:flex;justify-content:center;gap:8px;padding:16px;">
      ${page > 1 ? `<a href="/admin/logs?page=${page - 1}" class="btn btn-outline btn-sm">上一页</a>` : ''}
      <span style="line-height:32px;font-size:14px;color:var(--gray-500);">第 ${page} / ${totalPages} 页</span>
      ${page < totalPages ? `<a href="/admin/logs?page=${page + 1}" class="btn btn-outline btn-sm">下一页</a>` : ''}
    </div>
  ` : ''

  const content = `
    <div class="page-header">
      <h1 class="page-title">操作日志</h1>
      <span style="font-size:14px;color:var(--gray-500);">共 ${total} 条记录</span>
    </div>

    <div class="card">
      <div class="card-body" style="padding: 0;">
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>操作人</th>
                <th>类型</th>
                <th>目标</th>
                <th>结果</th>
                <th>IP</th>
                <th>时间</th>
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

  return layout('操作日志', content, 'logs')
}
