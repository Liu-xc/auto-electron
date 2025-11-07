#!/usr/bin/env python3
import asyncio
import json
import websockets
import requests

async def click_element_via_cdp():
    # Get the WebSocket URL for the main VS Code page
    response = requests.get('http://localhost:9222/json')
    targets = response.json()

    # Find the main VS Code workbench
    main_target = None
    for target in targets:
        if target.get('type') == 'page' and 'workbench' in target.get('url', ''):
            main_target = target
            break

    if not main_target:
        print("Main VS Code workbench target not found")
        return

    ws_url = main_target['webSocketDebuggerUrl']
    print(f"Connecting to: {ws_url}")

    async with websockets.connect(ws_url, extra_headers={"Origin": "localhost"}) as websocket:
        # Enable DOM and Runtime
        await send_command(websocket, 'DOM.enable')
        await send_command(websocket, 'Runtime.enable')

        # Execute JavaScript to click the element
        result = await send_command(websocket, 'Runtime.evaluate', {
            'expression': """
                const element = document.querySelector('#workbench\\.parts\\.soloTitlebar > div > div.titlebar-center > div > div.icube-solo-mode-tab > div:nth-child(3)');
                if (element) {
                    element.click();
                    return 'Element clicked successfully';
                } else {
                    return 'Element not found';
                }
            """,
            'awaitPromise': True,
            'returnByValue': True
        })

        print(f"Result: {result.get('result', {}).get('value', 'Unknown result')}")

async def send_command(websocket, method, params=None):
    """Send a command to the CDP WebSocket"""
    if params is None:
        params = {}

    command = {
        'id': 1,
        'method': method,
        'params': params
    }

    await websocket.send(json.dumps(command))
    response = await websocket.recv()
    return json.loads(response)

if __name__ == '__main__':
    asyncio.run(click_element_via_cdp())