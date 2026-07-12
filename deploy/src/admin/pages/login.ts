/**
 * 登录页 - Tailwind CSS
 */

export const loginPage = (error?: string) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录 - Appliance Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50: '#e8eaf6', 100: '#c5cae9', 200: '#9fa8da', 300: '#7986cb', 400: '#5c6bc0', 500: '#3f51b5', 600: '#3949ab', 700: '#303f9f', 800: '#283593', 900: '#1a237e' },
          }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-50 min-h-screen flex m-0">
  <div class="flex w-full min-h-screen">
    <!-- 左侧品牌区 -->
    <div class="hidden md:flex w-[45%] bg-gradient-to-br from-primary-900 via-primary-700 to-primary-800 flex-col justify-center items-center p-16 relative overflow-hidden">
      <div class="absolute -top-[30%] -right-[20%] w-[500px] h-[500px] rounded-full bg-white/[0.03]"></div>
      <div class="text-center relative z-10 max-w-md">
        <div class="w-[72px] h-[72px] rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mx-auto mb-6 text-4xl text-white border border-white/20">⚙</div>
        <div class="text-3xl font-bold text-white mb-3">Appliance Admin</div>
        <div class="text-sm text-white/70 leading-relaxed">高效、安全、智能的后台管理系统</div>
      </div>
      <div class="absolute bottom-8 left-0 right-0 text-center text-white/40 text-xs">© 2026 Appliance Admin</div>
    </div>

    <!-- 右侧表单区 -->
    <div class="flex-1 flex items-center justify-center p-10">
      <div class="w-full max-w-[420px]">
        <div class="text-[26px] font-bold text-gray-900 mb-1.5">欢迎回来</div>
        <div class="text-sm text-gray-500 mb-9">请输入您的账号信息以继续</div>
        ${error ? `<div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm text-red-600">⚠ ${error}</div>` : ''}
        <form method="POST" action="/admin/login">
          <div class="mb-5">
            <label class="block text-[13px] font-semibold text-gray-700 mb-1.5">账号</label>
            <input type="text" name="username" class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:border-primary-500 focus:ring-3 focus:ring-primary-500/10 transition-all" placeholder="请输入用户名" required>
          </div>
          <div class="mb-5">
            <label class="block text-[13px] font-semibold text-gray-700 mb-1.5">密码</label>
            <input type="password" name="password" class="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:border-primary-500 focus:ring-3 focus:ring-primary-500/10 transition-all" placeholder="请输入密码" required>
          </div>
          <button type="submit" class="w-full py-3 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors cursor-pointer border-0">登 录</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>`
