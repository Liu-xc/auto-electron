#!/usr/bin/env node

/**
 * 统一脚本运行器
 * 支持指定不同的测试脚本执行
 * 
 * 使用方法:
 *   node src/run.js <script-name> [options...]
 *   或
 *   node src/run.js --script <script-name> [options...]
 * 
 * 示例:
 *   node src/run.js automate-chat --batch --concurrency 3
 *   node src/run.js --script automate-chat --test-cases ./test-cases.json
 */

const path = require('path');
const fs = require('fs');

// ==================== 脚本注册 ====================

/**
 * 获取所有可用的脚本
 * @returns {Array<string>} 脚本名称数组
 */
function getAvailableScripts() {
  const scriptsDir = path.join(__dirname, 'scripts');
  const files = fs.readdirSync(scriptsDir);
  
  return files
    .filter(file => file.endsWith('.js') && file !== 'index.js' && !file.startsWith('_'))
    .map(file => file.replace('.js', ''));
}

/**
 * 加载脚本模块
 * @param {string} scriptName - 脚本名称（不含 .js 扩展名）
 * @returns {Object} 脚本模块
 */
function loadScript(scriptName) {
  const scriptPath = path.join(__dirname, 'scripts', `${scriptName}.js`);
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`脚本不存在: ${scriptName}\n可用脚本: ${getAvailableScripts().join(', ')}`);
  }
  
  try {
    return require(scriptPath);
  } catch (error) {
    throw new Error(`加载脚本失败: ${scriptName}\n错误: ${error.message}`);
  }
}

// ==================== 命令行参数解析 ====================

/**
 * 解析命令行参数
 * @returns {Object} { scriptName, options }
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  let scriptName = null;
  
  // 查找 --script 参数
  const scriptIndex = args.indexOf('--script');
  if (scriptIndex !== -1 && args[scriptIndex + 1]) {
    scriptName = args[scriptIndex + 1];
    args.splice(scriptIndex, 2); // 移除 --script 和脚本名
  } else if (args.length > 0 && !args[0].startsWith('--')) {
    // 第一个参数如果不是选项，则视为脚本名
    scriptName = args[0];
    args.shift(); // 移除脚本名
  }
  
  // 如果没有指定脚本名，显示帮助信息
  if (!scriptName) {
    console.error('错误: 未指定脚本名称\n');
    console.log('使用方法:');
    console.log('  node src/run.js <script-name> [options...]');
    console.log('  或');
    console.log('  node src/run.js --script <script-name> [options...]\n');
    console.log('可用脚本:');
    getAvailableScripts().forEach(name => {
      console.log(`  - ${name}`);
    });
    console.log('\n示例:');
    console.log('  node src/run.js automate-chat --batch --concurrency 3');
    console.log('  node src/run.js --script automate-chat --test-cases ./test-cases.json');
    process.exit(1);
  }
  
  // 解析其他选项
  // --test-cases
  const testCasesIndex = args.indexOf('--test-cases');
  if (testCasesIndex !== -1 && args[testCasesIndex + 1]) {
    options.testCasesPath = args[testCasesIndex + 1];
  }
  
  // --batch
  if (args.includes('--batch')) {
    options.batch = true;
  }
  
  // --stop-on-error
  if (args.includes('--stop-on-error')) {
    options.stopOnError = true;
  }
  
  // --concurrency
  const concurrencyIndex = args.indexOf('--concurrency');
  if (concurrencyIndex !== -1 && args[concurrencyIndex + 1]) {
    const concurrency = parseInt(args[concurrencyIndex + 1], 10);
    if (!isNaN(concurrency) && concurrency > 0) {
      options.concurrency = concurrency;
    }
  }
  
  // --log-dir
  const logDirIndex = args.indexOf('--log-dir');
  if (logDirIndex !== -1 && args[logDirIndex + 1]) {
    options.logDir = args[logDirIndex + 1];
  }
  
  // --keep-apps (不关闭应用)
  if (args.includes('--keep-apps')) {
    options.closeAppAfterFinish = false;
  }
  
  // --bot-reply-timeout (Bot 回复超时时间，单位：秒)
  const botReplyTimeoutIndex = args.indexOf('--bot-reply-timeout');
  if (botReplyTimeoutIndex !== -1 && args[botReplyTimeoutIndex + 1]) {
    const timeoutSeconds = parseInt(args[botReplyTimeoutIndex + 1], 10);
    if (!isNaN(timeoutSeconds) && timeoutSeconds > 0) {
      options.botReplyTimeout = timeoutSeconds * 1000; // 转换为毫秒
    }
  }
  
  // --max-concurrency (最大并发数)
  const maxConcurrencyIndex = args.indexOf('--max-concurrency');
  if (maxConcurrencyIndex !== -1 && args[maxConcurrencyIndex + 1]) {
    const maxConcurrency = parseInt(args[maxConcurrencyIndex + 1], 10);
    if (!isNaN(maxConcurrency) && maxConcurrency > 0) {
      options.maxConcurrency = maxConcurrency;
    }
  }
  
  return { scriptName, options };
}

// ==================== 主函数 ====================

async function main() {
  try {
    const { scriptName, options } = parseArgs();
    
    console.log(`正在加载脚本: ${scriptName}...`);
    const script = loadScript(scriptName);
    
    // 检查脚本是否导出 execute 函数
    if (typeof script.execute !== 'function') {
      throw new Error(`脚本 ${scriptName} 未导出 execute 函数`);
    }
    
    // 执行脚本
    console.log(`开始执行脚本: ${scriptName}\n`);
    await script.execute(options);
    
  } catch (error) {
    console.error('执行失败:', error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  getAvailableScripts,
  loadScript,
  parseArgs
};

