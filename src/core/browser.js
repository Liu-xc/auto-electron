const { chromium } = require('playwright');

// ==================== 浏览器连接管理 ====================
async function connectToBrowser(cdpPort) {
  console.log(`正在连接到 CDP 端口 ${cdpPort}...`);
  
  const browser = await chromium.connectOverCDP(`http://localhost:${cdpPort}`);
  
  // 获取所有上下文（页面）
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error('没有找到可用的浏览器上下文');
  }

  // 使用第一个上下文
  const context = contexts[0];
  const pages = context.pages();
  
  if (pages.length === 0) {
    throw new Error('没有找到可用的页面');
  }

  // 使用第一个页面
  const page = pages[0];
  console.log(`当前页面: ${page.url()}`);
  
  return { browser, page };
}

module.exports = {
  connectToBrowser
};

