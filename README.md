# Auto Electron

自动化 Electron 应用的脚本工具集。

## 项目结构

```
auto-electron/
├── src/                    # 源代码目录
│   ├── core/              # 核心模块
│   │   ├── browser.js     # 浏览器连接管理
│   │   ├── operations.js  # 原子操作函数
│   │   ├── test-case.js   # 测试用例执行逻辑
│   │   ├── app-manager.js # 应用实例管理器
│   │   ├── clipboard.js   # 剪贴板工具
│   │   └── utils.js       # 工具函数（配置加载、端口检查、应用启动等）
│   ├── scripts/           # 测试脚本目录
│   │   └── automate-chat.js  # 聊天自动化脚本
│   └── run.js             # 统一脚本运行器
├── config/                # 配置文件目录
│   ├── config.json        # 应用配置（端口、超时、延迟等）
│   ├── elements.config.json  # 元素选择器配置
│   └── test-cases.json    # 测试用例配置（批量执行）
├── tools/                 # 工具脚本目录
│   ├── check-dom-structure.js
│   ├── check-elements.js
│   ├── click-element.js
│   └── click-element.py
├── package.json
└── README.md
```

## 使用方法

### 脚本执行方式

项目支持多个测试脚本，可以通过以下方式指定和执行：

#### 方式 1: 使用 npm scripts（推荐）

```bash
# 运行 automate-chat 脚本（单个用例）
npm run test:chat

# 运行 automate-chat 脚本（批量执行）
npm run test:chat:batch

# 使用统一运行器（需要指定脚本名）
npm run run <script-name> [options...]
```

#### 方式 2: 直接使用运行器

```bash
# 指定脚本名称（位置参数）
node src/run.js automate-chat

# 或使用 --script 参数
node src/run.js --script automate-chat

# 批量执行
node src/run.js automate-chat --batch

# 指定测试用例文件
node src/run.js automate-chat --test-cases /path/to/test-cases.json

# 并发执行
node src/run.js automate-chat --batch --concurrency 3

# 查看可用脚本
node src/run.js
```

### 命令行选项

所有脚本支持以下通用选项：

- `--batch`: 批量执行模式（从 `config/test-cases.json` 读取用例）
- `--test-cases <path>`: 指定测试用例文件路径
- `--concurrency <number>`: 并发执行数量（默认 2，最大 5）
- `--max-concurrency <number>`: 最大并发数量（默认 5）
- `--bot-reply-timeout <seconds>`: Bot 回复超时时间（秒，默认 180 秒/3 分钟）
- `--stop-on-error`: 遇到错误时停止执行
- `--log-dir <path>`: 指定日志保存目录
- `--keep-apps`: 执行完成后保持应用运行（不自动关闭）

### 示例

```bash
# 单个用例执行（默认并发 2）
npm run test:chat

# 批量执行，3个并发
node src/run.js automate-chat --batch --concurrency 3

# 指定测试用例文件，遇到错误停止
node src/run.js automate-chat --test-cases ./my-cases.json --stop-on-error

# 并发执行，保持应用运行，自定义 Bot 回复超时为 5 分钟
node src/run.js automate-chat --batch --concurrency 4 --bot-reply-timeout 300 --keep-apps

# 设置最大并发为 3（即使指定 concurrency 更大也会被限制）
node src/run.js automate-chat --batch --concurrency 10 --max-concurrency 3
```

### 测试用例格式

测试用例文件 (`config/test-cases.json`) 是一个 JSON 数组，每个用例包含以下字段：

```json
[
  {
    "name": "用例名称（可选）",
    "workingDir": "/path/to/working/directory（可选，覆盖默认配置）",
    "inputText": "要输入的文本（可选，覆盖默认配置）"
  }
]
```

**字段说明：**
- `name`: 用例名称，用于日志输出（可选）
- `workingDir`: 启动应用的工作目录（可选，如果不提供则使用 `config.json` 中的默认值）
- `inputText`: 要输入到对话框的文本（可选，如果不提供则使用 `config.json` 中的默认值）
- `port`: 指定端口号（可选，用于并发执行时指定特定端口）
- `botReplyTimeout`: Bot 回复超时时间（毫秒，可选，如果不提供则使用 `config.json` 中的默认值 180000，即 3 分钟）

**示例：**

```json
[
  {
    "name": "用例1 - 项目A",
    "workingDir": "/Users/leo/Documents/project-a",
    "inputText": "测试消息 1"
  },
  {
    "name": "用例2 - 项目B",
    "workingDir": "/Users/leo/Documents/project-b",
    "inputText": "测试消息 2"
  },
  {
    "name": "用例3 - 使用默认配置",
    "inputText": "自定义文本"
  },
  {
    "name": "用例4 - 自定义超时时间",
    "workingDir": "/Users/leo/Documents/project-a",
    "inputText": "测试消息",
    "botReplyTimeout": 240000
  }
]
```

## 模块说明

### 核心模块 (`src/core/`)

- **browser.js**: 浏览器连接管理
- **operations.js**: 原子操作函数（点击、输入、等待等）
- **test-case.js**: 测试用例执行逻辑（单个用例执行、批量执行）
- **utils.js**: 工具函数（配置加载、端口检查、应用启动、测试用例加载）

### 配置文件 (`config/`)

- **config.json**: 应用配置
  - 应用路径、默认工作目录
  - CDP 端口配置
  - 超时和延迟设置
  - Transform 检查配置
  - 默认输入文本

- **elements.config.json**: 页面元素选择器配置

- **test-cases.json**: 测试用例配置（批量执行时使用）
  - 每个用例可以指定不同的工作目录和输入文本
  - 用例中的配置会覆盖 `config.json` 中的默认值

### 工具脚本 (`tools/`)

用于调试和检查页面元素的辅助工具。

## 扩展开发

### 创建新的自动化脚本

在 `src/scripts/` 目录下创建新脚本，导入核心模块：

```javascript
const { loadConfig, findElement } = require('../core/utils');
const { connectToBrowser } = require('../core/browser');
const { clickElement, fillInput } = require('../core/operations');

async function myAutomation() {
  const { config, elementsConfig } = loadConfig();
  const { browser, page } = await connectToBrowser(config.cdp.port);
  
  // 使用原子操作组装你的自动化流程
  const input = findElement(elementsConfig, 'NewTaskMessageInput');
  await clickElement(page, input.selector, 'Input');
  await fillInput(page, input.selector, '文本', 'Input');
  
  await browser.close();
}
```

### 创建新的测试脚本

在 `src/scripts/` 目录下创建新脚本，必须导出 `execute` 函数：

```javascript
// src/scripts/my-test.js
const { loadConfig, loadTestCases } = require('../core/utils');
const { executeTestCase, executeTestCases } = require('../core/test-case');

/**
 * 脚本主执行函数（统一接口）
 * @param {Object} options - 执行选项
 */
async function execute(options = {}) {
  const { config, elementsConfig } = loadConfig();
  
  // 你的测试逻辑
  if (options.batch) {
    // 批量执行
    const testCases = loadTestCases(options.testCasesPath);
    await executeTestCases(testCases, config, elementsConfig, options);
  } else {
    // 单个用例执行
    const testCase = {
      name: '我的用例',
      workingDir: config.app.workingDir,
      inputText: config.input.defaultText
    };
    await executeTestCase(testCase, config, elementsConfig, options);
  }
}

module.exports = {
  execute
};
```

创建后即可通过运行器执行：

```bash
node src/run.js my-test --batch
npm run run my-test --batch
```

## 配置说明

所有可配置项都在 `config/config.json` 中，包括：

- 应用启动配置
- CDP 端口设置
- 超时时间
- 操作延迟
- Transform 检查值
- 默认输入文本

修改配置后无需修改代码即可调整行为。

