const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function automateChat() {
  // 读取元素配置
  const configPath = path.join(__dirname, 'elements.config.json');
  const elementsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // 查找需要的元素
  const messageInput = elementsConfig.find(e => e.name === 'MessageInput');
  const sendButton = elementsConfig.find(e => e.name === 'SendButton');

  if (!messageInput || !sendButton) {
    throw new Error('找不到必要的元素配置');
  }

  console.log('正在连接到 CDP 端口 9222...');

  // 连接到 CDP 端点
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  
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

  try {
    // 等待输入框出现并点击
    console.log(`等待输入框: ${messageInput.selector}`);
    await page.waitForSelector(messageInput.selector, { timeout: 10000 });
    await page.click(messageInput.selector);
    console.log('已点击输入框');

    // 等待一下确保输入框获得焦点
    await page.waitForTimeout(300);

    // 输入文本
    console.log('正在输入文本: helloworld');
    await page.fill(messageInput.selector, 'helloworld');
    console.log('文本输入完成');

    // 等待一下确保文本已输入
    await page.waitForTimeout(300);

    // 等待发送按钮出现并点击
    console.log(`等待发送按钮: ${sendButton.selector}`);
    await page.waitForSelector(sendButton.selector, { timeout: 10000 });
    
    // 检查按钮是否可用（不应该处于 disabled 状态）
    const buttonInfo = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { found: false };
      
      // 如果选择器指向的是 span，找到父级 button
      const button = element.closest('button') || element;
      const isDisabled = button.classList.contains('disabled');
      
      return {
        found: true,
        isDisabled,
        tagName: button.tagName,
        className: button.className
      };
    }, sendButton.selector);

    if (!buttonInfo.found) {
      throw new Error('找不到发送按钮');
    }

    if (buttonInfo.isDisabled) {
      console.warn('警告: 发送按钮处于禁用状态，尝试点击...');
    }

    // 如果选择器指向 span，点击其父级 button
    const clickSelector = sendButton.selector.endsWith(' > span') 
      ? sendButton.selector.replace(' > span', '')
      : sendButton.selector;

    await page.click(clickSelector);
    console.log('已点击发送按钮');

    // 等待操作完成
    await page.waitForTimeout(1000);

    console.log('操作完成！');

  } catch (error) {
    console.error('操作失败:', error.message);
    throw error;
  } finally {
    // 不关闭浏览器，只断开连接
    await browser.close();
  }
}

// 运行脚本
automateChat().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});

