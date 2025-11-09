const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// 检查 CDP 端口是否响应
async function checkCDPPort(port = 9222) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/json`, (res) => {
      // 消费响应流以防止资源泄漏
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 等待端口可用
async function waitForPort(port = 9222, maxWait = 30000, interval = 1000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (await checkCDPPort(port)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

// 启动应用
function startApp() {
  return new Promise((resolve, reject) => {
    console.log('正在启动应用...');
    const appPath = '/Applications/Trae.app/Contents/MacOS/Electron';
    const args = ['--remote-debugging-port=9222'];
    const workingDir = '/Users/leo/Documents/clipboard-viewer';
    
    // 使用 spawn 在后台启动应用，在指定目录下执行
    const appProcess = spawn(appPath, args, {
      detached: true,
      stdio: 'ignore',
      cwd: workingDir
    });
    
    appProcess.on('error', (error) => {
      console.error('启动应用时出错:', error);
      reject(error);
    });
    
    // 不等待进程结束，让它在后台运行
    appProcess.unref();
    resolve();
  });
}

// 根据名称查找元素配置
function findElement(config, name) {
  const element = config.find(e => e.name === name);
  if (!element) {
    throw new Error(`找不到元素配置: ${name}`);
  }
  return element;
}

async function automateChat() {
  let browser = null;
  try {
    // 步骤 1: 检查本地是否有 9222 端口
    console.log('步骤 1: 检查 9222 端口...');
    const portInUse = await checkCDPPort(9222);
    
    if (!portInUse) {
      // 步骤 2: 如果没有，执行启动命令
      console.log('步骤 2: 9222 端口不可用，启动应用...');
      await startApp();
      
      // 步骤 3: 等待并检查本地 9222 启动成功
      console.log('步骤 3: 等待 9222 端口启动...');
      const portReady = await waitForPort(9222, 30000);
      
      if (!portReady) {
        throw new Error('等待超时：9222 端口未能启动');
      }
      console.log('✓ 9222 端口已启动');
    } else {
      console.log('✓ 9222 端口已可用');
    }

    // 读取元素配置
    const configPath = path.join(__dirname, 'elements.config.json');
    const elementsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    console.log('正在连接到 CDP 端口 9222...');

    // 连接到 CDP 端点
    browser = await chromium.connectOverCDP('http://localhost:9222');
    
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

    // 步骤 4: 检查 ModeTabContainer 的 transform，如果是 translate(-20px) 才点击 SwithToSoloButton
    console.log('步骤 4: 检查 ModeTabContainer 的 transform...');
    const modeTabContainer = findElement(elementsConfig, 'ModeTabContainer');
    const switchToSoloButton = findElement(elementsConfig, 'SwithToSoloButton');
    try {
      await page.waitForSelector(modeTabContainer.selector, { timeout: 5000 });
      
      // 等待延迟后再检查 transform
      await page.waitForTimeout(2000);
      
      // 检查 transform 样式
      const transform = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const style = window.getComputedStyle(element);
        return style.transform;
      }, modeTabContainer.selector);
      
      console.log(`ModeTabContainer transform: ${transform}`);
      
      // 检查 transform 是否表示 translateX(-20px)
      // 支持格式：translate(-20px), translateX(-20px), matrix(1, 0, 0, 1, -20, 0) 等
      let shouldClick = false;
      if (transform) {
        // 检查 translate(-20px) 或 translateX(-20px)
        if (transform.includes('translate(-20px)') || transform.includes('translateX(-20px)')) {
          shouldClick = true;
        }
        // 检查 matrix(1, 0, 0, 1, -20, 0) 格式（第五个参数是 -20）
        else if (transform.startsWith('matrix')) {
          const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
          if (matrixMatch) {
            const values = matrixMatch[1].split(',').map(v => v.trim());
            // matrix(a, b, c, d, tx, ty) - tx 是第五个参数，应该是 -20
            if (values.length >= 5 && parseFloat(values[4]) === -20) {
              shouldClick = true;
            }
          }
        }
      }
      
      if (shouldClick) {
        console.log('检测到 translateX(-20px) 或等效的 matrix，点击 SwithToSoloButton...');
        await page.waitForSelector(switchToSoloButton.selector, { timeout: 5000 });
        await page.click(switchToSoloButton.selector);
        console.log('✓ 已点击 SwithToSoloButton');
      } else {
        console.log('⚠ transform 不是 translateX(-20px) 或等效的 matrix，跳过点击 SwithToSoloButton');
      }
    } catch (error) {
      console.log('⚠ ModeTabContainer 或 SwithToSoloButton 未找到，跳过');
    }
    await page.waitForTimeout(2000);

    // 步骤 5: 点击 NewChat
    console.log('步骤 5: 点击 NewChat...');
    const newChat = findElement(elementsConfig, 'NewChat');
    await page.waitForSelector(newChat.selector, { timeout: 10000 });
    await page.click(newChat.selector);
    console.log('✓ 已点击 NewChat');
    await page.waitForTimeout(2000);

    // 步骤 6: 点击 NewTaskMessageInput
    console.log('步骤 6: 点击 NewTaskMessageInput...');
    const messageInput = findElement(elementsConfig, 'NewTaskMessageInput');
    await page.waitForSelector(messageInput.selector, { timeout: 10000 });
    await page.click(messageInput.selector);
    console.log('✓ 已点击 NewTaskMessageInput');
    await page.waitForTimeout(2000);

    // 步骤 7: 输入 hello world
    console.log('步骤 7: 输入 hello world...');
    await page.fill(messageInput.selector, 'hello world');
    console.log('✓ 已输入 hello world');
    await page.waitForTimeout(2000);

    // 步骤 8: 点击 SendButton
    console.log('步骤 8: 点击 SendButton...');
    const sendButton = findElement(elementsConfig, 'SendButton');
    await page.waitForSelector(sendButton.selector, { timeout: 10000 });
    
    // 如果选择器指向 span，点击其父级 button
    const clickSelector = sendButton.selector.endsWith(' > span') 
      ? sendButton.selector.replace(' > span', '')
      : sendButton.selector;
    
    await page.click(clickSelector);
    console.log('✓ 已点击 SendButton');
    await page.waitForTimeout(2000);

    // 步骤 9: 等待，直到页面中出现 LatestAssistantBar
    console.log('步骤 9: 等待 LatestAssistantBar 出现...');
    const latestAssistantBar = findElement(elementsConfig, 'LatestAssistantBar');
    await page.waitForSelector(latestAssistantBar.selector, { timeout: 30000 });
    console.log('✓ LatestAssistantBar 已出现');
    await page.waitForTimeout(2000);

    // 步骤 10: 双击 FirstBotAvatar
    console.log('步骤 10: 双击 FirstBotAvatar...');
    const firstBotAvatar = findElement(elementsConfig, 'FirstBotAvatar');
    await page.waitForSelector(firstBotAvatar.selector, { timeout: 10000 });
    await page.dblclick(firstBotAvatar.selector);
    console.log('✓ 已双击 FirstBotAvatar');
    await page.waitForTimeout(2000);

    console.log('✓ 所有步骤执行完成！');

  } catch (error) {
    console.error('✗ 操作失败:', error.message);
    throw error;
  } finally {
    // 断开浏览器连接（不关闭浏览器），确保资源总是被释放
    if (browser) {
      await browser.close();
    }
  }
}

// 运行脚本
automateChat().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});

