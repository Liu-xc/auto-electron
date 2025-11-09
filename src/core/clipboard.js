const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ==================== 剪贴板操作 ====================

/**
 * 读取剪贴板内容（macOS）
 * @returns {string} 剪贴板内容
 */
function readClipboard() {
  try {
    const content = execSync('pbpaste', { encoding: 'utf-8' });
    return content;
  } catch (error) {
    throw new Error(`读取剪贴板失败: ${error.message}`);
  }
}

/**
 * 保存日志到文件
 * @param {string} content - 要保存的内容
 * @param {string} caseName - 用例名称（用于生成文件名）
 * @param {string} logDir - 日志保存目录（可选，相对路径会解析为项目根目录）
 * @returns {string} 保存的文件路径
 */
function saveLog(content, caseName, logDir) {
  const fs = require('fs');
  const path = require('path');
  
  // 项目根目录（src/core 的上级目录的上级目录）
  const projectRoot = path.join(__dirname, '../..');
  
  // 如果没有指定日志目录，使用默认目录
  const defaultLogDir = path.join(projectRoot, 'logs');
  let targetLogDir;
  
  if (!logDir) {
    // 使用默认目录
    targetLogDir = defaultLogDir;
  } else if (path.isAbsolute(logDir)) {
    // 如果是绝对路径，直接使用
    targetLogDir = logDir;
  } else {
    // 如果是相对路径，解析为相对于项目根目录的路径
    targetLogDir = path.join(projectRoot, logDir);
  }
  
  // 确保日志目录存在
  if (!fs.existsSync(targetLogDir)) {
    fs.mkdirSync(targetLogDir, { recursive: true });
  }
  
  // 生成文件名：用例名称 + 时间戳
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedName = (caseName || 'log').replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${sanitizedName}_${timestamp}.txt`;
  const filepath = path.join(targetLogDir, filename);
  
  // 保存文件
  fs.writeFileSync(filepath, content, 'utf-8');
  
  return filepath;
}

/**
 * 读取剪贴板并保存日志
 * @param {string} caseName - 用例名称
 * @param {string} logDir - 日志保存目录（可选）
 * @returns {Promise<Object>} { success: boolean, filepath?: string, content?: string, error?: string }
 */
async function readClipboardAndSave(caseName, logDir) {
  try {
    console.log('正在读取剪贴板内容...');
    const content = readClipboard();
    
    if (!content || content.trim().length === 0) {
      console.warn('警告: 剪贴板内容为空');
      return { success: false, error: '剪贴板内容为空' };
    }
    
    console.log(`剪贴板内容长度: ${content.length} 字符`);
    
    // 保存到文件
    const filepath = saveLog(content, caseName, logDir);
    console.log(`✓ 日志已保存到: ${filepath}`);
    
    return { success: true, filepath, content };
  } catch (error) {
    console.error(`✗ 读取剪贴板失败:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  readClipboard,
  saveLog,
  readClipboardAndSave
};

