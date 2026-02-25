# 🔄 Синхронизация Агентов

**[STATE]** `EXECUTOR_TURN`

---

## 🎯 [GOAL]

Добавить функционал динамического удаления блоков настроек в панели управления (Control Panel) плагина `Pivot Table V2`.

**Локация в UI:** Секция `Customize` -> `Field Formatting Settings` -> Блоки `Field <n>` (где n от 1 до 10).

**Требуемые изменения:**

1. **Обновление интерфейса (UI):** Интегрировать кнопку "Удалить" (иконка корзины или крестика из стандартной библиотеки иконок проекта) рядом с заголовком каждого активного блока `Field <n>`.
2. **Мутация состояния (State):** При клике на кнопку удаления объект конфигурации этого поля должен вычищаться из общего состояния настроек графика (`formData` / `column_config`).
3. **Сброс стилей (Рендер):** При применении изменений (Update chart) визуальное форматирование ячеек таблицы, связанное с удаленным полем, должно быть отменено.
4. **Переиндексация контролов:** Оставшиеся блоки `Field <n>` в панели управления должны автоматически сдвинуть свою нумерацию для заполнения пробела (например, если удален `Field 2`, то бывший `Field 3` должен занять его место и стать `Field 2`).

---

## 🧠 [PLAN] (Заполняет Архитектор)

Привет! Эта задача требует внимательной работы с React и состоянием компонентов. Выполняй каждый шаг последовательно и не спеши. Если что-то не получается — добавляй `console.log()` для отладки.

### Шаг 1: Подготовка и импорты

1. Открой файл конфигурации контролов для сводной таблицы: `superset-frontend/plugins/plugin-chart-pivot-table/src/plugin/controlPanel.tsx`.
2. Найди импорты в начале файла. Тебе понадобится иконка удаления. Добавь импорт иконки, если её там нет (в Superset обычно используется библиотека иконок: `import { Icons } from '@superset-ui/core';` или иконки из `@ant-design/icons`).
3. Найди массив конфигурации, где генерируются блоки секции "Field Formatting Settings" (обычно это цикл `for` от 1 до 10 или `Array.from({ length: 10 })`).

### Шаг 2: Реализация функции удаления и сдвига (Логика)

1. Выше места, где определяются контролы (или внутри компонента кастомного контрола, если он вынесен отдельно), создай функцию для удаления. Назови её, например, `handleRemoveField(indexToRemove, props)`.
2. Внутри этой функции:
* Извлеки текущие настройки из `props.mapStateToProps` или `props.actions` (зависит от того, как контрол получает `formData`). Тебе нужен объект `column_config` (или аналогичный, где хранятся данные полей 1-10).
* Сделай глубокую копию этого объекта: `const newConfig = { ...currentConfig };`. Нельзя изменять напрямую `currentConfig`!
* Напиши цикл `for` от `i = indexToRemove` до `9` (предпоследний элемент).
* Внутри цикла копируй данные из следующего поля в текущее: `newConfig[\`Field ${i}`] = newConfig[`Field ${i + 1}`];`(имена ключей посмотри в текущем коде — они могут отличаться, например`header1`, `header2` и т.д.).
* Очисти самое последнее (десятое) поле, чтобы оно не дублировало девятое: `delete newConfig['Field 10'];` (или присвой ему пустой объект/значения по умолчанию).
* Вызови экшен обновления состояния: `props.actions.setControlValue('column_config', newConfig);`.



### Шаг 3: Добавление UI элемента (Кнопки)

1. Найди место в коде, где формируется заголовок блока (label). Обычно там написано что-то вроде `label: t('Field %s', i)`.
2. Измени строку на React-компонент, чтобы добавить иконку. Например:
```tsx
label: (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span>{t('Field %s', i)}</span>
    <Icons.Trash 
      onClick={() => handleRemoveField(i, props)} 
      style={{ cursor: 'pointer', color: 'red' }} 
    />
  </div>
)

```


*Примечание:* Убедись, что иконка рендерится только если в этом `Field` уже выбрано какое-то поле (чтобы пустые блоки не имели корзины). Для этого можно добавить проверку вида `if (hasData) { ... }`.

### Шаг 4: Ручное тестирование

1. Запусти проект локально.
2. Открой дашборд, создай или отредактируй Pivot Table V2.
3. В панели "Customize" разверни "Field Formatting Settings".
4. Настрой цвета или другие параметры для Field 1, Field 2 и Field 3.
5. Нажми на иконку корзины в заголовке **Field 2**.
6. **Проверка 1:** Убедись, что настройки из Field 3 переехали в Field 2.
7. Нажми кнопку **Update Chart** (Обновить график) над таблицей.
8. **Проверка 2:** Посмотри на саму таблицу — визуальное оформление, которое было у старого Field 2, должно полностью исчезнуть.

### Шаг 5: Финализация сборки

1. Проверь код на отсутствие ошибок линтера и TypeScript (`npm run lint`, `npm run type`).
2. Удали все добавленные тобой `console.log`.
3. Выполнить сборку фронтенда (superset-frontend и superset-plugins), запустить контейнеры через docker-compose.dev.yml, проверить версию и провести Git-флоу в ветку dev СТРОГО согласно инструкциям в файле .cursor/rules/agent-executor.mdc.

---

Привет! Проблема с "воскрешением" (гидратацией) удаленного селектора — классический кейс рассинхронизации состояния в Explore-виде Superset.

Архитектурное решение (Ответ на запрос):
Единственным источником истины для выбранных значений в UI является Redux-состояние form_data (которое мутируется в exploreReducer). Объект controls — это гибрид конфигурации и кэша, а formDataOverrides используется для трансляции вложенных структур в плоские ключи перед рендером. Значение селектора визуально восстанавливается из-за того, что при отсутствии (или undefined) значения в form_data, пайплайн инициализации контролов делает fallback на устаревшее кэшированное значение из controls[name].value.

Для устранения блокера выполни следующие шаги:

Шаг 1: Полная зачистка (delete) ключей в Reducer
В exploreReducer.js, при операции удаления и сдвига слотов, для самого последнего освобождаемого слота (например, бывший Field 3) необходимо не просто присваивать null/undefined, а жестко удалять ключи с помощью оператора delete из объекта new_form_data.

JavaScript

// Пример зачистки последнего слота:
delete new_form_data[`field_formatting_field${lastIndex}_selector`];
delete new_form_data[`field_formatting_field${lastIndex}_remove`];
// И так для всех относящихся к слоту ключей
Шаг 2: Изоляция от кэша в mapStateToProps
В конфигурации динамического селектора в controlPanel.tsx (где генерируется сам контрол) нужно явно запретить fallback на controls.value, если поле было удалено или перемещено.
Обнови mapStateToProps для контрола селектора:

TypeScript

mapStateToProps: (explore, controlState, chart) => {
  // Получаем актуальный form_data из стейта
  const form_data = explore?.controls?.form_data || explore?.form_data || {};
  
  // Жестко берем значение из form_data.
  // Если ключа явно нет (поле удалено), мы форсируем пустое значение (null) 
  // и тем самым игнорируем устаревший controlState.value
  return {
    value: form_data.hasOwnProperty(controlState.name) ? form_data[controlState.name] : null,
  };
}
Шаг 3: Контроль formDataOverrides
Если в controlPanel.tsx используется хук formDataOverrides для работы с полями Field Formatting Settings, обеспечь перетирку устаревших данных. Если поле удалено из основного объекта fieldGroupingSettings, override-функция должна явно возвращать null для плоского ключа селектора (например, field_formatting_field3_selector: null), чтобы гарантированно обнулить стейт перед рендером.

Шаг 4: Валидация UI-компонента
После реализации изменений протестируй локально:

Заполни 3 поля в Field Formatting Settings.

Нажми кнопку/чекбокс Remove у Field 3.

Убедись, что слот полностью очистился: все контролы, включая сам селектор названия поля, стали полностью пустыми, и имя метрики не возвращается обратно.

Шаг 5: Сборка и финализация
Выполнить сборку фронтенда (superset-frontend и superset-plugins), запустить контейнеры через docker-compose.dev.yml, проверить версию и провести Git-флоу в ветку dev СТРОГО согласно инструкциям в файле .cursor/rules/agent-executor.mdc.


Ответ архитектора на вопрос по перерисовке таблицы: 
Привет! Отличный анализ проблемы и хорошая локализация блокера.

"Воскрешение" (гидратация) значения селектора в Explore-виде Superset при динамическом изменении контролов обычно происходит по двум взаимосвязанным причинам:

Поведение getControlsState: При отсутствии ключа в new_form_data (если ты сделал delete), система инициализации контролов откатывается (fallback) к значению из предыдущего объекта controls или подтягивает default из конфигурации.

React Reconciliation (Проблема с key): Компонент SelectControl под капотом может не демонтироваться, если его React key (обычно привязанный только к имени контрола, например field_formatting_field3_selector) не изменился. Он сохраняет локальное состояние (internal value), даже если пропсы обновились не до конца.

Для полного решения проблемы необходимо применить "жесткое" обнуление и форсировать перерисовку.

План действий для Исполнителя:

Явное обнуление (null), а не просто delete:
В функции/редьюсере, где происходит удаление и сдвиг (shift) параметров (когда ты зачищаешь бывший Field 3), не удаляй ключ селектора из form_data через delete. Вместо этого явно присвой ему null.

JavaScript

// Вместо delete new_form_data['field_formatting_field3_selector'];
new_form_data['field_formatting_field3_selector'] = null; 
Это создаст строгий override, предотвращающий fallback на старое состояние в getControlsState.

Синхронизация объекта controls (если мутируешь напрямую):
Если твоя логика обрабатывается на уровне Redux (exploreReducer), убедись, что обнуляется не только form_data, но и актуализируется сам объект controls для данного поля:

JavaScript

if (state.controls && state.controls['field_formatting_field3_selector']) {
    state.controls['field_formatting_field3_selector'].value = null;
}
Форсирование перерисовки (Force Re-mount) компонента Select:
В конфигурации панели контролов (controlPanel.tsx для Pivot Table V2), найди место, где объявляется конфигурация селектора поля (field_formatting_field<n>_selector). Попробуй динамически изменять key контрола или добавить в его mapStateToProps жесткую проверку, чтобы компонент сбрасывал свой внутренний стейт:

TypeScript

// В mapStateToProps селектора:
mapStateToProps: (explore, controlState) => {
  const form_data = explore?.controls?.form_data || explore?.form_data || {};
  // Жестко привязываем к form_data, чтобы исключить кэш:
  return {
    value: form_data[controlState.name] || null,
  };
}
Проверка formDataOverrides:
Если плагин использует механизм formDataOverrides (часто применяется в ECharts и таблицах для форматирования), убедись, что хук, формирующий эти overrides, также передает явный null для удаленного поля.

Выполнить сборку фронтенда (superset-frontend и superset-plugins), запустить контейнеры через docker-compose.dev.yml, проверить версию и провести Git-флоу в ветку dev СТРОГО согласно инструкциям в файле .cursor/rules/agent-executor.mdc.

## 👷 [EXECUTION_LOG] (Заполняет Исполнитель)

* **Статус**: Требуется архитектурный разбор (последняя итерация не устранила проблему мгновенного снятия стиля на таблице)
* **Изменено (актуально):**
  * `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/plugin/controlPanel.tsx`
    * Переведён remove-контрол на `CheckboxControl`.
    * Добавлен полный rerender всех selector/remove-слотов после изменений.
  * `superset-frontend/src/explore/reducers/exploreReducer.js`
    * Добавлена reducer-level логика compact/sanitize для `field_formatting_field<n>_{selector,remove}`.
    * Сдвиг теперь переносит весь слот `field_formatting_field<n>_*`, а не только selector.
    * Для pivot field-контролов отключён второй проход `formDataOnChange`, который перетирал reducer-результат.
    * Для remove-операции удаление выполняется строго по индексу кликнутого слота, чтобы исключить удаление “не того поля” из-за рассинхронизации имен.
    * Для pivot field-контролов `controls` пересчитываются через `getControlsState(...)` из актуального `new_form_data`.

  * `docker/superset_config_dev.py`
    * `VERSION_STRING` синхронизируется с текущей версией пересборки.
  * `docker/docker-compose.dev.yml`
    * `SUPERSET_VERSION` синхронизируется с текущей версией пересборки.

  * `VERSION`
    * Добавлен/используется как источник ожидаемой версии перед каждой пересборкой.

  * `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/plugin/controlPanel.tsx`
    * В `mapStateToProps` селектора источником истины для выбранных значений сделан `form_data` (с fallback в `controls`) для стабильного порядка и отсутствия swap между строками.
    * Исправлен кейс удаления последнего поля: если в `form_data` selector-ключ присутствует и очищен (`undefined/null`), это значение больше не подменяется устаревшим `controls.value`.
    * По рекомендации Архитектора fallback на `controls.value` для selector полностью убран: значение selector теперь жёстко берётся из `form_data` и при отсутствии ключа форсируется `null`.
    * В `formDataOverrides` добавлена явная очистка пустого слота: `field_formatting_field<n>_selector = null` и `field_formatting_field<n>_remove = false`.
    * В `formDataOverrides` добавлена принудительная санитизация `fieldGroupingSettings` строго по активным selector-слотам (`Field 1..10`) для исключения залипания удалённых стилей на таблице.

  * `superset-frontend/src/explore/reducers/exploreReducer.js`
    * Для освобождаемых слотов удалены присваивания `undefined` как псевдо-значения; остаются только реальные компактированные ключи.
    * Для remove-контрола после удаления выполняется `delete new_form_data[field_formatting_field<n>_remove]`.
    * Для pivot field-контролов (`selector/remove`) добавлен принудительный `triggerRender: true`, чтобы удаление/сдвиг сразу отражались на виде таблицы без ожидания дополнительного действия.
* **Ошибки**:
  * Локальный линт файла `controlPanel.tsx` продолжает падать на существующих в файле нарушениях (`no-plusplus`, `arrow-body-style`) вне добавленной бизнес-логики.
* **Проверки (актуально):**
  * `npm run type` — успешно (`tsc --noEmit`).
  * `npm run plugins:build -- --scope @superset-ui/plugin-chart-pivot-table-v2` — выполнено, изменения попали в `lib/esm`.
  * `docker compose -f docker/docker-compose.dev.yml build --no-cache superset_dev_base superset_dev` — выполнено.
  * `docker compose -f docker/docker-compose.dev.yml up -d` — выполнено.
  * `curl -sf http://localhost:18088/health` — успешно.
  * `docker compose ... exec superset_dev sh -lc 'printenv APP_VERSION || true; printenv SUPERSET_VERSION || true'` → соответствует текущему `VERSION`.
  * Введена обязательная сверка: `VERSION_FILE` vs `APP_VERSION` после запуска (`VERSION_MATCH=YES`).

* **Последний результат проверки от пользователя (неуспех):**
  * После удаления поля в `Field Formatting Settings` конфигурация в форме очищается (selector/параметры),
    но визуальные изменения в таблице не обновляются мгновенно.
  * Симптом повторяется даже после:
    * `triggerRender: true` для pivot selector/remove в reducer,
    * санитизации `fieldGroupingSettings` в `formDataOverrides` по активным selector-слотам,
    * принудительной очистки selector/remove значений пустых слотов.

* **Сводка последних попыток (уже сделано):**
  * `exploreReducer.js`
    * reducer-level compact/sanitize для `field_formatting_field<n>_{selector,remove}`;
    * перенос полного слота `field_formatting_field<n>_*` при сдвиге;
    * удаление ключей (`delete`) для освобождаемых слотов;
    * отключение второго прохода `formDataOnChange` для pivot field-контролов;
    * пересчёт `controls` через `getControlsState(...)` для pivot field-операций;
    * `triggerRender: true` для pivot field selector/remove.
  * `controlPanel.tsx`
    * selector `mapStateToProps` переведён на `form_data` как source of truth;
    * fallback на `controls.value` для selector убран;
    * в `formDataOverrides` добавлены:
      * явная очистка пустых слотов (`selector = null`, `remove = false`),
      * санитизация `fieldGroupingSettings` по активным selector-слотам.

* **Актуальный блокер для Архитектора:**
  * Нужно определить корректную точку в пайплайне Explore (reducer / formDataOverrides / buildQuery / transformProps / trigger query),
    которая гарантированно вызывает пересчёт и перерисовку таблицы после удаления field-formatting блока,
    без ручного сохранения/повторного открытия.
  * Вероятная зона: требуется не только `triggerRender`, но и принудительный `force query`/пересборка payload для pivot style state,
    либо нормализация в `transformProps` с invalidate кэша field formatting.

* **Текущий блокер / handoff Архитектору:**
  * **Repro (стабильно):**
    1. В `Field Formatting Settings` заполнены 3 поля.
    2. Клик по `Remove` у `Field 3`.
    3. Факт: у `Field 3` очищаются остальные параметры, но **selector (название поля) остаётся**.
  * **Ожидаемое поведение:** при удалении `Field 3` должны очищаться **все** параметры, включая selector (название), и слот должен стать полностью пустым.
  * **Что уже пробовали (без полного успеха):**
    * Reducer-level compact/sanitize для `field_formatting_field<n>_{selector,remove}`.
    * Перенос полного слота `field_formatting_field<n>_*` при сдвиге.
    * Отключение второго прохода `formDataOnChange` для pivot field-контролов.
    * Пересчёт `controls` через `getControlsState(...)` из актуального `new_form_data`.
    * Приоритет `form_data` в `mapStateToProps` селектора с `hasOwnProperty`-проверкой.
    * Удаление по индексу слота (вместо удаления по имени поля).
  * **Гипотеза причины:** в цепочке гидратации/инициализации dynamic controls (селектор `Field 3`) значение selector повторно подтягивается из одного из источников (`controls`/`fieldGroupingSettings`/`formDataOverrides`) после reducer-очистки, но до финального рендера.
  * **Запрос к Архитектору:** указать единственный источник истины и точку в пайплайне (reducer vs formDataOverrides vs control mapStateToProps), где нужно финализировать очистку selector для последнего удаляемого слота, чтобы значение не восстанавливалось в UI.

* **Новая итерация (после ответа Архитектора, в работе):**
  * Найдена вероятная корневая причина в `ExploreViewContainer.reRenderChart(...)`:
    * при `renderTrigger`-обновлениях используется merge `latestQueryFormData + changedControls`,
    * при удалении динамических ключей `field_formatting_field<n>_*` удалённые ключи не попадают в `changedControls` и продолжают жить в `latestQueryFormData`.
  * Внесён фикс в `superset-frontend/src/explore/components/ExploreViewContainer/index.jsx`:
    * если среди изменённых контролов есть `field_formatting_field<n>_(selector|remove)`, выполняется полная пересборка `newQueryFormData` из `getFormDataFromControls(props.controls)` (без merge с `latestQueryFormData`).
    * для остальных render-trigger контролов сохранено прежнее поведение partial merge.
  * Ожидаемый эффект: удалённые ключи не «залипают» в rawFormData, `transformProps` получает очищенное состояние, стили удалённого поля снимаются сразу.