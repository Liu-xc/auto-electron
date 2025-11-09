// ==================== 原子操作函数 ====================

// 等待元素出现
async function waitForElement(page, selector, timeout, elementName) {
  console.log(`等待元素: ${elementName || selector}...`);
  await page.waitForSelector(selector, { timeout });
  console.log(`✓ 元素已出现: ${elementName || selector}`);
}

// 点击元素
async function clickElement(page, selector, elementName, options = {}) {
  const { timeout = 10000, waitAfter = 2000, adjustSelector = true } = options;
  
  console.log(`点击元素: ${elementName || selector}...`);
  await waitForElement(page, selector, timeout, elementName);
  
  // 如果选择器指向 span，点击其父级 button
  const clickSelector = adjustSelector && selector.endsWith(' > span') 
    ? selector.replace(' > span', '')
    : selector;
  
  await page.click(clickSelector);
  console.log(`✓ 已点击: ${elementName || selector}`);
  
  if (waitAfter > 0) {
    await page.waitForTimeout(waitAfter);
  }
}

// 双击元素
async function doubleClickElement(page, selector, elementName, options = {}) {
  const { timeout = 10000, waitAfter = 2000 } = options;
  
  console.log(`双击元素: ${elementName || selector}...`);
  await waitForElement(page, selector, timeout, elementName);
  await page.dblclick(selector);
  console.log(`✓ 已双击: ${elementName || selector}`);
  
  if (waitAfter > 0) {
    await page.waitForTimeout(waitAfter);
  }
}

// 输入文本
async function fillInput(page, selector, text, elementName, options = {}) {
  const { timeout = 10000, waitAfter = 2000 } = options;
  
  console.log(`输入文本到: ${elementName || selector}...`);
  await waitForElement(page, selector, timeout, elementName);
  await page.fill(selector, text);
  console.log(`✓ 已输入文本: ${text}`);
  
  if (waitAfter > 0) {
    await page.waitForTimeout(waitAfter);
  }
}

// 检查元素的 transform 样式
async function checkTransform(page, selector, expectedValue, elementName) {
  console.log(`检查 transform: ${elementName || selector}...`);
  
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.waitForTimeout(2000); // 等待样式稳定
  
  const transform = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    const style = window.getComputedStyle(element);
    return style.transform;
  }, selector);
  
  console.log(`${elementName || selector} transform: ${transform}`);
  
  // 检查 transform 是否匹配期望值
  let matches = false;
  if (transform) {
    // 检查 translate(-20px) 或 translateX(-20px)
    if (transform.includes(`translate(${expectedValue}px)`) || 
        transform.includes(`translateX(${expectedValue}px)`)) {
      matches = true;
    }
    // 检查 matrix 格式（包括 matrix 和 matrix3d）
    else if (transform.startsWith('matrix')) {
      // 匹配 matrix( 或 matrix3d(
      const matrixMatch = transform.match(/matrix3?d?\(([^)]+)\)/);
      if (matrixMatch) {
        const values = matrixMatch[1].split(',').map(v => v.trim());
        const isMatrix3d = transform.startsWith('matrix3d');
        
        if (isMatrix3d) {
          // matrix3d(a, b, c, d, e, f, g, h, i, j, k, l, tx, ty, tz, tw) - tx 是第 13 个参数（索引 12）
          if (values.length >= 13 && parseFloat(values[12]) === expectedValue) {
            matches = true;
          }
        } else {
          // matrix(a, b, c, d, tx, ty) - tx 是第五个参数（索引 4）
          if (values.length >= 5 && parseFloat(values[4]) === expectedValue) {
            matches = true;
          }
        }
      }
    }
  }
  
  return { matches, transform };
}

// 条件点击：根据 transform 检查结果决定是否点击
async function conditionalClickByTransform(
  page, 
  checkSelector, 
  clickSelector, 
  expectedTransformValue,
  checkElementName,
  clickElementName,
  options = {}
) {
  const { timeout = 5000, waitAfter = 2000 } = options;
  
  try {
    const { matches, transform } = await checkTransform(
      page, 
      checkSelector, 
      expectedTransformValue,
      checkElementName
    );
    
    if (matches) {
      console.log(`检测到匹配的 transform，点击 ${clickElementName}...`);
      await clickElement(page, clickSelector, clickElementName, { 
        timeout, 
        waitAfter: 0,
        adjustSelector: false 
      });
      if (waitAfter > 0) {
        await page.waitForTimeout(waitAfter);
      }
      return true;
    } else {
      console.log(`⚠ transform 不匹配，跳过点击 ${clickElementName}`);
      if (waitAfter > 0) {
        await page.waitForTimeout(waitAfter);
      }
      return false;
    }
  } catch (error) {
    console.log(`⚠ ${checkElementName} 或 ${clickElementName} 未找到，跳过`);
    if (waitAfter > 0) {
      await page.waitForTimeout(waitAfter);
    }
    return false;
  }
}

module.exports = {
  waitForElement,
  clickElement,
  doubleClickElement,
  fillInput,
  checkTransform,
  conditionalClickByTransform
};

