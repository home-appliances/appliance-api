/**
 * 登录页 - 服务端渲染
 */

export const loginPage = (error?: string) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录 - Appliance Admin</title>
  <link rel="stylesheet" href="/admin/css/variables.css">
  <link rel="stylesheet" href="/admin/css/base.css">
  <style>
    body { margin: 0; min-height: 100vh; display: flex; background: var(--gray-50); }
    .login-wrapper { display: flex; width: 100%; min-height: 100vh; }
    .login-brand {
      flex: 0 0 45%; background: linear-gradient(160deg, var(--primary-900) 0%, var(--primary-700) 50%, var(--primary-800) 100%);
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      padding: 60px; position: relative; overflow: hidden;
    }
    .login-brand::before {
      content: ''; position: absolute; top: -30%; right: -20%;
      width: 500px; height: 500px; border-radius: 50%;
      background: rgba(255,255,255,0.03);
    }
    .brand-content { text-align: center; position: relative; z-index: 1; max-width: 400px; }
    .brand-logo {
      width: 72px; height: 72px; border-radius: 16px;
      background: rgba(255,255,255,0.15); backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px; font-size: 32px; color: #fff;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .brand-name { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 12px; }
    .brand-slogan { font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6; }
    .brand-footer {
      position: absolute; bottom: 32px; left: 0; right: 0; text-align: center;
      color: rgba(255,255,255,0.4); font-size: 12px;
    }
    .login-form-area {
      flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px;
    }
    .login-card { width: 100%; max-width: 420px; }
    .login-title { font-size: 26px; font-weight: 700; color: var(--gray-900); margin-bottom: 6px; }
    .login-subtitle { font-size: 14px; color: var(--gray-500); margin-bottom: 36px; }
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; font-size: 13px; font-weight: 600; color: var(--gray-700); margin-bottom: 6px; }
    .form-input {
      width: 100%; padding: 10px 14px;
      border: 1.5px solid var(--gray-200); border-radius: 8px;
      font-size: 14px; color: var(--gray-900); background: #fff;
      transition: all 0.2s; box-sizing: border-box;
    }
    .form-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(26,35,126,0.08); }
    .btn-login {
      width: 100%; padding: 12px; border: none; border-radius: 8px;
      background: var(--primary); color: #fff; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .btn-login:hover { background: var(--primary-700); }
    .error-msg {
      background: rgba(244,67,54,0.08); border: 1px solid rgba(244,67,54,0.2);
      border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;
      font-size: 13px; color: var(--danger);
    }
    @media (max-width: 768px) {
      .login-brand { display: none; }
      .login-form-area { padding: 24px; }
    }
  </style>
</head>
<body>
  <div class="login-wrapper">
    <div class="login-brand">
      <div class="brand-content">
        <div class="brand-logo">⚙</div>
        <div class="brand-name">Appliance Admin</div>
        <div class="brand-slogan">高效、安全、智能的后台管理系统</div>
      </div>
      <div class="brand-footer">© 2026 Appliance Admin</div>
    </div>
    <div class="login-form-area">
      <div class="login-card">
        <div class="login-title">欢迎回来</div>
        <div class="login-subtitle">请输入您的账号信息以继续</div>
        ${error ? `<div class="error-msg">⚠ ${error}</div>` : ''}
        <form method="POST" action="/admin/login">
          <div class="form-group">
            <label class="form-label">账号</label>
            <input type="text" name="username" class="form-input" placeholder="请输入用户名" required>
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="password" name="password" class="form-input" placeholder="请输入密码" required>
          </div>
          <button type="submit" class="btn-login">登 录</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>`
