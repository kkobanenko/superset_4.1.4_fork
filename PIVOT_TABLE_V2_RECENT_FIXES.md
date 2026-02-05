<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements.  See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

## Ошибки и изменения, связанные с Pivot Table V2 (последние ~сутки)

### 1. Проблемы с доступом к дашборду и контекстом пользователя

- **Симптом**: при открытии дашборда возникали ошибки уровня backend, связанные с тем, что `g.user` отсутствовал в контексте.
- **Исправления**:
  - В `superset/utils/core.py` и `superset/security/manager.py` добавлены проверки `hasattr(g, "user")` и `g.user is not None` перед использованием пользователя.
  - В `superset/dashboards/filters.py` скорректирована логика построения `owner_ids_query`, чтобы корректно работать без жёсткой зависимости от `g.user`.

### 2. Ошибка `NoSuchModuleError` (ClickHouse и другие драйверы)

- **Симптом**: при загрузке некоторых дашбордов backend падал с `sqlalchemy.exc.NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:clickhousedb.connect`.
- **Причина**: dev‑образ Superset не содержал необходимые драйверы БД.
- **Исправления**:
  - В `docker/docker-compose.dev.yml` и `docker/Dockerfile-superset-dev` реализована двухшаговая схема:
    - базовый образ `superset_dev_base` собирается из текущего проекта (`Dockerfile`, target `dev`);
    - поверх него в `superset_dev` доустанавливаются нужные драйверы (ClickHouse, MSSQL, `psycopg2`) без использования образов из GitLab.

### 3. Проблемы с автоматическим тестированием через Playwright/MCP

- **Симптом**: нестабильная авторизация и навигация (тайм‑ауты 30000 ms, ошибки `Invalid params`) при попытке логина и открытия дашбордов через Playwright‑MCP.
- **Исправления / изменения подхода**:
  - Отказались от «магических» форм (`browser_fill_form`) и перешли к более явным шагам (раздельный `type`/`click` с использованием ссылок из snapshot).
  - Для интерактивных проверок UI стали опираться на `cursor-browser-extension` / `user-playwright` с явной навигацией и ожиданиями вместо скрытых хелперов.

### 4. Настройки subtotal в Pivot Table V2 не появлялись в UI

- **Симптом**: новые поля `Show subtotal`, `Subtotal label`, `Subtotal number format`, `Subtotal font color`, `Subtotal background color` были реализованы в коде плагина, но не отображались в разделе `Customize → Field Formatting Settings`.
- **Основные причины**:
  - Первая версия реализации добавляла контролы в вспомогательную функцию, которая фактически не использовалась реальным `controlPanel` (динамическая генерация секции `Field Formatting Settings` происходит в `generateFieldControls`).
  - После исправления места вставки контролов плагин `@superset-ui/plugin-chart-pivot-table-v2` не был пересобран, а Superset продолжал использовать старые собранные артефакты из `lib/`/`esm/` и `superset/static/assets`.
- **Исправления**:
  - Перенесли новые subtotal‑контролы в активную функцию `generateFieldControls` в `controlPanel.tsx`, рядом с уже рабочими полями вроде `Max width (px)`.
  - Обновили `formDataOverrides` в `controlPanel.tsx`, чтобы:
    - при загрузке чарта восстанавливать `field_formatting_field{i}_subtotal*` из `fieldGroupingSettings`;
    - при очистке неиспользуемых слотов обнулять соответствующие временные ключи.
  - В `transformProps.ts` добавили сборку и нормализацию `subtotalShow`, `subtotalLabel`, `subtotalAggregation` и `subtotalValueFormat` (valueFormat, fontColor, backgroundColor) из временных контролов по той же схеме, что и для `maxWidth` и других полевых настроек.
  - Выполнили полную пересборку:
    - `npm run plugins:build` (в Superset‑frontend) для всех пакетов, включая `@superset-ui/plugin-chart-pivot-table-v2`;
    - `npm run build` для обновления production‑assets в `superset/static/assets`.

### 5. Поведение subtotal и приоритет глобальных/полевых настроек

- **Симптом**: даже после появления контролов требовалось скорректировать приоритеты применения настроек subtotal («общие настройки таблицы» против «настроек конкретного поля»).
- **Текущий подход**:
  - В `types.ts` и `transformProps.ts` введено поле `subtotalShow` с тремя значениями:
    - `'show'` — принудительно показывать подытоги для данного поля;
    - `'no_show'` — принудительно скрывать подытоги для данного поля;
    - `'general_setting'` — использовать глобальные настройки таблицы (fallback).
  - В `TableRenderers.jsx` при выборе того, показывать ли subtotal и как его форматировать, используется стратегия «большего уточнения»:
    - сначала смотрим на настройки конкретного поля (`subtotalShow`, `subtotalLabel`, `subtotalValueFormat`);
    - если поле в состоянии `'general_setting'`, опираемся на глобальные параметры из блока `Data → Options`.

Эта сводка предназначена как краткий контекст по уже исправленным проблемам вокруг Pivot Table V2 и dev‑окружения, чтобы в дальнейшем опираться на неё при анализе новых симптомов.

