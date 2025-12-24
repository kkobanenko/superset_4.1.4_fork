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

// Тест проверяет, что для Pivot Table V2 применяются сохранённые настройки
// размера шрифта:
// 1) для поля строки "БР" (per-field форматирование);
// 2) для строк/столбцов с итогами (глобальные настройки totals/subtotals).
//
// Важные моменты:
// - Логин через стандартную страницу логина (AuthPage).
// - Переход на Explore по сохранённому form_data_key/slice_id.
// - Ожидание рендера таблицы.
// - Проверка CSS font-size для заголовка поля "БР".

import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';

// URL из условия задачи. Мы используем только path+query, так как baseURL
// задаётся через PLAYWRIGHT_BASE_URL (например, http://localhost:18088).
const EXPLORE_URL_PATH =
  '/explore/?form_data_key=V6X-7_ShOJ0&dashboard_page_id=hHaHWiAEVlxaz0jb-liMG&slice_id=48';

test('Pivot Table V2 применяет per-field fontSize и стили totals/subtotals', async ({
  page,
}) => {
  // Логин под админом через существующую страницу авторизации.
  const authPage = new AuthPage(page);
  await authPage.goto();
  await authPage.waitForLoginForm();
  await authPage.loginWithCredentials('admin', 'general');

  // В разных окружениях после логина могут быть разные редиректы.
  // Чтобы не завязываться на конкретный URL, даём странице немного
  // времени на обработку логина и сразу переходим к Explore.
  await page.waitForTimeout(2000);

  // Открываем Explore по сохранённому URL.
  await page.goto(EXPLORE_URL_PATH);

  // Ждём, пока отрендерится сама сводная таблица.
  await page.waitForSelector('table.pvtTable', { timeout: 20000 });

  // Ищем заголовок поля строки "БР".
  // В TableRenderers заголовок для rowAttrs рендерится как <th className="pvtAxisLabel">.
  const headerCell = page
    .locator('th.pvtAxisLabel', { hasText: 'БР' })
    .first();

  await expect(headerCell).toBeVisible();

  // Читаем вычисленный размер шрифта через браузерный API.
  const fontSize = await headerCell.evaluate(element => {
    // Приводим к HTMLElement, чтобы TypeScript не ругался.
    const el = element as HTMLElement;
    return window.getComputedStyle(el).fontSize;
  });

  // Ожидаем, что размер шрифта соответствует сохранённой настройке для поля (50px).
  expect(fontSize).toBe('50px');

  // Дополнительно проверяем, что глобальные настройки итогов/подытогов
  // применяются к заголовкам totals/subtotals.
  //
  // Предполагается, что в Explore для:
  // - Rows total font size (px)
  // - Columns total font size (px)
  // задано заметно отличное значение (например, 30px),
  // чтобы легко отличить от обычных ячеек.

  // Заголовок итогов по строкам (Total по строкам, правая колонка заголовков).
  const rowTotalsHeader = page
    .locator('th.pvtTotalLabel', { hasText: 'Total' })
    .first();
  const rowTotalsFontSize = await rowTotalsHeader.evaluate(element => {
    const el = element as HTMLElement;
    return window.getComputedStyle(el).fontSize;
  });

  // Заголовок итогов по колонкам (Total в нижней строке).
  const colTotalsHeader = page
    .locator('th.pvtTotalLabel.pvtRowTotalLabel', { hasText: 'Total' })
    .first();
  const colTotalsFontSize = await colTotalsHeader.evaluate(element => {
    const el = element as HTMLElement;
    return window.getComputedStyle(el).fontSize;
  });

  // Здесь мы не фиксируем конкретное значение, а лишь проверяем, что
  // шрифты отличаются от стандартного размера (например, больше 16px),
  // что говорит о применении настроек.
  const rowTotalsSizeNum = parseFloat(rowTotalsFontSize);
  const colTotalsSizeNum = parseFloat(colTotalsFontSize);

  expect(rowTotalsSizeNum).toBeGreaterThan(16);
  expect(colTotalsSizeNum).toBeGreaterThan(16);
});


