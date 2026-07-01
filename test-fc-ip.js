/**
 * 测试 FC 出口 IP
 * 上传到 FC 后访问即可获取出口 IP
 */

exports.handler = async (req, resp, context) => {
  try {
    // 获取出口 IP
    const response = await fetch('https://ipinfo.io/ip');
    const ip = await response.text();

    resp.setStatusCode(200);
    resp.setHeader('content-type', 'application/json');
    resp.send(JSON.stringify({
      success: true,
      exit_ip: ip.trim(),
      message: '这是 FC 的出口 IP，请添加到 RDS 安全组白名单'
    }));
  } catch (err) {
    resp.setStatusCode(500);
    resp.setHeader('content-type', 'application/json');
    resp.send(JSON.stringify({
      success: false,
      error: err.message
    }));
  }
};
