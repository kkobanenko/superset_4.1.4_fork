🎯 [GOAL]

Модифицировать Pivot Table v2 так, чтобы при наличии нескольких Metrics можно было настраивать параметры подытога (subtotal) отдельно для каждой метрики на уровне каждого поля группировки.

Требование UI:
В Customize → Field Formatting Settings → Field<n>:

Если Show subtotal для поля установлен в Show, то под ним должен появиться набор выпадающих блоков (по одному на каждую Metrics).

В каждом блоке по метрике должны быть:

чекбокс ShowSubtotal4Metrics (включить/выключить subtotal именно для этой метрики в рамках данного поля);

если чекбокс включён: настройки
Subtotal label, Subtotal aggregation, Subtotal number format, Subtotal font color, Subtotal background color для этой метрики.

Целевое поведение:

При включенном subtotal на поле — subtotal можно включать/выключать по метрикам.

Параметры subtotal (label/aggregation/format/colors) применяются к subtotal-ячейкам именно этой метрики.

Если для поля subtotal включён (Show), но все метрики отключены чекбоксами, итоговое поведение должно быть эквивалентно “subtotal не показывать для поля” (чтобы не было пустых строк/столбцов).

🧠 [PLAN] (Заполняет Архитектор)

Нужно расширить модель FieldGroupingSettings и связку controlPanel.tsx → transformProps.ts → TableRenderers.jsx, добавив metric-specific subtotal overrides.

Шаг 1: Зафиксировать текущую реализацию subtotal на поле (baseline)

Найти текущие ключи формы, связанные с subtotal на поле:

field_formatting_field{i}_subtotalShow

field_formatting_field{i}_subtotalLabel

field_formatting_field{i}_subtotalAggregation

field_formatting_field{i}_subtotalValueFormat (+ font/bg)

Найти места применения в рантайме:

superset-frontend/plugins/plugin-chart-pivot-table-v2/src/plugin/transformProps.ts — сборка fieldGroupingSettings

superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx — логика рендера subtotal

Выход: понимание: где именно читаются настройки subtotal и как они применяются к “значению метрики” в subtotal-ячейках.

Шаг 2: Спроектировать структуру хранения metric-specific subtotal настроек

В types.ts (интерфейс FieldGroupingSettings) добавить новое поле, например:

metricSubtotalSettings?: Record<string, MetricSubtotalSettings>

Ввести новый интерфейс:

export interface MetricSubtotalSettings {
  enabled?: boolean; // ShowSubtotal4Metrics
  subtotalLabel?: string;
  subtotalAggregation?: 'sum' | 'max' | 'min';
  subtotalValueFormat?: ValueCellFormatSettings; // number format + font/bg
}

Ключ Record<string, ...> должен быть стабильным идентификатором метрики, совпадающим с тем, что используете в UI/рендере:

предпочтительно getMetricLabel(metric) / metric.label (если такой helper уже используется в плагине для metric-specific formatting)

при необходимости: sanitize (замена пробелов/спецсимволов) только для ключей контролов, но не для отображаемого label.

Шаг 3: Доработать controlPanel (динамическая генерация контролов под каждую метрику)

В controlPanel.tsx в генерации Field Formatting Settings (внутри generateFieldControls):

Добавить для Field<n> блоки “Subtotal per metric” только если:

field_formatting_field{i}_subtotalShow === 'show'

Для каждой метрики создать collapsible/expandable block (по аналогии с уже существующими metric-specific блоками форматирования, если они есть):

Заголовок блока: имя метрики (verbose label).

Внутри блока добавить контролы с уникальными ключами вида:

field_formatting_field{i}_metric_{metricKey}_subtotalEnabled

field_formatting_field{i}_metric_{metricKey}_subtotalLabel

field_formatting_field{i}_metric_{metricKey}_subtotalAggregation

field_formatting_field{i}_metric_{metricKey}_subtotalValueFormat

field_formatting_field{i}_metric_{metricKey}_subtotalFontColor

field_formatting_field{i}_metric_{metricKey}_subtotalBackgroundColor

Реализовать зависимость видимости:

Label/Aggregation/Format/Colors показываются только если subtotalEnabled === true для данной метрики.

В formDataOverrides:

при загрузке чарта: распаковать fieldGroupingSettings[i].metricSubtotalSettings в временные ключи формы;

при сохранении/очистке слотов: корректно очищать временные ключи для удалённых Field-слотов (и, важно, для метрик).

Шаг 4: Обновить transformProps: сборка metricSubtotalSettings из временных контролов

В transformProps.ts:

При сборке fieldGroupingSettings для каждого Field<n>:

собрать metricSubtotalSettings из временных ключей по всем formData.metrics.

Нормализовать значения:

enabled по умолчанию: true (или undefined → трактовать как “включено”/“general”, выбрать стратегию и зафиксировать)

если чекбокс выключен — enabled=false, остальные поля можно не писать/обнулять.

Добавить защиту:

если subtotalShow !== 'show' → metricSubtotalSettings можно игнорировать (не отправлять в renderer), чтобы не плодить шум.

Шаг 5: Доработать TableRenderers.jsx: применение per-metric subtotal на рендере

В TableRenderers.jsx (или ближайшей утилите, где формируются subtotal values):

В точке, где решается:

показывать ли subtotal для поля

как форматировать значение subtotal

какую агрегацию использовать (sum/max/min)

Добавить ветвление по текущей метрике:

найти текущий metric key/label для ячейки

прочитать fieldSettings.metricSubtotalSettings[metricKey]

Логика показа:

если subtotalShow === 'show' и metricSubtotalSettings[metricKey].enabled === false → не показывать subtotal значение для этой метрики (и/или не учитывать эту метрику при отрисовке subtotal-строки/столбца).

если для поля все метрики enabled === false → subtotal для поля не отображать целиком (эквивалент no_show), чтобы избежать пустых subtotal-строк/столбцов.

Логика агрегации/формата/цветов:

если для метрики задан override — использовать его

иначе fallback:

сначала текущие field-level subtotal настройки (если они остаются как общий дефолт)

затем global table settings (как сейчас)

Subtotal label per metric:

найти текущее место, где применяется subtotalLabel

сделать его metric-aware: если метрика имеет subtotalLabel, использовать её в соответствующем месте отображения (там, где сейчас применяется общий field subtotal label).

Шаг 6: Тест-кейсы (ручные, обязательные)

Pivot с 2+ metrics, включить Show subtotal для одного Field:

метрика A: enabled=true, aggregation=sum, формат 0.0a, цвет/фон задать

метрика B: enabled=false

Проверка: subtotal появляется, для A — формат/цвет применён, для B — subtotal отсутствует (и нет мусора).

Для того же Field выключить enabled у всех метрик:

Проверка: subtotal строка/столбец исчезает полностью.

Проверить, что настройки сохраняются при:

сохранении чарта

открытии Explore заново (restored via formDataOverrides)

Проверить, что старые слайсы без metricSubtotalSettings продолжают работать (backward compatibility).

Шаг 7: Финализация

Выполнить сборку фронтенда (superset-frontend и superset-plugins), запустить контейнеры через docker-compose.dev.yml, проверить версию и провести Git-флоу в ветку dev СТРОГО согласно инструкциям в файле .cursor/rules/agent-executor.mdc 

Архитектор-для-командной-работы…

👷 [EXECUTION_LOG] (Заполняет Исполнитель)

Статус: ✅ Новая функциональность готова к коммиту и пушу; сборки и проверка окружения завершены.

Факты:
- `MetricSubtotalSettingsControl` обновлён для новой темы и токенов, `TableRenderers.jsx` ресурсами скрывает subtotal-значения для отключённых метрик, типы централизованы в `MetricSubtotalSettings.ts`.
- `VERSION` (0.0.117) наведён в соответствие с `docker/docker-compose.dev.yml`; выполнены `npm run build`, `npm run plugins:build` и `docker-compose -f docker/docker-compose.dev.yml up -d --build`.
- Проверка `docker-compose -f docker/docker-compose.dev.yml exec superset_dev printenv APP_VERSION` подтвердила `0.0.117`.

Что сделано:
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/plugin/components/MetricSubtotalSettingsControl.tsx`: световые токены темы применены к контролам.
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/plugin/transformProps.ts`: заполнение `metricSubtotalSettings` поддерживает новые контролы.
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/plugin/TableRenderers.jsx`: subtotal-ячейки реагируют на включённые/выключенные метрики.
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/types.ts`: добавлены новые интерфейсы и экспортированы из `MetricSubtotalSettings.ts`.
- `VERSION` и `docker/docker-compose.dev.yml`: синхронизированы на `0.0.117`.

Результат:
- Frontend и плагины собраны, Docker контейнеры запущены, APP_VERSION совпадает с версией проекта (0.0.117).

Git:
Ветка: feature/tune_subtotals_separately_for_every_metrics
Версия: 0.0.117
Коммиты: в процессе
