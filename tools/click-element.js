const WebSocket = require('ws');
const http = require('http');
const { getCDPPort } = require('./utils');

async function clickElementViaCDP() {
  const port = getCDPPort();
  console.log(`使用 CDP 端口: ${port}`);
  
  // First get the list of targets
  const targets = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });

  // Find the main VS Code workbench
  const mainTarget = targets.find(target =>
    target.type === 'page' && target.url.includes('workbench')
  );

  if (!mainTarget) {
    throw new Error('VS Code workbench target not found');
  }

  console.log('Connecting to target:', mainTarget.title);

  const ws = new WebSocket(mainTarget.webSocketDebuggerUrl);

  return new Promise((resolve, reject) => {
    ws.on('open', async () => {
      try {
        // Enable DOM and Runtime
        await sendCommand(ws, 'DOM.enable');
        await sendCommand(ws, 'Runtime.enable');

        // Execute JavaScript to click the element
        const result = await sendCommand(ws, 'Runtime.evaluate', {
          expression: `(function() {
            // Try multiple approaches to find the browser tab
            let element = null;

            // Approach 1: Direct CSS selector
            element = document.querySelector('#workbench\\.parts\\.soloTitlebar > div > div.titlebar-center > div.action-toolbar-container > div.icube-solo-mode-tab > div:nth-child(3)');

            // Approach 2: Find by text content if approach 1 fails
            if (!element) {
              const allTabs = document.querySelectorAll('.icube-solo-mode-tab-item');
              for (let i = 0; i < allTabs.length; i++) {
                if (allTabs[i].textContent.trim() === '浏览器') {
                  element = allTabs[i];
                  break;
                }
              }
            }

            // Approach 3: Get the 3rd tab item directly (index 2)
            if (!element) {
              element = document.querySelector('.icube-solo-mode-tab-item:nth-child(3)');
            }

            if (element) {
              element.click();
              return 'Browser tab clicked successfully using ' + (element.textContent.trim() === '浏览器' ? 'text content' : 'nth-child selector');
            } else {
              return 'Element not found with any method';
            }
          })()`,
          awaitPromise: true,
          returnByValue: true
        });

        if (result.result && result.result.value) {
          console.log(result.result.value);
        } else if (result.error) {
          console.error('Script error:', result.error.message);
        } else {
          console.log('Result:', JSON.stringify(result, null, 2));
        }
        ws.close();
        resolve();

      } catch (error) {
        console.error('Error:', error);
        ws.close();
        reject(error);
      }
    });

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data);

        // Handle responses to commands
        if (response.id && pendingCommands.has(response.id)) {
          const { resolve, reject, timeout } = pendingCommands.get(response.id);
          clearTimeout(timeout);
          pendingCommands.delete(response.id);

          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        }
        // Ignore notifications (messages without id)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      reject(error);
    });
  });
}

let messageId = 1;
const pendingCommands = new Map();

function sendCommand(ws, method, params = {}, sessionId = null) {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const message = {
      id,
      method,
      params,
      ...(sessionId && { sessionId })
    };

    pendingCommands.set(id, { resolve, reject });

    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Command ${method} timed out`));
    }, 10000);

    // Store timeout for cleanup
    pendingCommands.get(id).timeout = timeout;

    ws.send(JSON.stringify(message));
  });
}

clickElementViaCDP().catch(console.error);