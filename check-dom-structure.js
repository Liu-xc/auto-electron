const WebSocket = require('ws');
const http = require('http');

async function checkDOMStructure() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
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

  const mainTarget = targets.find(target =>
    target.type === 'page' && target.url.includes('workbench')
  );

  const ws = new WebSocket(mainTarget.webSocketDebuggerUrl);

  let messageId = 1;
  const pendingCommands = new Map();

  function sendCommand(ws, method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      const message = { id, method, params };

      pendingCommands.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        pendingCommands.delete(id);
        reject(new Error(`Command ${method} timed out`));
      }, 10000);

      pendingCommands.get(id).timeout = timeout;
      ws.send(JSON.stringify(message));
    });
  }

  return new Promise((resolve, reject) => {
    ws.on('open', async () => {
      try {
        await sendCommand(ws, 'DOM.enable');
        await sendCommand(ws, 'Runtime.enable');

        const result = await sendCommand(ws, 'Runtime.evaluate', {
          expression: `(function() {
            const soloTitlebar = document.querySelector('#workbench\\\\.parts\\\\.soloTitlebar');
            if (soloTitlebar) {
              // Get the exact path
              const titlebarContainer = soloTitlebar.querySelector(':scope > div');
              const titlebarCenter = titlebarContainer ? titlebarContainer.querySelector(':scope > div.titlebar-center') : null;
              const actionToolbar = titlebarCenter ? titlebarCenter.querySelector(':scope > div.action-toolbar-container') : null;
              const soloModeTab = actionToolbar ? actionToolbar.querySelector(':scope > div.icube-solo-mode-tab') : null;

              return {
                soloTitlebar: !!soloTitlebar,
                titlebarContainer: !!titlebarContainer,
                titlebarCenter: !!titlebarCenter,
                actionToolbar: !!actionToolbar,
                soloModeTab: !!soloModeTab,
                soloModeTabChildren: soloModeTab ? Array.from(soloModeTab.children).map((child, index) => ({
                  index,
                  tagName: child.tagName,
                  className: child.className,
                  textContent: child.textContent.trim(),
                  isClickable: child.style.cursor !== 'default' || child.onclick || child.tabIndex >= 0
                })) : [],
                exactPath: '#workbench\\\\.parts\\\\.soloTitlebar > div > div.titlebar-center > div.action-toolbar-container > div.icube-solo-mode-tab'
              };
            }
            return { error: 'soloTitlebar not found' };
          })()`,
          returnByValue: true
        });

        console.log('DOM Structure:', JSON.stringify(result.result.result.value, null, 2));
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
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('error', reject);
  });
}

checkDOMStructure().catch(console.error);