const { loadConfig, findElement } = require('./utils');
const { connectToBrowser } = require('./browser');
const { appManager } = require('./app-manager');
const { readClipboardAndSave, saveTaskLog } = require('./clipboard');
const {
  waitForElement,
  clickElement,
  doubleClickElement,
  fillInput,
  conditionalClickByTransform
} = require('./operations');

// ==================== 测试用例执行 ====================

/**
 * 执行单个测试用例
 * @param {Object} testCase - 测试用例对象
 * @param {string} testCase.workingDir - 工作目录（可选，覆盖默认配置）
 * @param {string} testCase.inputText - 输入文本（可选，覆盖默认配置）
 * @param {string} testCase.name - 用例名称（可选，用于日志）
 * @param {number} testCase.port - 指定端口（可选，用于并发执行）
 * @param {number} testCase.botReplyTimeout - Bot 回复超时时间（毫秒，可选，覆盖默认配置）
 * @param {Object} globalConfig - 全局配置对象
 * @param {Array} elementsConfig - 元素配置数组
 * @param {Object} options - 执行选项
 * @param {boolean} options.closeAppAfterFinish - 执行完成后是否关闭应用（默认 false）
 * @param {string} options.logDir - 日志保存目录（可选）
 * @param {number} options.botReplyTimeout - Bot 回复超时时间（毫秒，可选，覆盖默认配置）
 * @returns {Promise<Object>} 执行结果 { success: boolean, error?: string, caseName?: string, logFile?: string, port?: number }
 */
async function executeTestCase(testCase, globalConfig, elementsConfig, options = {}) {
  const { closeAppAfterFinish = false, logDir, botReplyTimeout } = options;
  const caseName = testCase.name || `用例-${Date.now()}`;
  const workingDir = testCase.workingDir || globalConfig.app.workingDir;
  const inputText = testCase.inputText || globalConfig.input.defaultText;
  
  // 确定使用的端口
  let port = testCase.port;
  let shouldCloseApp = false;
  
  // 合并应用配置，使用用例的 workingDir
  const appConfig = {
    ...globalConfig.app,
    workingDir
  };
  
  let browser = null;
  const startTime = Date.now();
  
  try {
    console.log(`\n========== 开始执行: ${caseName} ==========`);
    console.log(`工作目录: ${workingDir}`);
    console.log(`输入文本: ${inputText}`);
    
    // 步骤 1: 分配或使用指定端口
    if (!port) {
      // 如果没有指定端口，分配一个新端口
      port = await appManager.allocatePort(globalConfig.cdp.port, globalConfig.cdp.maxPorts || 100);
      shouldCloseApp = true; // 如果是新分配的端口，执行完成后关闭
      console.log(`步骤 1: 分配端口 ${port}...`);
    } else {
      console.log(`步骤 1: 使用指定端口 ${port}...`);
    }
    
    // 步骤 2: 检查端口是否已有应用实例
    if (!appManager.hasInstance(port)) {
      // 步骤 3: 启动应用实例
      console.log(`步骤 2: 启动应用实例（端口: ${port}）...`);
      await appManager.startAppInstance(
        appConfig, 
        port, 
        {
          waitMaxTime: globalConfig.cdp.waitMaxTime,
          waitInterval: globalConfig.cdp.waitInterval,
          maxPorts: globalConfig.cdp.maxPorts || 100
        }
      );
      shouldCloseApp = true; // 如果是新启动的应用，执行完成后关闭
    } else {
      console.log(`✓ 端口 ${port} 已有应用实例运行`);
    }

    // 连接到浏览器
    const { browser: connectedBrowser, page } = await connectToBrowser(port);
    browser = connectedBrowser;

    // 步骤 4: 条件点击 SwithToSoloButton
    console.log('步骤 4: 检查 ModeTabContainer 的 transform...');
    const modeTabContainer = findElement(elementsConfig, 'ModeTabContainer');
    const switchToSoloButton = findElement(elementsConfig, 'SwithToSoloButton');
    await conditionalClickByTransform(
      page,
      modeTabContainer.selector,
      switchToSoloButton.selector,
      globalConfig.transform.checkValue,
      'ModeTabContainer',
      'SwithToSoloButton',
      { timeout: globalConfig.timeouts.short, waitAfter: globalConfig.delays.stepInterval }
    );

    // 步骤 5: 点击 NewChat
    console.log('步骤 5: 点击 NewChat...');
    const newChat = findElement(elementsConfig, 'NewChat');
    await clickElement(
      page, 
      newChat.selector, 
      'NewChat',
      { timeout: globalConfig.timeouts.default, waitAfter: globalConfig.delays.stepInterval }
    );

    // 步骤 6: 点击 NewTaskMessageInput
    console.log('步骤 6: 点击 NewTaskMessageInput...');
    const messageInput = findElement(elementsConfig, 'NewTaskMessageInput');
    await clickElement(
      page, 
      messageInput.selector, 
      'NewTaskMessageInput',
      { timeout: globalConfig.timeouts.default, waitAfter: globalConfig.delays.stepInterval }
    );

    // 步骤 7: 输入文本（使用用例指定的文本）
    console.log('步骤 7: 输入文本...');
    await fillInput(
      page, 
      messageInput.selector, 
      inputText,
      'NewTaskMessageInput',
      { timeout: globalConfig.timeouts.default, waitAfter: globalConfig.delays.stepInterval }
    );

    // 步骤 8: 点击 SendButton
    console.log('步骤 8: 点击 SendButton...');
    const sendButton = findElement(elementsConfig, 'SendButton');
    await clickElement(
      page, 
      sendButton.selector, 
      'SendButton',
      { timeout: globalConfig.timeouts.default, waitAfter: globalConfig.delays.stepInterval }
    );

    // 步骤 9: 等待 LatestAssistantBar（Bot 回复）
    // 超时时间优先级：testCase.botReplyTimeout > options.botReplyTimeout > config.timeouts.long
    const botReplyTimeoutMs = testCase.botReplyTimeout ?? botReplyTimeout ?? globalConfig.timeouts.long;
    console.log(`步骤 9: 等待 LatestAssistantBar 出现（超时: ${botReplyTimeoutMs / 1000}秒）...`);
    const latestAssistantBar = findElement(elementsConfig, 'LatestAssistantBar');
    await waitForElement(
      page, 
      latestAssistantBar.selector, 
      botReplyTimeoutMs,
      'LatestAssistantBar'
    );
    await page.waitForTimeout(globalConfig.delays.stepInterval);

    // 步骤 10: 双击 FirstBotAvatar
    console.log('步骤 10: 双击 FirstBotAvatar...');
    const firstBotAvatar = findElement(elementsConfig, 'FirstBotAvatar');
    await doubleClickElement(
      page, 
      firstBotAvatar.selector, 
      'FirstBotAvatar',
      { timeout: globalConfig.timeouts.default, waitAfter: globalConfig.delays.stepInterval }
    );

    // 步骤 11: 读取剪贴板内容
    console.log('步骤 11: 读取剪贴板内容...');
    const clipboardResult = await readClipboardAndSave(caseName, logDir || globalConfig.logs?.dir);
    let clipboardContent = null;
    let logFile = null;
    if (clipboardResult.success) {
      clipboardContent = clipboardResult.content;
      logFile = clipboardResult.filepath;
      console.log(`✓ 剪贴板内容已读取（长度: ${clipboardContent.length} 字符）`);
    } else {
      console.warn(`⚠ 读取剪贴板失败: ${clipboardResult.error}`);
    }

    const endTime = Date.now();
    console.log(`✓ ${caseName} 执行完成！`);
    console.log(`========== 完成: ${caseName} ==========\n`);
    
    return { 
      success: true, 
      caseName,
      workingDir,
      inputText,
      clipboardContent,
      logFile, // 保留旧的文件路径用于兼容
      port,
      startTime,
      endTime,
      duration: endTime - startTime
    };

  } catch (error) {
    const endTime = Date.now();
    console.error(`✗ ${caseName} 执行失败:`, error.message);
    console.log(`========== 失败: ${caseName} ==========\n`);
    return { 
      success: false, 
      error: error.message, 
      caseName,
      workingDir,
      inputText,
      port,
      startTime,
      endTime,
      duration: endTime - startTime
    };
  } finally {
    // 断开浏览器连接（不关闭浏览器），确保资源总是被释放
    if (browser) {
      await browser.close();
    }
    
    // 如果设置了关闭应用，且应用是我们启动的，则关闭它
    if (closeAppAfterFinish && shouldCloseApp && port) {
      await appManager.closeAppInstance(port);
    }
  }
}

/**
 * 批量执行测试用例
 * @param {Array<Object>} testCases - 测试用例数组
 * @param {Object} globalConfig - 全局配置对象
 * @param {Array} elementsConfig - 元素配置数组
 * @param {Object} options - 执行选项
 * @param {boolean} options.stopOnError - 遇到错误时是否停止（默认 false）
 * @param {number} options.concurrency - 并发数量（默认使用配置中的值，通常为 2）
 * @param {number} options.maxConcurrency - 最大并发数量（默认使用配置中的值，通常为 5）
 * @param {boolean} options.closeAppAfterFinish - 执行完成后是否关闭应用（默认 true）
 * @param {string} options.logDir - 日志保存目录（可选）
 * @param {number} options.botReplyTimeout - Bot 回复超时时间（毫秒，可选）
 * @returns {Promise<Object>} 执行结果统计
 */
async function executeTestCases(testCases, globalConfig, elementsConfig, options = {}) {
  const { 
    stopOnError = false, 
    concurrency = globalConfig.execution?.concurrency ?? 2,
    maxConcurrency = globalConfig.execution?.maxConcurrency ?? 5,
    closeAppAfterFinish = true,
    logDir,
    botReplyTimeout
  } = options;
  
  // 限制并发数量不超过最大值
  const actualConcurrency = Math.min(concurrency, maxConcurrency);
  
  // 跟踪每个 workingDir 的执行 Promise，用于检测和等待相同目录的用例
  const workingDirPromises = new Map(); // workingDir -> Promise
  
  // 任务开始时间
  const taskStartTime = Date.now();
  const taskId = `task-${taskStartTime}`;
  
  const results = {
    total: testCases.length,
    success: 0,
    failed: 0,
    details: []
  };
  
  console.log(`\n开始批量执行 ${testCases.length} 个测试用例...`);
  if (actualConcurrency > 1) {
    console.log(`并发模式: ${actualConcurrency} 个用例同时执行（最大并发: ${maxConcurrency}）\n`);
  } else {
    console.log(`串行模式: 依次执行\n`);
  }
  
  // 并发执行
  if (actualConcurrency > 1) {
    const executing = [];
    let currentIndex = 0;
    
    // 执行单个用例的包装函数
    const executeOne = async (testCase, index) => {
      // 获取用例的 workingDir
      const workingDir = testCase.workingDir || globalConfig.app.workingDir;
      const caseName = testCase.name || `用例-${index}`;
      
      // 检查是否有相同的 workingDir 正在执行
      if (workingDirPromises.has(workingDir)) {
        console.log(`\n⚠ 检测到用例 "${caseName}" 的工作目录 "${workingDir}" 正在被其他用例使用，等待前置用例完成...`);
        await workingDirPromises.get(workingDir);
        console.log(`✓ 前置用例已完成，开始执行用例 "${caseName}"\n`);
      }
      
      // 创建当前用例的执行 Promise（立即执行）
      const executePromise = (async () => {
        try {
          const result = await executeTestCase(testCase, globalConfig, elementsConfig, {
            closeAppAfterFinish,
            logDir,
            botReplyTimeout
          });
          return { index, result };
        } catch (error) {
          return { 
            index, 
            result: { 
              success: false, 
              error: error.message, 
              caseName 
            } 
          };
        } finally {
          // 用例完成后，清理 workingDir 记录
          workingDirPromises.delete(workingDir);
        }
      })();
      
      // 立即记录当前用例的 Promise（这样后续相同 workingDir 的用例会等待这个 Promise）
      workingDirPromises.set(workingDir, executePromise);
      
      return await executePromise;
    };
    
    // 启动初始批次
    while (executing.length < actualConcurrency && currentIndex < testCases.length) {
      const testCase = testCases[currentIndex];
      const promise = executeOne(testCase, currentIndex).then(({ index, result }) => {
        // 从执行队列中移除
        const idx = executing.findIndex(p => p.index === index);
        if (idx !== -1) {
          executing.splice(idx, 1);
        }
        return { index, result };
      });
      executing.push({ index: currentIndex, promise });
      currentIndex++;
    }
    
    // 处理完成和启动新的用例
    while (executing.length > 0 || currentIndex < testCases.length) {
      // 等待任意一个完成
      const { index, result } = await Promise.race(
        executing.map(p => p.promise.then(r => ({ index: p.index, result: r.result })))
      );
      
      // 记录结果
      results.details[index] = result;
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        if (stopOnError) {
          console.log(`\n遇到错误，停止执行剩余用例`);
          // 取消所有正在执行的用例
          break;
        }
      }
      
      // 启动新的用例（如果还有）
      if (currentIndex < testCases.length && !(stopOnError && !result.success)) {
        const testCase = testCases[currentIndex];
        const promise = executeOne(testCase, currentIndex).then(({ index, result }) => {
          const idx = executing.findIndex(p => p.index === index);
          if (idx !== -1) {
            executing.splice(idx, 1);
          }
          return { index, result };
        });
        executing.push({ index: currentIndex, promise });
        currentIndex++;
      }
    }
    
    // 等待所有剩余的用例完成
    await Promise.all(executing.map(p => p.promise));
    
  } else {
    // 串行执行
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const workingDir = testCase.workingDir || globalConfig.app.workingDir;
      
      // 检查是否有相同的 workingDir 正在执行（串行模式下通常不会有，但为了安全起见还是检查）
      if (workingDirPromises.has(workingDir)) {
        const caseName = testCase.name || `用例-${i}`;
        console.log(`\n⚠ 检测到用例 "${caseName}" 的工作目录 "${workingDir}" 正在被其他用例使用，等待前置用例完成...`);
        await workingDirPromises.get(workingDir);
        console.log(`✓ 前置用例已完成，开始执行用例 "${caseName}"\n`);
      }
      
      // 创建当前用例的执行 Promise
      const executePromise = (async () => {
        try {
          return await executeTestCase(testCase, globalConfig, elementsConfig, {
            closeAppAfterFinish,
            logDir,
            botReplyTimeout
          });
        } finally {
          // 用例完成后，清理 workingDir 记录
          workingDirPromises.delete(workingDir);
        }
      })();
      
      // 记录当前用例的 Promise
      workingDirPromises.set(workingDir, executePromise);
      
      const result = await executePromise;
      
      results.details.push(result);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        
        if (stopOnError) {
          console.log(`\n遇到错误，停止执行剩余用例`);
          break;
        }
      }
      
      // 用例之间的间隔
      if (i < testCases.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // 任务结束时间
  const taskEndTime = Date.now();
  
  // 构建任务日志对象
  const taskLog = {
    taskId,
    startTime: taskStartTime,
    endTime: taskEndTime,
    duration: taskEndTime - taskStartTime,
    total: results.total,
    success: results.success,
    failed: results.failed,
    options: {
      concurrency: actualConcurrency,
      maxConcurrency,
      stopOnError,
      closeAppAfterFinish,
      botReplyTimeout
    },
    testCases: results.details
      .map((result, index) => {
        // 如果 result 不存在（并发模式下可能的情况），跳过
        if (!result) return null;
        const testCase = testCases[index] || {};
        return {
          index,
          name: result.caseName || testCase.name || `用例-${index}`,
          workingDir: result.workingDir || testCase.workingDir || globalConfig.app.workingDir,
          inputText: result.inputText || testCase.inputText || globalConfig.input.defaultText,
          success: result.success,
          error: result.error || null,
          clipboardContent: result.clipboardContent || null,
          port: result.port || null,
          startTime: result.startTime || null,
          endTime: result.endTime || null,
          duration: result.duration || null,
          logFile: result.logFile || null // 保留旧的文件路径用于兼容
        };
      })
      .filter(item => item !== null) // 过滤掉 null 值
  };
  
  // 保存 JSON 格式的任务日志
  const taskLogFile = saveTaskLog(taskLog, logDir || globalConfig.logs?.dir);
  console.log(`\n✓ 任务日志已保存: ${taskLogFile}`);
  
  // 打印统计信息
  console.log(`\n========== 批量执行完成 ==========`);
  console.log(`总计: ${results.total} 个用例`);
  console.log(`成功: ${results.success} 个`);
  console.log(`失败: ${results.failed} 个`);
  console.log(`总耗时: ${((taskEndTime - taskStartTime) / 1000).toFixed(2)} 秒`);
  if (results.details.some(r => r.logFile)) {
    console.log(`\n单个用例日志文件:`);
    results.details.forEach(r => {
      if (r.logFile) {
        console.log(`  - ${r.caseName}: ${r.logFile}`);
      }
    });
  }
  console.log(`========== ========== ==========\n`);
  
  return {
    ...results,
    taskLogFile,
    taskId,
    startTime: taskStartTime,
    endTime: taskEndTime,
    duration: taskEndTime - taskStartTime
  };
}

module.exports = {
  executeTestCase,
  executeTestCases
};

