const { loadConfig, findElement, checkCDPPort, waitForPort, startApp } = require('../core/utils');
const { connectToBrowser } = require('../core/browser');
const {
  waitForElement,
  clickElement,
  doubleClickElement,
  fillInput,
  conditionalClickByTransform
} = require('../core/operations');

// ==================== 主函数 ====================
async function automateChat() {
  const { config, elementsConfig } = loadConfig();
  let browser = null;
  
  try {
    // 步骤 1: 检查端口
    console.log(`步骤 1: 检查 ${config.cdp.port} 端口...`);
    const portInUse = await checkCDPPort(config.cdp.port, config.cdp.checkTimeout);
    
    if (!portInUse) {
      // 步骤 2: 启动应用
      console.log(`步骤 2: ${config.cdp.port} 端口不可用，启动应用...`);
      await startApp(config.app);
      
      // 步骤 3: 等待端口启动
      console.log(`步骤 3: 等待 ${config.cdp.port} 端口启动...`);
      const portReady = await waitForPort(
        config.cdp.port, 
        config.cdp.waitMaxTime, 
        config.cdp.waitInterval
      );
      
      if (!portReady) {
        throw new Error(`等待超时：${config.cdp.port} 端口未能启动`);
      }
      console.log(`✓ ${config.cdp.port} 端口已启动`);
    } else {
      console.log(`✓ ${config.cdp.port} 端口已可用`);
    }

    // 连接到浏览器
    const { browser: connectedBrowser, page } = await connectToBrowser(config.cdp.port);
    browser = connectedBrowser;

    // 步骤 4: 条件点击 SwithToSoloButton
    console.log('步骤 4: 检查 ModeTabContainer 的 transform...');
    const modeTabContainer = findElement(elementsConfig, 'ModeTabContainer');
    const switchToSoloButton = findElement(elementsConfig, 'SwithToSoloButton');
    await conditionalClickByTransform(
      page,
      modeTabContainer.selector,
      switchToSoloButton.selector,
      config.transform.checkValue,
      'ModeTabContainer',
      'SwithToSoloButton',
      { timeout: config.timeouts.short, waitAfter: config.delays.stepInterval }
    );

    // 步骤 5: 点击 NewChat
    console.log('步骤 5: 点击 NewChat...');
    const newChat = findElement(elementsConfig, 'NewChat');
    await clickElement(
      page, 
      newChat.selector, 
      'NewChat',
      { timeout: config.timeouts.default, waitAfter: config.delays.stepInterval }
    );

    // 步骤 6: 点击 NewTaskMessageInput
    console.log('步骤 6: 点击 NewTaskMessageInput...');
    const messageInput = findElement(elementsConfig, 'NewTaskMessageInput');
    await clickElement(
      page, 
      messageInput.selector, 
      'NewTaskMessageInput',
      { timeout: config.timeouts.default, waitAfter: config.delays.stepInterval }
    );

    // 步骤 7: 输入文本
    console.log('步骤 7: 输入文本...');
    await fillInput(
      page, 
      messageInput.selector, 
      config.input.defaultText,
      'NewTaskMessageInput',
      { timeout: config.timeouts.default, waitAfter: config.delays.stepInterval }
    );

    // 步骤 8: 点击 SendButton
    console.log('步骤 8: 点击 SendButton...');
    const sendButton = findElement(elementsConfig, 'SendButton');
    await clickElement(
      page, 
      sendButton.selector, 
      'SendButton',
      { timeout: config.timeouts.default, waitAfter: config.delays.stepInterval }
    );

    // 步骤 9: 等待 LatestAssistantBar
    console.log('步骤 9: 等待 LatestAssistantBar 出现...');
    const latestAssistantBar = findElement(elementsConfig, 'LatestAssistantBar');
    await waitForElement(
      page, 
      latestAssistantBar.selector, 
      config.timeouts.long,
      'LatestAssistantBar'
    );
    await page.waitForTimeout(config.delays.stepInterval);

    // 步骤 10: 双击 FirstBotAvatar
    console.log('步骤 10: 双击 FirstBotAvatar...');
    const firstBotAvatar = findElement(elementsConfig, 'FirstBotAvatar');
    await doubleClickElement(
      page, 
      firstBotAvatar.selector, 
      'FirstBotAvatar',
      { timeout: config.timeouts.default, waitAfter: config.delays.stepInterval }
    );

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
