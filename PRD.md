# PRD: Pivot Table V2 и dev-окружение форка Superset 4.1.4

Документ фиксирует продуктовые требования и фактическую реализацию на ветке форка. Обновляйте статус при изменении поведения чарта или инфраструктуры.

---

## 1. Контекст

- **Чарт:** `@superset-ui/plugin-chart-pivot-table-v2` (Pivot Table V2).
- **Тестовый UI:** `http://localhost:18088` (Docker Compose `docker/docker-compose.dev.yml`).
- **Принцип:** обратная совместимость с существующими дашбордами и сохранённым `formData`; новые поля опциональны.

---

## 2. Требования (источник: 2026-04-01 / уточнения 2026-04-02)

### 2.1. Заголовок оси метрик (Data → Metrics header label)

**Статус: выполнено.**

К настройке названия метрики на оси (аналог «Metrics header label» / подпись измерения метрик) добавлены:

- цвет текста;
- размер шрифта;
- выравнивание (слева / центр / справа).

Реализация через `globalTableSettings` и рендер в `TableRenderers.jsx` (стили оси Metric).

### 2.2. Field Formatting → Field &lt;n&gt; → Alignment

**Статус: выполнено.**

- В блоке Customize → Field Formatting Settings для выбранного поля доступно выравнивание (left / center / right).
- Настройка применяется к заголовкам и значениям поля; заголовки отдельных метрик согласуются с alignment этого поля (в т.ч. `metricHeaderAlignment ?? alignment` где задано в коде).
- **Исправление бага 2026-04-02:** значение из временного контрола `field_formatting_field{i}_alignment` не попадало в эффективный `fieldGroupingSettings` в `transformProps.ts`; добавлена сборка этого ключа в `buildEffectiveFieldGroupingSettings` (цикл по слотам 0..9).

### 2.3. Number format → «Adaptive formatting, empty instead 0»

**Статус: выполнено.**

- В списке форматов **не дублируется** отдельным пунктом «Adaptive formatting» на кастомной константе: стандартный **SMART_NUMBER** (подпись «Adaptive formatting» в общих `y_axis_format` choices) остаётся единственным adaptive-режимом из Superset core.
- Добавлен один дополнительный вариант на сентинеле `ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0`: форматирование как у adaptive (через маппинг на `SMART_NUMBER` в `getNumberFormatter` / `CurrencyFormatter`), но в **ячейках значений** для `0`, `null`, `undefined` (и строковый `'0'` по текущей логике) выводится **пустая строка**; для **числовых заголовков** пустое отображение не применяется.
- **Исправление «Invalid format: ADAPTIVE_…»:** core не регистрирует произвольные строки; добавлены `resolveD3NumberFormat` / `isEmptyInsteadOfZeroFormat` в `types.ts` плагина и использование в `TableRenderers.jsx`, `PivotTableV2Chart.tsx`. Сохранённые слайсы с устаревшим `ADAPTIVE_FORMATTING` продолжают работать через тот же маппинг на `SMART_NUMBER`.

---

## 3. Сопутствующие исправления платформы

### 3.1. Белая страница после `npm run build`

**Проблема:** после пересборки фронтенда обновлялись имена webpack-chunk’ов и `manifest.json`, а процесс Flask мог отдавать устаревшие URL скриптов → 404 на `.js` → пустой SPA.

**Решение:**

- В `superset/extensions/__init__.py` класс `UIManifestProcessor` перечитывает `manifest.json` при изменении **mtime** файла (не только при `app.debug`).
- В `docker-compose.dev.yml` добавлен комментарий про restart при редких сбоях.
- Оперативно: `docker compose -f docker/docker-compose.dev.yml restart superset_dev`.

---

## 4. Версионирование форка

| Артефакт | Назначение |
| --------| ---------- |
| `VERSION` (корень) | Согласованная версия сборки форка для Docker `APP_VERSION` / `SUPERSET_VERSION`. |
| `plugin-chart-pivot-table-v2/package.json` | Версия npm-пакета плагина; поднимать при изменениях плагина. |
| `docker/superset_config_dev.py` | `VERSION_STRING` (fallback), синхронизировать с основной версией при необходимости. |

---

## 5. Сборка и проверка

1. `cd superset-frontend && npm run plugins:build && npm run build`
2. При необходимости: `docker compose -f docker/docker-compose.dev.yml restart superset_dev`
3. Проверка UI: Explore/дашборд на `:18088`, отсутствие `Invalid format` в ячейках, применение alignment и empty-instead-zero по полям.

---

## 6. История решений (кратко)

| Дата | Тема |
| ---- | ---- |
| 2026-04-02 | План: alignment в transformProps; маппинг adaptive-сентинелов; убрать дубль adaptive в control panel; manifest mtime; документация. |
