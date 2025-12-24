/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Интерактивный тест для проверки динамического изменения размера шрифта
// для totals/subtotals в Pivot Table V2.
//
// Тест:
// 1. Открывает Explore с чартом
// 2. Проверяет текущие стили заголовков Subtotal и Total
// 3. Изменяет размер шрифта через UI (20px для rows subtotal, 20px для columns total)
// 4. Нажимает "Update chart"
// 5. Проверяет, что стили действительно изменились

import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';

const EXPLORE_URL_PATH =
  '/explore/?form_data_key=V6X-7_ShOJ0&dashboard_page_id=hHaHWiAEVlxaz0jb-liMG&slice_id=48';

test('Pivot Table V2 динамически применяет изменения размера шрифта для totals/subtotals', async ({
  page,
}) => {
  // Логин
  const authPage = new AuthPage(page);
  await authPage.goto();
  await authPage.waitForLoginForm();
  await authPage.loginWithCredentials('admin', 'admin');
  await page.waitForTimeout(2000);

  // Открываем Explore
  await page.goto(EXPLORE_URL_PATH);
  await page.waitForSelector('table.pvtTable', { timeout: 20000 });

  // Функция для получения стилей заголовка по тексту
  async function getHeaderStyles(text: string) {
    const header = page
      .locator('th', { hasText: text })
      .first();
    
    if (!(await header.count())) {
      return null;
    }

    return await header.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
      };
    });
  }

  // Проверяем начальные стили
  console.log('Проверяю начальные стили...');
  const initialSubtotalStyles = await getHeaderStyles('Subtotal');
  const initialTotalStyles = await getHeaderStyles('Total (Per Metric)');
  
  console.log('Начальные стили Subtotal:', initialSubtotalStyles);
  console.log('Начальные стили Total:', initialTotalStyles);

  // Используем evaluate для поиска и изменения элементов напрямую
  // Это более надежно, чем поиск через селекторы Playwright
  await page.evaluate(() => {
    // Раскрываем секцию Options, если она закрыта
    const optionsButtons = Array.from(document.querySelectorAll('button'));
    const optionsBtn = optionsButtons.find(b => 
      b.textContent?.trim() === 'Options' || 
      b.textContent?.includes('Options')
    );
    if (optionsBtn) {
      const isExpanded = optionsBtn.getAttribute('aria-expanded') === 'true';
      if (!isExpanded) {
        (optionsBtn as HTMLElement).click();
      }
    }
  });
  await page.waitForTimeout(1000);

  // Убеждаемся, что чекбоксы включены
  await page.evaluate(() => {
    // Show rows subtotal
    const buttons = Array.from(document.querySelectorAll('button'));
    const rowsSubtotalBtn = buttons.find(b => 
      b.textContent?.includes('Show rows subtotal') || 
      b.textContent?.includes('Show rows subtotal')
    );
    if (rowsSubtotalBtn) {
      const container = rowsSubtotalBtn.closest('div, label, span');
      const checkbox = container?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox && !checkbox.checked) {
        checkbox.click();
      }
    }

    // Show columns total
    const columnsTotalBtn = buttons.find(b => 
      b.textContent?.includes('Show columns total') || 
      b.textContent?.includes('Show columns total')
    );
    if (columnsTotalBtn) {
      const container = columnsTotalBtn.closest('div, label, span');
      const checkbox = container?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox && !checkbox.checked) {
        checkbox.click();
      }
    }
  });
  await page.waitForTimeout(500);

  // Изменяем размер шрифта для rows subtotal на 20px
  const rowsSubtotalValue = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => 
      b.textContent?.includes('Rows subtotal font size') ||
      b.textContent?.includes('Rows subtotal font size (px)')
    );
    if (btn) {
      // Ищем input в родительском контейнере
      const container = btn.closest('div');
      const input = container?.querySelector('input[type="number"], spinbutton, input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.value = '20';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        return input.value;
      }
    }
    return null;
  });
  console.log('Rows subtotal font size установлен:', rowsSubtotalValue);
  await page.waitForTimeout(500);

  // Изменяем размер шрифта для columns total на 20px
  const columnsTotalValue = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => 
      b.textContent?.includes('Columns total font size') ||
      b.textContent?.includes('Columns total font size (px)')
    );
    if (btn) {
      const container = btn.closest('div');
      const input = container?.querySelector('input[type="number"], spinbutton, input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.value = '20';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        return input.value;
      }
    }
    return null;
  });
  console.log('Columns total font size установлен:', columnsTotalValue);
  await page.waitForTimeout(500);

  console.log('Изменены настройки размера шрифта на 20px');

  // Нажимаем "Update chart"
  const updateButton = page.locator('button', { hasText: 'Update chart' }).first();
  await updateButton.click();

  // Ждём обновления таблицы
  await page.waitForTimeout(3000);
  await page.waitForSelector('table.pvtTable', { timeout: 20000 });

  console.log('Таблица обновлена, проверяю новые стили...');

  // Проверяем новые стили
  const newSubtotalStyles = await getHeaderStyles('Subtotal');
  const newTotalStyles = await getHeaderStyles('Total (Per Metric)');

  console.log('Новые стили Subtotal:', newSubtotalStyles);
  console.log('Новые стили Total:', newTotalStyles);

  // Проверяем, что размер шрифта изменился
  if (initialSubtotalStyles) {
    const initialSize = parseFloat(initialSubtotalStyles.fontSize);
    const newSize = parseFloat(newSubtotalStyles?.fontSize || '0');
    
    console.log(`Subtotal: было ${initialSize}px, стало ${newSize}px`);
    
    // Если начальный размер был меньше 20px, проверяем, что стал 20px
    if (initialSize < 20) {
      expect(newSize).toBeGreaterThanOrEqual(20);
    }
  }

  if (initialTotalStyles) {
    const initialSize = parseFloat(initialTotalStyles.fontSize);
    const newSize = parseFloat(newTotalStyles?.fontSize || '0');
    
    console.log(`Total: было ${initialSize}px, стало ${newSize}px`);
    
    // Если начальный размер был меньше 20px, проверяем, что стал 20px
    if (initialSize < 20) {
      expect(newSize).toBeGreaterThanOrEqual(20);
    }
  }

  // Финальная проверка: размер должен быть 20px или больше
  if (newSubtotalStyles) {
    const fontSize = parseFloat(newSubtotalStyles.fontSize);
    expect(fontSize).toBeGreaterThanOrEqual(20);
  }

  if (newTotalStyles) {
    const fontSize = parseFloat(newTotalStyles.fontSize);
    expect(fontSize).toBeGreaterThanOrEqual(20);
  }
});

