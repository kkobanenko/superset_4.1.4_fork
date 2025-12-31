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

import { Component } from 'react';
import { getNumberFormatter, getTimeFormatter, SMART_DATE_ID, t, safeHtmlSpan, NumberFormats } from '@superset-ui/core';
import PropTypes from 'prop-types';
import { PivotData, flatKey } from './utilities';
import { Styles } from './Styles';
import { ADAPTIVE_FORMATTING } from '../types';

// Константа для проверки адаптивного форматирования (поддерживаем оба варианта)
const isAdaptiveFormatting = (valueFormat) => {
  return valueFormat === ADAPTIVE_FORMATTING || valueFormat === NumberFormats.SMART_NUMBER;
};

// Russian month names
const RUSSIAN_MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

// Custom formatter for MONTH_YEAR_RU format
function formatMonthYearRu(date) {
  let dateObj;
  if (typeof date === 'number') {
    dateObj = new Date(date);
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  if (isNaN(dateObj.getTime())) {
    return String(date);
  }
  
  const month = dateObj.getMonth(); // 0-11
  const year = dateObj.getFullYear();
  return `${RUSSIAN_MONTHS[month]} ${year}`;
}

const parseLabel = value => {
  if (typeof value === 'string') {
    if (value === 'metric') return t('metric');
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  return String(value);
};

function displayCell(value, allowRenderHtml) {
  if (allowRenderHtml && typeof value === 'string') {
    return safeHtmlSpan(value);
  }
  return parseLabel(value);
}
function displayHeaderCell(
  needToggle,
  ArrowIcon,
  onArrowClick,
  value,
  namesMapping,
  allowRenderHtml,
) {
  const name = namesMapping[value] || value;
  const parsedLabel = parseLabel(name);
  const labelContent =
    allowRenderHtml && typeof parsedLabel === 'string'
      ? safeHtmlSpan(parsedLabel)
      : parsedLabel;
  return needToggle ? (
    <span className="toggle-wrapper">
      <span
        role="button"
        tabIndex="0"
        className="toggle"
        onClick={onArrowClick}
      >
        {ArrowIcon}
      </span>
      <span className="toggle-val">{labelContent}</span>
    </span>
  ) : (
    labelContent
  );
}

export class TableRenderer extends Component {
  constructor(props) {
    super(props);

    // We need state to record which entries are collapsed and which aren't.
    // This is an object with flat-keys indicating if the corresponding rows
    // should be collapsed.
    this.state = { collapsedRows: {}, collapsedCols: {} };

    this.clickHeaderHandler = this.clickHeaderHandler.bind(this);
    this.clickHandler = this.clickHandler.bind(this);
  }

  getBasePivotSettings() {
    // One-time extraction of pivot settings that we'll use throughout the render.

    const { props } = this;
    const colAttrs = props.cols;
    const rowAttrs = props.rows;

    const tableOptions = {
      rowTotals: true,
      colTotals: true,
      ...props.tableOptions,
    };
    const rowTotals = tableOptions.rowTotals || colAttrs.length === 0;
    const colTotals = tableOptions.colTotals || rowAttrs.length === 0;

    const namesMapping = props.namesMapping || {};
    const subtotalOptions = {
      arrowCollapsed: '\u25B2',
      arrowExpanded: '\u25BC',
      ...props.subtotalOptions,
    };

    const colSubtotalDisplay = {
      displayOnTop: false,
      enabled: tableOptions.colSubTotals,
      hideOnExpand: false,
      ...subtotalOptions.colSubtotalDisplay,
    };

    const rowSubtotalDisplay = {
      displayOnTop: false,
      enabled: tableOptions.rowSubTotals,
      hideOnExpand: false,
      ...subtotalOptions.rowSubtotalDisplay,
    };

    const pivotData = new PivotData(props, {
      rowEnabled: rowSubtotalDisplay.enabled,
      colEnabled: colSubtotalDisplay.enabled,
      rowPartialOnTop: rowSubtotalDisplay.displayOnTop,
      colPartialOnTop: colSubtotalDisplay.displayOnTop,
    });
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();

    // Also pre-calculate all the callbacks for cells, etc... This is nice to have to
    // avoid re-calculations of the call-backs on cell expansions, etc...
    const cellCallbacks = {};
    const rowTotalCallbacks = {};
    const colTotalCallbacks = {};
    let grandTotalCallback = null;
    if (tableOptions.clickCallback) {
      rowKeys.forEach(rowKey => {
        const flatRowKey = flatKey(rowKey);
        if (!(flatRowKey in cellCallbacks)) {
          cellCallbacks[flatRowKey] = {};
        }
        colKeys.forEach(colKey => {
          cellCallbacks[flatRowKey][flatKey(colKey)] = this.clickHandler(
            pivotData,
            rowKey,
            colKey,
          );
        });
      });

      // Add in totals as well.
      if (rowTotals) {
        rowKeys.forEach(rowKey => {
          rowTotalCallbacks[flatKey(rowKey)] = this.clickHandler(
            pivotData,
            rowKey,
            [],
          );
        });
      }
      if (colTotals) {
        colKeys.forEach(colKey => {
          colTotalCallbacks[flatKey(colKey)] = this.clickHandler(
            pivotData,
            [],
            colKey,
          );
        });
      }
      if (rowTotals && colTotals) {
        grandTotalCallback = this.clickHandler(pivotData, [], []);
      }
    }

    return {
      pivotData,
      colAttrs,
      rowAttrs,
      colKeys,
      rowKeys,
      rowTotals,
      colTotals,
      arrowCollapsed: subtotalOptions.arrowCollapsed,
      arrowExpanded: subtotalOptions.arrowExpanded,
      colSubtotalDisplay,
      rowSubtotalDisplay,
      cellCallbacks,
      rowTotalCallbacks,
      colTotalCallbacks,
      grandTotalCallback,
      namesMapping,
      allowRenderHtml: props.allowRenderHtml,
    };
  }

  // Получить настройки форматирования для поля группировки
  getFieldSettings(attrName) {
    const { tableOptions } = this.props;
    const fieldGroupingSettings =
      tableOptions?.fieldGroupingSettings || {};
    return fieldGroupingSettings[attrName] || {};
  }

  getMetricKey() {
    return this.props.tableOptions?.metricKey;
  }

  getGlobalTableSettings() {
    return this.props.tableOptions?.globalTableSettings || {};
  }

  // Получить формат метрики для адаптивного форматирования
  getMetricFormat(metricName) {
    if (!metricName) {
      return undefined;
    }
    const settings = this.getFieldSettings(metricName);
    if (settings && typeof settings.valueFormat === 'string' && settings.valueFormat.length > 0) {
      return settings.valueFormat;
    }
    return undefined;
  }

  // Парсинг SQL-формулы для извлечения базовых метрик и операций
  // Возвращает структуру: { baseMetrics: string[], operations: string[], isValid: boolean }
  parseSqlFormula(sqlExpression, metricNames, metricNameMapping) {
    if (!sqlExpression || typeof sqlExpression !== 'string') {
      return { baseMetrics: [], operations: [], isValid: false };
    }

    // Регулярное выражение для поиска паттернов типа sum(`метрика`), count(`метрика`), avg(`метрика`)
    // Поддерживаем основные агрегатные функции: SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT
    // Учитываем регистронезависимость и возможные пробелы
    const aggregateFunctionPattern = /(?:sum|count|avg|min|max|count_distinct)\s*\(\s*`([^`]+)`\s*\)/gi;
    
    // Извлекаем все метрики из формулы
    const baseMetrics = [];
    const metricMatches = [];
    let match;
    
    while ((match = aggregateFunctionPattern.exec(sqlExpression)) !== null) {
      const sqlMetricName = match[1].trim();
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[parseSqlFormula] Found metric in SQL:', sqlMetricName, 'Available metrics:', metricNames, 'metricNameMapping:', metricNameMapping);
      }
      // Пытаемся найти отображаемое имя метрики через маппинг
      // Если маппинг не найден, используем имя из SQL напрямую
      const displayMetricName = metricNameMapping && metricNameMapping[sqlMetricName] 
        ? metricNameMapping[sqlMetricName] 
        : sqlMetricName;
      
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[parseSqlFormula] Mapped metric name:', sqlMetricName, '->', displayMetricName);
      }
      
      baseMetrics.push(displayMetricName);
      metricMatches.push({
        metricName: displayMetricName,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Если не нашли метрики, формула невалидна
    if (baseMetrics.length === 0) {
      return { baseMetrics: [], operations: [], isValid: false };
    }

    // Извлекаем операции между метриками
    // Ищем операции /, *, +, - между найденными метриками
    const operations = [];
    const operationPattern = /[+\-*/]/g;
    const operationMatches = [];
    
    while ((match = operationPattern.exec(sqlExpression)) !== null) {
      operationMatches.push({
        operation: match[0],
        index: match.index,
      });
    }

    // Определяем операции между метриками
    // Операция должна быть между двумя метриками
    // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
    if (typeof console !== 'undefined' && console.log) {
      console.log('[parseSqlFormula] Processing operations:', { 
        metricMatches: metricMatches.map(m => ({ ...m, match: sqlExpression.substring(m.startIndex, m.endIndex) })),
        operationMatches: operationMatches.map(op => ({ ...op, char: sqlExpression[op.index] })),
        sqlExpression 
      });
    }
    
    for (let i = 0; i < metricMatches.length - 1; i += 1) {
      const currentMetricEnd = metricMatches[i].endIndex;
      const nextMetricStart = metricMatches[i + 1].startIndex;
      
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[parseSqlFormula] Checking operations between metrics:', {
          i,
          currentMetricEnd,
          nextMetricStart,
          currentMetric: metricMatches[i].metricName,
          nextMetric: metricMatches[i + 1].metricName,
          substring: sqlExpression.substring(currentMetricEnd, nextMetricStart)
        });
      }
      
      // Ищем операции между текущей и следующей метрикой
      // Операция может находиться сразу после конца первой метрики (>=) и до начала следующей (<)
      const operationsBetween = operationMatches.filter(
        op => op.index >= currentMetricEnd && op.index < nextMetricStart
      );
      
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[parseSqlFormula] Operations found between metrics:', {
          i,
          operationsBetween,
          operationsBetweenLength: operationsBetween.length
        });
      }
      
      if (operationsBetween.length > 0) {
        // Берем первую операцию между метриками
        operations.push(operationsBetween[0].operation);
      } else {
        // Если операция не найдена, формула невалидна
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        if (typeof console !== 'undefined' && console.log) {
          console.log('[parseSqlFormula] No operation found between metrics:', {
            i,
            currentMetricEnd,
            nextMetricStart,
            substring: sqlExpression.substring(currentMetricEnd, nextMetricStart)
          });
        }
        return { baseMetrics: [], operations: [], isValid: false };
      }
    }

    // Проверяем, что количество операций соответствует количеству метрик - 1
    if (operations.length !== baseMetrics.length - 1) {
      return { baseMetrics: [], operations: [], isValid: false };
    }

    return {
      baseMetrics,
      operations,
      isValid: true,
    };
  }

  // Получение значения базовой метрики из подытогов/итогов
  // Для подытога строки: создаем colKey с базовой метрикой
  // Для итога колонки: создаем rowKey или colKey с базовой метрикой (в зависимости от transposePivot)
  getBaseMetricValue(baseMetricName, rowKey, colKey, isRowSubtotal, isColSubtotal, pivotData, rowAttrs, colAttrs, metricKey) {
    if (!baseMetricName || !pivotData || !metricKey) {
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[getBaseMetricValue] Invalid parameters:', { baseMetricName, pivotData: !!pivotData, metricKey });
      }
      return null;
    }

    const { tableOptions } = this.props;
    const { transposePivot, metricsOrder } = tableOptions || {};

    try {
      let targetRowKey = [...rowKey];
      let targetColKey = [...colKey];

      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[getBaseMetricValue] Start:', { baseMetricName, rowKey, colKey, isRowSubtotal, isColSubtotal, transposePivot, rowAttrs, colAttrs, metricKey, metricsOrder });
      }

      // Находим индекс базовой метрики в metricsOrder
      // Используем trim() для сравнения, так как metricsOrder может содержать пробелы в конце
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[getBaseMetricValue] Searching for baseMetricName:', baseMetricName, 'in metricsOrder:', metricsOrder, 'type:', typeof metricsOrder, 'isArray:', Array.isArray(metricsOrder));
      }
      let baseMetricIndex = -1;
      if (metricsOrder && Array.isArray(metricsOrder)) {
        for (let i = 0; i < metricsOrder.length; i++) {
          if (metricsOrder[i] && metricsOrder[i].trim() === baseMetricName.trim()) {
            baseMetricIndex = i;
            break;
          }
        }
      }
      if (baseMetricIndex === -1) {
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        if (typeof console !== 'undefined' && console.log) {
          console.log('[getBaseMetricValue] Base metric not found in metricsOrder:', { 
            baseMetricName, 
            metricsOrder, 
            metricsOrderLength: metricsOrder ? metricsOrder.length : 0,
            metricsOrderItems: metricsOrder ? metricsOrder.map((m, i) => `${i}: "${m}"`) : []
          });
        }
        return null;
      }

      // Находим позицию metricKey в colAttrs
      const metricKeyIndex = colAttrs.indexOf(metricKey);
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[getBaseMetricValue] colKey structure:', { 
          colKey, 
          colKeyLength: colKey ? colKey.length : 0,
          colKeyItems: colKey ? colKey.map((item, i) => `${i}: ${item} (${typeof item})`) : [],
          colKeyValues: colKey ? colKey.map((item, i) => ({ index: i, value: item, type: typeof item })) : [],
          metricKey, 
          metricKeyIndex, 
          colAttrs,
          colAttrsLength: colAttrs ? colAttrs.length : 0,
          colAttrsItems: colAttrs ? colAttrs.map((item, i) => `${i}: "${item}"`) : []
        });
      }
      if (metricKeyIndex === -1) {
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        if (typeof console !== 'undefined' && console.log) {
          console.log('[getBaseMetricValue] metricKey not found in colAttrs:', { metricKey, colAttrs });
        }
        return null;
      }

      if (isRowSubtotal && !transposePivot) {
        // Для подытога строки при transposePivot = false: метрики в колонках
        // Для row subtotals нужно суммировать значения базовых метрик из всех обычных ячеек,
        // которые принадлежат этой подытоге строки (имеют тот же rowKey[0] и colKey[0])
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        if (typeof console !== 'undefined' && console.log) {
          console.log('[getBaseMetricValue] Row subtotal - summing from normal cells:', {
            rowKey,
            colKey,
            baseMetricName,
            baseMetricIndex,
            metricKeyIndex
          });
        }
        
        // Получаем rowKeys и colKeys из props для поиска всех обычных ячеек
        const { rowKeys, colKeys } = this.props;
        if (!rowKeys || !colKeys || rowKeys.length === 0 || colKeys.length === 0) {
          if (typeof console !== 'undefined' && console.log) {
            console.log('[getBaseMetricValue] No rowKeys or colKeys available for row subtotal');
          }
          return null;
        }
        
        // Для row subtotals rowKey имеет структуру [groupingLevel1]
        // Нужно найти все обычные ячейки с тем же rowKey[0] и colKey[0] (timestamp)
        const subtotalRowKeyPrefix = rowKey[0]; // Первый уровень группировки (например, "Москва и Центр")
        const timestamp = colKey && colKey.length > 0 ? colKey[0] : null;
        
        if (!subtotalRowKeyPrefix || timestamp === null) {
          if (typeof console !== 'undefined' && console.log) {
            console.log('[getBaseMetricValue] Invalid subtotal rowKey or timestamp:', {
              subtotalRowKeyPrefix,
              timestamp,
              rowKey,
              colKey
            });
          }
          return null;
        }
        
        // Суммируем значения базовых метрик из всех обычных ячеек
        let sum = 0;
        let foundAny = false;
        
        for (let i = 0; i < rowKeys.length; i++) {
          const normalRowKey = rowKeys[i];
          // Проверяем, что обычная ячейка принадлежит этой подытоге строки
          // (имеет тот же rowKey[0])
          if (!normalRowKey || normalRowKey.length === 0 || normalRowKey[0] !== subtotalRowKeyPrefix) {
            continue;
          }
          
          // Для каждой обычной ячейки ищем colKey с тем же timestamp и базовой метрикой
          for (let j = 0; j < colKeys.length; j++) {
            const normalColKey = colKeys[j];
            // Проверяем, что timestamp совпадает
            if (!normalColKey || normalColKey.length === 0 || normalColKey[0] !== timestamp) {
              continue;
            }
            
            // Создаем colKey для базовой метрики из этого colKey
            const baseMetricColKey = [...normalColKey];
            if (baseMetricColKey.length > metricKeyIndex) {
              baseMetricColKey[metricKeyIndex] = baseMetricIndex;
            } else {
              while (baseMetricColKey.length <= metricKeyIndex) {
                baseMetricColKey.push(null);
              }
              baseMetricColKey[metricKeyIndex] = baseMetricIndex;
            }
            
            // Получаем агрегатор для обычной ячейки с базовой метрикой
            const normalAgg = pivotData.getAggregator(normalRowKey, baseMetricColKey);
            if (normalAgg) {
              const normalValue = normalAgg.value();
              if (normalValue !== null && normalValue !== undefined && !Number.isNaN(normalValue)) {
                const numValue = typeof normalValue === 'number' ? normalValue : Number.parseFloat(normalValue);
                if (!Number.isNaN(numValue)) {
                  sum += numValue;
                  foundAny = true;
                  if (typeof console !== 'undefined' && console.log) {
                    console.log('[getBaseMetricValue] Added value from normal cell:', {
                      normalRowKey,
                      baseMetricColKey,
                      normalValue,
                      numValue,
                      sum
                    });
                  }
                }
              }
            }
          }
        }
        
        if (!foundAny) {
          if (typeof console !== 'undefined' && console.log) {
            console.log('[getBaseMetricValue] No values found for row subtotal:', {
              subtotalRowKeyPrefix,
              timestamp,
              baseMetricName,
              baseMetricIndex
            });
          }
          return null;
        }
        
        if (typeof console !== 'undefined' && console.log) {
          console.log('[getBaseMetricValue] Row subtotal sum:', {
            baseMetricName,
            baseMetricIndex,
            sum,
            subtotalRowKeyPrefix,
            timestamp
          });
        }
        
        return sum;
      } else if (isColSubtotal && !transposePivot) {
        // Для подытога колонки при transposePivot = false: метрики в колонках
        // Аналогично подытогу строки
        while (targetColKey.length <= metricKeyIndex) {
          targetColKey.push(null);
        }
        targetColKey[metricKeyIndex] = baseMetricIndex;
      } else if (!transposePivot && rowKey.length === 0 && colKey.length > 0) {
        // Для итога колонки при transposePivot = false: rowKey пустой, colKey содержит все измерения колонок
        // Заменяем метрику в colKey на индекс базовой метрики
        if (targetColKey.length > metricKeyIndex) {
          targetColKey[metricKeyIndex] = baseMetricIndex;
        } else {
          // Если colKey короче, расширяем его
          while (targetColKey.length <= metricKeyIndex) {
            targetColKey.push(null);
          }
          targetColKey[metricKeyIndex] = baseMetricIndex;
        }
      } else {
        // Для transposePivot = true или других случаев - пока не поддерживаем
        return null;
      }

      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[getBaseMetricValue] Before getAggregator:', { baseMetricName, baseMetricIndex, targetRowKey, targetColKey, metricKeyIndex });
      }

      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ - проверяем, какие ключи есть в pivotData
      if (typeof console !== 'undefined' && console.log && isRowSubtotal && !transposePivot) {
        // Пытаемся найти пример обычной ячейки для той же строки, чтобы сравнить структуру colKey
        // Для этого ищем первую обычную ячейку с той же строкой
        const { colKeys } = this.props;
        if (colKeys && colKeys.length > 0) {
          // Ищем colKey для базовой метрики "Факт" (baseMetricIndex = 2)
          // Для этого создаем colKey с индексом базовой метрики вместо имени
          const exampleColKeyForBaseMetric = [...colKey];
          // Заменяем имя метрики на индекс базовой метрики
          if (exampleColKeyForBaseMetric.length > metricKeyIndex) {
            exampleColKeyForBaseMetric[metricKeyIndex] = baseMetricIndex;
          } else {
            while (exampleColKeyForBaseMetric.length <= metricKeyIndex) {
              exampleColKeyForBaseMetric.push(null);
            }
            exampleColKeyForBaseMetric[metricKeyIndex] = baseMetricIndex;
          }
          const exampleAgg = pivotData.getAggregator(rowKey, exampleColKeyForBaseMetric);
          console.log('[getBaseMetricValue] Example normal cell for base metric:', {
            rowKey,
            originalColKey: colKey,
            exampleColKeyForBaseMetric,
            exampleColKeyLength: exampleColKeyForBaseMetric ? exampleColKeyForBaseMetric.length : 0,
            exampleColKeyItems: exampleColKeyForBaseMetric ? exampleColKeyForBaseMetric.map((item, i) => `[${i}]: ${JSON.stringify(item)} (${typeof item})`) : [],
            exampleAgg: exampleAgg ? exampleAgg.value() : null,
            colAttrs,
            colAttrsLength: colAttrs ? colAttrs.length : 0,
            metricKeyIndex,
            baseMetricIndex
          });
          // Также пробуем найти colKey для обычной ячейки с той же строкой и базовой метрикой
          // Пробуем разные варианты colKey
          for (let i = 0; i < Math.min(5, colKeys.length); i++) {
            const testColKey = colKeys[i];
            const testAgg = pivotData.getAggregator(rowKey, testColKey);
            if (testAgg && testAgg.value() !== null) {
              console.log('[getBaseMetricValue] Found working colKey for row:', {
                rowKey,
                testColKey,
                testColKeyItems: testColKey ? testColKey.map((item, i) => `[${i}]: ${JSON.stringify(item)} (${typeof item})`) : [],
                testAggValue: testAgg.value()
              });
              // Пробуем заменить метрику в этом colKey на базовую метрику
              const testColKeyForBaseMetric = [...testColKey];
              if (testColKeyForBaseMetric.length > metricKeyIndex) {
                testColKeyForBaseMetric[metricKeyIndex] = baseMetricIndex;
              } else {
                while (testColKeyForBaseMetric.length <= metricKeyIndex) {
                  testColKeyForBaseMetric.push(null);
                }
                testColKeyForBaseMetric[metricKeyIndex] = baseMetricIndex;
              }
              const testAggForBaseMetric = pivotData.getAggregator(rowKey, testColKeyForBaseMetric);
              console.log('[getBaseMetricValue] Test colKey for base metric:', {
                rowKey,
                originalTestColKey: testColKey,
                testColKeyForBaseMetric,
                testColKeyForBaseMetricItems: testColKeyForBaseMetric ? testColKeyForBaseMetric.map((item, i) => `[${i}]: ${JSON.stringify(item)} (${typeof item})`) : [],
                testAggForBaseMetric: testAggForBaseMetric ? testAggForBaseMetric.value() : null
              });
              break;
            }
          }
        }
      }

      // Получаем агрегатор для базовой метрики
      const agg = pivotData.getAggregator(targetRowKey, targetColKey);
      if (!agg) {
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        if (typeof console !== 'undefined' && console.log) {
          console.log('[getBaseMetricValue] Aggregator not found:', { baseMetricName, baseMetricIndex, targetRowKey, targetColKey });
        }
        return null;
      }

      const value = agg.value();
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[getBaseMetricValue] Aggregator value:', { baseMetricName, baseMetricIndex, value, targetRowKey, targetColKey });
      }
      // Проверяем, что значение валидно (не null, не undefined, не NaN)
      if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        if (typeof console !== 'undefined' && console.log) {
          console.log('[getBaseMetricValue] Invalid value:', { baseMetricName, baseMetricIndex, value });
        }
        return null;
      }

      const result = typeof value === 'number' ? value : Number.parseFloat(value);
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[getBaseMetricValue] Final result:', { baseMetricName, baseMetricIndex, result });
      }
      return result;
    } catch (error) {
      // В случае ошибки возвращаем null
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error getting base metric value:', error);
      }
      return null;
    }
  }

  // Вычисление значения формулы для подытогов/итогов
  computeFormulaValue(formulaMetricName, rowKey, colKey, isRowSubtotal, isColSubtotal, pivotData, rowAttrs, colAttrs, metricKey, metricsSqlExpressions, metricsOrder, metricNameMapping) {
    if (!formulaMetricName || !metricsSqlExpressions) {
      return null;
    }

    const sqlExpression = metricsSqlExpressions[formulaMetricName];
    if (!sqlExpression) {
      // Если метрика не является формулой, возвращаем null (будет использовано стандартное поведение)
      return null;
    }

    // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
    if (typeof console !== 'undefined' && console.log) {
      console.log('[computeFormulaValue] formulaMetricName:', formulaMetricName, 'sqlExpression:', sqlExpression, 'metricsOrder:', metricsOrder, 'metricNameMapping:', metricNameMapping);
    }

    // Парсим формулу
    const parsed = this.parseSqlFormula(sqlExpression, metricsOrder || [], metricNameMapping || {});
    // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
    if (typeof console !== 'undefined' && console.log) {
      console.log('[computeFormulaValue] Parsed formula:', { 
        isValid: parsed.isValid, 
        baseMetrics: parsed.baseMetrics, 
        operations: parsed.operations,
        baseMetricsLength: parsed.baseMetrics ? parsed.baseMetrics.length : 0
      });
    }
    if (!parsed.isValid || parsed.baseMetrics.length === 0) {
      // Если формула не может быть распарсена, возвращаем null (будет использовано стандартное поведение)
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[computeFormulaValue] Formula parsing failed:', { 
          formulaMetricName, 
          sqlExpression, 
          isValid: parsed.isValid, 
          baseMetrics: parsed.baseMetrics,
          baseMetricsLength: parsed.baseMetrics ? parsed.baseMetrics.length : 0
        });
      }
      return null;
    }

    // Получаем значения базовых метрик
    const baseValues = [];
    // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
    if (typeof console !== 'undefined' && console.log) {
      console.log('[computeFormulaValue] Starting to get base metric values:', { 
        baseMetrics: parsed.baseMetrics, 
        metricsOrder, 
        metricNameMapping 
      });
    }
    for (const baseMetric of parsed.baseMetrics) {
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[computeFormulaValue] Getting value for base metric:', baseMetric, 'from metricsOrder:', metricsOrder);
      }
      const value = this.getBaseMetricValue(
        baseMetric,
        rowKey,
        colKey,
        isRowSubtotal,
        isColSubtotal,
        pivotData,
        rowAttrs,
        colAttrs,
        metricKey
      );
      
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[computeFormulaValue] Got value for base metric:', { baseMetric, value });
      }
      
      if (value === null || value === undefined || Number.isNaN(value)) {
        // Если значение базовой метрики не найдено, возвращаем null
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        if (typeof console !== 'undefined' && console.log) {
          console.log('[computeFormulaValue] Base metric value not found:', { baseMetric, value, rowKey, colKey });
        }
        return null;
      }
      
      baseValues.push(value);
    }

    // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
    if (typeof console !== 'undefined' && console.log) {
      console.log('[computeFormulaValue] Base values:', { baseMetrics: parsed.baseMetrics, baseValues, operations: parsed.operations });
    }

    // Применяем операции к значениям базовых метрик
    let result = baseValues[0];
    for (let i = 0; i < parsed.operations.length; i += 1) {
      const operation = parsed.operations[i];
      const nextValue = baseValues[i + 1];

      if (nextValue === null || nextValue === undefined || Number.isNaN(nextValue)) {
        return null;
      }

      switch (operation) {
        case '/':
          if (nextValue === 0) {
            // Деление на ноль
            return null;
          }
          result = result / nextValue;
          break;
        case '*':
          result = result * nextValue;
          break;
        case '+':
          result = result + nextValue;
          break;
        case '-':
          result = result - nextValue;
          break;
        default:
          // Неподдерживаемая операция
          return null;
      }
    }

    // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
    if (typeof console !== 'undefined' && console.log) {
      console.log('[computeFormulaValue] Result:', { formulaMetricName, result, baseValues, operations: parsed.operations });
    }

    // Проверяем результат на валидность
    if (result === null || result === undefined || Number.isNaN(result) || !Number.isFinite(result)) {
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
      if (typeof console !== 'undefined' && console.log) {
        console.log('[computeFormulaValue] Invalid result:', { formulaMetricName, result });
      }
      return null;
    }

    return result;
  }

  buildTextStyle(settings, includeWidth = false) {
    const style = {};
    if (settings.fontSize) {
      style.fontSize = `${settings.fontSize}px`;
    }
    if (settings.fontColor) {
      style.color = settings.fontColor;
    }
    if (settings.backgroundColor) {
      style.backgroundColor = settings.backgroundColor;
    }
    if (includeWidth && settings.maxWidth) {
      style.maxWidth = `${settings.maxWidth}px`;
      style.overflow = settings.truncate ? 'hidden' : 'visible';
      style.textOverflow = settings.truncate ? 'ellipsis' : 'clip';
      style.whiteSpace = settings.truncate ? 'nowrap' : 'normal';
    }
    return style;
  }

  // Стиль для value-ячеек totals/subtotals (без maxWidth/truncate).
  // Возвращает объект стилей для использования в style={}
  buildValueCellStyle(formatSettings) {
    const style = {};
    if (!formatSettings || typeof formatSettings !== 'object') {
      return style;
    }
    if (formatSettings.fontSize) {
      // Используем setProperty с !important для перезаписи CSS правил с !important
      // В React нужно использовать строку стилей или установить через setProperty
      // Для inline стилей используем объект, но для !important нужен другой подход
      style.fontSize = `${formatSettings.fontSize}px`;
    }
    if (formatSettings.fontColor) {
      style.color = formatSettings.fontColor;
    }
    if (formatSettings.backgroundColor) {
      style.backgroundColor = formatSettings.backgroundColor;
    }
    return style;
  }

  // Создает ref callback для установки стилей с !important
  buildValueCellStyleRef(formatSettings) {
    if (!formatSettings || typeof formatSettings !== 'object') {
      return null;
    }
    return (element) => {
      if (element) {
        if (formatSettings.fontSize) {
          element.style.setProperty('font-size', `${formatSettings.fontSize}px`, 'important');
        }
        if (formatSettings.fontColor) {
          element.style.setProperty('color', formatSettings.fontColor, 'important');
        }
        if (formatSettings.backgroundColor) {
          element.style.setProperty('background-color', formatSettings.backgroundColor, 'important');
        }
      }
    };
  }

  // Создает ref callback для установки стилей полей с !important
  // (для обычных ячеек и заголовков из fieldGroupingSettings)
  buildFieldStyleRef(settings, includeWidth = false) {
    if (!settings || typeof settings !== 'object') {
      return null;
    }
    // Проверяем, есть ли хотя бы одно свойство форматирования
    const hasFormatting = settings.fontSize !== undefined ||
      settings.fontColor !== undefined ||
      settings.backgroundColor !== undefined ||
      (includeWidth && settings.maxWidth !== undefined);
    if (!hasFormatting) {
      return null;
    }
    return (element) => {
      if (element) {
        if (settings.fontSize) {
          element.style.setProperty('font-size', `${settings.fontSize}px`, 'important');
        }
        if (settings.fontColor) {
          element.style.setProperty('color', settings.fontColor, 'important');
        }
        if (settings.backgroundColor) {
          element.style.setProperty('background-color', settings.backgroundColor, 'important');
        }
        if (includeWidth && settings.maxWidth) {
          element.style.setProperty('max-width', `${settings.maxWidth}px`, 'important');
          if (settings.truncate) {
            element.style.setProperty('overflow', 'hidden', 'important');
            element.style.setProperty('text-overflow', 'ellipsis', 'important');
            element.style.setProperty('white-space', 'nowrap', 'important');
          } else {
            element.style.setProperty('overflow', 'visible', 'important');
            element.style.setProperty('text-overflow', 'clip', 'important');
            element.style.setProperty('white-space', 'normal', 'important');
          }
        }
      }
    };
  }

  // Форматировать значение заголовка (row/col) с учетом per-field настроек.
  formatHeaderValue(attrName, rawValue, dateFormatters) {
    const settings = this.getFieldSettings(attrName);

    if (
      dateFormatters &&
      dateFormatters[attrName] &&
      typeof dateFormatters[attrName] === 'function'
    ) {
      return dateFormatters[attrName](rawValue);
    }

    if (
      settings &&
      typeof settings.valueFormat === 'string' &&
      settings.valueFormat.length > 0 &&
      typeof rawValue === 'number'
    ) {
      try {
        return getNumberFormatter(settings.valueFormat)(rawValue);
      } catch (e) {
        return rawValue;
      }
    }

    if (
      settings &&
      typeof settings.dateFormat === 'string' &&
      settings.dateFormat.length > 0 &&
      settings.dateFormat !== SMART_DATE_ID
    ) {
      try {
        if (settings.dateFormat === 'MONTH_YEAR_RU') {
          return formatMonthYearRu(rawValue);
        }
        return getTimeFormatter(settings.dateFormat)(rawValue);
      } catch (e) {
        return rawValue;
      }
    }

    return rawValue;
  }

  // Форматировать агрегированное значение (metric value / totals/subtotals).
  // Если formatSettings содержит dateFormat/valueFormat, они перекрывают agg.format(...).
  formatAggValue(aggValue, formattedByAgg, formatSettings) {
    if (!formatSettings || typeof formatSettings !== 'object') {
      return formattedByAgg;
    }

    if (
      formatSettings.dateFormat &&
      typeof formatSettings.dateFormat === 'string' &&
      formatSettings.dateFormat.length > 0 &&
      formatSettings.dateFormat !== SMART_DATE_ID
    ) {
      try {
        if (formatSettings.dateFormat === 'MONTH_YEAR_RU') {
          return formatMonthYearRu(aggValue);
        }
        return getTimeFormatter(formatSettings.dateFormat)(aggValue);
      } catch (e) {
        return formattedByAgg;
      }
    }

    if (
      formatSettings.valueFormat &&
      typeof formatSettings.valueFormat === 'string' &&
      formatSettings.valueFormat.length > 0
    ) {
      try {
        return getNumberFormatter(formatSettings.valueFormat)(aggValue);
      } catch (e) {
        return formattedByAgg;
      }
    }

    return formattedByAgg;
  }

  // Получить стиль для заголовка колонки/строки
  getHeaderStyle(attrName) {
    const settings = this.getFieldSettings(attrName);
    const colAttrs = this.props.cols || [];
    const rowAttrs = this.props.rows || [];
    
    // Определяем тип поля (колонка или строка)
    const isColumn = colAttrs.indexOf(attrName) !== -1;
    const isRow = rowAttrs.indexOf(attrName) !== -1;
    
    // Используем правильные настройки в зависимости от типа поля
    const normalized = {
      ...settings,
      fontSize: isColumn
        ? (settings.columnHeaderFontSize ?? settings.fontSize)
        : isRow
        ? (settings.rowHeaderFontSize ?? settings.fontSize)
        : settings.fontSize,
      fontColor: isColumn
        ? (settings.columnHeaderFontColor ?? settings.fontColor)
        : isRow
        ? (settings.rowHeaderFontColor ?? settings.fontColor)
        : settings.fontColor,
      backgroundColor: isColumn
        ? (settings.columnHeaderBackgroundColor ?? settings.backgroundColor)
        : isRow
        ? (settings.rowHeaderBackgroundColor ?? settings.backgroundColor)
        : settings.backgroundColor,
    };
    return this.buildTextStyle(normalized, true);
  }

  // Получить стиль для ячейки данных
  getCellStyle(attrName) {
    const settings = this.getFieldSettings(attrName);
    const colAttrs = this.props.cols || [];
    const rowAttrs = this.props.rows || [];
    
    // Определяем тип поля (колонка или строка)
    const isColumn = colAttrs.indexOf(attrName) !== -1;
    const isRow = rowAttrs.indexOf(attrName) !== -1;
    
    // Используем правильные настройки в зависимости от типа поля
    const normalized = {
      ...settings,
      fontSize: isColumn
        ? (settings.columnValueFontSize ?? settings.fontSize)
        : isRow
        ? (settings.rowValueFontSize ?? settings.fontSize)
        : settings.fontSize,
      fontColor: isColumn
        ? (settings.columnValueFontColor ?? settings.fontColor)
        : isRow
        ? (settings.rowValueFontColor ?? settings.fontColor)
        : settings.fontColor,
      backgroundColor: isColumn
        ? (settings.columnValueBackgroundColor ?? settings.backgroundColor)
        : isRow
        ? (settings.rowValueBackgroundColor ?? settings.backgroundColor)
        : settings.backgroundColor,
    };
    return this.buildTextStyle(normalized, false);
  }

  getMetricHeaderStyle(metricName) {
    const settings = this.getFieldSettings(metricName);
    const normalized = {
      ...settings,
      fontSize: settings.metricHeaderFontSize ?? settings.fontSize,
      fontColor: settings.metricHeaderFontColor ?? settings.fontColor,
      backgroundColor:
        settings.metricHeaderBackgroundColor ?? settings.backgroundColor,
    };
    // Header also supports width/truncation
    return this.buildTextStyle(normalized, true);
  }

  getMetricValueStyle(metricName) {
    const settings = this.getFieldSettings(metricName);
    const normalized = {
      ...settings,
      fontSize: settings.metricValueFontSize ?? settings.fontSize,
      fontColor: settings.metricValueFontColor ?? settings.fontColor,
      backgroundColor:
        settings.metricValueBackgroundColor ?? settings.backgroundColor,
    };
    return this.buildTextStyle(normalized, false);
  }

  getMetricNameForCell(rowKey, colKey, rowAttrs, colAttrs, colIndex = null) {
    const { tableOptions } = this.props;
    const { transposePivot, metricsOrder } = tableOptions || {};
    
    const metricKey = this.getMetricKey();
    if (!metricKey) {
      return null;
    }

    // Сначала пытаемся найти метрику через metricKey в colAttrs или rowAttrs
    const colIdx = colAttrs.indexOf(metricKey);
    if (colIdx !== -1 && colIdx < colKey.length) {
      return String(colKey[colIdx]);
    }

    const rowIdx = rowAttrs.indexOf(metricKey);
    if (rowIdx !== -1 && rowIdx < rowKey.length) {
      return String(rowKey[rowIdx]);
    }

    // Если не нашли через metricKey, используем colIndex и metricsOrder для определения метрики
    // Это нужно для подытогов и итогов, где colKey может быть неполным
    if (colIndex !== null && metricsOrder && metricsOrder.length > 0) {
      if (!transposePivot) {
        // Если не transposed, метрики в колонках
        // Используем colIndex напрямую для определения метрики
        // Предполагаем, что метрики повторяются в порядке для каждой группы дат
        const metricsPerGroup = metricsOrder.length;
        const metricIndexInGroup = colIndex % metricsPerGroup;
        if (metricIndexInGroup < metricsOrder.length) {
          return metricsOrder[metricIndexInGroup];
        }
      } else {
        // Если transposed, метрики в строках
        // Для строк используем rowKey.length для определения позиции
        // Но это сложнее, так как нам нужен индекс строки
        // Пока возвращаем null, так как для transposed нужна другая логика
        return null;
      }
    }

    // Если не нашли через metricKey, проверяем, является ли последний элемент colKey метрикой
    // Это может быть нужно для подытогов, где colKey может быть неполным
    if (colKey.length > 0) {
      const lastColAttrIndex = colKey.length - 1;
      if (lastColAttrIndex < colAttrs.length && colAttrs[lastColAttrIndex] === metricKey) {
        return String(colKey[lastColAttrIndex]);
      }
    }

    // Аналогично для rowKey
    if (rowKey.length > 0) {
      const lastRowAttrIndex = rowKey.length - 1;
      if (lastRowAttrIndex < rowAttrs.length && rowAttrs[lastRowAttrIndex] === metricKey) {
        return String(rowKey[lastRowAttrIndex]);
      }
    }

    return null;
  }

  // Обрезать текст значения, если нужно
  truncateValue(value, attrName) {
    const settings = this.getFieldSettings(attrName);
    if (settings.truncate && settings.maxWidth && typeof value === 'string') {
      // Простая обрезка на уровне CSS, более точная обрезка будет через CSS
      return value;
    }
    return value;
  }

  clickHandler(pivotData, rowValues, colValues) {
    const colAttrs = this.props.cols;
    const rowAttrs = this.props.rows;
    const value = pivotData.getAggregator(rowValues, colValues).value();
    const filters = {};
    const colLimit = Math.min(colAttrs.length, colValues.length);
    for (let i = 0; i < colLimit; i += 1) {
      const attr = colAttrs[i];
      if (colValues[i] !== null) {
        filters[attr] = colValues[i];
      }
    }
    const rowLimit = Math.min(rowAttrs.length, rowValues.length);
    for (let i = 0; i < rowLimit; i += 1) {
      const attr = rowAttrs[i];
      if (rowValues[i] !== null) {
        filters[attr] = rowValues[i];
      }
    }
    return e =>
      this.props.tableOptions.clickCallback(e, value, filters, pivotData);
  }

  clickHeaderHandler(
    pivotData,
    values,
    attrs,
    attrIdx,
    callback,
    isSubtotal = false,
    isGrandTotal = false,
  ) {
    const filters = {};
    for (let i = 0; i <= attrIdx; i += 1) {
      const attr = attrs[i];
      filters[attr] = values[i];
    }
    return e =>
      callback(
        e,
        values[attrIdx],
        filters,
        pivotData,
        isSubtotal,
        isGrandTotal,
      );
  }

  collapseAttr(rowOrCol, attrIdx, allKeys) {
    return e => {
      // Collapse an entire attribute.
      e.stopPropagation();
      const keyLen = attrIdx + 1;
      const collapsed = allKeys.filter(k => k.length === keyLen).map(flatKey);

      const updates = {};
      collapsed.forEach(k => {
        updates[k] = true;
      });

      if (rowOrCol) {
        this.setState(state => ({
          collapsedRows: { ...state.collapsedRows, ...updates },
        }));
      } else {
        this.setState(state => ({
          collapsedCols: { ...state.collapsedCols, ...updates },
        }));
      }
    };
  }

  expandAttr(rowOrCol, attrIdx, allKeys) {
    return e => {
      // Expand an entire attribute. This implicitly implies expanding all of the
      // parents as well. It's a bit inefficient but ah well...
      e.stopPropagation();
      const updates = {};
      allKeys.forEach(k => {
        for (let i = 0; i <= attrIdx; i += 1) {
          updates[flatKey(k.slice(0, i + 1))] = false;
        }
      });

      if (rowOrCol) {
        this.setState(state => ({
          collapsedRows: { ...state.collapsedRows, ...updates },
        }));
      } else {
        this.setState(state => ({
          collapsedCols: { ...state.collapsedCols, ...updates },
        }));
      }
    };
  }

  toggleRowKey(flatRowKey) {
    return e => {
      e.stopPropagation();
      this.setState(state => ({
        collapsedRows: {
          ...state.collapsedRows,
          [flatRowKey]: !state.collapsedRows[flatRowKey],
        },
      }));
    };
  }

  toggleColKey(flatColKey) {
    return e => {
      e.stopPropagation();
      this.setState(state => ({
        collapsedCols: {
          ...state.collapsedCols,
          [flatColKey]: !state.collapsedCols[flatColKey],
        },
      }));
    };
  }

  calcAttrSpans(attrArr, numAttrs) {
    // Given an array of attribute values (i.e. each element is another array with
    // the value at every level), compute the spans for every attribute value at
    // every level. The return value is a nested array of the same shape. It has
    // -1's for repeated values and the span number otherwise.

    const spans = [];
    // Index of the last new value
    const li = Array(numAttrs).map(() => 0);
    let lv = Array(numAttrs).map(() => null);
    for (let i = 0; i < attrArr.length; i += 1) {
      // Keep increasing span values as long as the last keys are the same. For
      // the rest, record spans of 1. Update the indices too.
      const cv = attrArr[i];
      const ent = [];
      let depth = 0;
      const limit = Math.min(lv.length, cv.length);
      while (depth < limit && lv[depth] === cv[depth]) {
        ent.push(-1);
        spans[li[depth]][depth] += 1;
        depth += 1;
      }
      while (depth < cv.length) {
        li[depth] = i;
        ent.push(1);
        depth += 1;
      }
      spans.push(ent);
      lv = cv;
    }
    return spans;
  }

  renderColHeaderRow(attrName, attrIdx, pivotSettings) {
    // Render a single row in the column header at the top of the pivot table.

    const {
      rowAttrs,
      colAttrs,
      colKeys,
      visibleColKeys,
      colAttrSpans,
      rowTotals,
      arrowExpanded,
      arrowCollapsed,
      colSubtotalDisplay,
      maxColVisible,
      pivotData,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;
    const {
      highlightHeaderCellsOnHover,
      omittedHighlightHeaderGroups = [],
      highlightedHeaderCells,
      dateFormatters,
    } = this.props.tableOptions;

    const spaceCell =
      attrIdx === 0 && rowAttrs.length !== 0 ? (
        <th
          key="padding"
          colSpan={rowAttrs.length}
          rowSpan={colAttrs.length}
          aria-hidden="true"
        />
      ) : null;

    const needToggle =
      colSubtotalDisplay.enabled && attrIdx !== colAttrs.length - 1;
    let arrowClickHandle = null;
    let subArrow = null;
    if (needToggle) {
      arrowClickHandle =
        attrIdx + 1 < maxColVisible
          ? this.collapseAttr(false, attrIdx, colKeys)
          : this.expandAttr(false, attrIdx, colKeys);
      subArrow = attrIdx + 1 < maxColVisible ? arrowExpanded : arrowCollapsed;
    }
    // Применяем стили форматирования к заголовку колонки
    const headerStyle = this.getHeaderStyle(attrName);
    const fieldSettings = this.getFieldSettings(attrName);
    // Используем правильные настройки для заголовков колонок
    // colAttrs уже объявлена выше через деструктуризацию из pivotSettings
    const isColumn = colAttrs.indexOf(attrName) !== -1;
    const headerFieldSettings = isColumn
      ? {
          fontSize: fieldSettings.columnHeaderFontSize ?? fieldSettings.fontSize,
          fontColor: fieldSettings.columnHeaderFontColor ?? fieldSettings.fontColor,
          backgroundColor: fieldSettings.columnHeaderBackgroundColor ?? fieldSettings.backgroundColor,
        }
      : fieldSettings;
    // Создаем ref callback для применения стилей с !important
    const headerStyleRef = this.buildFieldStyleRef(headerFieldSettings, true);
    // Разделяем стили: fontSize, fontColor, backgroundColor через ref, остальные через style
    const headerStyleWithoutFormatting = {
      ...headerStyle,
      fontSize: undefined,
      color: undefined,
      backgroundColor: undefined,
    };
    const attrNameCell = (
      <th key="label" className="pvtAxisLabel" style={headerStyleWithoutFormatting} ref={headerStyleRef}>
        {displayHeaderCell(
          needToggle,
          subArrow,
          arrowClickHandle,
          attrName,
          namesMapping,
          allowRenderHtml,
        )}
      </th>
    );

    const attrValueCells = [];
    const rowIncrSpan = rowAttrs.length !== 0 ? 1 : 0;
    // Iterate through columns. Jump over duplicate values.
    let i = 0;
    while (i < visibleColKeys.length) {
      let handleContextMenu;
      const colKey = visibleColKeys[i];
      const colSpan = attrIdx < colKey.length ? colAttrSpans[i][attrIdx] : 1;
      let colLabelClass = 'pvtColLabel';
      if (attrIdx < colKey.length) {
        if (!omittedHighlightHeaderGroups.includes(colAttrs[attrIdx])) {
          if (highlightHeaderCellsOnHover) {
            colLabelClass += ' hoverable';
          }
          handleContextMenu = e =>
            this.props.onContextMenu(e, colKey, undefined, {
              [attrName]: colKey[attrIdx],
            });
        }
        if (
          highlightedHeaderCells &&
          Array.isArray(highlightedHeaderCells[colAttrs[attrIdx]]) &&
          highlightedHeaderCells[colAttrs[attrIdx]].includes(colKey[attrIdx])
        ) {
          colLabelClass += ' active';
        }

        const rowSpan = 1 + (attrIdx === colAttrs.length - 1 ? rowIncrSpan : 0);
        const flatColKey = flatKey(colKey.slice(0, attrIdx + 1));
        const onArrowClick = needToggle ? this.toggleColKey(flatColKey) : null;

        const headerCellFormattedValue = this.formatHeaderValue(
          attrName,
          colKey[attrIdx],
          dateFormatters,
        );
        // Apply metric-specific header formatting when this header belongs to a metric value.
        const metricKey = this.getMetricKey();
        const rawHeaderValue = colKey[attrIdx];
        const valueHeaderStyle =
          metricKey &&
          attrName === metricKey &&
          (typeof rawHeaderValue === 'string' || typeof rawHeaderValue === 'number')
            ? this.getMetricHeaderStyle(String(rawHeaderValue))
            : this.getHeaderStyle(attrName);
        // Создаем ref callback для применения стилей с !important
        const valueHeaderFieldSettingsRaw = metricKey &&
          attrName === metricKey &&
          (typeof rawHeaderValue === 'string' || typeof rawHeaderValue === 'number')
          ? this.getFieldSettings(String(rawHeaderValue))
          : this.getFieldSettings(attrName);
        // Для метрик используем metricHeaderFontSize, metricHeaderFontColor, metricHeaderBackgroundColor
        // Для колонок используем columnValueFontSize, columnValueFontColor, columnValueBackgroundColor (это значения колонок, не заголовки)
        const colAttrsLocal = this.props.cols || [];
        const isColumnField = colAttrsLocal.indexOf(attrName) !== -1;
        const valueHeaderFieldSettings = metricKey &&
          attrName === metricKey &&
          (typeof rawHeaderValue === 'string' || typeof rawHeaderValue === 'number')
          ? {
              fontSize: valueHeaderFieldSettingsRaw.metricHeaderFontSize ?? valueHeaderFieldSettingsRaw.fontSize,
              fontColor: valueHeaderFieldSettingsRaw.metricHeaderFontColor ?? valueHeaderFieldSettingsRaw.fontColor,
              backgroundColor: valueHeaderFieldSettingsRaw.metricHeaderBackgroundColor ?? valueHeaderFieldSettingsRaw.backgroundColor,
              maxWidth: valueHeaderFieldSettingsRaw.maxWidth,
              truncate: valueHeaderFieldSettingsRaw.truncate,
            }
          : isColumnField
          ? {
              ...valueHeaderFieldSettingsRaw,
              fontSize: valueHeaderFieldSettingsRaw.columnValueFontSize ?? valueHeaderFieldSettingsRaw.fontSize,
              fontColor: valueHeaderFieldSettingsRaw.columnValueFontColor ?? valueHeaderFieldSettingsRaw.fontColor,
              backgroundColor: valueHeaderFieldSettingsRaw.columnValueBackgroundColor ?? valueHeaderFieldSettingsRaw.backgroundColor,
            }
          : valueHeaderFieldSettingsRaw;
        const valueHeaderStyleRef = this.buildFieldStyleRef(valueHeaderFieldSettings, true);
        // Разделяем стили: fontSize, fontColor, backgroundColor через ref, остальные через style
        const valueHeaderStyleWithoutFormatting = {
          ...valueHeaderStyle,
          fontSize: undefined,
          color: undefined,
          backgroundColor: undefined,
        };
        attrValueCells.push(
          <th
            className={colLabelClass}
            key={`colKey-${flatColKey}`}
            colSpan={colSpan}
            rowSpan={rowSpan}
            role="columnheader button"
            style={valueHeaderStyleWithoutFormatting}
            ref={valueHeaderStyleRef}
            onClick={this.clickHeaderHandler(
              pivotData,
              colKey,
              this.props.cols,
              attrIdx,
              this.props.tableOptions.clickColumnHeaderCallback,
            )}
            onContextMenu={handleContextMenu}
          >
            {displayHeaderCell(
              needToggle,
              this.state.collapsedCols[flatColKey]
                ? arrowCollapsed
                : arrowExpanded,
              onArrowClick,
              headerCellFormattedValue,
              namesMapping,
              allowRenderHtml,
            )}
          </th>,
        );
      } else if (attrIdx === colKey.length) {
        const rowSpan = colAttrs.length - colKey.length + rowIncrSpan;
        // Подытог по колонкам: глобальная метка (если задана) перекрывает per-field subtotalLabel.
        const globalTableSettings = this.getGlobalTableSettings();
        const fieldSettings = this.getFieldSettings(attrName);
        const subtotalLabel =
          globalTableSettings?.colSubTotalsLabel ||
          fieldSettings?.subtotalLabel ||
          t('Subtotal');
        // Применяем стили форматирования для colSubTotals
        const colSubtotalLabelStyleRef = globalTableSettings?.colSubTotalsValueFormat
          ? this.buildValueCellStyleRef(globalTableSettings.colSubTotalsValueFormat)
          : null;
        attrValueCells.push(
          <th
            className={`${colLabelClass} pvtSubtotalLabel`}
            key={`colKeyBuffer-${flatKey(colKey)}`}
            colSpan={colSpan}
            rowSpan={rowSpan}
            role="columnheader button"
            ref={colSubtotalLabelStyleRef}
            onClick={this.clickHeaderHandler(
              pivotData,
              colKey,
              this.props.cols,
              attrIdx,
              this.props.tableOptions.clickColumnHeaderCallback,
              true,
            )}
          >
            {subtotalLabel}
          </th>,
        );
      }
      // The next colSpan columns will have the same value anyway...
      i += colSpan;
    }

    // Итог по строкам (total колонка): используем rowTotalsLabel.
    const globalTableSettings = this.getGlobalTableSettings();
    const rowTotalsLabel =
      globalTableSettings?.rowTotalsLabel ||
      t('Total (%(aggregatorName)s)', {
        aggregatorName: t(this.props.aggregatorName),
      });
    // Применяем те же настройки форматирования, что и к значениям total по строкам,
    // чтобы шрифт/цвет/фон были согласованы у заголовка и ячеек.
    const rowTotalsLabelStyleRef = globalTableSettings?.rowTotalsValueFormat
      ? this.buildValueCellStyleRef(globalTableSettings.rowTotalsValueFormat)
      : null;
    const totalCell =
      attrIdx === 0 && rowTotals ? (
        <th
          key="total"
          className="pvtTotalLabel pvtColTotalLabel"
          rowSpan={colAttrs.length + Math.min(rowAttrs.length, 1)}
          role="columnheader button"
          ref={rowTotalsLabelStyleRef}
          onClick={this.clickHeaderHandler(
            pivotData,
            [],
            this.props.cols,
            attrIdx,
            this.props.tableOptions.clickColumnHeaderCallback,
            false,
            true,
          )}
        >
          {rowTotalsLabel}
        </th>
      ) : null;

    const cells = [spaceCell, attrNameCell, ...attrValueCells, totalCell];
    return <tr key={`colAttr-${attrIdx}`}>{cells}</tr>;
  }

  renderRowHeaderRow(pivotSettings) {
    // Render just the attribute names of the rows (the actual attribute values
    // will show up in the individual rows).

    const {
      rowAttrs,
      colAttrs,
      rowKeys,
      arrowCollapsed,
      arrowExpanded,
      rowSubtotalDisplay,
      maxRowVisible,
      pivotData,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;
    return (
      <tr key="rowHdr">
        {rowAttrs.map((r, i) => {
          const needLabelToggle =
            rowSubtotalDisplay.enabled && i !== rowAttrs.length - 1;
          let arrowClickHandle = null;
          let subArrow = null;
          if (needLabelToggle) {
            arrowClickHandle =
              i + 1 < maxRowVisible
                ? this.collapseAttr(true, i, rowKeys)
                : this.expandAttr(true, i, rowKeys);
            subArrow = i + 1 < maxRowVisible ? arrowExpanded : arrowCollapsed;
          }
          // Применяем стили форматирования к заголовкам строк
          const rowHeaderStyle = this.getHeaderStyle(r);
          const rowHeaderFieldSettings = this.getFieldSettings(r);
          // Используем правильные настройки для заголовков строк
          const rowAttrsLocal = this.props.rows || [];
          const isRow = rowAttrsLocal.indexOf(r) !== -1;
          const normalizedRowHeaderFieldSettings = isRow
            ? {
                ...rowHeaderFieldSettings,
                fontSize: rowHeaderFieldSettings.rowHeaderFontSize ?? rowHeaderFieldSettings.fontSize,
                fontColor: rowHeaderFieldSettings.rowHeaderFontColor ?? rowHeaderFieldSettings.fontColor,
                backgroundColor: rowHeaderFieldSettings.rowHeaderBackgroundColor ?? rowHeaderFieldSettings.backgroundColor,
              }
            : rowHeaderFieldSettings;
          // Создаем ref callback для применения стилей с !important
          const rowHeaderStyleRef = this.buildFieldStyleRef(normalizedRowHeaderFieldSettings, true);
          // Разделяем стили: fontSize, fontColor, backgroundColor через ref, остальные через style
          const rowHeaderStyleWithoutFormatting = {
            ...rowHeaderStyle,
            fontSize: undefined,
            color: undefined,
            backgroundColor: undefined,
          };
          return (
            <th className="pvtAxisLabel" key={`rowAttr-${i}`} style={rowHeaderStyleWithoutFormatting} ref={rowHeaderStyleRef}>
              {displayHeaderCell(
                needLabelToggle,
                subArrow,
                arrowClickHandle,
                r,
                namesMapping,
                allowRenderHtml,
              )}
            </th>
          );
        })}
        {(() => {
          // Применяем стили форматирования для row totals в заголовке строк
          const globalTableSettings = this.getGlobalTableSettings();
          const rowTotalsLabelStyleRef = globalTableSettings?.rowTotalsValueFormat
            ? this.buildValueCellStyleRef(globalTableSettings.rowTotalsValueFormat)
            : null;
          return (
        <th
              className="pvtTotalLabel pvtColTotalLabel"
          key="padding"
          role="columnheader button"
              ref={rowTotalsLabelStyleRef}
          onClick={this.clickHeaderHandler(
            pivotData,
            [],
            this.props.rows,
            0,
            this.props.tableOptions.clickRowHeaderCallback,
            false,
            true,
          )}
        >
          {colAttrs.length === 0
            ? t('Total (%(aggregatorName)s)', {
                aggregatorName: t(this.props.aggregatorName),
              })
            : null}
        </th>
          );
        })()}
      </tr>
    );
  }

  renderTableRow(rowKey, rowIdx, pivotSettings) {
    // Render a single row in the pivot table.

    const {
      rowAttrs,
      colAttrs,
      rowAttrSpans,
      visibleColKeys,
      pivotData,
      rowTotals,
      rowSubtotalDisplay,
      arrowExpanded,
      arrowCollapsed,
      cellCallbacks,
      rowTotalCallbacks,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;

    const {
      highlightHeaderCellsOnHover,
      omittedHighlightHeaderGroups = [],
      highlightedHeaderCells,
      cellColorFormatters,
      dateFormatters,
    } = this.props.tableOptions;
    const flatRowKey = flatKey(rowKey);
    const globalTableSettings = this.getGlobalTableSettings();
    const isRowSubtotalRow = rowKey.length < rowAttrs.length;

    const colIncrSpan = colAttrs.length !== 0 ? 1 : 0;
    const attrValueCells = rowKey.map((r, i) => {
      let handleContextMenu;
      let valueCellClassName = 'pvtRowLabel';
      if (!omittedHighlightHeaderGroups.includes(rowAttrs[i])) {
        if (highlightHeaderCellsOnHover) {
          valueCellClassName += ' hoverable';
        }
        handleContextMenu = e =>
          this.props.onContextMenu(e, undefined, rowKey, {
            [rowAttrs[i]]: r,
          });
      }
      if (
        highlightedHeaderCells &&
        Array.isArray(highlightedHeaderCells[rowAttrs[i]]) &&
        highlightedHeaderCells[rowAttrs[i]].includes(r)
      ) {
        valueCellClassName += ' active';
      }
      const rowSpan = rowAttrSpans[rowIdx][i];
      if (rowSpan > 0) {
        const flatRowKey = flatKey(rowKey.slice(0, i + 1));
        const colSpan = 1 + (i === rowAttrs.length - 1 ? colIncrSpan : 0);
        const needRowToggle =
          rowSubtotalDisplay.enabled && i !== rowAttrs.length - 1;
        const onArrowClick = needRowToggle
          ? this.toggleRowKey(flatRowKey)
          : null;

        const headerCellFormattedValue = this.formatHeaderValue(
          rowAttrs[i],
          r,
          dateFormatters,
        );
        // Apply metric-specific header formatting when metric dimension is placed on rows.
        const metricKey = this.getMetricKey();
        const rowValueHeaderStyle =
          metricKey &&
          rowAttrs[i] === metricKey &&
          (typeof r === 'string' || typeof r === 'number')
            ? this.getMetricHeaderStyle(String(r))
            : this.getHeaderStyle(rowAttrs[i]);
        // Создаем ref callback для применения стилей с !important
        // Для Row values всегда используем поле строки (rowAttrs[i]), а не значение строки (r)
        // Настройки хранятся по имени поля (например, "БР"), а не по значению строки (например, "Москва и Центр")
        const rowAttrsLocal = this.props.rows || [];
        const isRowField = rowAttrsLocal.indexOf(rowAttrs[i]) !== -1;
        const isMetricValue = metricKey && rowAttrs[i] === metricKey && (typeof r === 'string' || typeof r === 'number');
        // Для метрик используем значение строки, для Row fields - всегда поле строки
        const rowValueHeaderFieldSettingsRaw = isMetricValue
          ? this.getFieldSettings(String(r))
          : this.getFieldSettings(rowAttrs[i]);
        // Для метрик используем metricHeaderFontSize, metricHeaderFontColor, metricHeaderBackgroundColor
        // Для строк используем rowValueFontSize, rowValueFontColor, rowValueBackgroundColor (это значения строк, не заголовки)
        const rowValueHeaderFieldSettings = isMetricValue
          ? {
              fontSize: rowValueHeaderFieldSettingsRaw.metricHeaderFontSize ?? rowValueHeaderFieldSettingsRaw.fontSize,
              fontColor: rowValueHeaderFieldSettingsRaw.metricHeaderFontColor ?? rowValueHeaderFieldSettingsRaw.fontColor,
              backgroundColor: rowValueHeaderFieldSettingsRaw.metricHeaderBackgroundColor ?? rowValueHeaderFieldSettingsRaw.backgroundColor,
              maxWidth: rowValueHeaderFieldSettingsRaw.maxWidth,
              truncate: rowValueHeaderFieldSettingsRaw.truncate,
            }
          : isRowField
          ? {
              ...rowValueHeaderFieldSettingsRaw,
              fontSize: rowValueHeaderFieldSettingsRaw.rowValueFontSize ?? rowValueHeaderFieldSettingsRaw.fontSize,
              fontColor: rowValueHeaderFieldSettingsRaw.rowValueFontColor ?? rowValueHeaderFieldSettingsRaw.fontColor,
              backgroundColor: rowValueHeaderFieldSettingsRaw.rowValueBackgroundColor ?? rowValueHeaderFieldSettingsRaw.backgroundColor,
            }
          : rowValueHeaderFieldSettingsRaw;
        const rowValueHeaderStyleRef = this.buildFieldStyleRef(rowValueHeaderFieldSettings, true);
        // Разделяем стили: fontSize, fontColor, backgroundColor через ref, остальные через style
        const rowValueHeaderStyleWithoutFormatting = {
          ...rowValueHeaderStyle,
          fontSize: undefined,
          color: undefined,
          backgroundColor: undefined,
        };
        return (
          <th
            key={`rowKeyLabel-${i}`}
            className={valueCellClassName}
            rowSpan={rowSpan}
            colSpan={colSpan}
            role="columnheader button"
            style={rowValueHeaderStyleWithoutFormatting}
            ref={rowValueHeaderStyleRef}
            onClick={this.clickHeaderHandler(
              pivotData,
              rowKey,
              this.props.rows,
              i,
              this.props.tableOptions.clickRowHeaderCallback,
            )}
            onContextMenu={handleContextMenu}
          >
            {displayHeaderCell(
              needRowToggle,
              this.state.collapsedRows[flatRowKey]
                ? arrowCollapsed
                : arrowExpanded,
              onArrowClick,
              headerCellFormattedValue,
              namesMapping,
              allowRenderHtml,
            )}
          </th>
        );
      }
      return null;
    });

    // Получаем кастомную метку подытога для строки, если она задана
    const rowSubtotalAttrName =
      rowKey.length > 0 && rowKey.length <= rowAttrs.length
        ? rowAttrs[rowKey.length - 1]
        : null;
    const rowFieldSettings = rowSubtotalAttrName
      ? this.getFieldSettings(rowSubtotalAttrName)
      : {};
    const rowSubtotalLabel =
      globalTableSettings?.rowSubTotalsLabel ||
      rowFieldSettings?.subtotalLabel ||
      t('Subtotal');
    // Для заголовка строки подытога применяем глобальный стиль rowSubTotalsValueFormat,
    // чтобы настройки шрифта и цветов были заметны не только в числовых ячейках.
    const rowSubtotalLabelStyleRef = globalTableSettings?.rowSubTotalsValueFormat
      ? this.buildValueCellStyleRef(globalTableSettings.rowSubTotalsValueFormat)
      : null;
    const attrValuePaddingCell =
      rowKey.length < rowAttrs.length ? (
        <th
          className="pvtRowLabel pvtSubtotalLabel"
          key="rowKeyBuffer"
          colSpan={rowAttrs.length - rowKey.length + colIncrSpan}
          rowSpan={1}
          role="columnheader button"
          ref={rowSubtotalLabelStyleRef}
          onClick={this.clickHeaderHandler(
            pivotData,
            rowKey,
            this.props.rows,
            rowKey.length,
            this.props.tableOptions.clickRowHeaderCallback,
            true,
          )}
        >
          {rowSubtotalLabel}
        </th>
      ) : null;

    const rowClickHandlers = cellCallbacks[flatRowKey] || {};
    const { tableOptions } = this.props;
    const { transposePivot, metricsSqlExpressions, metricsOrder, metricNameMapping } = tableOptions || {};
    const metricKey = this.getMetricKey();
    
    const valueCells = visibleColKeys.map((colKey, colIndex) => {
      const flatColKey = flatKey(colKey);
      // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ - логируем структуру colKey для обычных ячеек
      if (typeof console !== 'undefined' && console.log && !isRowSubtotalRow && colIndex === 0) {
        console.log('[renderRow] Normal cell colKey structure:', {
          rowKey: JSON.stringify(rowKey),
          rowKeyLength: rowKey ? rowKey.length : 0,
          rowKeyItems: rowKey ? rowKey.map((item, i) => `[${i}]: ${JSON.stringify(item)} (${typeof item})`) : [],
          colKey: JSON.stringify(colKey),
          colKeyLength: colKey ? colKey.length : 0,
          colKeyItems: colKey ? colKey.map((item, i) => `[${i}]: ${JSON.stringify(item)} (${typeof item})`) : [],
          colAttrs: JSON.stringify(colAttrs),
          colAttrsLength: colAttrs ? colAttrs.length : 0,
          colAttrsItems: colAttrs ? colAttrs.map((item, i) => `[${i}]: "${item}"`) : [],
          metricKey: JSON.stringify(metricKey),
          metricsOrder: JSON.stringify(metricsOrder)
        });
        const agg = pivotData.getAggregator(rowKey, colKey);
        if (agg) {
          console.log('[renderRow] Normal cell aggregator value:', { value: agg.value(), rowKey: JSON.stringify(rowKey), colKey: JSON.stringify(colKey) });
        } else {
          console.log('[renderRow] Normal cell aggregator not found for:', { rowKey: JSON.stringify(rowKey), colKey: JSON.stringify(colKey) });
        }
      }
      const agg = pivotData.getAggregator(rowKey, colKey);
      
      // Для подытогов строк при transposePivot = false проверяем, является ли метрика формулой
      let aggValue = agg.value();
      if (isRowSubtotalRow && !transposePivot && metricsSqlExpressions && metricKey) {
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ - логируем структуру colKey для подытогов строк
        if (typeof console !== 'undefined' && console.log && colIndex === 0) {
          console.log('[renderRow] Row subtotal colKey structure:', {
            rowKey: JSON.stringify(rowKey),
            rowKeyLength: rowKey ? rowKey.length : 0,
            rowKeyItems: rowKey ? rowKey.map((item, i) => `[${i}]: ${JSON.stringify(item)} (${typeof item})`) : [],
            colKey: JSON.stringify(colKey),
            colKeyLength: colKey ? colKey.length : 0,
            colKeyItems: colKey ? colKey.map((item, i) => `[${i}]: ${JSON.stringify(item)} (${typeof item})`) : [],
            colAttrs: JSON.stringify(colAttrs),
            colAttrsLength: colAttrs ? colAttrs.length : 0,
            colAttrsItems: colAttrs ? colAttrs.map((item, i) => `[${i}]: "${item}"`) : [],
            metricKey: JSON.stringify(metricKey),
            metricsOrder: JSON.stringify(metricsOrder)
          });
          console.log('[renderRow] Row subtotal aggregator value:', { value: aggValue, rowKey: JSON.stringify(rowKey), colKey: JSON.stringify(colKey) });
        }
        const metricName = this.getMetricNameForCell(rowKey, colKey, rowAttrs, colAttrs, colIndex);
        // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        if (typeof console !== 'undefined' && console.log) {
          console.log('[renderRow] isRowSubtotalRow:', isRowSubtotalRow, 'metricName:', metricName, 'hasSqlExpression:', metricName && metricsSqlExpressions[metricName]);
        }
        if (metricName && metricsSqlExpressions[metricName]) {
          // Метрика является формулой, вычисляем значение по формуле
          const formulaValue = this.computeFormulaValue(
            metricName,
            rowKey,
            colKey,
            true, // isRowSubtotal
            false, // isColSubtotal
            pivotData,
            rowAttrs,
            colAttrs,
            metricKey,
            metricsSqlExpressions,
            metricsOrder,
            metricNameMapping
          );
          // ВРЕМЕННОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
          if (typeof console !== 'undefined' && console.log) {
            console.log('[renderRow] formula calculation result:', { metricName, formulaValue, aggValue, rowKey, colKey });
          }
          if (formulaValue !== null && formulaValue !== undefined && !Number.isNaN(formulaValue)) {
            aggValue = formulaValue;
          }
          // Если formulaValue равен null, используем стандартное значение aggValue
        }
      }
      
      const isColSubtotalCol = colKey.length < colAttrs.length;

      const keys = [...rowKey, ...colKey];
      let backgroundColor;
      if (cellColorFormatters) {
        Object.values(cellColorFormatters).forEach(cellColorFormatter => {
          if (Array.isArray(cellColorFormatter)) {
            keys.forEach(key => {
              if (backgroundColor) {
                return;
              }
              cellColorFormatter
                .filter(formatter => formatter.column === key)
                .forEach(formatter => {
                  const formatterResult = formatter.getColorFromValue(aggValue);
                  if (formatterResult) {
                    backgroundColor = formatterResult;
                  }
                });
            });
          }
        });
      }

      // Apply formatting to data cells:
      // - field-based cell style (e.g. last col attr)
      // - metric-specific value style (based on concrete metric name, like "Факт")
      const cellAttrName =
        colKey.length > 0 ? colAttrs[colKey.length - 1] : null;
      const cellStyle = cellAttrName ? this.getCellStyle(cellAttrName) : {};

      const metricName = this.getMetricNameForCell(
        rowKey,
        colKey,
        rowAttrs,
        colAttrs,
        colIndex,
      );
      const metricValueStyle = metricName
        ? this.getMetricValueStyle(metricName)
        : {};
      
      // Объединяем стили: сначала стили форматирования, затем цвет фона из formatter
      // Создаем ref callback для применения стилей с !important для totals/subtotals
      const rowSubtotalStyleRef = isRowSubtotalRow && globalTableSettings?.rowSubTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.rowSubTotalsValueFormat)
        : null;
      const colSubtotalStyleRef = isColSubtotalCol && globalTableSettings?.colSubTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.colSubTotalsValueFormat)
        : null;
      
      // Создаем ref callbacks для cellStyle и metricValueStyle
      // Используем правильные настройки для значений колонок/строк
      const cellFieldSettings = cellAttrName ? this.getFieldSettings(cellAttrName) : {};
      const colAttrsLocal = this.props.cols || [];
      const rowAttrsLocal = this.props.rows || [];
      const isColumnField = cellAttrName && colAttrsLocal.indexOf(cellAttrName) !== -1;
      const isRowField = cellAttrName && rowAttrsLocal.indexOf(cellAttrName) !== -1;
      const normalizedCellFieldSettings = cellAttrName
        ? (isColumnField
            ? {
                fontSize: cellFieldSettings.columnValueFontSize ?? cellFieldSettings.fontSize,
                fontColor: cellFieldSettings.columnValueFontColor ?? cellFieldSettings.fontColor,
                backgroundColor: cellFieldSettings.columnValueBackgroundColor ?? cellFieldSettings.backgroundColor,
              }
            : isRowField
            ? {
                fontSize: cellFieldSettings.rowValueFontSize ?? cellFieldSettings.fontSize,
                fontColor: cellFieldSettings.rowValueFontColor ?? cellFieldSettings.fontColor,
                backgroundColor: cellFieldSettings.rowValueBackgroundColor ?? cellFieldSettings.backgroundColor,
              }
            : cellFieldSettings)
        : null;
      const cellStyleRef = normalizedCellFieldSettings ? this.buildFieldStyleRef(normalizedCellFieldSettings, false) : null;
      const metricValueFieldSettings = metricName ? this.getFieldSettings(metricName) : {};
      const metricValueStyleRef = metricName ? this.buildFieldStyleRef({
        fontSize: metricValueFieldSettings.metricValueFontSize ?? metricValueFieldSettings.fontSize,
        fontColor: metricValueFieldSettings.metricValueFontColor ?? metricValueFieldSettings.fontColor,
        backgroundColor: metricValueFieldSettings.metricValueBackgroundColor ?? metricValueFieldSettings.backgroundColor,
      }, false) : null;
      
      // Объединяем все ref callbacks
      const allRefCallbacks = [rowSubtotalStyleRef, colSubtotalStyleRef, cellStyleRef, metricValueStyleRef].filter(Boolean);
      const combinedStyleRef = allRefCallbacks.length > 0
        ? (element) => {
            allRefCallbacks.forEach(refCallback => refCallback(element));
          }
        : null;

      // Разделяем стили: fontSize, fontColor, backgroundColor через ref, остальные через style
      const finalStyle = {
        ...(agg.isSubtotal ? { fontWeight: 'bold' } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
      };

      const formattedByAgg = agg.format(aggValue);
      // Per-metric override для форматирования значений метрики:
      // если у конкретной метрики задан valueFormat/dateFormat, применяем их к value-cell.
      // Важно: totals/subtotals форматы (globalTableSettings.*ValueFormat) имеют приоритет.
      const metricFormatSettings = metricName ? this.getFieldSettings(metricName) : undefined;
      
      // Обработка адаптивного форматирования для подытогов/итогов
      let overrideFormatSettings =
        (isRowSubtotalRow && globalTableSettings?.rowSubTotalsValueFormat) ||
        (isColSubtotalCol && globalTableSettings?.colSubTotalsValueFormat) ||
        metricFormatSettings ||
        undefined;
      
      // Если используется адаптивное форматирование для подытогов строк
      if (isRowSubtotalRow && isAdaptiveFormatting(globalTableSettings?.rowSubTotalsValueFormat?.valueFormat)) {
        const adaptiveMetricName = this.getMetricNameForCell(rowKey, colKey, rowAttrs, colAttrs, colIndex);
        const adaptiveMetricFormat = adaptiveMetricName ? this.getMetricFormat(adaptiveMetricName) : undefined;
        if (adaptiveMetricFormat) {
          overrideFormatSettings = { valueFormat: adaptiveMetricFormat };
        } else {
          // Если формат метрики не найден, используем формат агрегатора
          overrideFormatSettings = undefined;
        }
      }
      
      // Если используется адаптивное форматирование для подытогов колонок
      if (isColSubtotalCol && isAdaptiveFormatting(globalTableSettings?.colSubTotalsValueFormat?.valueFormat)) {
        const adaptiveMetricName = this.getMetricNameForCell(rowKey, colKey, rowAttrs, colAttrs, colIndex);
        const adaptiveMetricFormat = adaptiveMetricName ? this.getMetricFormat(adaptiveMetricName) : undefined;
        if (adaptiveMetricFormat) {
          overrideFormatSettings = { valueFormat: adaptiveMetricFormat };
        } else {
          // Если формат метрики не найден, используем формат агрегатора
          overrideFormatSettings = undefined;
        }
      }
      
      const formattedValue = this.formatAggValue(
        aggValue,
        formattedByAgg,
        overrideFormatSettings,
      );

      return (
        <td
          role="gridcell"
          className="pvtVal"
          key={`pvtVal-${flatColKey}`}
          ref={combinedStyleRef}
          onClick={rowClickHandlers[flatColKey]}
          onContextMenu={e => this.props.onContextMenu(e, colKey, rowKey)}
          style={finalStyle}
        >
          {displayCell(formattedValue, allowRenderHtml)}
        </td>
      );
    });

    let totalCell = null;
    if (rowTotals) {
      const agg = pivotData.getAggregator(rowKey, []);
      const aggValue = agg.value();
      const totalStyleRef = globalTableSettings?.rowTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.rowTotalsValueFormat)
        : null;
      
      // Обработка адаптивного форматирования для итогов строк
      let totalFormatSettings = globalTableSettings?.rowTotalsValueFormat;
      if (isAdaptiveFormatting(totalFormatSettings?.valueFormat)) {
        // Для итогов строк метрика определяется по rowKey (когда transposePivot = true)
        const adaptiveMetricName = this.getMetricNameForCell(rowKey, [], rowAttrs, colAttrs);
        const adaptiveMetricFormat = adaptiveMetricName ? this.getMetricFormat(adaptiveMetricName) : undefined;
        if (adaptiveMetricFormat) {
          totalFormatSettings = { ...totalFormatSettings, valueFormat: adaptiveMetricFormat };
        } else {
          // Если формат метрики не найден, используем формат агрегатора
          totalFormatSettings = undefined;
        }
      }
      
      const totalFormattedValue = this.formatAggValue(
        aggValue,
        agg.format(aggValue),
        totalFormatSettings,
      );
      // Объединяем ref callback со стилями padding
      const totalCellRef = totalStyleRef
        ? (element) => {
            if (element) {
              element.style.padding = '5px';
              totalStyleRef(element);
            }
          }
        : (element) => {
            if (element) {
              element.style.padding = '5px';
            }
          };
      totalCell = (
        <td
          role="gridcell"
          key="total"
          className="pvtTotal"
          ref={totalCellRef}
          onClick={rowTotalCallbacks[flatRowKey]}
          onContextMenu={e => this.props.onContextMenu(e, undefined, rowKey)}
        >
          {displayCell(totalFormattedValue, allowRenderHtml)}
        </td>
      );
    }

    const rowCells = [
      ...attrValueCells,
      attrValuePaddingCell,
      ...valueCells,
      totalCell,
    ];

    return <tr key={`keyRow-${flatRowKey}`}>{rowCells}</tr>;
  }

  renderTotalsRow(pivotSettings) {
    // Render the final totals rows that has the totals for all the columns.

    const {
      rowAttrs,
      colAttrs,
      visibleColKeys,
      rowTotals,
      pivotData,
      colTotalCallbacks,
      grandTotalCallback,
    } = pivotSettings;

    // Итог по колонкам (Total строка): используем columnTotalsLabel.
    const globalTableSettings = this.getGlobalTableSettings();
    const colTotalsLabel =
      globalTableSettings?.columnTotalsLabel ||
      t('Total (%(aggregatorName)s)', {
        aggregatorName: t(this.props.aggregatorName),
      });
    // Для заголовка строки итогов по колонкам используем columnTotalsValueFormat,
    // чтобы настройки форматирования были едины для заголовка и значений.
    // Если columnTotalsValueFormat не задан, но есть rowTotalsValueFormat, используем его
    // для совместимости со старыми настройками
    // Проверяем, что объект не пустой и содержит хотя бы одно свойство форматирования
    const hasColumnTotalsFormat = globalTableSettings?.columnTotalsValueFormat &&
      typeof globalTableSettings.columnTotalsValueFormat === 'object' &&
      Object.keys(globalTableSettings.columnTotalsValueFormat).length > 0;
    const hasRowTotalsFormat = globalTableSettings?.rowTotalsValueFormat &&
      typeof globalTableSettings.rowTotalsValueFormat === 'object' &&
      Object.keys(globalTableSettings.rowTotalsValueFormat).length > 0;
    const colTotalsLabelStyleRef = hasColumnTotalsFormat
      ? this.buildValueCellStyleRef(globalTableSettings.columnTotalsValueFormat)
      : hasRowTotalsFormat
        ? this.buildValueCellStyleRef(globalTableSettings.rowTotalsValueFormat)
        : null;

    const totalLabelCell = (
      <th
        key="label"
        className="pvtTotalLabel pvtRowTotalLabel"
        colSpan={rowAttrs.length + Math.min(colAttrs.length, 1)}
        role="columnheader button"
        ref={colTotalsLabelStyleRef}
        onClick={this.clickHeaderHandler(
          pivotData,
          [],
          this.props.rows,
          0,
          this.props.tableOptions.clickRowHeaderCallback,
          false,
          true,
        )}
      >
        {colTotalsLabel}
      </th>
    );

    const { tableOptions } = this.props;
    const { transposePivot, metricsSqlExpressions, metricsOrder, metricNameMapping } = tableOptions || {};
    const metricKey = this.getMetricKey();
    
    const totalValueCells = visibleColKeys.map(colKey => {
      const flatColKey = flatKey(colKey);
      const agg = pivotData.getAggregator([], colKey);
      
      // Для итогов колонок при transposePivot = false проверяем, является ли метрика формулой
      let aggValue = agg.value();
      if (!transposePivot && metricsSqlExpressions && metricKey) {
        const metricName = this.getMetricNameForCell([], colKey, rowAttrs, colAttrs);
        if (metricName && metricsSqlExpressions[metricName]) {
          // Метрика является формулой, вычисляем значение по формуле
          const formulaValue = this.computeFormulaValue(
            metricName,
            [], // rowKey для итога колонки пустой
            colKey,
            false, // isRowSubtotal
            false, // isColSubtotal (это итог колонки, а не подытог)
            pivotData,
            rowAttrs,
            colAttrs,
            metricKey,
            metricsSqlExpressions,
            metricsOrder,
            metricNameMapping
          );
          if (formulaValue !== null && formulaValue !== undefined && !Number.isNaN(formulaValue)) {
            aggValue = formulaValue;
          }
          // Если formulaValue равен null, используем стандартное значение aggValue
        }
      }
      
      const totalRowStyleRef = globalTableSettings?.columnTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.columnTotalsValueFormat)
        : null;
      
      // Обработка адаптивного форматирования для итогов колонок
      let totalRowFormatSettings = globalTableSettings?.columnTotalsValueFormat;
      if (isAdaptiveFormatting(totalRowFormatSettings?.valueFormat)) {
        // Для итогов колонок метрика определяется по colKey (когда transposePivot = false)
        const adaptiveMetricName = this.getMetricNameForCell([], colKey, rowAttrs, colAttrs);
        const adaptiveMetricFormat = adaptiveMetricName ? this.getMetricFormat(adaptiveMetricName) : undefined;
        if (adaptiveMetricFormat) {
          totalRowFormatSettings = { ...totalRowFormatSettings, valueFormat: adaptiveMetricFormat };
        } else {
          // Если формат метрики не найден, используем формат агрегатора
          totalRowFormatSettings = undefined;
        }
      }
      
      const totalRowFormattedValue = this.formatAggValue(
        aggValue,
        agg.format(aggValue),
        totalRowFormatSettings,
      );

      // Объединяем ref callback со стилями padding
      const combinedRef = totalRowStyleRef
        ? (element) => {
            if (element) {
              element.style.padding = '5px';
              totalRowStyleRef(element);
            }
          }
        : (element) => {
            if (element) {
              element.style.padding = '5px';
            }
          };

      return (
        <td
          role="gridcell"
          className="pvtTotal pvtRowTotal"
          key={`total-${flatColKey}`}
          ref={combinedRef}
          onClick={colTotalCallbacks[flatColKey]}
          onContextMenu={e => this.props.onContextMenu(e, colKey, undefined)}
        >
          {displayCell(totalRowFormattedValue, this.props.allowRenderHtml)}
        </td>
      );
    });

    let grandTotalCell = null;
    if (rowTotals) {
      const agg = pivotData.getAggregator([], []);
      const aggValue = agg.value();
      const grandTotalStyleRef = globalTableSettings?.columnTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.columnTotalsValueFormat)
        : null;
      const grandTotalFormattedValue = this.formatAggValue(
        aggValue,
        agg.format(aggValue),
        globalTableSettings?.columnTotalsValueFormat,
      );
      // Объединяем ref callback со стилями padding
      const grandTotalRef = grandTotalStyleRef
        ? (element) => {
            if (element) {
              element.style.padding = '5px';
              grandTotalStyleRef(element);
            }
          }
        : (element) => {
            if (element) {
              element.style.padding = '5px';
            }
          };
      grandTotalCell = (
        <td
          role="gridcell"
          key="total"
          className="pvtGrandTotal pvtRowTotal"
          ref={grandTotalRef}
          onClick={grandTotalCallback}
          onContextMenu={e => this.props.onContextMenu(e, undefined, undefined)}
        >
          {displayCell(grandTotalFormattedValue, this.props.allowRenderHtml)}
        </td>
      );
    }

    const totalCells = [totalLabelCell, ...totalValueCells, grandTotalCell];

    return (
      <tr key="total" className="pvtRowTotals">
        {totalCells}
      </tr>
    );
  }

  visibleKeys(keys, collapsed, numAttrs, subtotalDisplay) {
    return keys.filter(
      key =>
        // Is the key hidden by one of its parents?
        !key.some((k, j) => collapsed[flatKey(key.slice(0, j))]) &&
        // Leaf key.
        (key.length === numAttrs ||
          // Children hidden. Must show total.
          flatKey(key) in collapsed ||
          // Don't hide totals.
          !subtotalDisplay.hideOnExpand),
    );
  }

  isDashboardEditMode() {
    return document.contains(document.querySelector('.dashboard--editing'));
  }

  render() {
    if (this.cachedProps !== this.props) {
      this.cachedProps = this.props;
      this.cachedBasePivotSettings = this.getBasePivotSettings();
    }
    const {
      colAttrs,
      rowAttrs,
      rowKeys,
      colKeys,
      colTotals,
      rowSubtotalDisplay,
      colSubtotalDisplay,
      allowRenderHtml,
    } = this.cachedBasePivotSettings;

    // Need to account for exclusions to compute the effective row
    // and column keys.
    const visibleRowKeys = this.visibleKeys(
      rowKeys,
      this.state.collapsedRows,
      rowAttrs.length,
      rowSubtotalDisplay,
    );
    const visibleColKeys = this.visibleKeys(
      colKeys,
      this.state.collapsedCols,
      colAttrs.length,
      colSubtotalDisplay,
    );

    const pivotSettings = {
      visibleRowKeys,
      maxRowVisible: Math.max(...visibleRowKeys.map(k => k.length)),
      visibleColKeys,
      maxColVisible: Math.max(...visibleColKeys.map(k => k.length)),
      rowAttrSpans: this.calcAttrSpans(visibleRowKeys, rowAttrs.length),
      colAttrSpans: this.calcAttrSpans(visibleColKeys, colAttrs.length),
      allowRenderHtml,
      ...this.cachedBasePivotSettings,
    };

    return (
      <Styles isDashboardEditMode={this.isDashboardEditMode()}>
        <table className="pvtTable" role="grid">
          <thead>
            {colAttrs.map((c, j) =>
              this.renderColHeaderRow(c, j, pivotSettings),
            )}
            {rowAttrs.length !== 0 && this.renderRowHeaderRow(pivotSettings)}
          </thead>
          <tbody>
            {visibleRowKeys.map((r, i) =>
              this.renderTableRow(r, i, pivotSettings),
            )}
            {colTotals && this.renderTotalsRow(pivotSettings)}
          </tbody>
        </table>
      </Styles>
    );
  }
}

TableRenderer.propTypes = {
  ...PivotData.propTypes,
  tableOptions: PropTypes.object,
  onContextMenu: PropTypes.func,
};
TableRenderer.defaultProps = { ...PivotData.defaultProps, tableOptions: {} };
