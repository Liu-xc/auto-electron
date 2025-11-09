const { spawn } = require('child_process');
const http = require('http');

// ==================== 配置加载 ====================
function loadConfig() {
  const fs = require('fs');
  const path = require('path');
  
  const configPath = path.join(__dirname, '../../config/config.json');
  const elementsConfigPath = path.join(__dirname, '../../config/elements.config.json');
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const elementsConfig = JSON.parse(fs.readFileSync(elementsConfigPath, 'utf-8'));
  
  return { config, elementsConfig };
}

// ==================== 测试用例加载 ====================
/**
 * 加载测试用例
 * @param {string} testCasesPath - 测试用例文件路径（可选，默认从 config/test-cases.json 加载）
 * @returns {Array<Object>} 测试用例数组
 */
function loadTestCases(testCasesPath) {
  const fs = require('fs');
  const path = require('path');
  
  const defaultPath = path.join(__dirname, '../../config/test-cases.json');
  const filePath = testCasesPath || defaultPath;
  
  if (!fs.existsSync(filePath)) {
    console.warn(`警告: 测试用例文件不存在: ${filePath}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const testCases = JSON.parse(content);
  
  // 确保返回数组
  if (!Array.isArray(testCases)) {
    throw new Error('测试用例文件格式错误：必须是数组格式');
  }
  
  return testCases;
}

// ==================== 元素查找 ====================
function findElement(elementsConfig, name) {
  const element = elementsConfig.find(e => e.name === name);
  if (!element) {
    throw new Error(`找不到元素配置: ${name}`);
  }
  return element;
}

// ==================== 端口检查 ====================
// 检查 CDP 端口是否响应
async function checkCDPPort(port, timeout) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/json`, (res) => {
      // 消费响应流以防止资源泄漏
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeout, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 等待端口可用
async function waitForPort(port, maxWait, interval) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (await checkCDPPort(port, 2000)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

// ==================== 应用启动 ====================
function startApp(appConfig) {
  return new Promise((resolve, reject) => {
    console.log('正在启动应用...');
    
    const appProcess = spawn(appConfig.path, appConfig.args, {
      detached: true,
      stdio: 'ignore',
      cwd: appConfig.workingDir
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

module.exports = {
  loadConfig,
  findElement,
  checkCDPPort,
  waitForPort,
  startApp,
  loadTestCases
};

