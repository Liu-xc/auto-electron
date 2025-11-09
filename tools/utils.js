/**
 * 工具脚本通用工具函数
 */

const path = require('path');
const fs = require('fs');

/**
 * 获取 CDP 端口
 * 优先级：命令行参数 > 环境变量 > 配置文件
 * @param {number} defaultPort - 默认端口（如果都未指定）
 * @returns {number} CDP 端口号
 */
function getCDPPort(defaultPort = null) {
  // 1. 检查命令行参数 --port
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port) && port > 0) {
      return port;
    }
  }
  
  // 2. 检查环境变量
  if (process.env.CDP_PORT) {
    const port = parseInt(process.env.CDP_PORT, 10);
    if (!isNaN(port) && port > 0) {
      return port;
    }
  }
  
  // 3. 从配置文件读取
  try {
    const configPath = path.join(__dirname, '../config/config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.cdp && config.cdp.port) {
        return config.cdp.port;
      }
    }
  } catch (error) {
    console.warn('警告: 无法读取配置文件，使用默认端口');
  }
  
  // 4. 使用默认值
  return defaultPort || 9222;
}

module.exports = {
  getCDPPort
};

