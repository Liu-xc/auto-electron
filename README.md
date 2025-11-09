# Auto Electron

自动化 Electron 应用的脚本工具集。

## 项目结构

```
auto-electron/
├── src/                    # 源代码目录
│   ├── core/              # 核心模块
│   │   ├── browser.js     # 浏览器连接管理
│   │   ├── operations.js  # 原子操作函数
│   │   └── utils.js       # 工具函数（配置加载、端口检查、应用启动等）
│   └── scripts/           # 自动化脚本
│       └── automate-chat.js  # 主自动化脚本
├── config/                # 配置文件目录
│   ├── config.json        # 应用配置（端口、超时、延迟等）
│   └── elements.config.json  # 元素选择器配置
├── tools/                 # 工具脚本目录
│   ├── check-dom-structure.js
│   ├── check-elements.js
│   ├── click-element.js
│   └── click-element.py
├── package.json
└── README.md
```

## 使用方法

### 运行自动化脚本

```bash
npm run automate
```

或直接运行：

```bash
node src/scripts/automate-chat.js
```

## 模块说明

### 核心模块 (`src/core/`)

- **browser.js**: 浏览器连接管理
- **operations.js**: 原子操作函数（点击、输入、等待等）
- **utils.js**: 工具函数（配置加载、端口检查、应用启动）

### 配置文件 (`config/`)

- **config.json**: 应用配置
  - 应用路径、工作目录
  - CDP 端口配置
  - 超时和延迟设置
  - Transform 检查配置
  - 默认输入文本

- **elements.config.json**: 页面元素选择器配置

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

## 配置说明

所有可配置项都在 `config/config.json` 中，包括：

- 应用启动配置
- CDP 端口设置
- 超时时间
- 操作延迟
- Transform 检查值
- 默认输入文本

修改配置后无需修改代码即可调整行为。

