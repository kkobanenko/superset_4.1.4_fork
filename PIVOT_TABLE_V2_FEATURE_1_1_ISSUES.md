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

# Проблемы и решения: Фича 1.1 - Скрытие колонок Subtotal для поля "Дата"

## Описание задачи

**Фича 1.1**: При установке для Field2: Дата (Column) параметра `"Show subtotal" = "No Show"` (при глобальной настройке `"Show columns subtotal" = True`) требуется:
- ✅ Скрыть колонку со значениями подытогов по колонке "Дата"
- ✅ Оставить строку с заголовками дат (в которой показываются значения "Дата", "Jan 1970", "Sep 2020", "Oct 2020", ...)

## Проблема 1: Неправильная логика определения subtotal колонок

### Симптомы
- Колонки "Subtotal" не исчезали при установке `"Show subtotal" = "No Show"` для поля "Дата"
- Строка с заголовками дат оставалась (это было правильно)
- Колонки с данными подытогов оставались видимыми (это было неправильно)

### Причина
Исходная логика определения subtotal колонок использовала сравнение длин:
```javascript
const isColSubtotalCol = colKey.length < colAttrs.length;
```

**Проблема**: В реальной структуре данных pivot table метрики включены в `colAttrs`:
- `colAttrs = ["Metric", "Дата", "Номер плана"]` (длина 3)
- `colKey = ["Sum(Продажи: Сумма без НДС)", 0, 0]` (длина 3)

Поэтому `isColSubtotalCol = 3 < 3 = false`, и код скрытия никогда не выполнялся!

### Диагностика
Добавлено логирование для понимания структуры данных:
```javascript
// ВРЕМЕННОЕ ПОЛНОЕ ЛОГИРОВАНИЕ ДЛЯ ДИАГНОСТИКИ СТРУКТУРЫ colKey
if (typeof console !== 'undefined' && console.log && colIndex === 0) {
  console.log('[FullColKeyDebug]', {
    colIndex,
    colKey: JSON.stringify(colKey),
    colKeyLength: colKey.length,
    colAttrs: JSON.stringify(colAttrs),
    colAttrsLength: colAttrs.length,
    isColSubtotalCol,
    rowKey: JSON.stringify(rowKey)
  });
}
```

**Результат логирования**:
```javascript
colAttrs: ["Metric","Дата","Номер плана"]
colKey: ["Sum(Продажи: Сумма без НДС)",0,0]
```

**Ключевое открытие**: Значение `0` в `colKey[1]` и `colKey[2]` является маркером subtotal для соответствующих атрибутов!

### Решение
Изменена логика определения subtotal колонок:
```javascript
// Проверяем, является ли колонка subtotal:
// Если в colKey есть 0 (начиная с индекса 1, после метрики), это subtotal
const isColSubtotalCol = colKey.slice(1).includes(0);

// Находим атрибут, для которого это subtotal (первый 0 после метрики)
const firstZeroIndex = isColSubtotalCol ? colKey.indexOf(0, 1) : -1;
const colSubtotalAttrName = firstZeroIndex >= 0 && firstZeroIndex < colAttrs.length
  ? colAttrs[firstZeroIndex]
  : null;
const colSubtotalSettings = colSubtotalAttrName
  ? this.getFieldSubtotalSettings(colSubtotalAttrName, false)
  : null;

// Скрываем колонку, если subtotalSettings.enabled = false
if (isColSubtotalCol && colSubtotalSettings && !colSubtotalSettings.enabled) {
  return null;
}
```

**Логика**:
1. Проверяем наличие `0` в `colKey` после метрики (индекс >= 1)
2. Находим индекс первого `0` - это позиция атрибута в `colAttrs`
3. Получаем `colSubtotalAttrName = colAttrs[firstZeroIndex]` (например, "Дата")
4. Проверяем настройки subtotal для этого атрибута
5. Если `enabled = false`, скрываем всю колонку (`return null`)

### Файлы изменений
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx` (строки ~2126-2140)

---

## Проблема 2: Кэширование старых JavaScript файлов в браузере

### Симптомы
- После пересборки frontend и перезапуска Docker контейнера браузер продолжал загружать старые JavaScript файлы
- Ошибка `ReferenceError: rowIndex is not defined` появлялась даже после исправления кода
- Консоль браузера показывала загрузку файла `1212179a946b1da6dbb0.chunk.js`, который не существовал в файловой системе

### Причина
**Кэширование на стороне браузера**: Браузер кэшировал старые JavaScript chunk файлы по их именам (contenthash). Даже после пересборки и получения новых файлов с другими именами, браузер продолжал использовать старые файлы из кэша.

**Дополнительные факторы**:
- Docker volume mount: `../superset/static/assets:/app/superset/static/assets:ro` монтирует локальные файлы в контейнер
- Если файлы не были перезаписаны корректно, контейнер мог использовать старые версии
- Браузер мог кэшировать файлы по URL, даже если они были обновлены на сервере

### Диагностика
1. **Проверка локальных файлов**:
   ```bash
   ls -la /home/kobanenkokn/Superset_4.1.4_fork/superset/static/assets/1212179a946b1da6dbb0.chunk.js
   # Результат: файл не существует
   ```

2. **Проверка в контейнере**:
   ```bash
   docker exec superset_dev ls -la /app/superset/static/assets/1212179a946b1da6dbb0.chunk.js
   # Результат: файл не существует
   ```

3. **Проверка консоли браузера**:
   - Браузер показывал загрузку `1212179a946b1da6dbb0.chunk.js:124:29679`
   - Ошибка `ReferenceError: rowIndex is not defined` указывала на старый код

4. **Проверка новых файлов**:
   ```bash
   ls -lt /home/kobanenkokn/Superset_4.1.4_fork/superset/static/assets/*.js | head -10
   # Результат: новые файлы с другими именами (например, 7bb087d4f55fcef711b6.chunk.js)
   ```

### Решение

#### Вариант 1: Принудительная перезагрузка с cache-busting параметром
```javascript
// В браузере: переход на URL с параметром для обхода кэша
http://localhost:18088/superset/dashboard/13/?cachebust=123456789
```

#### Вариант 2: Hard refresh браузера
- **Chrome/Edge**: `Ctrl+Shift+R` или `Ctrl+F5`
- **Firefox**: `Ctrl+Shift+R` или `Ctrl+F5`
- **Safari**: `Cmd+Shift+R`

#### Вариант 3: Очистка кэша браузера
- Открыть DevTools (F12)
- Правый клик на кнопке обновления
- Выбрать "Очистить кэш и жесткая перезагрузка"

#### Вариант 4: Использование инкогнито/приватного режима
- Открыть страницу в режиме инкогнито, где кэш не используется

#### Вариант 5: Проверка правильности сборки
```bash
# Убедиться, что frontend пересобран полностью
cd superset-frontend
npm run plugins:build
npm run build

# Проверить, что новые файлы созданы
ls -lt ../superset/static/assets/*.js | head -5

# Перезапустить контейнер для применения изменений
docker compose -f docker/docker-compose.dev.yml restart superset_dev
```

### Рекомендации для предотвращения проблемы

1. **Всегда использовать cache-busting при тестировании**:
   - Добавлять параметр `?refresh=timestamp` или `?cachebust=random` к URL
   - Использовать DevTools с опцией "Disable cache" (Network tab)

2. **Проверять хеши файлов**:
   - После сборки проверять, что новые chunk файлы имеют новые имена (contenthash)
   - Убедиться, что старые файлы удалены или перезаписаны

3. **Использовать DevTools для отладки**:
   - Network tab: проверить, какие файлы загружаются
   - Sources tab: проверить актуальный код в загруженных файлах
   - Console: проверить ошибки и логи

4. **В production**:
   - Использовать правильные HTTP заголовки для кэширования (`Cache-Control`, `ETag`)
   - Настроить CDN для правильной инвалидации кэша при обновлениях

### Файлы, связанные с проблемой
- `superset-frontend/webpack.config.js` - конфигурация сборки с contenthash
- `docker/docker-compose.dev.yml` - volume mounts для static assets
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx` - исходный код с ошибкой

---

## Проблема 3: Ошибка компиляции из-за неопределенной переменной

### Симптомы
- После добавления логирования появилась ошибка: `ReferenceError: rowIndex is not defined`
- Таблица не отображалась, показывалась ошибка "Data error"

### Причина
В коде логирования использовалась переменная `rowIndex`, которая не была определена в контексте `valueCells.map()`:
```javascript
// НЕПРАВИЛЬНО:
console.log('[FullColKeyDebug]', {
  rowIndex,  // ❌ rowIndex не определена в этом контексте!
  colIndex,
  // ...
});
```

### Решение
Удалена переменная `rowIndex` из логирования, так как она не нужна для диагностики структуры `colKey`:
```javascript
// ПРАВИЛЬНО:
console.log('[FullColKeyDebug]', {
  colIndex,
  colKey: JSON.stringify(colKey),
  colKeyLength: colKey.length,
  colAttrs: JSON.stringify(colAttrs),
  colAttrsLength: colAttrs.length,
  isColSubtotalCol,
  rowKey: JSON.stringify(rowKey)  // rowKey доступен и содержит нужную информацию
});
```

### Файлы изменений
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx` (строка ~2130)

---

## Проблема 4: Скрытие только data cells, но не заголовков колонок

### Симптомы
- После исправления логики определения subtotal колонок data cells (ячейки с данными) скрывались корректно
- Но заголовки колонок "Subtotal" все еще отображались в таблице
- Пользователь видел пустые колонки с заголовками

### Причина
Код скрытия был добавлен только в `valueCells.map()` (рендеринг ячеек данных), но не в `renderColHeaderRow()` (рендеринг заголовков колонок).

**Структура рендеринга pivot table**:
1. `renderColHeaderRow()` - рендерит заголовки колонок (включая "Subtotal")
2. `valueCells.map()` - рендерит ячейки данных для каждой строки
3. Если скрыть только ячейки данных, заголовки остаются видимыми

### Решение (в процессе реализации)

Необходимо также скрывать заголовки subtotal колонок в методе `renderColHeaderRow()`:

```javascript
renderColHeaderRow(attrName, attrIdx, pivotSettings) {
  // ... существующий код ...
  
  // Проверяем, нужно ли скрыть заголовок subtotal колонки
  const visibleColKeys = colKeys.filter(colKey => {
    const isColSubtotalCol = colKey.slice(1).includes(0);
    if (isColSubtotalCol) {
      const firstZeroIndex = colKey.indexOf(0, 1);
      const colSubtotalAttrName = firstZeroIndex >= 0 && firstZeroIndex < colAttrs.length
        ? colAttrs[firstZeroIndex]
        : null;
      const colSubtotalSettings = colSubtotalAttrName
        ? this.getFieldSubtotalSettings(colSubtotalAttrName, false)
        : null;
      
      // Скрываем заголовок, если subtotalSettings.enabled = false
      if (colSubtotalSettings && !colSubtotalSettings.enabled) {
        return false; // Исключаем из visibleColKeys
      }
    }
    return true;
  });
  
  // Используем visibleColKeys вместо colKeys для рендеринга
  // ...
}
```

**Альтернативный подход**: Фильтровать `visibleColKeys` в методе `render()` перед передачей в `renderColHeaderRow()` и `valueCells.map()`.

### Файлы для изменения
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx`
  - Метод `renderColHeaderRow()` (строка ~1475)
  - Метод `render()` (строка ~2648, где вызывается `renderColHeaderRow()`)

---

## Общие рекомендации по отладке

### 1. Использование логирования
- Добавлять временное логирование для понимания структуры данных
- Использовать уникальные префиксы для логов (`[FullColKeyDebug]`, `[ColSubtotalDebug]`)
- Удалять логирование после завершения отладки

### 2. Проверка структуры данных
- Всегда проверять реальную структуру данных через логирование
- Не полагаться на предположения о структуре данных
- Использовать `JSON.stringify()` для безопасного логирования объектов

### 3. Тестирование в браузере
- Всегда использовать cache-busting параметры при тестировании
- Проверять консоль браузера на наличие ошибок
- Использовать DevTools для проверки загруженных файлов
- Делать скриншоты для визуальной проверки результатов

### 4. Пересборка и развертывание
- Всегда выполнять полную пересборку: `npm run plugins:build && npm run build`
- Проверять, что новые файлы созданы с новыми именами (contenthash)
- Перезапускать Docker контейнер после сборки
- Проверять health endpoint перед тестированием

### 5. Работа с кэшем
- Использовать DevTools с опцией "Disable cache"
- Добавлять cache-busting параметры к URL
- Использовать hard refresh (`Ctrl+Shift+R`)
- В крайнем случае - использовать режим инкогнито

---

## Проблема 5: Неправильная фильтрация - скрываются колонки с конкретными значениями вместо subtotal колонок

### Симптомы
- При установке `"Show subtotal" = "No Show"` для поля "Дата" исчезают не те колонки, которые должны
- Вместо subtotal колонок для "Дата" исчезают колонки с метриками для конкретных значений других полей
- Например, если есть 2 значения поля "Номер плана" (0 и 16), исчезает колонка метрики для значения "Номер плана" = 16
- Строка с заголовками дат остается видимой (это правильно)

### Причина
Исходная логика фильтрации проверяла наличие `0` в `colKey.slice(1)` и использовала **первый** найденный `0` для определения атрибута:

```javascript
const isColSubtotalCol = colKey.slice(1).includes(0);
const firstZeroIndex = colKey.indexOf(0, 1);
const colSubtotalAttrName = colAttrs[firstZeroIndex];
```

**Проблема**: 
- Если `colKey = ["Sum(...)", "Jan 1970", 0]`, то `firstZeroIndex = 2`, что соответствует "Номер плана"
- Но если для "Номер плана" установлено "No Show", колонка скрывается, хотя это subtotal для "Номер плана", а не для "Дата"
- Более того, если `colKey = ["Sum(...)", "Jan 1970", 16]` (обычная колонка с конкретными значениями), логика не должна скрывать её, но из-за неправильной проверки она могла скрываться

**Ключевая проблема**: Логика проверяла только первый `0` в `colKey`, но не проверяла, для какого конкретно атрибута это subtotal. Нужно проверять каждый атрибут отдельно.

### Решение
Изменена логика фильтрации для проверки каждого атрибута отдельно:

```javascript
// Проверяем каждый атрибут после метрики (начиная с индекса 1)
for (let attrIdx = 1; attrIdx < colAttrs.length && attrIdx < colKey.length; attrIdx++) {
  // Если значение для этого атрибута равно 0, это subtotal для данного атрибута
  // ВАЖНО: Используем строгое сравнение === 0, чтобы не скрывать колонки с конкретными значениями
  const isSubtotalForThisAttr = colKey[attrIdx] === 0;
  
  if (isSubtotalForThisAttr) {
    const attrName = colAttrs[attrIdx];
    const colSubtotalSettings = attrName
      ? this.getFieldSubtotalSettings(attrName, false)
      : null;
    
    // Скрываем колонку, если для этого атрибута установлено "No Show"
    if (colSubtotalSettings && !colSubtotalSettings.enabled) {
      return false; // Скрываем эту колонку
    }
    // Если subtotal для этого атрибута разрешен, продолжаем проверку других атрибутов
  }
}
```

**Логика**:
1. Проверяем каждый атрибут отдельно (начиная с индекса 1, после метрики)
2. Если `colKey[attrIdx] === 0`, это subtotal для атрибута `colAttrs[attrIdx]`
3. Проверяем настройки subtotal именно для этого атрибута
4. Если для этого атрибута установлено "No Show", скрываем колонку
5. Если subtotal разрешен для этого атрибута, продолжаем проверку других атрибутов
6. Колонка скрывается только если она является subtotal для хотя бы одного атрибута с настройкой "No Show"

**Важно**: Используется строгое сравнение `=== 0`, чтобы не скрывать колонки с конкретными значениями (например, `colKey[2] = 16` не будет равно `0`).

### Файлы изменений
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx`
  - Метод `render()` - фильтрация `visibleColKeys` (строки ~2632-2680)
  - Метод `renderTableRow()` - проверка в `valueCells.map()` (строки ~2126-2143)

---

## Проблема 6: ReferenceError - colSubtotalSettings is not defined

### Симптомы
- Таблица не отображается, показывается ошибка: `ReferenceError: colSubtotalSettings is not defined`
- Ошибка возникает при рендеринге визуализации

### Причина
После рефакторинга логики фильтрации переменная `colSubtotalSettings` была определена только внутри цикла `for`:

```javascript
for (let attrIdx = 1; attrIdx < colAttrs.length && attrIdx < colKey.length; attrIdx++) {
  if (colKey[attrIdx] === 0) {
    const colSubtotalSettings = attrName  // ❌ Определена только внутри цикла
      ? this.getFieldSubtotalSettings(attrName, false)
      : null;
    // ...
  }
}
// colSubtotalSettings используется здесь, но не определена! ❌
const colSubtotalStyleRef = isColSubtotalCol && colSubtotalSettings?.enabled && ...
```

**Проблема**: Переменная `colSubtotalSettings` использовалась после выхода из цикла (для стилей и форматирования в строках ~2230, 2237, 2301, 2303), но была определена только внутри цикла, что вызывало `ReferenceError`.

### Решение
Определена переменная `colSubtotalSettings` вне цикла, чтобы она была доступна для использования дальше в коде:

```javascript
let colSubtotalSettings = null; // Определяем вне цикла для использования дальше в коде
let colSubtotalAttrName = null; // Сохраняем имя атрибута для subtotal

for (let attrIdx = 1; attrIdx < colAttrs.length && attrIdx < colKey.length; attrIdx++) {
  if (colKey[attrIdx] === 0) {
    const attrName = colAttrs[attrIdx];
    const attrSubtotalSettings = attrName
      ? this.getFieldSubtotalSettings(attrName, false)
      : null;
    
    // Сохраняем настройки первого найденного атрибута для использования в стилях и форматировании
    if (!colSubtotalSettings && attrSubtotalSettings) {
      colSubtotalSettings = attrSubtotalSettings;
      colSubtotalAttrName = attrName;
    }
    
    // Проверка на скрытие ячейки...
  }
}
// Теперь colSubtotalSettings доступна здесь ✅
const colSubtotalStyleRef = isColSubtotalCol && colSubtotalSettings?.enabled && ...
```

**Логика**:
1. Определяем `colSubtotalSettings` и `colSubtotalAttrName` вне цикла
2. В цикле используем локальную переменную `attrSubtotalSettings` для проверки каждого атрибута
3. Сохраняем настройки первого найденного атрибута в `colSubtotalSettings` для использования в стилях и форматировании
4. После цикла `colSubtotalSettings` доступна для использования в стилях и форматировании

### Файлы изменений
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx` (строки ~2126-2164)

---

## Статус реализации

- ✅ **Завершено**: Исправлена логика определения subtotal колонок
- ✅ **Завершено**: Добавлено скрытие data cells для subtotal колонок
- ✅ **Завершено**: Исправлена ошибка компиляции с `rowIndex`
- ✅ **Завершено**: Документирована проблема с кэшированием браузера
- ✅ **Завершено**: Реализация скрытия заголовков subtotal колонок через фильтрацию `visibleColKeys`
- ✅ **Завершено**: Исправлена логика фильтрации для проверки каждого атрибута отдельно
- ✅ **Завершено**: Исправлена ошибка `ReferenceError: colSubtotalSettings is not defined`
- ⏳ **Ожидается**: Полное тестирование фичи после применения исправлений

---

## Связанные файлы

- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx` - основная логика рендеринга
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/types.ts` - типы для subtotal настроек
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/plugin/controlPanel.tsx` - UI контролы
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/plugin/transformProps.ts` - трансформация props
- `docker/docker-compose.dev.yml` - конфигурация Docker для dev окружения
- `superset-frontend/webpack.config.js` - конфигурация сборки frontend

---

## Проблема 7: Фильтрация работает только для первого значения поля "Дата"

### Симптомы
- При установке `"Show subtotal" = "No Show"` для поля "Дата" колонка подытогов исчезала только для первого значения "Jan 1970"
- Колонки подытогов для остальных значений ("Sep 2020", "Oct 2020" и т.д.) оставались видимыми
- Логика фильтрации работала частично - только для первого блока колонок

### Причина
Исходная логика фильтрации проверяла наличие `0` в `colKey[attrIdx]` для определения subtotal колонок, но не учитывала структуру группировки колонок.

**Ключевое понимание**: Колонка подытогов для поля "Дата" - это **последняя колонка в блоке колонок**, расположенных под каждым уникальным значением поля "Дата". 

**Структура данных**:
- Для "Jan 1970": обычные колонки (для разных значений "Номер плана"), затем последняя - Subtotal для "Jan 1970"
- Для "Sep 2020": обычные колонки, затем последняя - Subtotal для "Sep 2020"
- И т.д.

**Проблема**: Простая проверка `colKey[attrIdx] === 0` не учитывала, является ли колонка последней в группе. Нужно было проверять, что следующая колонка имеет другое значение для предыдущих атрибутов (или это последняя колонка вообще).

### Решение
Реализована функция `isLastInGroup()` для определения последней колонки в группе:

```javascript
const isLastInGroup = (colKeyIndex, attrIdx) => {
  const currentColKey = visibleColKeys[colKeyIndex];
  
  // Если это не subtotal колонка для данного атрибута, то это не последняя в группе
  if (currentColKey[attrIdx] !== 0) {
    return false;
  }
  
  // Проверяем, что все предыдущие значения (до attrIdx) не равны 0
  // (т.е. это не subtotal для предыдущих атрибутов)
  for (let prevIdx = 1; prevIdx < attrIdx; prevIdx++) {
    if (currentColKey[prevIdx] === 0) {
      return false; // Это subtotal для предыдущего атрибута, не для текущего
    }
  }
  
  // Если это последняя колонка в списке, то она точно последняя в группе
  if (colKeyIndex === visibleColKeys.length - 1) {
    return true;
  }
  
  const nextColKey = visibleColKeys[colKeyIndex + 1];
  
  // Проверяем, что следующая колонка имеет ДРУГОЕ значение для текущего атрибута (attrIdx)
  // Это означает, что мы перешли к следующему значению поля "Дата"
  if (nextColKey[attrIdx] !== 0) {
    return true; // Следующая колонка имеет конкретное значение для "Дата", значит мы закончили группу
  }
  
  // Если следующая колонка тоже subtotal, проверяем предыдущие атрибуты
  for (let prevIdx = 1; prevIdx < attrIdx; prevIdx++) {
    if (currentColKey[prevIdx] !== nextColKey[prevIdx]) {
      return true; // Предыдущие значения отличаются, значит это разные группы
    }
  }
  
  return true; // Все предыдущие значения совпадают, но следующая колонка тоже subtotal - разные группы
};
```

**Логика**:
1. Проверяем, что текущая колонка является subtotal для конкретного атрибута (`colKey[attrIdx] === 0`)
2. Проверяем, что это не subtotal для предыдущих атрибутов
3. Если это последняя колонка в списке - она точно последняя в группе
4. Если следующая колонка имеет другое значение для текущего атрибута - мы закончили группу
5. Если следующая колонка тоже subtotal, проверяем предыдущие атрибуты для определения разных групп

**Использование**:
```javascript
// Находим индексы атрибутов, для которых нужно проверить настройки subtotal
const attrIndicesToCheck = [];
for (let attrIdx = 1; attrIdx < colAttrs.length; attrIdx++) {
  const attrName = colAttrs[attrIdx];
  if (attrName) {
    const subtotalSettings = this.getFieldSubtotalSettings(attrName, false);
    if (subtotalSettings && !subtotalSettings.enabled) {
      attrIndicesToCheck.push(attrIdx);
    }
  }
}

// Фильтруем колонки, используя isLastInGroup()
visibleColKeys = visibleColKeys.filter((colKey, colKeyIndex) => {
  for (const attrIdx of attrIndicesToCheck) {
    if (isLastInGroup(colKeyIndex, attrIdx)) {
      return false; // Скрываем эту колонку
    }
  }
  return true; // Показываем колонку
});
```

### Файлы изменений
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx`
  - Метод `render()` - добавлена функция `isLastInGroup()` и улучшена фильтрация `visibleColKeys` (строки ~2718-2820)

---

## Проблема 8: Настройки поля не находятся из-за несовпадения имен

### Симптомы
- В логах консоли: `subtotalShow: general_setting` (настройка не найдена)
- Фильтрация не выполняется: `No attributes with "No Show" setting, skipping filtering`
- Настройки поля не передаются в компонент, хотя они установлены в UI

### Причина
Метод `getFieldSettings()` использовал точное совпадение имени поля:
```javascript
getFieldSettings(attrName) {
  const fieldGroupingSettings = this.props.tableOptions?.fieldGroupingSettings || {};
  return fieldGroupingSettings[attrName] || {}; // ❌ Только точное совпадение
}
```

**Проблема**: 
- В `colAttrs` может быть просто "Дата"
- В `fieldGroupingSettings` ключ может быть "Field2: Дата" (с префиксом)
- Точное совпадение не работает, настройки не находятся

### Решение
Улучшен метод `getFieldSettings()` для поиска настроек по частичному совпадению имени:

```javascript
getFieldSettings(attrName) {
  const { tableOptions } = this.props;
  const fieldGroupingSettings = tableOptions?.fieldGroupingSettings || {};
  
  // Сначала пробуем точное совпадение
  if (fieldGroupingSettings[attrName]) {
    return fieldGroupingSettings[attrName];
  }
  
  // Если точное совпадение не найдено, ищем по частичному совпадению
  // (например, если attrName = "Дата", а ключ = "Field2: Дата")
  const matchingKey = Object.keys(fieldGroupingSettings).find(key => {
    // Проверяем, заканчивается ли ключ на attrName (с учетом возможного префикса)
    return key === attrName || key.endsWith(`: ${attrName}`) || key.endsWith(` ${attrName}`);
  });
  
  if (matchingKey) {
    return fieldGroupingSettings[matchingKey];
  }
  
  return {};
}
```

**Логика**:
1. Сначала пробуем точное совпадение (`fieldGroupingSettings[attrName]`)
2. Если не найдено, ищем ключ, который заканчивается на `: ${attrName}` или ` ${attrName}`
3. Если найден подходящий ключ, возвращаем его настройки
4. Если ничего не найдено, возвращаем пустой объект

### Файлы изменений
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx`
  - Метод `getFieldSettings()` (строки ~285-304)

---

## Проблема 9: Недостаточное логирование для отладки

### Симптомы
- Сложно понять, почему фильтрация работает только для первого значения
- Не видно структуру `fieldGroupingSettings` и какие настройки передаются в компонент
- Не видно, какие колонки проверяются и почему некоторые не определяются как "последние в группе"

### Решение
Добавлено детальное логирование на всех этапах фильтрации:

1. **Логирование структуры данных**:
```javascript
console.log('[FilterColKeys] Initial data:', {
  colAttrs: JSON.stringify(colAttrs),
  colAttrsLength: colAttrs.length,
  colAttrsItems: colAttrs.map((item, i) => `${i}: "${item}"`),
  visibleColKeysLength: visibleColKeys.length,
  firstFewColKeys: visibleColKeys.slice(0, 3).map(k => JSON.stringify(k)),
  fieldGroupingSettingsKeys: Object.keys(fieldGroupingSettings),
  fieldGroupingSettingsKeysCount: Object.keys(fieldGroupingSettings).length,
  possibleDateKeys,
  dateFieldSettings: dateSettingsDetail,
  allFieldSettings: Object.keys(fieldGroupingSettings).reduce((acc, key) => {
    acc[key] = {
      subtotalShow: fieldGroupingSettings[key]?.subtotalShow,
      subtotalEnabled: fieldGroupingSettings[key]?.subtotalEnabled
    };
    return acc;
  }, {})
});

// Дополнительное логирование полной структуры
if (Object.keys(fieldGroupingSettings).length > 0) {
  console.log('[FilterColKeys] Full fieldGroupingSettings:', JSON.stringify(fieldGroupingSettings, null, 2));
}
```

2. **Логирование проверки subtotal колонок**:
```javascript
if (typeof console !== 'undefined' && console.log && colKey[attrIdx] === 0) {
  const attrName = colAttrs[attrIdx];
  const nextColKey = colKeyIndex < visibleColKeys.length - 1 
    ? visibleColKeys[colKeyIndex + 1]
    : null;
  console.log('[FilterColKeys] Checking subtotal column:', {
    colKeyIndex,
    colKey: JSON.stringify(colKey),
    attrIdx,
    attrName,
    isLast,
    nextColKey: nextColKey ? JSON.stringify(nextColKey) : 'LAST',
    nextColKeyAttrValue: nextColKey ? nextColKey[attrIdx] : 'N/A',
    willHide: isLast
  });
}
```

3. **Логирование в `getFieldSubtotalSettings()`**:
```javascript
if (typeof console !== 'undefined' && console.log && !isRow && attrName === 'Дата') {
  console.log('[getFieldSubtotalSettings] For "Дата":', {
    attrName,
    isRow,
    fieldSettings,
    subtotalShow,
    globalColSubTotals: globalTableSettings?.colSubTotals,
    willReturnEnabled: subtotalShow !== 'no_show'
  });
}
```

### Файлы изменений
- `superset-frontend/plugins/plugin-chart-pivot-table-v2/src/react-pivottable/TableRenderers.jsx`
  - Метод `render()` - логирование структуры данных (строки ~2692-2720)
  - Метод `render()` - логирование проверки subtotal колонок (строки ~2801-2820)
  - Метод `getFieldSubtotalSettings()` - логирование для "Дата" (строки ~314-330)

---

## Статус реализации (обновлено)

- ✅ **Завершено**: Исправлена логика определения subtotal колонок
- ✅ **Завершено**: Добавлено скрытие data cells для subtotal колонок
- ✅ **Завершено**: Исправлена ошибка компиляции с `rowIndex`
- ✅ **Завершено**: Документирована проблема с кэшированием браузера
- ✅ **Завершено**: Реализация скрытия заголовков subtotal колонок через фильтрацию `visibleColKeys`
- ✅ **Завершено**: Исправлена логика фильтрации для проверки каждого атрибута отдельно
- ✅ **Завершено**: Исправлена ошибка `ReferenceError: colSubtotalSettings is not defined`
- ✅ **Завершено**: Реализована функция `isLastInGroup()` для определения последней колонки в группе
- ✅ **Завершено**: Улучшен метод `getFieldSettings()` для поиска настроек по частичному совпадению имени
- ✅ **Завершено**: Добавлено детальное логирование для отладки процесса фильтрации
- ⏳ **В процессе**: Тестирование фичи - требуется проверить, что фильтрация работает для всех значений поля "Дата"

---

**Дата создания документа**: 2026-02-05  
**Последнее обновление**: 2026-02-06 (добавлены Проблема 7, 8, 9: логика определения последней колонки в группе, поиск настроек по частичному совпадению, детальное логирование)  
**Автор**: AI Assistant (Claude Sonnet 4.5)
