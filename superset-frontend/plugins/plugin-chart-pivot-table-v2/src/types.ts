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
  QueryFormData,
  DataRecord,
  SetDataMaskHook,
  DataRecordValue,
  JsonObject,
  TimeFormatter,
  NumberFormatter,
  QueryFormMetric,
  QueryFormColumn,
  TimeGranularity,
  ContextMenuFilters,
  Currency,
  NumberFormats,
} from '@superset-ui/core';
import { ColorFormatters } from '@superset-ui/chart-controls';
import type {
  ValueCellFormatSettings,
  MetricSubtotalSettingsType,
} from './MetricSubtotalSettings';

export type {
  ValueCellFormatSettings,
  MetricSubtotalSettingsType,
} from './MetricSubtotalSettings';

export interface PivotTableStylesProps {
  height: number;
  width: number | string;
  margin: number;
}

export type FilterType = Record<string, DataRecordValue>;
export type SelectedFiltersType = Record<string, DataRecordValue[]>;

export type DateFormatter =
  | TimeFormatter
  | NumberFormatter
  | ((value: DataRecordValue) => string);
export enum MetricsLayoutEnum {
  ROWS = 'ROWS',
  COLUMNS = 'COLUMNS',
}

// Константа для идентификации адаптивного форматирования
export const ADAPTIVE_FORMATTING = 'ADAPTIVE_FORMATTING';
export const ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0 =
  'ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0';

/**
 * Маппинг кастомных сентинелов плагина на ключи форматтера из @superset-ui/core.
 * SMART_NUMBER в UI уже подписан как «Adaptive formatting».
 */
export function resolveD3NumberFormat(format: string): string {
  if (
    format === ADAPTIVE_FORMATTING ||
    format === ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0
  ) {
    return NumberFormats.SMART_NUMBER;
  }
  return format;
}

/** Пустая строка вместо 0/null в ячейках значений (не для заголовков). */
export function isEmptyInsteadOfZeroFormat(
  format: string | undefined,
): boolean {
  return format === ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0;
}

interface PivotTableCustomizeProps {
  groupbyRows: QueryFormColumn[];
  groupbyColumns: QueryFormColumn[];
  metrics: QueryFormMetric[];
  tableRenderer: string;
  colOrder: string;
  rowOrder: string;
  rowSortingMetric?: string; // Имя метрики для сортировки строк по значениям
  colSortingMetric?: string; // Имя метрики для сортировки колонок по значениям
  // Глобальная функция агрегации (legacy). В UI мы используем per-metric aggregation,
  // поэтому поле делаем необязательным для обратной совместимости со старыми slices.
  aggregateFunction?: string;
  transposePivot: boolean;
  combineMetric: boolean;
  rowSubtotalPosition: boolean;
  colSubtotalPosition: boolean;
  colTotals: boolean;
  colSubTotals: boolean;
  rowTotals: boolean;
  rowSubTotals: boolean;
  valueFormat?: string;
  dateFormat?: string;
  currencyFormat: Currency;
  setDataMask: SetDataMaskHook;
  emitCrossFilters?: boolean;
  selectedFilters?: SelectedFiltersType;
  verboseMap: JsonObject;
  columnFormats: JsonObject;
  currencyFormats: Record<string, Currency>;
  metricsLayout?: MetricsLayoutEnum;
  metricColorFormatters: ColorFormatters;
  dateFormatters: Record<string, DateFormatter | undefined>;
  legacy_order_by: QueryFormMetric[] | QueryFormMetric | null;
  order_desc: boolean;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  timeGrainSqla?: TimeGranularity;
  time_grain_sqla?: TimeGranularity;
  granularity_sqla?: string;
  allowRenderHtml?: boolean;
}

export type PivotTableQueryFormData = QueryFormData &
  PivotTableStylesProps &
  PivotTableCustomizeProps;

export type PivotTableProps = PivotTableStylesProps &
  PivotTableCustomizeProps & {
    data: DataRecord[];
  };

// Настройки форматирования для каждого поля группировки
export interface FieldGroupingSettings {
  maxWidth?: number; // максимальная ширина колонки в пикселях
  truncate?: boolean; // обрезать/не обрезать значение при превышении maxWidth
  headerSort?: 'alphabetical' | 'by_value' | 'custom'; // способ сортировки заголовков
  // Legacy поле для обратной совместимости. Используется subtotalShow вместо него.
  subtotalEnabled?: boolean; // нужен/не нужен подытог по этому полю (deprecated, используйте subtotalShow)
  // Настройки subtotal для поля (переопределяют общие настройки таблицы)
  subtotalShow?: 'show' | 'no_show' | 'general_setting'; // По умолчанию 'general_setting' - использовать общие настройки
  subtotalLabel?: string; // Переопределяет globalTableSettings.rowSubTotalsLabel/colSubTotalsLabel
  subtotalAggregation?: 'sum' | 'max' | 'min'; // тип агрегирования для подытога
  subtotalValueFormat?: ValueCellFormatSettings; // Переопределяет globalTableSettings.rowSubTotalsValueFormat/colSubTotalsValueFormat
  cellValueType?: 'absolute' | 'percentage' | 'absolute_and_percentage'; // тип отображаемого значения
  percentageType?: 'total' | 'parent_row' | 'parent_column'; // тип доли (если cellValueType включает percentage)
  valueFormat?: string; // D3 формат для значений (использует существующие форматеры Superset)
  dateFormat?: string; // D3 time format для дат/времени (можно задавать per-field)
  fontSize?: number; // размер шрифта в пикселях
  fontColor?: string; // цвет шрифта в hex формате (будет преобразован из RGBColor)
  backgroundColor?: string; // цвет фона в hex формате (будет преобразован из RGBColor)
  alignment?: 'left' | 'center' | 'right'; // выравнивание заголовков и value-ячеек поля

  // Индивидуальная функция агрегации для метрики (имя агрегатора как в списке UI).
  // Применяется только для metric value полей (ключи = имена метрик).
  metricAggregationFunction?: string;

  // Metric-specific formatting:
  // - `metricHeader*` applies to the metric header cell (e.g. "Факт" in the header)
  // - `metricValue*` applies to the metric value cells (numbers)
  metricHeaderFontSize?: number;
  metricHeaderFontColor?: string;
  metricHeaderBackgroundColor?: string;
  metricHeaderAlignment?: 'left' | 'center' | 'right';
  metricValueFontSize?: number;
  metricValueFontColor?: string;
  metricValueBackgroundColor?: string;

  // Настройки subtotal для конкретных метрик (Metric-specific overrides)
  // Ключ - имя метрики (label)
  metricSubtotalSettings?: Record<string, MetricSubtotalSettingsType>;
}

// Глобальные настройки таблицы
export interface GlobalTableSettings {
  columnTotalsEnabled?: boolean; // нужен/не нужен общий итог по столбцам
  columnTotalsPosition?: 'top' | 'bottom'; // позиция итога по столбцам
  columnTotalsLabel?: string; // наименование итога по столбцам
  rowTotalsEnabled?: boolean; // нужен/не нужен общий итог по строкам
  rowTotalsPosition?: 'left' | 'right'; // позиция итога по строкам
  rowTotalsLabel?: string; // наименование итога по строкам

  // Заголовок измерения метрик (строка/столбец "Мера"/"Metric").
  metricsLabel?: string;
  metricsLabelFontSize?: number;
  metricsLabelFontColor?: string;
  metricsLabelAlignment?: 'left' | 'center' | 'right';

  // Настройки подписей/форматов для subtotal (когда включены Show rows/columns subtotal).
  rowSubTotalsLabel?: string;
  colSubTotalsLabel?: string;

  // Форматирование value-ячеек для итогов/подытогов (перекрывает обычный формат метрики).
  rowTotalsValueFormat?: ValueCellFormatSettings;
  columnTotalsValueFormat?: ValueCellFormatSettings;
  rowSubTotalsValueFormat?: ValueCellFormatSettings;
  colSubTotalsValueFormat?: ValueCellFormatSettings;
}

// Расширенная форма данных для Pivot Table V2
export interface PivotTableV2QueryFormData extends PivotTableQueryFormData {
  fieldGroupingSettings?: Record<string, FieldGroupingSettings>; // ключ - имя поля
  globalTableSettings?: GlobalTableSettings;
}

export interface PivotTableV2Props extends PivotTableProps {
  fieldGroupingSettings?: Record<string, FieldGroupingSettings>;
  globalTableSettings?: GlobalTableSettings;
  // SQL-выражения метрик для определения формул (ключ - имя метрики, значение - sqlExpression или null)
  metricsSqlExpressions?: Record<string, string | null>;
  // Маппинг между именами метрик из SQL-выражений и отображаемыми именами метрик
  // Ключ: имя метрики из SQL-выражения (например, "Продажи: Сумма без НДС")
  // Значение: отображаемое имя метрики (например, "Факт")
  metricNameMapping?: Record<string, string>;
}
