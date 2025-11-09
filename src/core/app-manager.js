const { spawn } = require('child_process');
const { checkCDPPort, waitForPort, loadConfig } = require('./utils');

// ==================== 应用实例管理器 ====================

class AppInstanceManager {
  constructor() {
    this.instances = new Map(); // port -> { process, workingDir, port, startTime }
    this.portPool = new Set(); // 已使用的端口集合
  }

  /**
   * 分配一个可用的端口
   * @param {number} basePort - 基础端口号
   * @param {number} maxPorts - 最大端口数（默认 100）
   * @returns {number} 可用的端口号
   */
  async allocatePort(basePort, maxPorts = 100) {
    for (let i = 0; i < maxPorts; i++) {
      const port = basePort + i;
      
      // 检查端口是否已被分配
      if (this.portPool.has(port)) {
        continue;
      }
      
      // 检查端口是否可用
      const isInUse = await checkCDPPort(port, 500);
      if (!isInUse) {
        this.portPool.add(port);
        return port;
      }
    }
    
    throw new Error(`无法分配可用端口（基础端口: ${basePort}, 最大尝试: ${maxPorts}）`);
  }

  /**
   * 启动应用实例
   * @param {Object} appConfig - 应用配置
   * @param {string} appConfig.path - 应用路径
   * @param {string} appConfig.workingDir - 工作目录
   * @param {Array} appConfig.args - 启动参数（会自动添加端口参数）
   * @param {number} port - 指定端口号（如果已分配）或基础端口号（如果未分配）
   * @param {Object} options - 选项
   * @param {number} options.waitMaxTime - 等待端口启动的最大时间
   * @param {number} options.waitInterval - 等待端口启动的检查间隔
   * @param {number} options.maxPorts - 最大端口数（仅在 port 未分配时使用）
   * @returns {Promise<Object>} { port, process, workingDir }
   */
  async startAppInstance(appConfig, port, options = {}) {
    const { waitMaxTime = 30000, waitInterval = 1000, maxPorts = 100 } = options;
    
    // 如果端口未指定，则分配一个（从配置读取基础端口）
    if (!port) {
      const { config } = loadConfig();
      const basePort = config.cdp.port || 9222;
      port = await this.allocatePort(basePort, maxPorts);
    } else if (!this.portPool.has(port)) {
      // 如果端口已指定但未在池中，标记为已使用
      this.portPool.add(port);
    }
    // 如果端口已在池中，说明已经被分配，直接使用
    
    console.log(`正在启动应用实例，端口: ${port}, 工作目录: ${appConfig.workingDir}`);
    
    // 构建启动参数，添加端口参数
    const args = [
      ...appConfig.args.filter(arg => !arg.includes('--remote-debugging-port')),
      `--remote-debugging-port=${port}`
    ];
    
    return new Promise((resolve, reject) => {
      const appProcess = spawn(appConfig.path, args, {
        detached: true,
        stdio: 'ignore',
        cwd: appConfig.workingDir
      });
      
      appProcess.on('error', (error) => {
        console.error(`启动应用实例失败（端口 ${port}）:`, error);
        this.portPool.delete(port);
        reject(error);
      });
      
      // 不等待进程结束，让它在后台运行
      appProcess.unref();
      
      // 记录实例信息
      const instance = {
        process: appProcess,
        port,
        workingDir: appConfig.workingDir,
        startTime: Date.now()
      };
      this.instances.set(port, instance);
      
      // 等待端口启动
      console.log(`等待端口 ${port} 启动...`);
      waitForPort(port, waitMaxTime, waitInterval)
        .then(portReady => {
          if (portReady) {
            console.log(`✓ 应用实例已启动，端口: ${port}`);
            resolve({ port, process: appProcess, workingDir: appConfig.workingDir });
          } else {
            this.portPool.delete(port);
            this.instances.delete(port);
            reject(new Error(`等待超时：端口 ${port} 未能启动`));
          }
        })
        .catch(error => {
          this.portPool.delete(port);
          this.instances.delete(port);
          reject(error);
        });
    });
  }

  /**
   * 关闭指定端口的应用实例
   * @param {number} port - 端口号
   * @returns {Promise<boolean>} 是否成功关闭
   */
  async closeAppInstance(port) {
    const instance = this.instances.get(port);
    if (!instance) {
      console.warn(`警告: 找不到端口 ${port} 的应用实例`);
      return false;
    }
    
    try {
      console.log(`正在关闭应用实例（端口: ${port}）...`);
      
      // 尝试优雅关闭
      if (instance.process && !instance.process.killed) {
        instance.process.kill('SIGTERM');
        
        // 等待进程退出
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            // 如果 3 秒后还没退出，强制杀死
            if (!instance.process.killed) {
              instance.process.kill('SIGKILL');
            }
            resolve();
          }, 3000);
          
          instance.process.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
      // 清理
      this.instances.delete(port);
      this.portPool.delete(port);
      
      console.log(`✓ 应用实例已关闭（端口: ${port}）`);
      return true;
    } catch (error) {
      console.error(`关闭应用实例失败（端口 ${port}）:`, error.message);
      // 即使出错也清理记录
      this.instances.delete(port);
      this.portPool.delete(port);
      return false;
    }
  }

  /**
   * 关闭所有应用实例
   * @returns {Promise<void>}
   */
  async closeAllInstances() {
    const ports = Array.from(this.instances.keys());
    console.log(`正在关闭所有应用实例（共 ${ports.length} 个）...`);
    
    await Promise.all(ports.map(port => this.closeAppInstance(port)));
    
    console.log('✓ 所有应用实例已关闭');
  }

  /**
   * 获取所有实例信息
   * @returns {Array<Object>} 实例信息数组
   */
  getAllInstances() {
    return Array.from(this.instances.values()).map(instance => ({
      port: instance.port,
      workingDir: instance.workingDir,
      startTime: instance.startTime,
      uptime: Date.now() - instance.startTime
    }));
  }

  /**
   * 检查实例是否存在
   * @param {number} port - 端口号
   * @returns {boolean}
   */
  hasInstance(port) {
    return this.instances.has(port);
  }

  /**
   * 检查指定的 workingDir 是否正在被使用
   * @param {string} workingDir - 工作目录路径
   * @returns {boolean} 如果该 workingDir 正在被使用返回 true
   */
  isWorkingDirInUse(workingDir) {
    for (const instance of this.instances.values()) {
      if (instance.workingDir === workingDir) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取使用指定 workingDir 的所有实例端口
   * @param {string} workingDir - 工作目录路径
   * @returns {Array<number>} 端口号数组
   */
  getPortsByWorkingDir(workingDir) {
    const ports = [];
    for (const [port, instance] of this.instances.entries()) {
      if (instance.workingDir === workingDir) {
        ports.push(port);
      }
    }
    return ports;
  }
}

// 导出单例
const appManager = new AppInstanceManager();

module.exports = {
  AppInstanceManager,
  appManager
};

