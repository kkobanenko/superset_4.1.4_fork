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
  ControlPanelConfig,
  D3_TIME_FORMAT_OPTIONS,
  Dataset,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  ensureIsArray,
  getColumnLabel,
  isAdhocColumn,
  isPhysicalColumn,
  QueryFormColumn,
  QueryFormMetric,
  SMART_DATE_ID,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import { MetricsLayoutEnum } from '../types';

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
          name: `fieldGroupingSettings.${fieldName}.subtotalEnabled`,
          config: {
            type: 'CheckboxControl',
            label: t('Enable subtotals'),
            renderTrigger: true,
            default: false,
            description: t('Show subtotals for this field'),
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
              return fieldSettings[fieldName]?.subtotalEnabled === true;
            },
          },
        },
        {
          name: `fieldGroupingSettings.${fieldName}.subtotalAggregation`,
          config: {
            type: 'SelectControl',
            label: t('Subtotal aggregation'),
            renderTrigger: true,
            default: 'sum',
            choices: [
              ['sum', t('Sum')],
              ['max', t('Maximum')],
              ['min', t('Minimum')],
            ],
            description: t('Aggregation type for subtotals'),
            visibility: ({ controls }: { controls?: any }) => {
              const fieldSettings = controls?.fieldGroupingSettings?.value || {};
              return fieldSettings[fieldName]?.subtotalEnabled === true;
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
                  ...ensureIsArray(controls?.groupbyColumns.value),
                  ...ensureIsArray(controls?.groupbyRows.value),
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
            name: 'aggregateFunction',
            config: {
              type: 'SelectControl',
              label: t('Aggregation function'),
              clearable: false,
              choices: [
                ['Count', t('Count')],
                ['Count Unique Values', t('Count Unique Values')],
                ['List Unique Values', t('List Unique Values')],
                ['Sum', t('Sum')],
                ['Average', t('Average')],
                ['Median', t('Median')],
                ['Sample Variance', t('Sample Variance')],
                ['Sample Standard Deviation', t('Sample Standard Deviation')],
                ['Minimum', t('Minimum')],
                ['Maximum', t('Maximum')],
                ['First', t('First')],
                ['Last', t('Last')],
                ['Sum as Fraction of Total', t('Sum as Fraction of Total')],
                ['Sum as Fraction of Rows', t('Sum as Fraction of Rows')],
                ['Sum as Fraction of Columns', t('Sum as Fraction of Columns')],
                ['Count as Fraction of Total', t('Count as Fraction of Total')],
                ['Count as Fraction of Rows', t('Count as Fraction of Rows')],
                [
                  'Count as Fraction of Columns',
                  t('Count as Fraction of Columns'),
                ],
              ],
              default: 'Sum',
              description: t(
                'Aggregate function to apply when pivoting and computing the total rows and columns',
              ),
              renderTrigger: true,
            },
          },
        ],
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
            name: 'rowSubTotals',
            config: {
              type: 'CheckboxControl',
              label: t('Show rows subtotal'),
              default: false,
              renderTrigger: true,
              description: t('Display row level subtotal'),
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
              default: false,
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
        [
          {
            name: 'field_formatting_info',
            config: {
              type: 'InfoControl',
              label: t('Field Formatting'),
              description: t(
                'Configure formatting settings for specific fields. Select a field from Rows, Columns, or Metrics, then configure its formatting below. You can configure up to 10 fields.',
              ),
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
                    label: t('Field %s', fieldIndex + 1),
                    renderTrigger: true,
                    clearable: true,
                    description: t('Select a field to configure formatting'),
                    placeholder: t('Select field...'),
                    rerender: ['groupbyRows', 'groupbyColumns', 'metrics', 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      // Получаем все доступные поля: rows, columns и metrics
                      const groupbyRows = ensureIsArray(state.controls?.groupbyRows?.value || []);
                      const groupbyColumns = ensureIsArray(state.controls?.groupbyColumns?.value || []);
                      const metrics = ensureIsArray(state.controls?.metrics?.value || []);
                      
                      // Получаем verbose_map для отображения понятных названий
                      const datasource = state.datasource as Dataset | undefined;
                      const verboseMap = datasource?.verbose_map || {};
                      
                      // Формируем список всех доступных полей с метками
                      const allFields: Array<{ value: string; label: string; type: string }> = [];
                      
                      // Добавляем поля из Rows
                      groupbyRows.forEach((field: QueryFormColumn) => {
                        const fieldLabel = getColumnLabel(field);
                        const displayLabel = typeof verboseMap[fieldLabel] === 'string' 
                          ? `${verboseMap[fieldLabel]} (Row)`
                          : `${fieldLabel} (Row)`;
                        allFields.push({
                          value: fieldLabel,
                          label: displayLabel,
                          type: 'row',
                        });
                      });
                      
                      // Добавляем поля из Columns
                      groupbyColumns.forEach((field: QueryFormColumn) => {
                        const fieldLabel = getColumnLabel(field);
                        const displayLabel = typeof verboseMap[fieldLabel] === 'string' 
                          ? `${verboseMap[fieldLabel]} (Column)`
                          : `${fieldLabel} (Column)`;
                        allFields.push({
                          value: fieldLabel,
                          label: displayLabel,
                          type: 'column',
                        });
                      });
                      
                      // Добавляем метрики
                      metrics.forEach((metric: QueryFormMetric) => {
                        // Получаем метку метрики: строка или объект с label/sqlExpression
                        let metricLabel: string;
                        if (typeof metric === 'string') {
                          metricLabel = metric;
                        } else if (metric.label) {
                          metricLabel = metric.label;
                        } else if ('sqlExpression' in metric && metric.sqlExpression) {
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
                      });
                      
                      // Получаем выбранное поле для этого набора настроек
                      const selectedField = state.controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      
                      return {
                        choices: allFields.map(field => [field.value, field.label]),
                        value: selectedField,
                      };
                    },
                  },
                },
              ],
              [
                {
                  name: `field_formatting_field${fieldIndex}_info`,
                  config: {
                    type: 'InfoControl',
                    label: t('Formatting for selected field'),
                    description: t('Configure formatting options below'),
                    visibility: ({ controls: ctrl }: { controls?: any }) => {
                      const selectedField = ctrl?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      return !!selectedField;
                    },
                    mapStateToProps: (state: any) => {
                      const selectedField = state.controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      if (!selectedField) {
                        return { label: t('Select a field above') };
                      }
                      const datasource = state.datasource as Dataset | undefined;
                      const verboseMap = datasource?.verbose_map || {};
                      const displayName = typeof verboseMap[selectedField] === 'string' 
                        ? verboseMap[selectedField]
                        : selectedField;
                      return {
                        label: t('Formatting for: %s', displayName),
                      };
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
                    visibility: ({ controls: ctrl }: { controls?: any }) => {
                      const selectedField = ctrl?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      return !!selectedField;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      const selectedField = state.controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      const fieldSettings = selectedField 
                        ? state.controls?.fieldGroupingSettings?.value?.[selectedField] || {}
                        : {};
                      return {
                        value: fieldSettings.maxWidth,
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
                    visibility: ({ controls: ctrl }: { controls?: any }) => {
                      const selectedField = ctrl?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      return !!selectedField;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      const selectedField = state.controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      const fieldSettings = selectedField 
                        ? state.controls?.fieldGroupingSettings?.value?.[selectedField] || {}
                        : {};
                      return {
                        value: fieldSettings.truncate ?? false,
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
                    visibility: ({ controls: ctrl }: { controls?: any }) => {
                      const selectedField = ctrl?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      return !!selectedField;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      const selectedField = state.controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      const fieldSettings = selectedField 
                        ? state.controls?.fieldGroupingSettings?.value?.[selectedField] || {}
                        : {};
                      return {
                        value: fieldSettings.fontSize,
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
                    visibility: ({ controls: ctrl }: { controls?: any }) => {
                      const selectedField = ctrl?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      return !!selectedField;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      const selectedField = state.controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      const fieldSettings = selectedField 
                        ? state.controls?.fieldGroupingSettings?.value?.[selectedField] || {}
                        : {};
                      return {
                        value: fieldSettings.fontColor,
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
                    visibility: ({ controls: ctrl }: { controls?: any }) => {
                      const selectedField = ctrl?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      return !!selectedField;
                    },
                    rerender: [`field_formatting_field${fieldIndex}_selector`, 'fieldGroupingSettings'],
                    mapStateToProps: (state: any) => {
                      const selectedField = state.controls?.[`field_formatting_field${fieldIndex}_selector`]?.value;
                      const fieldSettings = selectedField 
                        ? state.controls?.fieldGroupingSettings?.value?.[selectedField] || {}
                        : {};
                      return {
                        value: fieldSettings.backgroundColor,
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
    const fieldGroupingSettings = formData.fieldGroupingSettings || {};
    
    // Синхронизируем значения из временных контролов для каждого набора настроек (до 10)
    for (let i = 0; i < 10; i++) {
      // Получаем выбранное поле для этого набора настроек
      const selectorKey = `field_formatting_field${i}_selector` as keyof typeof formData;
      const selectedField = formData[selectorKey] as string | undefined;
      
      if (!selectedField) {
        continue; // Пропускаем, если поле не выбрано
      }
      
      const fieldSettings = fieldGroupingSettings[selectedField] || {};
      
      // Синхронизируем значения из временных контролов
      const maxWidthKey = `field_formatting_field${i}_maxWidth` as keyof typeof formData;
      const truncateKey = `field_formatting_field${i}_truncate` as keyof typeof formData;
      const fontSizeKey = `field_formatting_field${i}_fontSize` as keyof typeof formData;
      const fontColorKey = `field_formatting_field${i}_fontColor` as keyof typeof formData;
      const backgroundColorKey = `field_formatting_field${i}_backgroundColor` as keyof typeof formData;
      
      if (formData[maxWidthKey] !== undefined) {
        fieldSettings.maxWidth = formData[maxWidthKey] as number;
      }
      if (formData[truncateKey] !== undefined) {
        fieldSettings.truncate = formData[truncateKey] as boolean;
      }
      if (formData[fontSizeKey] !== undefined) {
        fieldSettings.fontSize = formData[fontSizeKey] as number;
      }
      if (formData[fontColorKey] !== undefined) {
        fieldSettings.fontColor = formData[fontColorKey] as string;
      }
      if (formData[backgroundColorKey] !== undefined) {
        fieldSettings.backgroundColor = formData[backgroundColorKey] as string;
      }
      
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
    };
    
    // Инициализируем значения временных контролов для каждого набора настроек
    for (let i = 0; i < 10; i++) {
      const selectorKey = `field_formatting_field${i}_selector` as keyof typeof formData;
      const selectedField = formData[selectorKey] as string | undefined;
      
      if (!selectedField) {
        // Если поле не выбрано, очищаем значения контролов
        resultFormData[`field_formatting_field${i}_maxWidth`] = undefined;
        resultFormData[`field_formatting_field${i}_truncate`] = false;
        resultFormData[`field_formatting_field${i}_fontSize`] = undefined;
        resultFormData[`field_formatting_field${i}_fontColor`] = undefined;
        resultFormData[`field_formatting_field${i}_backgroundColor`] = undefined;
        continue;
      }
      
      const fieldSettings = fieldGroupingSettings[selectedField] || {};
      
      resultFormData[`field_formatting_field${i}_maxWidth`] = fieldSettings.maxWidth;
      resultFormData[`field_formatting_field${i}_truncate`] = fieldSettings.truncate ?? false;
      resultFormData[`field_formatting_field${i}_fontSize`] = fieldSettings.fontSize;
      resultFormData[`field_formatting_field${i}_fontColor`] = fieldSettings.fontColor;
      resultFormData[`field_formatting_field${i}_backgroundColor`] = fieldSettings.backgroundColor;
    }
    
    return resultFormData;
  },
};

export default config;
