const { loadConfig, loadTestCases } = require('../core/utils');
const { executeTestCase, executeTestCases } = require('../core/test-case');

// ==================== 脚本执行函数 ====================

/**
 * 执行单个测试用例（使用默认配置）
 */
async function executeSingle() {
  const { config, elementsConfig } = loadConfig();
  
  // 使用默认配置创建一个测试用例
  const defaultTestCase = {
    name: '默认用例',
    workingDir: config.app.workingDir,
    inputText: config.input.defaultText
  };
  
  const result = await executeTestCase(defaultTestCase, config, elementsConfig);
  
  if (!result.success) {
    throw new Error(result.error);
  }
}

/**
 * 批量执行测试用例
 * @param {Object} options - 执行选项
 */
async function executeBatch(options = {}) {
  const { config, elementsConfig } = loadConfig();
  const testCases = loadTestCases(options.testCasesPath);
  
  if (testCases.length === 0) {
    console.log('没有找到测试用例，使用默认配置执行单个用例');
    await executeSingle();
    return;
  }
  
  // 合并配置中的默认选项
  const executionOptions = {
    concurrency: options.concurrency ?? config.execution?.concurrency ?? 2,
    maxConcurrency: options.maxConcurrency ?? config.execution?.maxConcurrency ?? 5,
    closeAppAfterFinish: options.closeAppAfterFinish ?? config.execution?.closeAppAfterFinish ?? true,
    stopOnError: options.stopOnError ?? false,
    logDir: options.logDir ?? config.logs?.dir,
    botReplyTimeout: options.botReplyTimeout
  };
  
  const results = await executeTestCases(testCases, config, elementsConfig, executionOptions);
  
  // 如果有失败的用例，退出码为 1
  if (results.failed > 0) {
    throw new Error(`执行失败: ${results.failed} 个用例失败`);
  }
}

/**
 * 脚本主执行函数（统一接口）
 * @param {Object} options - 执行选项
 */
async function execute(options = {}) {
  // 如果指定了 testCasesPath 或 batch，则批量执行
  if (options.testCasesPath || options.batch) {
    await executeBatch(options);
  } else {
    // 否则单个用例执行
    await executeSingle();
  }
}

// ==================== 模块导出 ====================

module.exports = {
  execute,
  executeSingle,
  executeBatch
};
