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
import {
  ChartProps,
  DataRecord,
  extractTimegrain,
  getTimeFormatter,
  getTimeFormatterForGranularity,
  SMART_DATE_ID,
  TimeFormats,
} from '@superset-ui/core';

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
function createMonthYearRuFormatter(): (date: Date | number | string) => string {
  return (date: Date | number | string) => {
    let dateObj: Date;
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
  };
}
import { GenericDataType } from '@apache-superset/core/api/core';
import { getColorFormatters } from '@superset-ui/chart-controls';
import {
  DateFormatter,
  PivotTableV2QueryFormData,
  PivotTableV2Props,
} from '../types';

const { DATABASE_DATETIME } = TimeFormats;

function isNumeric(key: string, data: DataRecord[] = []) {
  return data.every(
    record =>
      record[key] === null ||
      record[key] === undefined ||
      typeof record[key] === 'number',
  );
}

// Преобразовать цвет, который приходит из ColorPickerControl (RGBColor), в CSS-строку.
// Это нужно потому, что в Explore ColorPickerControl возвращает объект вида:
// { r: number, g: number, b: number, a?: number }
// а TableRenderers ожидает строку для style.color / style.backgroundColor.
function toCssColor(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const v = value as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
  if (
    typeof v.r !== 'number' ||
    typeof v.g !== 'number' ||
    typeof v.b !== 'number'
  ) {
    return undefined;
  }

  const r = Math.round(v.r);
  const g = Math.round(v.g);
  const b = Math.round(v.b);
  const a = typeof v.a === 'number' ? v.a : 1;

  // rgba работает и для alpha=1
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Нормализовать настройки форматирования value-ячеек (для total/subtotal).
// ColorPickerControl возвращает RGBColor, поэтому конвертируем в CSS цвет.
function normalizeValueCellFormatSettings(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const v = value as {
    valueFormat?: unknown;
    dateFormat?: unknown;
    fontSize?: unknown;
    fontColor?: unknown;
    backgroundColor?: unknown;
  };

  const out: Record<string, unknown> = {};

  if (typeof v.valueFormat === 'string' && v.valueFormat.length > 0) {
    out.valueFormat = v.valueFormat;
  }
  if (typeof v.dateFormat === 'string' && v.dateFormat.length > 0) {
    out.dateFormat = v.dateFormat;
  }
  if (typeof v.fontSize === 'number') {
    out.fontSize = v.fontSize;
  }
  const fontColorCss = toCssColor(v.fontColor);
  if (typeof fontColorCss === 'string') {
    out.fontColor = fontColorCss;
  }
  const backgroundColorCss = toCssColor(v.backgroundColor);
  if (typeof backgroundColorCss === 'string') {
    out.backgroundColor = backgroundColorCss;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeGlobalTableSettings(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const v = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...v };

  out.rowTotalsValueFormat =
    normalizeValueCellFormatSettings(v.rowTotalsValueFormat) ||
    v.rowTotalsValueFormat;
  out.columnTotalsValueFormat =
    normalizeValueCellFormatSettings(v.columnTotalsValueFormat) ||
    v.columnTotalsValueFormat;
  out.rowSubTotalsValueFormat =
    normalizeValueCellFormatSettings(v.rowSubTotalsValueFormat) ||
    v.rowSubTotalsValueFormat;
  out.colSubTotalsValueFormat =
    normalizeValueCellFormatSettings(v.colSubTotalsValueFormat) ||
    v.colSubTotalsValueFormat;

  return out;
}

/**
 * Собрать итоговые настройки форматирования полей (fieldGroupingSettings) из:
 * 1) formData.fieldGroupingSettings (если она есть)
 * 2) "временных" контролов вида field_formatting_field{N}_*
 *
 * Почему так:
 * - Superset не вызывает `formDataOverrides` на каждый чих (например, при renderTrigger)
 * - Значит, чтобы изменения влияли на отрисовку сразу, мы собираем настройки
 *   прямо здесь, на каждый вызов transformProps.
 *
 * Важно: ключи в fieldGroupingSettings должны совпадать с getColumnLabel(...) и
 * названиями метрик (label), потому что именно эти строки используются как row/col attrs
 * в PivotTable.
 */
function buildEffectiveFieldGroupingSettings(
  // ChartProps.formData в рантайме может быть просто PlainObject, поэтому принимаем
  // максимально безопасный тип и работаем через проверки/приведение.
  formData: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  // Достать "человекочитаемое" имя метрики из QueryFormMetric (который может быть строкой или объектом).
  // Пишем максимально просто и безопасно, без сложных паттернов.
  function getMetricLabel(metric: unknown): string | null {
    if (typeof metric === 'string' && metric.length > 0) {
      return metric;
    }
    if (!metric || typeof metric !== 'object') {
      return null;
    }
    const m = metric as { label?: unknown; sqlExpression?: unknown };
    if (typeof m.label === 'string' && m.label.length > 0) {
      return m.label;
    }
    if (typeof m.sqlExpression === 'string' && m.sqlExpression.length > 0) {
      return m.sqlExpression;
    }
    return null;
  }

  const baseSettingsRaw = formData.fieldGroupingSettings;
  const baseSettings =
    (typeof baseSettingsRaw === 'object' && baseSettingsRaw !== null
      ? (baseSettingsRaw as Record<string, Record<string, unknown>>)
      : {}) || {};

  // Копируем, чтобы не мутировать исходный объект из formData
  const merged: Record<string, Record<string, unknown>> = { ...baseSettings };

  // Достаём динамические значения из formData по строковым ключам.
  // Здесь intentionally используем Record<string, unknown>, чтобы не плодить any,
  // но при этом иметь доступ к динамическим полям.
  const fd = formData;

  function normalizeMetricAggregateToPivotAggregator(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length === 0) {
      return undefined;
    }
    // Keep pivot-specific options as-is.
    if (value.includes(' as Fraction of ') || value.includes(' as Share of Parent ')) {
      return value;
    }
    // Map common SQL aggregate names to pivot aggregators.
    switch (value.toUpperCase()) {
      case 'SUM':
        return 'Sum';
      case 'AVG':
        return 'Average';
      case 'MIN':
        return 'Minimum';
      case 'MAX':
        return 'Maximum';
      case 'COUNT':
        return 'Count';
      case 'COUNT_DISTINCT':
        return 'Count Unique Values';
      default:
        break;
    }
    // Already in pivot naming?
    return value;
  }

  for (let i = 0; i < 10; i += 1) {
    const selectorKey = `field_formatting_field${i}_selector`;
    const selectedField = fd[selectorKey];
    if (typeof selectedField !== 'string' || selectedField.length === 0) {
      continue;
    }

    const nextFieldSettings: Record<string, unknown> = {
      ...(merged[selectedField] || {}),
    };

    const maxWidth = fd[`field_formatting_field${i}_maxWidth`];
    if (typeof maxWidth === 'number') {
      nextFieldSettings.maxWidth = maxWidth;
    }

    const truncate = fd[`field_formatting_field${i}_truncate`];
    if (typeof truncate === 'boolean') {
      nextFieldSettings.truncate = truncate;
    }

    const fontSize = fd[`field_formatting_field${i}_fontSize`];
    if (typeof fontSize === 'number') {
      nextFieldSettings.fontSize = fontSize;
    }

    const fontColor = fd[`field_formatting_field${i}_fontColor`];
    const fontColorCss = toCssColor(fontColor);
    if (typeof fontColorCss === 'string') {
      nextFieldSettings.fontColor = fontColorCss;
    }

    const backgroundColor = fd[`field_formatting_field${i}_backgroundColor`];
    const backgroundColorCss = toCssColor(backgroundColor);
    if (typeof backgroundColorCss === 'string') {
      nextFieldSettings.backgroundColor = backgroundColorCss;
    }

    // Формат значений (числа/даты) для выбранного поля.
    // В UI это используется для:
    // - row/col headers (когда значение числовое или temporal)
    // - metric values (когда значение агрегируется)
    const valueFormat = fd[`field_formatting_field${i}_valueFormat`];
    if (typeof valueFormat === 'string' && valueFormat.length > 0) {
      // Если формат совпадает с глобальным, не сохраняем как per-field override.
      // Это снижает шум и делает per-field настройку "осознанной".
      const globalValueFormat = fd.valueFormat;
      const sameAsGlobal =
        typeof globalValueFormat === 'string' && globalValueFormat === valueFormat;
      if (!sameAsGlobal) {
        nextFieldSettings.valueFormat = valueFormat;
      }
    }

    const dateFormat = fd[`field_formatting_field${i}_dateFormat`];
    if (typeof dateFormat === 'string' && dateFormat.length > 0) {
      // Аналогично: если формат совпадает с глобальным, не сохраняем override.
      const globalDateFormat = fd.dateFormat;
      const sameAsGlobal =
        typeof globalDateFormat === 'string' && globalDateFormat === dateFormat;
      if (!sameAsGlobal) {
        nextFieldSettings.dateFormat = dateFormat;
      }
    }

    // Индивидуальная функция агрегации для метрики (если выбранное поле является метрикой).
    const metricAggregationFunction =
      fd[`field_formatting_field${i}_metricAggregationFunction`];
    if (
      typeof metricAggregationFunction === 'string' &&
      metricAggregationFunction.length > 0
    ) {
      nextFieldSettings.metricAggregationFunction = metricAggregationFunction;
    }

    // Metric-specific formatting: header styles
    const metricHeaderFontSize = fd[`field_formatting_field${i}_metricHeaderFontSize`];
    if (typeof metricHeaderFontSize === 'number') {
      nextFieldSettings.metricHeaderFontSize = metricHeaderFontSize;
    }

    const metricHeaderFontColor = fd[`field_formatting_field${i}_metricHeaderFontColor`];
    const metricHeaderFontColorCss = toCssColor(metricHeaderFontColor);
    if (typeof metricHeaderFontColorCss === 'string') {
      nextFieldSettings.metricHeaderFontColor = metricHeaderFontColorCss;
    }

    const metricHeaderBackgroundColor =
      fd[`field_formatting_field${i}_metricHeaderBackgroundColor`];
    const metricHeaderBackgroundColorCss = toCssColor(metricHeaderBackgroundColor);
    if (typeof metricHeaderBackgroundColorCss === 'string') {
      nextFieldSettings.metricHeaderBackgroundColor = metricHeaderBackgroundColorCss;
    }

    // Metric-specific formatting: value styles
    const metricValueFontSize = fd[`field_formatting_field${i}_metricValueFontSize`];
    if (typeof metricValueFontSize === 'number') {
      nextFieldSettings.metricValueFontSize = metricValueFontSize;
    }

    const metricValueFontColor = fd[`field_formatting_field${i}_metricValueFontColor`];
    const metricValueFontColorCss = toCssColor(metricValueFontColor);
    if (typeof metricValueFontColorCss === 'string') {
      nextFieldSettings.metricValueFontColor = metricValueFontColorCss;
    }

    const metricValueBackgroundColor =
      fd[`field_formatting_field${i}_metricValueBackgroundColor`];
    const metricValueBackgroundColorCss = toCssColor(metricValueBackgroundColor);
    if (typeof metricValueBackgroundColorCss === 'string') {
      nextFieldSettings.metricValueBackgroundColor = metricValueBackgroundColorCss;
    }

    merged[selectedField] = nextFieldSettings;
  }

  // Per-metric aggregation uses Data -> Metrics -> Simple -> aggregate (metric.aggregate)
  const metricsRaw = fd.metrics;
  if (Array.isArray(metricsRaw)) {
    for (let i = 0; i < metricsRaw.length; i += 1) {
      const metric = metricsRaw[i];
      const metricName = getMetricLabel(metric);
      if (!metricName) {
        continue;
      }

      const metricAggregate =
        metric && typeof metric === 'object' && 'aggregate' in (metric as Record<string, unknown>)
          ? (metric as Record<string, unknown>).aggregate
          : undefined;
      const pivotAgg = normalizeMetricAggregateToPivotAggregator(metricAggregate);
      if (pivotAgg) {
        const prev = merged[metricName] || {};
        merged[metricName] = {
          ...prev,
          metricAggregationFunction: pivotAgg,
        };
      }
    }
  }

  return merged;
}

export default function transformProps(chartProps: ChartProps<PivotTableV2QueryFormData>): PivotTableV2Props {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your PivotTableChart.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */
  const {
    width,
    height,
    queriesData,
    rawFormData,
    hooks: { setDataMask = () => {}, onContextMenu },
    filterState,
    datasource: { verboseMap = {}, columnFormats = {}, currencyFormats = {} },
    emitCrossFilters,
    theme,
  } = chartProps;
  const { data, colnames, coltypes } = queriesData[0];
  // Важно: chartProps.formData типизирован, но в рантайме/в generic типах Superset
  // это может быть PlainObject, поэтому работаем через "typedFormData".
  const typedFormData = chartProps.formData as unknown as PivotTableV2QueryFormData;
  const {
    groupbyRows,
    groupbyColumns,
    metrics,
    tableRenderer,
    colOrder,
    rowOrder,
    rowSortingMetric,
    colSortingMetric,
    aggregateFunction,
    transposePivot,
    combineMetric,
    rowSubtotalPosition,
    colSubtotalPosition,
    colTotals,
    colSubTotals,
    rowTotals,
    rowSubTotals,
    valueFormat,
    dateFormat,
    metricsLayout,
    conditionalFormatting,
    timeGrainSqla,
    currencyFormat,
    allowRenderHtml,
    globalTableSettings,
    legacy_order_by,
    order_desc,
  } = typedFormData;
  const { selectedFilters } = filterState;
  const granularity = extractTimegrain(rawFormData);

  // Итоговые настройки форматирования, которые реально будут применяться в рендерере.
  //
  // ВАЖНО: в Superset `chartProps.formData` часто является "нормализованной" формой
  // и может НЕ включать UI-only контролы (например, динамические field_formatting_field{N}_*).
  // При этом `rawFormData` содержит полную форму из Explore, включая эти контролы.
  // Поэтому собираем настройки именно из `rawFormData`.
  const effectiveFieldGroupingSettings =
    buildEffectiveFieldGroupingSettings(rawFormData as unknown as Record<string, unknown>);

  const dateFormatters = colnames
    .filter(
      (colname: string, index: number) =>
        coltypes[index] === GenericDataType.Temporal,
    )
    .reduce(
      (
        acc: Record<string, DateFormatter | undefined>,
        temporalColname: string,
      ) => {
        let formatter: DateFormatter | undefined;
        // Per-field override: если пользователь указал dateFormat для конкретного поля,
        // то используем его вместо глобального dateFormat.
        const perFieldDateFormat =
          effectiveFieldGroupingSettings?.[temporalColname]?.dateFormat;
        const effectiveDateFormat =
          typeof perFieldDateFormat === 'string' && perFieldDateFormat.length > 0
            ? perFieldDateFormat
            : dateFormat;
        if (effectiveDateFormat === SMART_DATE_ID) {
          if (granularity) {
            // time column use formats based on granularity
            formatter = getTimeFormatterForGranularity(granularity);
          } else if (isNumeric(temporalColname, data)) {
            formatter = getTimeFormatter(DATABASE_DATETIME);
          } else {
            // if no column-specific format, print cell as is
            formatter = String;
          }
        } else if (effectiveDateFormat === 'MONTH_YEAR_RU') {
          formatter = createMonthYearRuFormatter();
        } else if (effectiveDateFormat) {
          formatter = getTimeFormatter(effectiveDateFormat);
        }
        if (formatter) {
          acc[temporalColname] = formatter;
        }
        return acc;
      },
      {},
    );
  const metricColorFormatters = getColorFormatters(
    conditionalFormatting,
    data,
    theme,
  );
  const normalizedGlobalTableSettings = normalizeGlobalTableSettings(globalTableSettings);

  return {
    width,
    height,
    margin: 0, // Default margin, можно сделать настраиваемым
    data,
    groupbyRows,
    groupbyColumns,
    metrics,
    tableRenderer,
    colOrder,
    rowOrder,
    rowSortingMetric,
    colSortingMetric,
    aggregateFunction,
    transposePivot,
    combineMetric,
    rowSubtotalPosition,
    colSubtotalPosition,
    colTotals,
    colSubTotals,
    rowTotals,
    rowSubTotals,
    valueFormat,
    currencyFormat,
    emitCrossFilters,
    setDataMask,
    selectedFilters,
    verboseMap,
    columnFormats,
    currencyFormats,
    metricsLayout,
    metricColorFormatters,
    dateFormatters,
    onContextMenu,
    timeGrainSqla,
    allowRenderHtml,
    // Используем "эффективные" настройки (из fieldGroupingSettings + динамических контролов)
    fieldGroupingSettings: effectiveFieldGroupingSettings,
    globalTableSettings: normalizedGlobalTableSettings,
    legacy_order_by: legacy_order_by || null,
    order_desc: order_desc ?? true,
  };
}
