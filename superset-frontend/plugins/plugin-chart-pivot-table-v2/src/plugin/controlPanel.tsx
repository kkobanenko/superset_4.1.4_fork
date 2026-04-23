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
import React from 'react';
import {
  ControlPanelConfig,
  D3_TIME_FORMAT_OPTIONS,
  Dataset,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  isAdhocColumn,
  isPhysicalColumn,
  QueryFormColumn,
  QueryFormMetric,
  SMART_DATE_ID,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import { ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0, MetricsLayoutEnum } from '../types';
import MetricSubtotalSettingsControl from './components/MetricSubtotalSettingsControl';
import MetricTotalSettingsControl from './components/MetricTotalSettingsControl';
import FieldSettingsCollapseControl from './components/FieldSettingsCollapseControl';
import RemoveFieldInlineCheckbox from './components/RemoveFieldInlineCheckbox';

// Расширенные опции формата даты с добавлением "month year" на русском
const EXTENDED_D3_TIME_FORMAT_OPTIONS: [string, string][] = [
  ...D3_TIME_FORMAT_OPTIONS,
  ['MONTH_YEAR_RU', t('Month Year (Russian) | Декабрь 2025')],
];

// Pivot Table V2 расширяет список агрегаторов в "Data -> Metrics -> Simple -> aggregate".
// Часть значений является pivot-специфичной (client-side) и будет нормализована
// для SQL-запроса внутри buildQuery плагина.
// ВАЖНО: здесь каждое логическое значение представлено один раз (без дублей вроде SUM/Sum).
const PIVOT_V2_METRIC_AGGREGATE_OPTIONS: string[] = [
  // Базовые агрегаторы (читаемые подписи, мапятся на SQL внутри buildQuery).
  'Average', // AVG
  'Count', // COUNT
  'Count Unique Values', // COUNT_DISTINCT
  'Minimum', // MIN
  'Maximum', // MAX
  'Sum', // SUM
  // Расширенные pivot-агрегаторы (client-side, фракции и “share of parent”).
  'First',
  'Last',
  'Median',
  'Sample Standard Deviation',
  'Sample Variance',
  'Sum as Fraction of Columns',
  'Sum as Fraction of Rows',
  'Sum as Fraction of Total',
  'Sum as Share of Parent Column Group',
  'Sum as Share of Parent Row Group',
  'Count as Fraction of Columns',
  'Count as Fraction of Rows',
  'Count as Fraction of Total',
  'Count as Share of Parent Column Group',
  'Count as Share of Parent Row Group',
];

const MAX_FIELD_FORMATTING_SLOTS = 10;
const ALIGNMENT_CHOICES: [string, string][] = [
  ['left', t('Left')],
  ['center', t('Center')],
  ['right', t('Right')],
];
const ALL_FIELD_SELECTOR_CONTROL_NAMES = Array.from(
  { length: MAX_FIELD_FORMATTING_SLOTS },
  (_, index) => getSelectorControlName(index),
);

const ALL_FIELD_REMOVE_CONTROL_NAMES = Array.from(
  { length: MAX_FIELD_FORMATTING_SLOTS },
  (_, index) => `field_formatting_field${index}_remove`,
);

type FieldGroupingSettingsMap = Record<string, unknown>;

function getSelectorControlName(index: number): string {
  return `field_formatting_field${index}_selector`;
}

function getFieldSelectorValue(
  formData: Record<string, unknown>,
  index: number,
): string | undefined {
  const value = formData[getSelectorControlName(index)];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getCompactSelectedFields(formData: Record<string, unknown>): string[] {
  const compact: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < MAX_FIELD_FORMATTING_SLOTS; i += 1) {
    const selectedField = getFieldSelectorValue(formData, i);
    if (!selectedField || seen.has(selectedField)) {
      continue;
    }
    seen.add(selectedField);
    compact.push(selectedField);
  }
  return compact;
}

function sanitizeFieldGroupingSettings(
  settingsRaw: unknown,
  selectedFields: string[],
): FieldGroupingSettingsMap {
  const settings =
    settingsRaw && typeof settingsRaw === 'object'
      ? (settingsRaw as FieldGroupingSettingsMap)
      : {};
  const selectedSet = new Set(selectedFields);
  const sanitized: FieldGroupingSettingsMap = {};

  Object.entries(settings).forEach(([fieldName, fieldSettings]) => {
    if (selectedSet.has(fieldName) && fieldSettings !== null) {
      sanitized[fieldName] = fieldSettings;
    }
  });

  return sanitized;
}

function compactFieldFormattingState(
  formData: Record<string, unknown>,
  changedIndex: number,
  nextValue: unknown,
): Record<string, unknown> {
  const nextFormData: Record<string, unknown> = { ...formData };
  const selectorName = getSelectorControlName(changedIndex);

  if (typeof nextValue === 'string' && nextValue.length > 0) {
    nextFormData[selectorName] = nextValue;
  } else {
    nextFormData[selectorName] = undefined;
  }

  const compactSelectedFields = getCompactSelectedFields(nextFormData);
  for (let i = 0; i < MAX_FIELD_FORMATTING_SLOTS; i += 1) {
    nextFormData[getSelectorControlName(i)] = compactSelectedFields[i];
    nextFormData[`field_formatting_field${i}_remove`] = false;
  }

  nextFormData.fieldGroupingSettings = sanitizeFieldGroupingSettings(
    nextFormData.fieldGroupingSettings,
    compactSelectedFields,
  );

  return nextFormData;
}

// Функция для создания секции настроек конкретного поля группировки
// TODO: будет использована для динамического создания секций
// @ts-ignore - функция будет использована в будущем
function createFieldFormattingSection(fieldName: string, fieldLabel: string) {
  // @ts-ignore
  const _fieldKey = `field_${fieldName.replace(/[^a-zA-Z0-9]/g, '_')}`;
  return {
    label: t('Field: %s', fieldLabel),
    expanded: false,
    controlSetRows: [
      [
        {
          name: `fieldGroupingSettings.${fieldName}.maxWidth`,
          config: {
            type: 'NumberControl',
            label: t('Max width (px)'),
            renderTrigger: true,
            default: undefined,
            description: t('Maximum column width in pixels'),
          },
        },
        {
          name: `fieldGroupingSettings.${fieldName}.truncate`,
          config: {
            type: 'CheckboxControl',
            label: t('Truncate values'),
            renderTrigger: true,
            default: false,
            description: t('Truncate values that exceed max width'),
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.headerSort`,
          config: {
            type: 'SelectControl',
            label: t('Header sort'),
            renderTrigger: true,
            default: 'alphabetical',
            choices: [
              ['alphabetical', t('Alphabetical')],
              ['by_value', t('By value')],
              ['custom', t('Custom')],
            ],
            description: t('Sorting method for headers'),
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.subtotalShow`,
          config: {
            type: 'RadioButtonControl',
            label: t('Show subtotal'),
            renderTrigger: true,
            default: 'general_setting',
            options: [
              ['show', t('Show')],
              ['no_show', t('No Show')],
              ['general_setting', t('General setting')],
            ],
            description: t(
              'Show subtotal for this field. "General setting" uses table-wide settings from Data -> Options.',
            ),
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.subtotalLabel`,
          config: {
            type: 'TextControl',
            label: t('Subtotal label'),
            renderTrigger: true,
            default: t('Subtotal'),
            description: t('Label for subtotal row/column'),
            visibility: ({ controls }: { controls?: any }) => {
              const fieldSettings = controls?.fieldGroupingSettings?.value || {};
              const subtotalShow = fieldSettings[fieldName]?.subtotalShow;
              // Показываем только при явном включении subtotalShow
              // Также поддерживаем обратную совместимость с subtotalEnabled
              const subtotalEnabled = fieldSettings[fieldName]?.subtotalEnabled;
              return (
                subtotalShow === 'show' ||
                (subtotalShow === undefined && subtotalEnabled === true)
              );
            },
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.subtotalValueFormat.fontColor`,
          config: {
            type: 'ColorPickerControl',
            label: t('Subtotal font color'),
            renderTrigger: true,
            default: undefined,
            description: t('Font color for subtotal cells'),
            visibility: ({ controls }: { controls?: any }) => {
              const fieldSettings = controls?.fieldGroupingSettings?.value || {};
              const subtotalShow = fieldSettings[fieldName]?.subtotalShow;
              const subtotalEnabled = fieldSettings[fieldName]?.subtotalEnabled;
              return (
                subtotalShow === 'show' ||
                (subtotalShow === undefined && subtotalEnabled === true)
              );
            },
          },
        },
        {
          name: `fieldGroupingSettings.${fieldName}.subtotalValueFormat.backgroundColor`,
          config: {
            type: 'ColorPickerControl',
            label: t('Subtotal background color'),
            renderTrigger: true,
            default: undefined,
            description: t('Background color for subtotal cells'),
            visibility: ({ controls }: { controls?: any }) => {
              const fieldSettings = controls?.fieldGroupingSettings?.value || {};
              const subtotalShow = fieldSettings[fieldName]?.subtotalShow;
              const subtotalEnabled = fieldSettings[fieldName]?.subtotalEnabled;
              return (
                subtotalShow === 'show' ||
                (subtotalShow === undefined && subtotalEnabled === true)
              );
            },
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.cellValueType`,
          config: {
            type: 'RadioButtonControl',
            label: t('Cell value type'),
            renderTrigger: true,
            default: 'absolute',
            options: [
              ['absolute', t('Absolute only')],
              ['percentage', t('Percentage only')],
              ['absolute_and_percentage', t('Absolute + Percentage')],
            ],
            description: t('Type of value to display in cells'),
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.percentageType`,
          config: {
            type: 'SelectControl',
            label: t('Percentage type'),
            renderTrigger: true,
            default: 'total',
            choices: [
              ['total', t('Of total')],
              ['parent_row', t('Of parent row')],
              ['parent_column', t('Of parent column')],
            ],
            description: t('Type of percentage calculation'),
            visibility: ({ controls }: { controls?: any }) => {
              const fieldSettings = controls?.fieldGroupingSettings?.value || {};
              const cellValueType = fieldSettings[fieldName]?.cellValueType;
              return (
                cellValueType === 'percentage' ||
                cellValueType === 'absolute_and_percentage'
              );
            },
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.valueFormat`,
          config: {
            ...sharedControls.y_axis_format,
            label: t('Value format'),
            renderTrigger: true,
            description: t('D3 format for values'),
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.fontSize`,
          config: {
            type: 'NumberControl',
            label: t('Font size (px)'),
            renderTrigger: true,
            default: undefined,
            description: t('Font size in pixels'),
          },
        },
        {
          name: `fieldGroupingSettings.${fieldName}.fontColor`,
          config: {
            type: 'ColorPickerControl',
            label: t('Font color'),
            renderTrigger: true,
            default: undefined,
            description: t('Font color'),
          },
        },
      ],
      [
        {
          name: `fieldGroupingSettings.${fieldName}.backgroundColor`,
          config: {
            type: 'ColorPickerControl',
            label: t('Background color'),
            renderTrigger: true,
            default: undefined,
            description: t('Background color for column/row'),
          },
        },
      ],
    ],
    visibility: ({ controls }: { controls?: any }) => {
      // Показывать секцию только если поле выбрано
      const groupbyRows = ensureIsArray(controls?.groupbyRows?.value);
      const groupbyColumns = ensureIsArray(controls?.groupbyColumns?.value);
      const allFields = [...groupbyRows, ...groupbyColumns];
      return allFields.some(
        field => getColumnLabel(field as QueryFormColumn) === fieldName,
      );
    },
  };
}

// Функция для получения всех выбранных полей
// TODO: будет использована для динамического создания секций
// @ts-ignore - функция будет использована в будущем
function getAllGroupingFields(_controls: any): string[] {
  const groupbyRows = ensureIsArray(_controls?.groupbyRows?.value || []);
  const groupbyColumns = ensureIsArray(_controls?.groupbyColumns?.value || []);
  const allFields = [...groupbyRows, ...groupbyColumns];
  return Array.from(
    new Set(
      allFields.map(field => getColumnLabel(field as QueryFormColumn)),
    ),
  );
}

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupbyColumns',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Columns to group by on the columns'),
            },
          },
        ],
        [
          {
            name: 'groupbyRows',
            config: {
              ...sharedControls.groupby,
              label: t('Rows'),
              description: t('Columns to group by on the rows'),
            },
          },
        ],
        [
          {
            name: 'time_grain_sqla',
            config: {
              ...sharedControls.time_grain_sqla,
              visibility: ({ controls }) => {
                const dttmLookup = Object.fromEntries(
                  ensureIsArray(controls?.groupbyColumns?.options).map(
                    option => [option.column_name, option.is_dttm],
                  ),
                );

                return [
                  ...ensureIsArray(controls?.groupbyColumns?.value),
                  ...ensureIsArray(controls?.groupbyRows?.value),
                ]
                  .map(selection => {
                    if (isAdhocColumn(selection)) {
                      return true;
                    }
                    if (isPhysicalColumn(selection)) {
                      return !!dttmLookup[selection];
                    }
                    return false;
                  })
                  .some(Boolean);
              },
            },
          },
          'temporal_columns_lookup',
        ],
        [
          {
            name: 'metrics',
            config: {
              ...sharedControls.metrics,
              validators: [validateNonEmpty],
              rerender: ['conditional_formatting'],
              aggregateOptions: PIVOT_V2_METRIC_AGGREGATE_OPTIONS,
            },
          },
        ],
        [
          {
            name: 'metricsLayout',
            config: {
              type: 'RadioButtonControl',
              renderTrigger: true,
              label: t('Apply metrics on'),
              default: MetricsLayoutEnum.COLUMNS,
              options: [
                [MetricsLayoutEnum.COLUMNS, t('Columns')],
                [MetricsLayoutEnum.ROWS, t('Rows')],
              ],
              description: t(
                'Use metrics as a top level group for columns or for rows',
              ),
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.metricsLabel',
            config: {
              type: 'TextControl',
              label: t('Metrics header label'),
              renderTrigger: true,
              default: t('Metric'),
              description: t(
                'Header label for the metrics dimension row or column. Leave empty to hide the label.',
              ),
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.metricsLabelFontSize',
            config: {
              type: 'NumberControl',
              label: t('Metrics header font size (px)'),
              renderTrigger: true,
              default: undefined,
            },
          },
          {
            name: 'globalTableSettings.metricsLabelFontColor',
            config: {
              type: 'ColorPickerControl',
              label: t('Metrics header font color'),
              renderTrigger: true,
              default: undefined,
            },
          },
          {
            name: 'globalTableSettings.metricsLabelAlignment',
            config: {
              type: 'SelectControl',
              label: t('Metrics header alignment'),
              renderTrigger: true,
              default: undefined,
              clearable: true,
              choices: ALIGNMENT_CHOICES,
            },
          },
        ],
        ['adhoc_filters'],
        ['series_limit'],
        [
          {
            name: 'row_limit',
            config: {
              ...sharedControls.row_limit,
              label: t('Cell limit'),
              description: t('Limits the number of cells that get retrieved.'),
            },
          },
        ],
        // TODO(kgabryje): add series_columns control after control panel is redesigned to avoid clutter
        [
          {
            name: 'series_limit_metric',
            config: {
              ...sharedControls.series_limit_metric,
              description: t(
                'Metric used to define how the top series are sorted if a series or cell limit is present. ' +
                  'If undefined reverts to the first metric (where appropriate).',
              ),
            },
          },
        ],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
            },
          },
        ],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      tabOverride: 'data',
      controlSetRows: [
        [
          {
            name: 'rowTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show rows total'),
              default: false,
              renderTrigger: true,
              description: t('Display row level total'),
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.rowTotalsLabel',
            config: {
              type: 'TextControl',
              label: t('Rows total label'),
              renderTrigger: true,
              default: t('Total'),
              description: t('Header label for the rows total column'),
              visibility: ({ controls }: { controls?: any }) =>
                controls?.rowTotals?.value === true,
            },
          },
          {
            name: 'globalTableSettings.rowTotalsValueFormat.valueFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('Rows total number format'),
              renderTrigger: true,
              description: t('D3 number format for the rows total column'),
              choices: [
                [
                  ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0,
                  t('Adaptive formatting, empty instead 0'),
                ],
                ...(sharedControls.y_axis_format.choices || []),
              ],
              visibility: ({ controls }: { controls?: any }) =>
                controls?.rowTotals?.value === true &&
                controls?.transposePivot?.value === true,
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.rowTotalsValueFormat.dateFormat',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Rows total date format'),
              default: SMART_DATE_ID,
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: t('D3 time format for the rows total column'),
              visibility: ({ controls }: { controls?: any }) =>
                controls?.rowTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.rowTotalsValueFormat.fontSize',
            config: {
              type: 'NumberControl',
              label: t('Rows total font size (px)'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.rowTotals?.value === true,
            },
          },
          {
            name: 'globalTableSettings.rowTotalsValueFormat.fontColor',
            config: {
              type: 'ColorPickerControl',
              label: t('Rows total font color'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.rowTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.rowTotalsValueFormat.backgroundColor',
            config: {
              type: 'ColorPickerControl',
              label: t('Rows total background color'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.rowTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'colTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show columns total'),
              default: false,
              renderTrigger: true,
              description: t('Display column level total'),
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.columnTotalsMetricSettings',
            config: {
              type: MetricTotalSettingsControl,
              label: t('Per-Metric Total Overrides'),
              renderTrigger: true,
              default: {},
              description: t('Customize total settings for each metric'),
              mapStateToProps: ({ controls }: { controls: Record<string, any> }) => ({
                metrics: controls?.metrics?.value || [],
              }),
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.columnTotalsLabel',
            config: {
              type: 'TextControl',
              label: t('Total label'),
              renderTrigger: true,
              default: t('Total'),
              description: t('Label for the columns total row'),
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colTotals?.value === true,
            },
          },
          {
            name: 'globalTableSettings.columnTotalsValueFormat.fontSize',
            config: {
              type: 'NumberControl',
              label: t('Total font size (px)'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.columnTotalsValueFormat.fontColor',
            config: {
              type: 'ColorPickerControl',
              label: t('Total font color'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.columnTotalsValueFormat.backgroundColor',
            config: {
              type: 'ColorPickerControl',
              label: t('Total background color'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'colSubTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show columns subtotal'),
              default: false,
              renderTrigger: true,
              description: t('Display column level subtotal'),
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.rowSearchEnabled',
            config: {
              type: 'CheckboxControl',
              label: t('Search box'),
              default: false,
              renderTrigger: true,
              description: t(
                'Whether to include a client-side search box that filters rows by full row path',
              ),
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.colSubTotalsLabel',
            config: {
              type: 'TextControl',
              label: t('Columns subtotal label'),
              renderTrigger: true,
              default: t('Subtotal'),
              description: t('Header label for the columns subtotal row'),
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colSubTotals?.value === true,
            },
          },
          {
            name: 'globalTableSettings.colSubTotalsValueFormat.fontSize',
            config: {
              type: 'NumberControl',
              label: t('Columns subtotal font size (px)'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colSubTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.colSubTotalsValueFormat.fontColor',
            config: {
              type: 'ColorPickerControl',
              label: t('Columns subtotal font color'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colSubTotals?.value === true,
            },
          },
          {
            name: 'globalTableSettings.colSubTotalsValueFormat.backgroundColor',
            config: {
              type: 'ColorPickerControl',
              label: t('Columns subtotal background color'),
              renderTrigger: true,
              default: undefined,
              visibility: ({ controls }: { controls?: any }) =>
                controls?.colSubTotals?.value === true,
            },
          },
        ],
        [
          {
            name: 'transposePivot',
            config: {
              type: 'CheckboxControl',
              label: t('Transpose pivot'),
              default: false,
              description: t('Swap rows and columns'),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'combineMetric',
            config: {
              type: 'CheckboxControl',
              label: t('Combine metrics'),
              default: true,
              description: t(
                'Display metrics side by side within each column, as ' +
                  'opposed to each column being displayed side by side for each metric.',
              ),
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'valueFormat',
            config: {
              ...sharedControls.y_axis_format,
              label: t('Value format'),
            },
          },
        ],
        ['currency_format'],
        [
          {
            name: 'date_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              default: SMART_DATE_ID,
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              description: t('D3 time format for datetime columns'),
            },
          },
        ],
        [
          {
            name: 'rowOrder',
            config: {
              type: 'SelectControl',
              label: t('Sort rows by'),
              default: 'key_a_to_z',
              choices: [
                // [value, label]
                ['key_a_to_z', t('key a-z')],
                ['key_z_to_a', t('key z-a')],
                ['value_a_to_z', t('value ascending')],
                ['value_z_to_a', t('value descending')],
                ['value_a_to_z_inside_parent', t('value ascending inside parent group')],
                ['value_z_to_a_inside_parent', t('value descending inside parent group')],
              ],
              renderTrigger: true,
              description: (
                <>
                  <div>{t('Change order of rows.')}</div>
                  <div>{t('Available sorting modes:')}</div>
                  <ul>
                    <li>{t('By key: use row names as sorting key')}</li>
                    <li>{t('By value: use metric values as sorting key')}</li>
                  </ul>
                </>
              ),
            },
          },
        ],
        [
          {
            name: 'rowSortingMetric',
            config: {
              type: 'SelectControl',
              label: t('Sorting row value'),
              default: undefined,
              freeForm: false,
              mapStateToProps: (state: any) => {
                try {
                  const metrics = ensureIsArray(state?.controls?.metrics?.value || []);
                  if (!metrics || metrics.length === 0) {
                    return { choices: [] };
                  }
                  const choicesList = metrics
                    .map((m: QueryFormMetric) => {
                      try {
                        const label = getMetricLabel(m);
                        if (label && typeof label === 'string' && label.length > 0) {
                          return [label, label];
                        }
                        return null;
                      } catch (e) {
                        return null;
                      }
                    })
                    .filter((item): item is [string, string] => item !== null);
                  return { choices: choicesList };
                } catch (e) {
                  return { choices: [] };
                }
              },
              renderTrigger: true,
              description: t('Select metric to use for sorting rows by value'),
              visibility: ({ controls }: { controls?: any }) => {
                const rowOrder = controls?.rowOrder?.value;
                return rowOrder === 'value_a_to_z' || rowOrder === 'value_z_to_a' || 
                       rowOrder === 'value_a_to_z_inside_parent' || rowOrder === 'value_z_to_a_inside_parent';
              },
            },
          },
        ],
        [
          {
            name: 'colOrder',
            config: {
              type: 'SelectControl',
              label: t('Sort columns by'),
              default: 'key_a_to_z',
              choices: [
                // [value, label]
                ['key_a_to_z', t('key a-z')],
                ['key_z_to_a', t('key z-a')],
                ['value_a_to_z', t('value ascending')],
                ['value_z_to_a', t('value descending')],
                ['value_a_to_z_inside_parent', t('value ascending inside parent group')],
                ['value_z_to_a_inside_parent', t('value descending inside parent group')],
              ],
              renderTrigger: true,
              description: (
                <>
                  <div>{t('Change order of columns.')}</div>
                  <div>{t('Available sorting modes:')}</div>
                  <ul>
                    <li>{t('By key: use column names as sorting key')}</li>
                    <li>{t('By value: use metric values as sorting key')}</li>
                  </ul>
                </>
              ),
            },
          },
        ],
        [
          {
            name: 'colSortingMetric',
            config: {
              type: 'SelectControl',
              label: t('Sorting column value'),
              default: undefined,
              freeForm: false,
              mapStateToProps: (state: any) => {
                try {
                  const metrics = ensureIsArray(state?.controls?.metrics?.value || []);
                  if (!metrics || metrics.length === 0) {
                    return { choices: [] };
                  }
                  const choicesList = metrics
                    .map((m: QueryFormMetric) => {
                      try {
                        const label = getMetricLabel(m);
                        if (label && typeof label === 'string' && label.length > 0) {
                          return [label, label];
                        }
                        return null;
                      } catch (e) {
                        return null;
                      }
                    })
                    .filter((item): item is [string, string] => item !== null);
                  return { choices: choicesList };
                } catch (e) {
                  return { choices: [] };
                }
              },
              renderTrigger: true,
              description: t('Select metric to use for sorting columns by value'),
              visibility: ({ controls }: { controls?: any }) => {
                const colOrder = controls?.colOrder?.value;
                return colOrder === 'value_a_to_z' || colOrder === 'value_z_to_a' || 
                       colOrder === 'value_a_to_z_inside_parent' || colOrder === 'value_z_to_a_inside_parent';
              },
            },
          },
        ],
        [
          {
            name: 'rowSubtotalPosition',
            config: {
              type: 'SelectControl',
              label: t('Rows subtotal position'),
              default: false,
              choices: [
                // [value, label]
                [true, t('Top')],
                [false, t('Bottom')],
              ],
              renderTrigger: true,
              description: t('Position of row level subtotal'),
            },
          },
        ],
        [
          {
            name: 'colSubtotalPosition',
            config: {
              type: 'SelectControl',
              label: t('Columns subtotal position'),
              default: false,
              choices: [
                // [value, label]
                [true, t('Left')],
                [false, t('Right')],
              ],
              renderTrigger: true,
              description: t('Position of column level subtotal'),
            },
          },
        ],
        [
          {
            name: 'conditional_formatting',
            config: {
              type: 'ConditionalFormattingControl',
              renderTrigger: true,
              label: t('Conditional formatting'),
              description: t('Apply conditional color formatting to metrics'),
              mapStateToProps(explore, _, chart) {
                const values =
                  (explore?.controls?.metrics?.value as QueryFormMetric[]) ??
                  [];
                const verboseMap = explore?.datasource?.hasOwnProperty(
                  'verbose_map',
                )
                  ? (explore?.datasource as Dataset)?.verbose_map
                  : (explore?.datasource?.columns ?? {});
                const chartStatus = chart?.chartStatus;
                const { colnames, coltypes } =
                  chart?.queriesResponse?.[0] ?? {};
                const metricColumn = values.map(value => {
                  if (typeof value === 'string') {
                    return {
                      value,
                      label: Array.isArray(verboseMap)
                        ? value
                        : verboseMap[value],
                      dataType: colnames && coltypes[colnames?.indexOf(value)],
                    };
                  }
                  return {
                    value: value.label,
                    label: value.label,
                    dataType:
                      colnames && coltypes[colnames?.indexOf(value.label)],
                  };
                });
                return {
                  removeIrrelevantConditions: chartStatus === 'success',
                  columnOptions: metricColumn,
                  verboseMap,
                };
              },
            },
          },
        ],
        [
          {
            name: 'allow_render_html',
            config: {
              type: 'CheckboxControl',
              label: t('Render columns in HTML format'),
              renderTrigger: true,
              default: true,
              description: t(
                'Renders table cells as HTML when applicable. For example, HTML <a> tags will be rendered as hyperlinks.',
              ),
            },
          },
        ],
      ],
    },
    // Секция настроек форматирования полей
    // Каждый набор настроек позволяет выбрать конкретное поле и настроить его форматирование
    {
      label: t('Field Formatting Settings'),
      expanded: false,
      controlSetRows: [
        // ВАЖНО: `fieldGroupingSettings` — это объект, который используется как источник истины
        // для форматирования. Он должен существовать в `controls`, иначе при выборе значения
        // в селекторе Superset попытается перерассчитать `rerender`-контролы и упадет на
        // `newState.controls[controlName].value` (controlName = 'fieldGroupingSettings').
        [
          {
            name: 'fieldGroupingSettings',
            config: {
              type: 'HiddenControl',
              default: {},
              renderTrigger: true,
            },
          },
        ],
        // Генерируем до 10 наборов настроек, каждый с выбором поля
        ...(function generateFieldControls() {
          const controls: any[] = [];
          // Генерируем контролы для до 10 полей
          for (let i = 0; i < 10; i++) {
            const fieldIndex = i;
            controls.push(
              [
                {
                  name: `field_formatting_field${fieldIndex}_selector`,
                  config: {
                    type: 'SelectControl',
                    // Визуально выделяем лейбл «Field N»: жирный шрифт,
                    // увеличенный размер и фоновая подложка для заметности
                    label: React.createElement(
                      'span',
                      {
                        style: {
                          fontWeight: 700,
                          fontSize: '14px',
                          background: '#e6f4ff',
                          padding: '1px 8px',
                          borderRadius: '4px',
                          color: '#1677ff',
                        },
                      },
                      t('Field %s', fieldIndex + 1),
                    ),
                    renderTrigger: true,
                    clearable: true,
                    description: t('Select a field to configure formatting'),
                    placeholder: t('Select field...'),
                    rerender: [
                      'groupbyRows',
                      'groupbyColumns',
                      'metrics',
                      'fieldGroupingSettings',
                      ...ALL_FIELD_SELECTOR_CONTROL_NAMES,
                      ...ALL_FIELD_REMOVE_CONTROL_NAMES,
                    ],
                    formDataOnChange: (
                      value: unknown,
                      _prevValue: unknown,
                      formData: unknown,
                    ) => {
                      if (!formData || typeof formData !== 'object') {
                        return formData;
                      }

                      return compactFieldFormattingState(
                        formData as Record<string, unknown>,
                        fieldIndex,
                        value,
                      );
                    },
                    mapStateToProps: (state: any, controlState?: any) => {
                      // Безопасная проверка входных параметров
                      if (!state || typeof state !== 'object') {
                        return {
                          choices: [],
                          value: undefined,
                        };
                      }
                      
                      // Безопасно получаем все доступные поля: rows, columns и metrics
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const formData =
                        state.form_data && typeof state.form_data === 'object'
                          ? state.form_data
                          : {};
                      const groupbyRows = ensureIsArray(controls?.groupbyRows?.value || []);
                      const groupbyColumns = ensureIsArray(controls?.groupbyColumns?.value || []);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      
                      // Получаем verbose_map для отображения понятных названий
                      const datasource = (state.datasource && typeof state.datasource === 'object')
                        ? (state.datasource as Dataset)
                        : undefined;
                      const verboseMap = (datasource?.verbose_map && typeof datasource.verbose_map === 'object')
                        ? datasource.verbose_map
                        : {};
                      
                      // Формируем список всех доступных полей с метками
                      const allFields: Array<{ value: string; label: string; type: string }> = [];
                      
                      // Добавляем поля из Rows
                      if (Array.isArray(groupbyRows)) {
                        groupbyRows.forEach((field: QueryFormColumn) => {
                          try {
                            const fieldLabel = getColumnLabel(field);
                            const displayLabel = typeof verboseMap[fieldLabel] === 'string' 
                              ? `${verboseMap[fieldLabel]} (Row)`
                              : `${fieldLabel} (Row)`;
                            allFields.push({
                              value: fieldLabel,
                              label: displayLabel,
                              type: 'row',
                            });
                          } catch (e) {
                            // Игнорируем ошибки при обработке полей
                          }
                        });
                      }
                      
                      // Добавляем поля из Columns
                      if (Array.isArray(groupbyColumns)) {
                        groupbyColumns.forEach((field: QueryFormColumn) => {
                          try {
                            const fieldLabel = getColumnLabel(field);
                            const displayLabel = typeof verboseMap[fieldLabel] === 'string' 
                              ? `${verboseMap[fieldLabel]} (Column)`
                              : `${fieldLabel} (Column)`;
                            allFields.push({
                              value: fieldLabel,
                              label: displayLabel,
                              type: 'column',
                            });
                          } catch (e) {
                            // Игнорируем ошибки при обработке полей
                          }
                        });
                      }
                      
                      // Добавляем метрики
                      if (Array.isArray(metrics)) {
                        metrics.forEach((metric: QueryFormMetric) => {
                          try {
                            // Получаем метку метрики: строка или объект с label/sqlExpression
                            let metricLabel: string;
                            if (typeof metric === 'string') {
                              metricLabel = metric;
                            } else if (metric && typeof metric === 'object' && metric.label) {
                              metricLabel = metric.label;
                            } else if (metric && typeof metric === 'object' && 'sqlExpression' in metric && metric.sqlExpression) {
                              metricLabel = metric.sqlExpression;
                            } else {
                              metricLabel = 'Unknown Metric';
                            }
                            const displayLabel = typeof verboseMap[metricLabel] === 'string' 
                              ? `${verboseMap[metricLabel]} (Metric)`
                              : `${metricLabel} (Metric)`;
                            allFields.push({
                              value: metricLabel,
                              label: displayLabel,
                              type: 'metric',
                            });
                          } catch (e) {
                            // Игнорируем ошибки при обработке метрик
                          }
                        });
                      }
                      
                      // 2-2: поля, уже выбранные в предыдущих слотах Field 1..Field n-1, не показывать в списке
                      const previouslySelectedSet = new Set<string>();
                      for (let k = 0; k < fieldIndex; k += 1) {
                        const selectorName = `field_formatting_field${k}_selector`;
                        const formValue = formData?.[selectorName];
                        const v = formValue;
                        if (typeof v === 'string' && v.length > 0) {
                          previouslySelectedSet.add(v);
                        }
                      }
                      const availableFields = allFields.filter(
                        field => !previouslySelectedSet.has(field.value),
                      );

                      // Безопасно получаем выбранное поле для этого набора настроек
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const hasSelectedFieldInFormData =
                        Object.prototype.hasOwnProperty.call(
                          formData,
                          selectorControlName,
                        );
                      const selectedFieldFromFormData = formData?.[selectorControlName];
                      const selectedField = hasSelectedFieldInFormData
                        ? selectedFieldFromFormData ?? null
                        : null;
                      return {
                        choices: availableFields.map(field => [field.value, field.label]),
                        value: selectedField,
                        // Инлайн-кнопка «✕ Remove» справа от лейбла «Field N»
                        // для компактности — вместо отдельного чекбокса
                        rightNode: selectedField
                          ? React.createElement(RemoveFieldInlineCheckbox, { fieldIndex })
                          : undefined,
                      };
                    },
                  },
                },
                {
                  // Скрытый контрол для хранения состояния remove и rerender
                  // (визуально заменён на rightNode в _selector)
                  name: `field_formatting_field${fieldIndex}_remove`,
                  config: {
                    type: 'HiddenControl',
                    renderTrigger: true,
                    default: false,
                    rerender: [
                      ...ALL_FIELD_SELECTOR_CONTROL_NAMES,
                      ...ALL_FIELD_REMOVE_CONTROL_NAMES,
                      'fieldGroupingSettings',
                    ],
                    // formDataOnChange не нужен: exploreReducer обрабатывает
                    // _remove-контролы напрямую через FIELD_REMOVE_REGEX
                    // (isPivotFieldControl === true → formDataOnChange пропускается)
                  },
                },
              ],
              // Контрол-переключатель для сворачивания/разворачивания блока настроек поля
              [
                {
                  name: `field_formatting_field${fieldIndex}_expanded`,
                  config: {
                    type: FieldSettingsCollapseControl,
                    label: '',
                    // ВАЖНО: renderTrigger ОБЯЗАН быть true!
                    // При renderTrigger:false Superset перемещает всю секцию
                    // на вкладку Data вместо Customize.
                    renderTrigger: true,
                    default: false,
                    // Показываем стрелку только когда поле выбрано
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      return !!selectorControl?.value;
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_maxWidth`,
                  config: {
                    type: 'NumberControl',
                    label: t('Max width (px)'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Maximum column width in pixels'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      return !!selectedField;
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'maxWidth' in fieldSettings) ? fieldSettings.maxWidth : undefined,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_truncate`,
                  config: {
                    type: 'CheckboxControl',
                    label: t('Truncate values'),
                    renderTrigger: true,
                    default: false,
                    description: t('Truncate values that exceed max width'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      return !!selectedField;
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: false };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: false };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'truncate' in fieldSettings) ? (fieldSettings.truncate ?? false) : false,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_alignment`,
                  config: {
                    type: 'SelectControl',
                    label: t('Alignment'),
                    renderTrigger: true,
                    default: undefined,
                    clearable: true,
                    choices: ALIGNMENT_CHOICES,
                    description: t('Alignment for field headers and value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      return !!selectedField;
                    },
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'alignment' in fieldSettings &&
                          fieldSettings.alignment !== undefined
                            ? fieldSettings.alignment
                            : undefined,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_valueFormat`,
                  config: {
                    ...sharedControls.y_axis_format,
                    label: t('Number format'),
                    clearable: true,
                    default: undefined,
                    renderTrigger: true,
                    description: t('D3 number format (per field)'),
                    choices: [
                      [
                        ADAPTIVE_FORMATTING_EMPTY_INSTEAD_0,
                        t('Adaptive formatting, empty instead 0'),
                      ],
                      ...(sharedControls.y_axis_format.choices || []),
                    ],
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl =
                        controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      return !!selectedField;
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [
                      `field_formatting_field${fieldIndex}_selector`,
                      'fieldGroupingSettings',
                    ],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'valueFormat' in fieldSettings &&
                          fieldSettings.valueFormat !== undefined
                            ? fieldSettings.valueFormat
                            : undefined,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_dateFormat`,
                  config: {
                    type: 'SelectControl',
                    freeForm: true,
                    label: t('Date format'),
                    clearable: true,
                    default: undefined,
                    renderTrigger: true,
                    choices: EXTENDED_D3_TIME_FORMAT_OPTIONS,
                    description: t('D3 time format (per field)'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl =
                        controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      return !!selectedField;
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [
                      `field_formatting_field${fieldIndex}_selector`,
                      'fieldGroupingSettings',
                    ],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'dateFormat' in fieldSettings &&
                          fieldSettings.dateFormat !== undefined
                            ? fieldSettings.dateFormat
                            : undefined,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_fontSize`,
                  config: {
                    type: 'NumberControl',
                    label: t('Font size (px)'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font size in pixels'),
                    visibility: (props: any) => {
                      // Hide generic typography controls for all fields (Row, Columns, Metrics)
                      // They have separate header/value styling controls below
                      return false;
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'fontSize' in fieldSettings) ? fieldSettings.fontSize : undefined,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_fontColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Font color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font color'),
                    visibility: (props: any) => {
                      // Hide generic typography controls for all fields (Row, Columns, Metrics)
                      // They have separate header/value styling controls below
                      return false;
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'fontColor' in fieldSettings) ? fieldSettings.fontColor : undefined,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_backgroundColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Background color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Background color for column/row'),
                    visibility: (props: any) => {
                      // Hide generic typography controls for all fields (Row, Columns, Metrics)
                      // They have separate header/value styling controls below
                      return false;
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'backgroundColor' in fieldSettings) ? fieldSettings.backgroundColor : undefined,
                      };
                    },
                  },
                },
              ],
              // Column/Row-specific header and value formatting
              [
                {
                  name: `field_formatting_field${fieldIndex}_columnHeaderFontSize`,
                  config: {
                    type: 'NumberControl',
                    label: t('Column header font size (px)'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font size for column header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyColumns = ensureIsArray(controls?.groupbyColumns?.value || []);
                      const columnLabels = groupbyColumns
                        .map((c: QueryFormColumn) => getColumnLabel(c))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return columnLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyColumns'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'columnHeaderFontSize' in fieldSettings && fieldSettings.columnHeaderFontSize !== undefined)
                          ? fieldSettings.columnHeaderFontSize
                          : fieldSettings.fontSize,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_columnHeaderFontColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Column header font color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font color for column header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyColumns = ensureIsArray(controls?.groupbyColumns?.value || []);
                      const columnLabels = groupbyColumns
                        .map((c: QueryFormColumn) => getColumnLabel(c))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return columnLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyColumns'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'columnHeaderFontColor' in fieldSettings && fieldSettings.columnHeaderFontColor !== undefined)
                          ? fieldSettings.columnHeaderFontColor
                          : fieldSettings.fontColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_columnHeaderBackgroundColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Column header background color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Background color for column header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyColumns = ensureIsArray(controls?.groupbyColumns?.value || []);
                      const columnLabels = groupbyColumns
                        .map((c: QueryFormColumn) => getColumnLabel(c))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return columnLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyColumns'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'columnHeaderBackgroundColor' in fieldSettings && fieldSettings.columnHeaderBackgroundColor !== undefined)
                          ? fieldSettings.columnHeaderBackgroundColor
                          : fieldSettings.backgroundColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_columnValueFontSize`,
                  config: {
                    type: 'NumberControl',
                    label: t('Column values font size (px)'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font size for column value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyColumns = ensureIsArray(controls?.groupbyColumns?.value || []);
                      const columnLabels = groupbyColumns
                        .map((c: QueryFormColumn) => getColumnLabel(c))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return columnLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyColumns'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'columnValueFontSize' in fieldSettings && fieldSettings.columnValueFontSize !== undefined)
                          ? fieldSettings.columnValueFontSize
                          : fieldSettings.fontSize,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_columnValueFontColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Column values font color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font color for column value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyColumns = ensureIsArray(controls?.groupbyColumns?.value || []);
                      const columnLabels = groupbyColumns
                        .map((c: QueryFormColumn) => getColumnLabel(c))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return columnLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyColumns'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'columnValueFontColor' in fieldSettings && fieldSettings.columnValueFontColor !== undefined)
                          ? fieldSettings.columnValueFontColor
                          : fieldSettings.fontColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_columnValueBackgroundColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Column values background color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Background color for column value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyColumns = ensureIsArray(controls?.groupbyColumns?.value || []);
                      const columnLabels = groupbyColumns
                        .map((c: QueryFormColumn) => getColumnLabel(c))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return columnLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyColumns'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'columnValueBackgroundColor' in fieldSettings && fieldSettings.columnValueBackgroundColor !== undefined)
                          ? fieldSettings.columnValueBackgroundColor
                          : fieldSettings.backgroundColor,
                      };
                    },
                  },
                },
              ],
              // Row-specific header and value formatting
              [
                {
                  name: `field_formatting_field${fieldIndex}_rowHeaderFontSize`,
                  config: {
                    type: 'NumberControl',
                    label: t('Row header font size (px)'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font size for row header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyRows = ensureIsArray(controls?.groupbyRows?.value || []);
                      const rowLabels = groupbyRows
                        .map((r: QueryFormColumn) => getColumnLabel(r))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return rowLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyRows'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'rowHeaderFontSize' in fieldSettings && fieldSettings.rowHeaderFontSize !== undefined)
                          ? fieldSettings.rowHeaderFontSize
                          : fieldSettings.fontSize,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_rowHeaderFontColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Row header font color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font color for row header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyRows = ensureIsArray(controls?.groupbyRows?.value || []);
                      const rowLabels = groupbyRows
                        .map((r: QueryFormColumn) => getColumnLabel(r))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return rowLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyRows'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'rowHeaderFontColor' in fieldSettings && fieldSettings.rowHeaderFontColor !== undefined)
                          ? fieldSettings.rowHeaderFontColor
                          : fieldSettings.fontColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_rowHeaderBackgroundColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Row header background color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Background color for row header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyRows = ensureIsArray(controls?.groupbyRows?.value || []);
                      const rowLabels = groupbyRows
                        .map((r: QueryFormColumn) => getColumnLabel(r))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return rowLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyRows'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'rowHeaderBackgroundColor' in fieldSettings && fieldSettings.rowHeaderBackgroundColor !== undefined)
                          ? fieldSettings.rowHeaderBackgroundColor
                          : fieldSettings.backgroundColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_rowValueFontSize`,
                  config: {
                    type: 'NumberControl',
                    label: t('Row values font size (px)'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font size for row value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyRows = ensureIsArray(controls?.groupbyRows?.value || []);
                      const rowLabels = groupbyRows
                        .map((r: QueryFormColumn) => getColumnLabel(r))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return rowLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyRows'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'rowValueFontSize' in fieldSettings && fieldSettings.rowValueFontSize !== undefined)
                          ? fieldSettings.rowValueFontSize
                          : fieldSettings.fontSize,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_rowValueFontColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Row values font color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font color for row value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyRows = ensureIsArray(controls?.groupbyRows?.value || []);
                      const rowLabels = groupbyRows
                        .map((r: QueryFormColumn) => getColumnLabel(r))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return rowLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyRows'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'rowValueFontColor' in fieldSettings && fieldSettings.rowValueFontColor !== undefined)
                          ? fieldSettings.rowValueFontColor
                          : fieldSettings.fontColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_rowValueBackgroundColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Row values background color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Background color for row value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl = controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const groupbyRows = ensureIsArray(controls?.groupbyRows?.value || []);
                      const rowLabels = groupbyRows
                        .map((r: QueryFormColumn) => getColumnLabel(r))
                        .filter((x: string) => x.length > 0);
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (m && typeof m === 'object' && 'sqlExpression' in m && m.sqlExpression) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return rowLabels.includes(String(selectedField)) && !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings', 'groupbyRows'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls = (state.controls && typeof state.controls === 'object') 
                        ? state.controls 
                        : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl = (controls && selectorControlName in controls)
                        ? controls[selectorControlName]
                        : undefined;
                      const selectedField = (selectorControl && typeof selectorControl === 'object' && 'value' in selectorControl)
                        ? selectorControl.value
                        : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl = (controls && 'fieldGroupingSettings' in controls)
                        ? controls.fieldGroupingSettings
                        : undefined;
                      const fieldGroupingSettings = (fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl === 'object' && 'value' in fieldGroupingSettingsControl && typeof fieldGroupingSettingsControl.value === 'object')
                        ? fieldGroupingSettingsControl.value
                        : {};
                      const fieldSettings = (fieldGroupingSettings && selectedField in fieldGroupingSettings && typeof fieldGroupingSettings[selectedField] === 'object')
                        ? fieldGroupingSettings[selectedField]
                        : {};
                      return {
                        value: (fieldSettings && 'rowValueBackgroundColor' in fieldSettings && fieldSettings.rowValueBackgroundColor !== undefined)
                          ? fieldSettings.rowValueBackgroundColor
                          : fieldSettings.backgroundColor,
                      };
                    },
                  },
                },
              ],
              // Metric-specific header formatting
              [
                {
                  name: `field_formatting_field${fieldIndex}_metricHeaderFontSize`,
                  config: {
                    type: 'NumberControl',
                    label: t('Metric header font size (px)'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font size for metric header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectedField =
                        controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'metricHeaderFontSize' in fieldSettings &&
                          fieldSettings.metricHeaderFontSize !== undefined
                            ? fieldSettings.metricHeaderFontSize
                            : fieldSettings.fontSize,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_metricHeaderFontColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Metric header font color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font color for metric header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectedField =
                        controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'metricHeaderFontColor' in fieldSettings &&
                          fieldSettings.metricHeaderFontColor !== undefined
                            ? fieldSettings.metricHeaderFontColor
                            : fieldSettings.fontColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_metricHeaderBackgroundColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Metric header background color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Background color for metric header cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectedField =
                        controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'metricHeaderBackgroundColor' in fieldSettings &&
                          fieldSettings.metricHeaderBackgroundColor !== undefined
                            ? fieldSettings.metricHeaderBackgroundColor
                            : fieldSettings.backgroundColor,
                      };
                    },
                  },
                },
              ],
              // Metric-specific value formatting
              [
                {
                  name: `field_formatting_field${fieldIndex}_metricValueFontSize`,
                  config: {
                    type: 'NumberControl',
                    label: t('Metric values font size (px)'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font size for metric value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectedField =
                        controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'metricValueFontSize' in fieldSettings &&
                          fieldSettings.metricValueFontSize !== undefined
                            ? fieldSettings.metricValueFontSize
                            : fieldSettings.fontSize,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_metricValueFontColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Metric values font color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font color for metric value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectedField =
                        controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'metricValueFontColor' in fieldSettings &&
                          fieldSettings.metricValueFontColor !== undefined
                            ? fieldSettings.metricValueFontColor
                            : fieldSettings.fontColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_metricValueBackgroundColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Metric values background color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Background color for metric value cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectedField =
                        controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value:
                          fieldSettings &&
                          'metricValueBackgroundColor' in fieldSettings &&
                          fieldSettings.metricValueBackgroundColor !== undefined
                            ? fieldSettings.metricValueBackgroundColor
                            : fieldSettings.backgroundColor,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_showNonZeroOnly`,
                  config: {
                    type: 'CheckboxControl',
                    label: t('Show non-zero values only'),
                    renderTrigger: true,
                    default: false,
                    description: t(
                      'Render empty string for null/NaN/zero/near-zero metric values.',
                    ),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectedField =
                        controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return metricLabels.includes(String(selectedField));
                    },
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl =
                        controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [
                      `field_formatting_field${fieldIndex}_selector`,
                      'fieldGroupingSettings',
                    ],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: false };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: false };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value: Boolean(fieldSettings?.showNonZeroOnly),
                      };
                    },
                  },
                },
              ],
              // Subtotal settings для поля
              [
                {
                  name: `field_formatting_field${fieldIndex}_subtotalShow`,
                  config: {
                    type: 'RadioButtonControl',
                    label: t('Show subtotal'),
                    renderTrigger: true,
                    default: 'general_setting',
                    options: [
                      ['show', t('Show')],
                      ['no_show', t('No Show')],
                      ['general_setting', t('General setting')],
                    ],
                    description: t(
                      'Show subtotal for this field. "General setting" uses table-wide settings from Data -> Options.',
                    ),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl =
                        controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      return !metricLabels.includes(String(selectedField));
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: 'general_setting' };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: 'general_setting' };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      // Обратная совместимость с subtotalEnabled
                      if (fieldSettings.subtotalShow !== undefined) {
                        return { value: fieldSettings.subtotalShow };
                      }
                      if (fieldSettings.subtotalEnabled !== undefined) {
                        return { value: fieldSettings.subtotalEnabled === true ? 'show' : 'no_show' };
                      }
                      return { value: 'general_setting' };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_metricSubtotalSettings`,
                  config: {
                    type: MetricSubtotalSettingsControl,
                    label: t('Per-Metric Subtotal Settings'),
                    renderTrigger: true,
                    default: {},
                    description: t('Customize subtotal settings for each metric'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl =
                        controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }

                      // Hide subtotal settings for metrics (metrics cannot have subtotals of themselves in this context)
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      
                      // If the selected field is a metric itself, don't show subtotal options (it doesn't make sense)
                      if (metricLabels.includes(String(selectedField))) {
                        return false;
                      }

                      // Check if Subtotal is enabled generic
                      const subtotalShowControl =
                        controls?.[`field_formatting_field${fieldIndex}_subtotalShow`];
                      const subtotalShow = subtotalShowControl?.value;
                      const fieldGroupingSettingsControl =
                        controls?.fieldGroupingSettings;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl?.value || {};
                      const fieldSettings = fieldGroupingSettings[selectedField] || {};
                      const subtotalEnabled = fieldSettings.subtotalEnabled;
                      return (
                        subtotalShow === 'show' ||
                        (subtotalShow === undefined && subtotalEnabled === true)
                      );
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [
                      `field_formatting_field${fieldIndex}_selector`,
                      `field_formatting_field${fieldIndex}_subtotalShow`,
                      'metrics', 
                      'fieldGroupingSettings',
                    ],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: {} };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      
                      // Get Metrics for the component to render the list
                      const metrics = ensureIsArray(controls?.metrics?.value || []);

                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: {}, metrics };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      
                      return {
                        value: fieldSettings?.metricSubtotalSettings || {},
                        metrics,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_subtotalLabel`,
                  config: {
                    type: 'TextControl',
                    label: t('Subtotal label'),
                    renderTrigger: true,
                    default: t('Subtotal'),
                    description: t('Label for subtotal row/column'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl =
                        controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }

                      // Hide subtotal settings for metrics
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      if (metricLabels.includes(String(selectedField))) {
                        return false;
                      }

                      const subtotalShowControl =
                        controls?.[`field_formatting_field${fieldIndex}_subtotalShow`];
                      const subtotalShow = subtotalShowControl?.value;
                      // Показываем только при явном включении subtotalShow
                      // Также поддерживаем обратную совместимость с subtotalEnabled
                      const fieldGroupingSettingsControl =
                        controls?.fieldGroupingSettings;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl?.value || {};
                      const fieldSettings = fieldGroupingSettings[selectedField] || {};
                      const subtotalEnabled = fieldSettings.subtotalEnabled;
                      return (
                        subtotalShow === 'show' ||
                        (subtotalShow === undefined && subtotalEnabled === true)
                      );
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [
                      `field_formatting_field${fieldIndex}_selector`,
                      `field_formatting_field${fieldIndex}_subtotalShow`,
                      'fieldGroupingSettings',
                    ],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      return {
                        value: fieldSettings?.subtotalLabel || undefined,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_subtotalFontColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Subtotal font color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Font color for subtotal cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl =
                        controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }

                      // Hide subtotal settings for metrics
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      if (metricLabels.includes(String(selectedField))) {
                        return false;
                      }

                      const subtotalShowControl =
                        controls?.[`field_formatting_field${fieldIndex}_subtotalShow`];
                      const subtotalShow = subtotalShowControl?.value;
                      const fieldGroupingSettingsControl =
                        controls?.fieldGroupingSettings;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl?.value || {};
                      const fieldSettings = fieldGroupingSettings[selectedField] || {};
                      const subtotalEnabled = fieldSettings.subtotalEnabled;
                      return (
                        subtotalShow === 'show' ||
                        (subtotalShow === undefined && subtotalEnabled === true)
                      );
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [
                      `field_formatting_field${fieldIndex}_selector`,
                      `field_formatting_field${fieldIndex}_subtotalShow`,
                      'fieldGroupingSettings',
                    ],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      const subtotalValueFormat = fieldSettings?.subtotalValueFormat;
                      return {
                        value: subtotalValueFormat?.fontColor || undefined,
                      };
                    },
                  },
                },
                {
                  name: `field_formatting_field${fieldIndex}_subtotalBackgroundColor`,
                  config: {
                    type: 'ColorPickerControl',
                    label: t('Subtotal background color'),
                    renderTrigger: true,
                    default: undefined,
                    description: t('Background color for subtotal cells'),
                    visibility: (props: any) => {
                      const controls = props?.controls || {};
                      const selectorControl =
                        controls?.[`field_formatting_field${fieldIndex}_selector`];
                      const selectedField = selectorControl?.value;
                      if (!selectedField) {
                        return false;
                      }

                      // Hide subtotal settings for metrics
                      const metrics = ensureIsArray(controls?.metrics?.value || []);
                      const metricLabels = metrics
                        .map((m: QueryFormMetric) => {
                          if (typeof m === 'string') return m;
                          if (m && typeof m === 'object' && 'label' in m && m.label) {
                            return String(m.label);
                          }
                          if (
                            m &&
                            typeof m === 'object' &&
                            'sqlExpression' in m &&
                            m.sqlExpression
                          ) {
                            return String(m.sqlExpression);
                          }
                          return '';
                        })
                        .filter((x: string) => x.length > 0);
                      if (metricLabels.includes(String(selectedField))) {
                        return false;
                      }

                      const subtotalShowControl =
                        controls?.[`field_formatting_field${fieldIndex}_subtotalShow`];
                      const subtotalShow = subtotalShowControl?.value;
                      const fieldGroupingSettingsControl =
                        controls?.fieldGroupingSettings;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl?.value || {};
                      const fieldSettings = fieldGroupingSettings[selectedField] || {};
                      const subtotalEnabled = fieldSettings.subtotalEnabled;
                      return (
                        subtotalShow === 'show' ||
                        (subtotalShow === undefined && subtotalEnabled === true)
                      );
                    },
                    // Скрываем через CSS (display:none) когда блок свёрнут.
                    // ВАЖНО: используем hidden, а НЕ visibility,
                    // т.к. visibility=false размонтирует компонент и сбрасывает значения.
                    hidden: (props: any) => {
                      const controls = props?.controls || {};
                      const expandedControl = controls?.[`field_formatting_field${fieldIndex}_expanded`];
                      return !expandedControl?.value;
                    },
                    rerender: [
                      `field_formatting_field${fieldIndex}_selector`,
                      `field_formatting_field${fieldIndex}_subtotalShow`,
                      'fieldGroupingSettings',
                    ],
                    mapStateToProps: (state: any) => {
                      if (!state || typeof state !== 'object') {
                        return { value: undefined };
                      }
                      const controls =
                        state.controls && typeof state.controls === 'object'
                          ? state.controls
                          : {};
                      const selectorControlName = `field_formatting_field${fieldIndex}_selector`;
                      const selectorControl =
                        controls && selectorControlName in controls
                          ? controls[selectorControlName]
                          : undefined;
                      const selectedField =
                        selectorControl &&
                        typeof selectorControl === 'object' &&
                        'value' in selectorControl
                          ? selectorControl.value
                          : undefined;
                      if (!selectedField) {
                        return { value: undefined };
                      }
                      const fieldGroupingSettingsControl =
                        controls && 'fieldGroupingSettings' in controls
                          ? controls.fieldGroupingSettings
                          : undefined;
                      const fieldGroupingSettings =
                        fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl === 'object' &&
                        'value' in fieldGroupingSettingsControl &&
                        typeof fieldGroupingSettingsControl.value === 'object'
                          ? fieldGroupingSettingsControl.value
                          : {};
                      const fieldSettings =
                        fieldGroupingSettings &&
                        selectedField in fieldGroupingSettings &&
                        typeof fieldGroupingSettings[selectedField] === 'object'
                          ? fieldGroupingSettings[selectedField]
                          : {};
                      const subtotalValueFormat = fieldSettings?.subtotalValueFormat;
                      return {
                        value: subtotalValueFormat?.backgroundColor || undefined,
                      };
                    },
                  },
                },
              ],
            );
          }
          return controls;
        })(),
      ],
    },
    // Секция глобальных настроек таблицы
    {
      label: t('Global Table Settings'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'globalTableSettings.columnTotalsEnabled',
            config: {
              type: 'CheckboxControl',
              label: t('Show column totals'),
              renderTrigger: true,
              default: false,
              description: t('Display total row for columns'),
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.columnTotalsPosition',
            config: {
              type: 'SelectControl',
              label: t('Column totals position'),
              renderTrigger: true,
              default: 'bottom',
              choices: [
                ['top', t('Top')],
                ['bottom', t('Bottom')],
              ],
              description: t('Position of column totals'),
              visibility: ({ controls }: { controls?: any }) => {
                const settings = controls?.globalTableSettings?.value as any;
                return settings?.columnTotalsEnabled === true;
              },
            },
          },
          {
            name: 'globalTableSettings.columnTotalsLabel',
            config: {
              type: 'TextControl',
              label: t('Column totals label'),
              renderTrigger: true,
              default: t('Total'),
              description: t('Label for column totals row'),
              visibility: ({ controls }: { controls?: any }) => {
                const settings = controls?.globalTableSettings?.value as any;
                return settings?.columnTotalsEnabled === true;
              },
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.rowTotalsEnabled',
            config: {
              type: 'CheckboxControl',
              label: t('Show row totals'),
              renderTrigger: true,
              default: false,
              description: t('Display total column for rows'),
            },
          },
        ],
        [
          {
            name: 'globalTableSettings.rowTotalsPosition',
            config: {
              type: 'SelectControl',
              label: t('Row totals position'),
              renderTrigger: true,
              default: 'right',
              choices: [
                ['left', t('Left')],
                ['right', t('Right')],
              ],
              description: t('Position of row totals'),
              visibility: ({ controls }: { controls?: any }) => {
                const settings = controls?.globalTableSettings?.value as any;
                return settings?.rowTotalsEnabled === true;
              },
            },
          },
          {
            name: 'globalTableSettings.rowTotalsLabel',
            config: {
              type: 'TextControl',
              label: t('Row totals label'),
              renderTrigger: true,
              default: t('Total'),
              description: t('Label for row totals column'),
              visibility: ({ controls }: { controls?: any }) => {
                const settings = controls?.globalTableSettings?.value as any;
                return settings?.rowTotalsEnabled === true;
              },
            },
          },
        ],
      ],
    },
  ],
  formDataOverrides: formData => {
    const groupbyColumns = getStandardizedControls().controls.columns.filter(
      col => !ensureIsArray(formData.groupbyRows).includes(col),
    );
    getStandardizedControls().controls.columns =
      getStandardizedControls().controls.columns.filter(
        col => !groupbyColumns.includes(col),
      );
    
    // Синхронизируем значения временных контролов с fieldGroupingSettings
    const rawFieldGroupingSettings = formData.fieldGroupingSettings || {};
    const selectedFields = new Set<string>();
    for (let i = 0; i < MAX_FIELD_FORMATTING_SLOTS; i += 1) {
      const selectorValue = formData[
        `field_formatting_field${i}_selector` as keyof typeof formData
      ] as unknown;
      if (typeof selectorValue === 'string' && selectorValue.length > 0) {
        selectedFields.add(selectorValue);
      }
    }

    const fieldGroupingSettings = Object.entries(rawFieldGroupingSettings).reduce(
      (acc, [fieldName, fieldSettings]) => {
        if (selectedFields.has(fieldName) && fieldSettings !== null) {
          const next = { ...(fieldSettings as Record<string, unknown>) };
          // Агрегация subtotal задаётся только в Per-Metric Overrides.
          delete next.subtotalAggregation;
          acc[fieldName] = next;
        }
        return acc;
      },
      {} as Record<string, any>,
    );
    
    // Синхронизируем значения из временных контролов для каждого набора настроек (до 10)
    for (let i = 0; i < 10; i++) {
      // Получаем выбранное поле для этого набора настроек
      const selectorKey = `field_formatting_field${i}_selector` as keyof typeof formData;
      const selectedField = formData[selectorKey] as string | undefined;
      
      // 2-1: если поле не выбрано — не добавляем его в formDataOverrides (очистка через formDataOnChange в селекторе)
      if (!selectedField) {
        continue;
      }     
      
      const fieldSettings = fieldGroupingSettings[selectedField] || {};
      
      // Синхронизируем значения из временных контролов
      const maxWidthKey = `field_formatting_field${i}_maxWidth` as keyof typeof formData;
      const truncateKey = `field_formatting_field${i}_truncate` as keyof typeof formData;
      const valueFormatKey =
        `field_formatting_field${i}_valueFormat` as keyof typeof formData;
      const dateFormatKey =
        `field_formatting_field${i}_dateFormat` as keyof typeof formData;
      const metricAggregationFunctionKey =
        `field_formatting_field${i}_metricAggregationFunction` as keyof typeof formData;
      const fontSizeKey = `field_formatting_field${i}_fontSize` as keyof typeof formData;
      const fontColorKey = `field_formatting_field${i}_fontColor` as keyof typeof formData;
      const backgroundColorKey = `field_formatting_field${i}_backgroundColor` as keyof typeof formData;
      const alignmentKey = `field_formatting_field${i}_alignment` as keyof typeof formData;
      const metricHeaderFontSizeKey =
        `field_formatting_field${i}_metricHeaderFontSize` as keyof typeof formData;
      const metricHeaderFontColorKey =
        `field_formatting_field${i}_metricHeaderFontColor` as keyof typeof formData;
      const metricHeaderBackgroundColorKey =
        `field_formatting_field${i}_metricHeaderBackgroundColor` as keyof typeof formData;
      const metricValueFontSizeKey =
        `field_formatting_field${i}_metricValueFontSize` as keyof typeof formData;
      const metricValueFontColorKey =
        `field_formatting_field${i}_metricValueFontColor` as keyof typeof formData;
      const metricValueBackgroundColorKey =
        `field_formatting_field${i}_metricValueBackgroundColor` as keyof typeof formData;
      const showNonZeroOnlyKey =
        `field_formatting_field${i}_showNonZeroOnly` as keyof typeof formData;
      const columnHeaderFontSizeKey =
        `field_formatting_field${i}_columnHeaderFontSize` as keyof typeof formData;
      const columnHeaderFontColorKey =
        `field_formatting_field${i}_columnHeaderFontColor` as keyof typeof formData;
      const columnHeaderBackgroundColorKey =
        `field_formatting_field${i}_columnHeaderBackgroundColor` as keyof typeof formData;
      const columnValueFontSizeKey =
        `field_formatting_field${i}_columnValueFontSize` as keyof typeof formData;
      const columnValueFontColorKey =
        `field_formatting_field${i}_columnValueFontColor` as keyof typeof formData;
      const columnValueBackgroundColorKey =
        `field_formatting_field${i}_columnValueBackgroundColor` as keyof typeof formData;
      const rowHeaderFontSizeKey =
        `field_formatting_field${i}_rowHeaderFontSize` as keyof typeof formData;
      const rowHeaderFontColorKey =
        `field_formatting_field${i}_rowHeaderFontColor` as keyof typeof formData;
      const rowHeaderBackgroundColorKey =
        `field_formatting_field${i}_rowHeaderBackgroundColor` as keyof typeof formData;
      const rowValueFontSizeKey =
        `field_formatting_field${i}_rowValueFontSize` as keyof typeof formData;
      const rowValueFontColorKey =
        `field_formatting_field${i}_rowValueFontColor` as keyof typeof formData;
      const rowValueBackgroundColorKey =
        `field_formatting_field${i}_rowValueBackgroundColor` as keyof typeof formData;
      const subtotalShowKey = 
        `field_formatting_field${i}_subtotalShow` as keyof typeof formData;
      const subtotalLabelKey = 
        `field_formatting_field${i}_subtotalLabel` as keyof typeof formData;
      const subtotalValueFormatKey = 
        `field_formatting_field${i}_subtotalValueFormat` as keyof typeof formData;
      const subtotalFontColorKey = 
        `field_formatting_field${i}_subtotalFontColor` as keyof typeof formData;
      const subtotalBackgroundColorKey = 
        `field_formatting_field${i}_subtotalBackgroundColor` as keyof typeof formData;
      const metricSubtotalSettingsKey =
        `field_formatting_field${i}_metricSubtotalSettings` as keyof typeof formData;
      
      if (formData[maxWidthKey] !== undefined) {
        fieldSettings.maxWidth = formData[maxWidthKey] as number;
      }
      if (formData[truncateKey] !== undefined) {
        fieldSettings.truncate = formData[truncateKey] as boolean;
      }
      if (formData[subtotalShowKey] !== undefined) {
        fieldSettings.subtotalShow = formData[subtotalShowKey] as string;
      }
      // Очищаем legacy subtotalEnabled, так как он заменен на subtotalShow
      if (fieldSettings.subtotalEnabled !== undefined) {
        delete fieldSettings.subtotalEnabled;
      }
      if (formData[subtotalLabelKey] !== undefined) {
        fieldSettings.subtotalLabel = formData[subtotalLabelKey] as string;
      }
      // Сохраняем формат и цвета сабтоталов как объект
      if (
        formData[subtotalValueFormatKey] !== undefined ||
        formData[subtotalFontColorKey] !== undefined ||
        formData[subtotalBackgroundColorKey] !== undefined
      ) {
        fieldSettings.subtotalValueFormat = {
          ...(fieldSettings.subtotalValueFormat || {}),
        };
        if (formData[subtotalValueFormatKey] !== undefined) {
          fieldSettings.subtotalValueFormat.valueFormat = formData[subtotalValueFormatKey] as string;
        }
        if (formData[subtotalFontColorKey] !== undefined) {
          fieldSettings.subtotalValueFormat.fontColor = formData[subtotalFontColorKey] as string;
        }
        if (formData[subtotalBackgroundColorKey] !== undefined) {
          fieldSettings.subtotalValueFormat.backgroundColor = formData[subtotalBackgroundColorKey] as string;
        }
      }
      if (formData[metricSubtotalSettingsKey] !== undefined) {
        fieldSettings.metricSubtotalSettings = formData[
          metricSubtotalSettingsKey
        ] as Record<string, any>;
      }
      if (formData[valueFormatKey] !== undefined) {
        fieldSettings.valueFormat = formData[valueFormatKey] as string;
      }
      if (formData[alignmentKey] !== undefined) {
        fieldSettings.alignment = formData[alignmentKey] as string;
      }
      if (formData[dateFormatKey] !== undefined) {
        fieldSettings.dateFormat = formData[dateFormatKey] as string;
      }
      if (formData[metricAggregationFunctionKey] !== undefined) {
        fieldSettings.metricAggregationFunction =
          formData[metricAggregationFunctionKey] as string;
      }
      // Не сохраняем безымянные настройки fontSize, fontColor, backgroundColor для Row и Columns
      // Они имеют отдельные настройки для header и values
      const groupbyRows = ensureIsArray(formData.groupbyRows || []);
      const groupbyColumns = ensureIsArray(formData.groupbyColumns || []);
      const rowLabels = groupbyRows.map((r: QueryFormColumn) => getColumnLabel(r)).filter((x: string) => x.length > 0);
      const columnLabels = groupbyColumns.map((c: QueryFormColumn) => getColumnLabel(c)).filter((x: string) => x.length > 0);
      const isRowField = rowLabels.indexOf(String(selectedField)) !== -1;
      const isColumnField = columnLabels.indexOf(String(selectedField)) !== -1;
      // Сохраняем безымянные настройки только для метрик (для обратной совместимости)
      // Для Row и Columns используем только отдельные настройки header/value
      if (!isRowField && !isColumnField) {
        if (formData[fontSizeKey] !== undefined) {
          fieldSettings.fontSize = formData[fontSizeKey] as number;
        }
        if (formData[fontColorKey] !== undefined) {
          fieldSettings.fontColor = formData[fontColorKey] as string;
        }
        if (formData[backgroundColorKey] !== undefined) {
          fieldSettings.backgroundColor = formData[backgroundColorKey] as string;
        }
      }

      if (formData[metricHeaderFontSizeKey] !== undefined) {
        fieldSettings.metricHeaderFontSize = formData[metricHeaderFontSizeKey] as number;
      }
      if (formData[metricHeaderFontColorKey] !== undefined) {
        fieldSettings.metricHeaderFontColor = formData[metricHeaderFontColorKey] as string;
      }
      if (formData[metricHeaderBackgroundColorKey] !== undefined) {
        fieldSettings.metricHeaderBackgroundColor =
          formData[metricHeaderBackgroundColorKey] as string;
      }
      if (formData[metricValueFontSizeKey] !== undefined) {
        fieldSettings.metricValueFontSize = formData[metricValueFontSizeKey] as number;
      }
      if (formData[metricValueFontColorKey] !== undefined) {
        fieldSettings.metricValueFontColor = formData[metricValueFontColorKey] as string;
      }
      if (formData[metricValueBackgroundColorKey] !== undefined) {
        fieldSettings.metricValueBackgroundColor =
          formData[metricValueBackgroundColorKey] as string;
      }
      if (formData[showNonZeroOnlyKey] !== undefined) {
        fieldSettings.showNonZeroOnly = Boolean(formData[showNonZeroOnlyKey]);
      }
      if (formData[columnHeaderFontSizeKey] !== undefined) {
        fieldSettings.columnHeaderFontSize = formData[columnHeaderFontSizeKey] as number;
      }
      if (formData[columnHeaderFontColorKey] !== undefined) {
        fieldSettings.columnHeaderFontColor = formData[columnHeaderFontColorKey] as string;
      }
      if (formData[columnHeaderBackgroundColorKey] !== undefined) {
        fieldSettings.columnHeaderBackgroundColor =
          formData[columnHeaderBackgroundColorKey] as string;
      }
      if (formData[columnValueFontSizeKey] !== undefined) {
        fieldSettings.columnValueFontSize = formData[columnValueFontSizeKey] as number;
      }
      if (formData[columnValueFontColorKey] !== undefined) {
        fieldSettings.columnValueFontColor = formData[columnValueFontColorKey] as string;
      }
      if (formData[columnValueBackgroundColorKey] !== undefined) {
        fieldSettings.columnValueBackgroundColor =
          formData[columnValueBackgroundColorKey] as string;
      }
      if (formData[rowHeaderFontSizeKey] !== undefined) {
        fieldSettings.rowHeaderFontSize = formData[rowHeaderFontSizeKey] as number;
      }
      if (formData[rowHeaderFontColorKey] !== undefined) {
        fieldSettings.rowHeaderFontColor = formData[rowHeaderFontColorKey] as string;
      }
      if (formData[rowHeaderBackgroundColorKey] !== undefined) {
        fieldSettings.rowHeaderBackgroundColor =
          formData[rowHeaderBackgroundColorKey] as string;
      }
      if (formData[rowValueFontSizeKey] !== undefined) {
        fieldSettings.rowValueFontSize = formData[rowValueFontSizeKey] as number;
      }
      if (formData[rowValueFontColorKey] !== undefined) {
        fieldSettings.rowValueFontColor = formData[rowValueFontColorKey] as string;
      }
      if (formData[rowValueBackgroundColorKey] !== undefined) {
        fieldSettings.rowValueBackgroundColor =
          formData[rowValueBackgroundColorKey] as string;
      }

      delete fieldSettings.subtotalAggregation;

      // Сохраняем настройки только если есть хотя бы одно значение
      if (Object.keys(fieldSettings).length > 0) {
        fieldGroupingSettings[selectedField] = fieldSettings;
      }
    }
    
    // Инициализируем значения временных контролов из fieldGroupingSettings
    const resultFormData: any = {
      ...formData,
      metrics: getStandardizedControls().popAllMetrics(),
      groupbyColumns,
      fieldGroupingSettings,
      // Ensure combineMetric defaults to true for enhanced pivot table
      // so that metrics are shown side by side under each column value.
      combineMetric: formData.combineMetric ?? true,
    };
    
    // Сначала восстанавливаем настройки для полей, которые уже выбраны в селекторах
    const usedSelectors = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const selectorKey = `field_formatting_field${i}_selector` as keyof typeof formData;
      const selectedField = formData[selectorKey] as string | undefined;
      
      if (selectedField) {
        usedSelectors.add(selectedField);
        const fieldSettings = fieldGroupingSettings[selectedField] || {};
        
        resultFormData[`field_formatting_field${i}_maxWidth`] = fieldSettings.maxWidth;
        resultFormData[`field_formatting_field${i}_truncate`] = fieldSettings.truncate ?? false;
        resultFormData[`field_formatting_field${i}_valueFormat`] =
          fieldSettings.valueFormat;
        resultFormData[`field_formatting_field${i}_alignment`] =
          fieldSettings.alignment;
        resultFormData[`field_formatting_field${i}_dateFormat`] = fieldSettings.dateFormat;
        resultFormData[`field_formatting_field${i}_metricAggregationFunction`] =
          fieldSettings.metricAggregationFunction;
        // Не восстанавливаем безымянные настройки fontSize, fontColor, backgroundColor для Row и Columns
        // Они имеют отдельные настройки для header и values
        const groupbyRows = ensureIsArray(formData.groupbyRows || []);
        const groupbyColumns = ensureIsArray(formData.groupbyColumns || []);
        const rowLabels = groupbyRows.map((r: QueryFormColumn) => getColumnLabel(r)).filter((x: string) => x.length > 0);
        const columnLabels = groupbyColumns.map((c: QueryFormColumn) => getColumnLabel(c)).filter((x: string) => x.length > 0);
        const isRowField = rowLabels.indexOf(String(selectedField)) !== -1;
        const isColumnField = columnLabels.indexOf(String(selectedField)) !== -1;
        // Восстанавливаем безымянные настройки только для метрик (для обратной совместимости)
        // Для Row и Columns используем только отдельные настройки header/value
        if (!isRowField && !isColumnField) {
          resultFormData[`field_formatting_field${i}_fontSize`] = fieldSettings.fontSize;
          resultFormData[`field_formatting_field${i}_fontColor`] = fieldSettings.fontColor;
          resultFormData[`field_formatting_field${i}_backgroundColor`] = fieldSettings.backgroundColor;
        }
        resultFormData[`field_formatting_field${i}_metricHeaderFontSize`] =
          fieldSettings.metricHeaderFontSize;
        resultFormData[`field_formatting_field${i}_metricHeaderFontColor`] =
          fieldSettings.metricHeaderFontColor;
        resultFormData[`field_formatting_field${i}_metricHeaderBackgroundColor`] =
          fieldSettings.metricHeaderBackgroundColor;
        resultFormData[`field_formatting_field${i}_metricValueFontSize`] =
          fieldSettings.metricValueFontSize;
        resultFormData[`field_formatting_field${i}_metricValueFontColor`] =
          fieldSettings.metricValueFontColor;
        resultFormData[`field_formatting_field${i}_metricValueBackgroundColor`] =
          fieldSettings.metricValueBackgroundColor;
        resultFormData[`field_formatting_field${i}_showNonZeroOnly`] =
          Boolean(fieldSettings.showNonZeroOnly);
        resultFormData[`field_formatting_field${i}_columnHeaderFontSize`] =
          fieldSettings.columnHeaderFontSize;
        resultFormData[`field_formatting_field${i}_columnHeaderFontColor`] =
          fieldSettings.columnHeaderFontColor;
        resultFormData[`field_formatting_field${i}_columnHeaderBackgroundColor`] =
          fieldSettings.columnHeaderBackgroundColor;
        resultFormData[`field_formatting_field${i}_columnValueFontSize`] =
          fieldSettings.columnValueFontSize;
        resultFormData[`field_formatting_field${i}_columnValueFontColor`] =
          fieldSettings.columnValueFontColor;
        resultFormData[`field_formatting_field${i}_columnValueBackgroundColor`] =
          fieldSettings.columnValueBackgroundColor;
        resultFormData[`field_formatting_field${i}_rowHeaderFontSize`] =
          fieldSettings.rowHeaderFontSize;
        resultFormData[`field_formatting_field${i}_rowHeaderFontColor`] =
          fieldSettings.rowHeaderFontColor;
        resultFormData[`field_formatting_field${i}_rowHeaderBackgroundColor`] =
          fieldSettings.rowHeaderBackgroundColor;
        resultFormData[`field_formatting_field${i}_rowValueFontSize`] =
          fieldSettings.rowValueFontSize;
        resultFormData[`field_formatting_field${i}_rowValueFontColor`] =
          fieldSettings.rowValueFontColor;
        resultFormData[`field_formatting_field${i}_rowValueBackgroundColor`] =
          fieldSettings.rowValueBackgroundColor;
        // Восстанавливаем настройки subtotal
        resultFormData[`field_formatting_field${i}_subtotalShow`] = fieldSettings.subtotalShow;
        resultFormData[`field_formatting_field${i}_subtotalLabel`] = fieldSettings.subtotalLabel;
        if (fieldSettings.subtotalValueFormat) {
          resultFormData[`field_formatting_field${i}_subtotalValueFormat`] = fieldSettings.subtotalValueFormat.valueFormat;
          resultFormData[`field_formatting_field${i}_subtotalFontColor`] = fieldSettings.subtotalValueFormat.fontColor;
          resultFormData[`field_formatting_field${i}_subtotalBackgroundColor`] = fieldSettings.subtotalValueFormat.backgroundColor;
        }
      }
    }
    
    // Затем восстанавливаем настройки для полей из fieldGroupingSettings, которые не выбраны в селекторах
    // Это нужно для правильной загрузки настроек при открытии чарта с дашборда
    const fieldNames = Object.keys(fieldGroupingSettings);
    let nextFreeIndex = 0;
    for (const fieldName of fieldNames) {
      // Пропускаем поля, которые уже восстановлены
      if (usedSelectors.has(fieldName)) {
        continue;
      }
      
      // Находим первый свободный индекс для временного контрола
      while (nextFreeIndex < 10 && resultFormData[`field_formatting_field${nextFreeIndex}_selector`]) {
        nextFreeIndex += 1;
      }
      
      if (nextFreeIndex >= 10) {
        // Нет свободных слотов, пропускаем
        break;
      }
      
      const fieldSettings = fieldGroupingSettings[fieldName] || {};
      
      // Восстанавливаем селектор и все настройки
      resultFormData[`field_formatting_field${nextFreeIndex}_selector`] = fieldName;
      resultFormData[`field_formatting_field${nextFreeIndex}_maxWidth`] = fieldSettings.maxWidth;
      resultFormData[`field_formatting_field${nextFreeIndex}_truncate`] = fieldSettings.truncate ?? false;
      resultFormData[`field_formatting_field${nextFreeIndex}_valueFormat`] =
        fieldSettings.valueFormat;
      resultFormData[`field_formatting_field${nextFreeIndex}_dateFormat`] = fieldSettings.dateFormat;
      resultFormData[`field_formatting_field${nextFreeIndex}_metricAggregationFunction`] =
        fieldSettings.metricAggregationFunction;
      // Не восстанавливаем безымянные настройки fontSize, fontColor, backgroundColor для Row и Columns
      // Они имеют отдельные настройки для header и values
      const groupbyRows = ensureIsArray(formData.groupbyRows || []);
      const groupbyColumns = ensureIsArray(formData.groupbyColumns || []);
      const rowLabels = groupbyRows.map((r: QueryFormColumn) => getColumnLabel(r)).filter((x: string) => x.length > 0);
      const columnLabels = groupbyColumns.map((c: QueryFormColumn) => getColumnLabel(c)).filter((x: string) => x.length > 0);
      const isRowField = rowLabels.indexOf(String(fieldName)) !== -1;
      const isColumnField = columnLabels.indexOf(String(fieldName)) !== -1;
      // Восстанавливаем безымянные настройки только для метрик (для обратной совместимости)
      // Для Row и Columns используем только отдельные настройки header/value
      if (!isRowField && !isColumnField) {
        resultFormData[`field_formatting_field${nextFreeIndex}_fontSize`] = fieldSettings.fontSize;
        resultFormData[`field_formatting_field${nextFreeIndex}_fontColor`] = fieldSettings.fontColor;
        resultFormData[`field_formatting_field${nextFreeIndex}_backgroundColor`] = fieldSettings.backgroundColor;
      }
      resultFormData[`field_formatting_field${nextFreeIndex}_metricHeaderFontSize`] =
        fieldSettings.metricHeaderFontSize;
      resultFormData[`field_formatting_field${nextFreeIndex}_metricHeaderFontColor`] =
        fieldSettings.metricHeaderFontColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_metricHeaderBackgroundColor`] =
        fieldSettings.metricHeaderBackgroundColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_metricValueFontSize`] =
        fieldSettings.metricValueFontSize;
      resultFormData[`field_formatting_field${nextFreeIndex}_metricValueFontColor`] =
        fieldSettings.metricValueFontColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_metricValueBackgroundColor`] =
        fieldSettings.metricValueBackgroundColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_showNonZeroOnly`] =
        Boolean(fieldSettings.showNonZeroOnly);
      resultFormData[`field_formatting_field${nextFreeIndex}_columnHeaderFontSize`] =
        fieldSettings.columnHeaderFontSize;
      resultFormData[`field_formatting_field${nextFreeIndex}_columnHeaderFontColor`] =
        fieldSettings.columnHeaderFontColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_columnHeaderBackgroundColor`] =
        fieldSettings.columnHeaderBackgroundColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_columnValueFontSize`] =
        fieldSettings.columnValueFontSize;
      resultFormData[`field_formatting_field${nextFreeIndex}_columnValueFontColor`] =
        fieldSettings.columnValueFontColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_columnValueBackgroundColor`] =
        fieldSettings.columnValueBackgroundColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_rowHeaderFontSize`] =
        fieldSettings.rowHeaderFontSize;
      resultFormData[`field_formatting_field${nextFreeIndex}_rowHeaderFontColor`] =
        fieldSettings.rowHeaderFontColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_rowHeaderBackgroundColor`] =
        fieldSettings.rowHeaderBackgroundColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_rowValueFontSize`] =
        fieldSettings.rowValueFontSize;
      resultFormData[`field_formatting_field${nextFreeIndex}_rowValueFontColor`] =
        fieldSettings.rowValueFontColor;
      resultFormData[`field_formatting_field${nextFreeIndex}_rowValueBackgroundColor`] =
        fieldSettings.rowValueBackgroundColor;
      // Восстанавливаем настройки subtotal
      resultFormData[`field_formatting_field${nextFreeIndex}_subtotalShow`] = fieldSettings.subtotalShow;
      resultFormData[`field_formatting_field${nextFreeIndex}_subtotalLabel`] = fieldSettings.subtotalLabel;
      if (fieldSettings.subtotalValueFormat) {
        resultFormData[`field_formatting_field${nextFreeIndex}_subtotalValueFormat`] = fieldSettings.subtotalValueFormat.valueFormat;
        resultFormData[`field_formatting_field${nextFreeIndex}_subtotalFontColor`] = fieldSettings.subtotalValueFormat.fontColor;
        resultFormData[`field_formatting_field${nextFreeIndex}_subtotalBackgroundColor`] = fieldSettings.subtotalValueFormat.backgroundColor;
      }
      
      nextFreeIndex += 1;
    }
    
    // Очищаем неиспользуемые временные контролы
    for (let i = 0; i < 10; i++) {
      const selectorKey = `field_formatting_field${i}_selector` as keyof typeof formData;
      const selectedField = resultFormData[selectorKey] as string | undefined;
      
      if (!selectedField) {
        // Если поле не выбрано, очищаем значения контролов
        resultFormData[`field_formatting_field${i}_selector`] = null;
        resultFormData[`field_formatting_field${i}_remove`] = false;
        resultFormData[`field_formatting_field${i}_maxWidth`] = undefined;
        resultFormData[`field_formatting_field${i}_truncate`] = false;
        resultFormData[`field_formatting_field${i}_valueFormat`] = undefined;
        resultFormData[`field_formatting_field${i}_dateFormat`] = undefined;
        resultFormData[`field_formatting_field${i}_metricAggregationFunction`] =
          undefined;
        resultFormData[`field_formatting_field${i}_fontSize`] = undefined;
        resultFormData[`field_formatting_field${i}_fontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_backgroundColor`] = undefined;
        resultFormData[`field_formatting_field${i}_metricHeaderFontSize`] = undefined;
        resultFormData[`field_formatting_field${i}_metricHeaderFontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_metricHeaderBackgroundColor`] = undefined;
        resultFormData[`field_formatting_field${i}_metricValueFontSize`] = undefined;
        resultFormData[`field_formatting_field${i}_metricValueFontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_metricValueBackgroundColor`] = undefined;
        resultFormData[`field_formatting_field${i}_showNonZeroOnly`] = false;
        resultFormData[`field_formatting_field${i}_columnHeaderFontSize`] = undefined;
        resultFormData[`field_formatting_field${i}_columnHeaderFontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_columnHeaderBackgroundColor`] = undefined;
        resultFormData[`field_formatting_field${i}_columnValueFontSize`] = undefined;
        resultFormData[`field_formatting_field${i}_columnValueFontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_columnValueBackgroundColor`] = undefined;
        resultFormData[`field_formatting_field${i}_rowHeaderFontSize`] = undefined;
        resultFormData[`field_formatting_field${i}_rowHeaderFontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_rowHeaderBackgroundColor`] = undefined;
        resultFormData[`field_formatting_field${i}_rowValueFontSize`] = undefined;
        resultFormData[`field_formatting_field${i}_rowValueFontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_rowValueBackgroundColor`] = undefined;
        // Очищаем настройки subtotal
        resultFormData[`field_formatting_field${i}_subtotalShow`] = undefined;
        resultFormData[`field_formatting_field${i}_subtotalLabel`] = undefined;
        resultFormData[`field_formatting_field${i}_subtotalValueFormat`] = undefined;
        resultFormData[`field_formatting_field${i}_subtotalFontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_subtotalBackgroundColor`] = undefined;
      }
    }
    
    // Синхронизируем globalTableSettings из вложенного объекта обратно в плоские ключи
    // Это нужно для правильной загрузки настроек при открытии чарта с дашборда
    const globalTableSettings = formData.globalTableSettings;
    if (globalTableSettings && typeof globalTableSettings === 'object') {
      const gts = globalTableSettings as Record<string, unknown>;
      
      // Синхронизируем rowTotalsValueFormat
      // ВАЖНО: не перезаписываем значение, если оно уже задано через плоский ключ (из UI)
      if (gts.rowTotalsValueFormat && typeof gts.rowTotalsValueFormat === 'object') {
        const rtvf = gts.rowTotalsValueFormat as Record<string, unknown>;
        if (rtvf.valueFormat !== undefined && formData['globalTableSettings.rowTotalsValueFormat.valueFormat'] === undefined) {
          resultFormData['globalTableSettings.rowTotalsValueFormat.valueFormat'] = rtvf.valueFormat;
        }
        if (rtvf.dateFormat !== undefined) {
          resultFormData['globalTableSettings.rowTotalsValueFormat.dateFormat'] = rtvf.dateFormat;
        }
        if (rtvf.fontSize !== undefined) {
          resultFormData['globalTableSettings.rowTotalsValueFormat.fontSize'] = rtvf.fontSize;
        }
        if (rtvf.fontColor !== undefined) {
          resultFormData['globalTableSettings.rowTotalsValueFormat.fontColor'] = rtvf.fontColor;
        }
        if (rtvf.backgroundColor !== undefined) {
          resultFormData['globalTableSettings.rowTotalsValueFormat.backgroundColor'] = rtvf.backgroundColor;
        }
      }
      
      // Синхронизируем rowSubTotalsValueFormat
      // ВАЖНО: не перезаписываем значение, если оно уже задано через плоский ключ (из UI)
      if (gts.rowSubTotalsValueFormat && typeof gts.rowSubTotalsValueFormat === 'object') {
        const rstvf = gts.rowSubTotalsValueFormat as Record<string, unknown>;
        if (rstvf.valueFormat !== undefined && formData['globalTableSettings.rowSubTotalsValueFormat.valueFormat'] === undefined) {
          resultFormData['globalTableSettings.rowSubTotalsValueFormat.valueFormat'] = rstvf.valueFormat;
        }
        if (rstvf.dateFormat !== undefined) {
          resultFormData['globalTableSettings.rowSubTotalsValueFormat.dateFormat'] = rstvf.dateFormat;
        }
        if (rstvf.fontSize !== undefined) {
          resultFormData['globalTableSettings.rowSubTotalsValueFormat.fontSize'] = rstvf.fontSize;
        }
        if (rstvf.fontColor !== undefined) {
          resultFormData['globalTableSettings.rowSubTotalsValueFormat.fontColor'] = rstvf.fontColor;
        }
        if (rstvf.backgroundColor !== undefined) {
          resultFormData['globalTableSettings.rowSubTotalsValueFormat.backgroundColor'] = rstvf.backgroundColor;
        }
      }
      
      // Синхронизируем columnTotalsValueFormat
      // ВАЖНО: не перезаписываем значение, если оно уже задано через плоский ключ (из UI)
      if (gts.columnTotalsValueFormat && typeof gts.columnTotalsValueFormat === 'object') {
        const ctvf = gts.columnTotalsValueFormat as Record<string, unknown>;
        if (ctvf.valueFormat !== undefined && formData['globalTableSettings.columnTotalsValueFormat.valueFormat'] === undefined) {
          resultFormData['globalTableSettings.columnTotalsValueFormat.valueFormat'] = ctvf.valueFormat;
        }
        if (ctvf.dateFormat !== undefined) {
          resultFormData['globalTableSettings.columnTotalsValueFormat.dateFormat'] = ctvf.dateFormat;
        }
        if (ctvf.fontSize !== undefined) {
          resultFormData['globalTableSettings.columnTotalsValueFormat.fontSize'] = ctvf.fontSize;
        }
        if (ctvf.fontColor !== undefined) {
          resultFormData['globalTableSettings.columnTotalsValueFormat.fontColor'] = ctvf.fontColor;
        }
        if (ctvf.backgroundColor !== undefined) {
          resultFormData['globalTableSettings.columnTotalsValueFormat.backgroundColor'] = ctvf.backgroundColor;
        }
      }

      // Новый контракт totals: per-metric block c object value.
      // Для старых chart settings legacy global total number format показываем
      // как fallback у всех метрик, чтобы новый UI отражал фактическое поведение.
      if (
        formData['globalTableSettings.columnTotalsMetricSettings'] === undefined &&
        Array.isArray(formData.metrics)
      ) {
        const nextMetricSettings: Record<string, any> = {};
        const existingMetricSettings =
          gts.columnTotalsMetricSettings &&
          typeof gts.columnTotalsMetricSettings === 'object'
            ? (gts.columnTotalsMetricSettings as Record<string, unknown>)
            : {};

        Object.entries(existingMetricSettings).forEach(([metricName, settings]) => {
          if (!settings || typeof settings !== 'object') {
            return;
          }
          nextMetricSettings[metricName] = settings;
        });

        const legacyTotalValueFormat =
          gts.columnTotalsValueFormat &&
          typeof gts.columnTotalsValueFormat === 'object'
            ? (gts.columnTotalsValueFormat as Record<string, unknown>).valueFormat
            : undefined;

        if (
          typeof legacyTotalValueFormat === 'string' &&
          legacyTotalValueFormat.length > 0
        ) {
          ensureIsArray(formData.metrics).forEach((metric: QueryFormMetric) => {
            const metricLabel = getMetricLabel(metric);
            if (!metricLabel) {
              return;
            }
            const existingSettings = nextMetricSettings[metricLabel];
            const existingFormat =
              existingSettings &&
              typeof existingSettings === 'object' &&
              (existingSettings as Record<string, any>).totalValueFormat &&
              typeof (existingSettings as Record<string, any>).totalValueFormat ===
                'object'
                ? ((existingSettings as Record<string, any>).totalValueFormat as Record<
                    string,
                    unknown
                  >)
                : {};

            if (existingFormat.valueFormat === undefined) {
              nextMetricSettings[metricLabel] = {
                ...(existingSettings as Record<string, unknown>),
                totalValueFormat: {
                  ...existingFormat,
                  valueFormat: legacyTotalValueFormat,
                },
              };
            }
          });
        }

        resultFormData['globalTableSettings.columnTotalsMetricSettings'] =
          nextMetricSettings;
      }
      
      // Синхронизируем colSubTotalsValueFormat
      // ВАЖНО: не перезаписываем значение, если оно уже задано через плоский ключ (из UI)
      if (gts.colSubTotalsValueFormat && typeof gts.colSubTotalsValueFormat === 'object') {
        const cstvf = gts.colSubTotalsValueFormat as Record<string, unknown>;
        if (cstvf.valueFormat !== undefined && formData['globalTableSettings.colSubTotalsValueFormat.valueFormat'] === undefined) {
          resultFormData['globalTableSettings.colSubTotalsValueFormat.valueFormat'] = cstvf.valueFormat;
        }
        if (cstvf.dateFormat !== undefined) {
          resultFormData['globalTableSettings.colSubTotalsValueFormat.dateFormat'] = cstvf.dateFormat;
        }
        if (cstvf.fontSize !== undefined) {
          resultFormData['globalTableSettings.colSubTotalsValueFormat.fontSize'] = cstvf.fontSize;
        }
        if (cstvf.fontColor !== undefined) {
          resultFormData['globalTableSettings.colSubTotalsValueFormat.fontColor'] = cstvf.fontColor;
        }
        if (cstvf.backgroundColor !== undefined) {
          resultFormData['globalTableSettings.colSubTotalsValueFormat.backgroundColor'] = cstvf.backgroundColor;
        }
      }
      
      // Синхронизируем другие поля
      if (gts.rowTotalsLabel !== undefined) {
        resultFormData['globalTableSettings.rowTotalsLabel'] = gts.rowTotalsLabel;
      }
      if (gts.rowTotalsPosition !== undefined) {
        resultFormData['globalTableSettings.rowTotalsPosition'] = gts.rowTotalsPosition;
      }
      if (gts.rowSubTotalsLabel !== undefined) {
        resultFormData['globalTableSettings.rowSubTotalsLabel'] = gts.rowSubTotalsLabel;
      }
      if (gts.columnTotalsLabel !== undefined) {
        resultFormData['globalTableSettings.columnTotalsLabel'] = gts.columnTotalsLabel;
      }
      if (gts.columnTotalsPosition !== undefined) {
        resultFormData['globalTableSettings.columnTotalsPosition'] = gts.columnTotalsPosition;
      }
      if (gts.colSubTotalsLabel !== undefined) {
        resultFormData['globalTableSettings.colSubTotalsLabel'] = gts.colSubTotalsLabel;
      }
      if (gts.rowSearchEnabled !== undefined) {
        resultFormData['globalTableSettings.rowSearchEnabled'] = gts.rowSearchEnabled;
      }
    }
    
    return resultFormData;
  },
};

export default config;
