const WebSocket = require('ws');
const http = require('http');

async function checkElements() {
  // Get targets
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

  if (!mainTarget) {
    throw new Error('VS Code workbench target not found');
  }

  console.log('Connecting to target:', mainTarget.title);
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

        // Check for titlebar elements
        const result = await sendCommand(ws, 'Runtime.evaluate', {
          expression: `(function() {
            const soloTitlebar = document.querySelector('#workbench\\\\.parts\\\\.soloTitlebar');
            if (soloTitlebar) {
              return {
                foundSoloTitlebar: true,
                soloTitlebarHTML: soloTitlebar.outerHTML.substring(0, 500) + '...',
                allTabs: Array.from(document.querySelectorAll('.icube-solo-mode-tab')).map((el, index) => ({
                  index,
                  tagName: el.tagName,
                  className: el.className,
                  textContent: el.textContent.trim(),
                  innerHTML: el.innerHTML.substring(0, 200)
                })),
                titleBarCenter: document.querySelector('.titlebar-center') ? {
                  found: true,
                  children: Array.from(document.querySelector('.titlebar-center').children).map(child => ({
                    tagName: child.tagName,
                    className: child.className,
                    textContent: child.textContent.trim()
                  }))
                } : { found: false }
              };
            } else {
              return {
                foundSoloTitlebar: false,
                allSoloElements: Array.from(document.querySelectorAll('[id*="solo"], [class*="solo"]')).map(el => ({
                  tagName: el.tagName,
                  id: el.id,
                  className: el.className,
                  textContent: el.textContent.trim()
                }))
              };
            }
          })()`,
          returnByValue: true
        });

        console.log('Element analysis:', JSON.stringify(result.result.result.value, null, 2));
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

checkElements().catch(console.error);