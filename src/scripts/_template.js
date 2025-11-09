/**
 * 测试脚本模板
 * 
 * 复制此文件并重命名为你的脚本名称，然后实现 execute 函数
 * 
 * 示例:
 *   cp src/scripts/_template.js src/scripts/my-test.js
 *   然后编辑 my-test.js 实现你的测试逻辑
 */

const { loadConfig, loadTestCases } = require('../core/utils');
const { executeTestCase, executeTestCases } = require('../core/test-case');

/**
 * 脚本主执行函数（统一接口）
 * 
 * @param {Object} options - 执行选项
 * @param {boolean} options.batch - 是否批量执行
 * @param {string} options.testCasesPath - 测试用例文件路径
 * @param {number} options.concurrency - 并发数量
 * @param {boolean} options.stopOnError - 遇到错误是否停止
 * @param {string} options.logDir - 日志保存目录
 * @param {boolean} options.closeAppAfterFinish - 执行完成后是否关闭应用
 */
async function execute(options = {}) {
  const { config, elementsConfig } = loadConfig();
  
  // ========== 在这里实现你的测试逻辑 ==========
  
  if (options.batch) {
    // 批量执行模式
    const testCases = loadTestCases(options.testCasesPath);
    
    if (testCases.length === 0) {
      console.log('没有找到测试用例');
      return;
    }
    
    // 合并配置中的默认选项
    const executionOptions = {
      concurrency: options.concurrency ?? config.execution?.concurrency ?? 1,
      closeAppAfterFinish: options.closeAppAfterFinish ?? config.execution?.closeAppAfterFinish ?? true,
      stopOnError: options.stopOnError ?? false,
      logDir: options.logDir ?? config.logs?.dir
    };
    
    const results = await executeTestCases(testCases, config, elementsConfig, executionOptions);
    
    // 如果有失败的用例，抛出错误
    if (results.failed > 0) {
      throw new Error(`执行失败: ${results.failed} 个用例失败`);
    }
  } else {
    // 单个用例执行模式
    const testCase = {
      name: '默认用例',
      workingDir: config.app.workingDir,
      inputText: config.input.defaultText
    };
    
    const result = await executeTestCase(testCase, config, elementsConfig, {
      closeAppAfterFinish: options.closeAppAfterFinish ?? config.execution?.closeAppAfterFinish ?? true,
      logDir: options.logDir ?? config.logs?.dir
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
  }
  
  // ============================================
}

module.exports = {
  execute
};

