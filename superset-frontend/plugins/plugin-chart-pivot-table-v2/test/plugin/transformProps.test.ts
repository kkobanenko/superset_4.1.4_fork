/*
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

import { ChartProps, QueryFormData } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import transformProps from '../../src/plugin/transformProps';
import { MetricsLayoutEnum } from '../../src/types';

describe('PivotTableChart transformProps', () => {
  const setDataMask = jest.fn();
  const formData: QueryFormData = {
    groupbyRows: ['row1', 'row2'],
    groupbyColumns: ['col1', 'col2'],
    metrics: ['metric1', 'metric2'],
    tableRenderer: 'Table With Subtotal',
    colOrder: 'key_a_to_z',
    rowOrder: 'key_a_to_z',
    aggregateFunction: 'Sum',
    transposePivot: true,
    combineMetric: true,
    rowSubtotalPosition: true,
    colSubtotalPosition: true,
    colTotals: true,
    rowTotals: true,
    valueFormat: 'SMART_NUMBER',
    metricsLayout: MetricsLayoutEnum.COLUMNS,
    viz_type: 'pivot_table_v2',
    datasource: '',
    conditionalFormatting: [],
    dateFormat: '',
    legacy_order_by: 'count',
    order_desc: true,
    currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
  };
  const chartProps = new ChartProps<QueryFormData>({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
        colnames: ['name', 'sum__num', '__timestamp'],
        coltypes: [1, 0, 2],
      },
    ],
    hooks: { setDataMask },
    filterState: { selectedFilters: {} },
    datasource: { verboseMap: {}, columnFormats: {} },
    theme: supersetTheme,
  });

  it('should transform chart props for viz', () => {
    const result = transformProps(chartProps as any);
    expect(result).toMatchObject({
      width: 800,
      height: 600,
      groupbyRows: ['row1', 'row2'],
      groupbyColumns: ['col1', 'col2'],
      metrics: ['metric1', 'metric2'],
      tableRenderer: 'Table With Subtotal',
      colOrder: 'key_a_to_z',
      rowOrder: 'key_a_to_z',
      aggregateFunction: 'Sum',
      transposePivot: true,
      combineMetric: true,
      rowSubtotalPosition: true,
      colSubtotalPosition: true,
      colTotals: true,
      rowTotals: true,
      valueFormat: 'SMART_NUMBER',
      data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
      setDataMask,
      selectedFilters: {},
      verboseMap: {},
      metricsLayout: MetricsLayoutEnum.COLUMNS,
      metricColorFormatters: [],
      dateFormatters: {},
      emitCrossFilters: false,
      columnFormats: {},
      currencyFormats: {},
      currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
    });
  });

  it('should filter null and non-object records from data', () => {
    const chartPropsWithInvalidRecords = new ChartProps<QueryFormData>({
      formData,
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            { name: 'Valid', sum__num: 2, __timestamp: 599616000000 },
            null,
            'invalid',
          ],
          colnames: ['name', 'sum__num', '__timestamp'],
          coltypes: [1, 0, 2],
        },
      ],
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    expect(transformProps(chartPropsWithInvalidRecords as any).data).toEqual([
      { name: 'Valid', sum__num: 2, __timestamp: 599616000000 },
    ]);
  });

  it('should pass showNonZeroOnly from dynamic metric controls', () => {
    const chartPropsWithMetricFormatting = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        field_formatting_field0_selector: 'metric1',
        field_formatting_field0_showNonZeroOnly: true,
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsWithMetricFormatting as any);
    expect(result.fieldGroupingSettings?.metric1?.showNonZeroOnly).toBe(true);
  });

  it('should preserve formula aggregation in metric subtotal settings', () => {
    const chartPropsWithFormulaSubtotal = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        field_formatting_field0_selector: 'row1',
        field_formatting_field0_subtotalShow: 'show',
        field_formatting_field0_metricSubtotalSettings: {
          metric1: {
            subtotalEnabled: true,
            subtotalAggregation: 'formula',
          },
        },
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsWithFormulaSubtotal as any);
    expect(
      result.fieldGroupingSettings?.row1?.metricSubtotalSettings?.metric1
        ?.subtotalAggregation,
    ).toBe('formula');
  });

  it('migrates legacy per-metric subtotal label/colors to field level and keeps metric D3 format', () => {
    const chartPropsMigrate = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        field_formatting_field0_selector: 'row1',
        field_formatting_field0_metricSubtotalSettings: {
          metric2: {
            subtotalLabel: 'L2',
            subtotalValueFormat: {
              valueFormat: '.2f',
              fontColor: '#111111',
              backgroundColor: '#eeeeee',
            },
            subtotalAggregation: 'max',
          },
          metric1: {
            subtotalLabel: 'L1',
            subtotalAggregation: 'sum',
          },
        },
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsMigrate as any);
    expect(result.fieldGroupingSettings?.row1?.subtotalLabel).toBe('L1');
    expect(result.fieldGroupingSettings?.row1?.subtotalValueFormat?.fontColor).toBe(
      '#111111',
    );
    expect(
      result.fieldGroupingSettings?.row1?.subtotalValueFormat?.backgroundColor,
    ).toBe('#eeeeee');
    expect(result.fieldGroupingSettings?.row1?.subtotalValueFormat?.valueFormat).toBe(
      undefined,
    );
    expect(result.fieldGroupingSettings?.row1?.metricSubtotalSettings?.metric1).toEqual({
      subtotalAggregation: 'sum',
    });
    expect(result.fieldGroupingSettings?.row1?.metricSubtotalSettings?.metric2).toEqual({
      subtotalAggregation: 'max',
      subtotalValueFormat: {
        valueFormat: '.2f',
      },
    });
    expect(
      (result.fieldGroupingSettings?.row1 as { subtotalAggregation?: string } | undefined)
        ?.subtotalAggregation,
    ).toBeUndefined();
  });

  it('preserves legacy field-level subtotal number format as fallback', () => {
    const chartPropsWithLegacyFieldFormat = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        field_formatting_field0_selector: 'row1',
        fieldGroupingSettings: {
          row1: {
            subtotalShow: 'show',
            subtotalValueFormat: {
              valueFormat: '.1%',
              fontColor: '#123456',
            },
          },
        },
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsWithLegacyFieldFormat as any);
    expect(result.fieldGroupingSettings?.row1?.subtotalValueFormat).toEqual({
      valueFormat: '.1%',
      fontColor: '#123456',
    });
  });

  it('builds metricNameMapping for single-aggregate SQL metrics used by formula subtotal', () => {
    const chartPropsWithSqlBaseMetrics = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        metrics: [
          {
            expressionType: 'SQL',
            label: 'Факт',
            sqlExpression: 'SUM(if(`Дата` < now(),`Продажи: Сумма без НДС`, 0.))',
          },
          {
            expressionType: 'SQL',
            label: 'План',
            sqlExpression: 'SUM(`Значение`) * 1000',
          },
          {
            expressionType: 'SQL',
            label: '%',
            sqlExpression:
              'SUM(if(`Дата` < now(),`Продажи: Сумма без НДС`, 0.)) / SUM(`Значение` * 1000)',
          },
        ],
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsWithSqlBaseMetrics as any);
    expect(result.metricNameMapping?.['Продажи: Сумма без НДС']).toBe('Факт');
    expect(result.metricNameMapping?.Значение).toBe('План');
  });

  it('keeps first matching SQL metric name mapping when raw term is shared', () => {
    const chartPropsWithDuplicateRawMetric = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        metrics: [
          {
            expressionType: 'SQL',
            label: 'Факт',
            sqlExpression: 'SUM(if(`Дата` < now(),`Продажи: Сумма без НДС`, 0.))',
          },
          {
            expressionType: 'SQL',
            label: 'Факт по документам',
            sqlExpression: 'SUM(`Продажи: Сумма без НДС`)',
          },
          {
            expressionType: 'SQL',
            label: 'План',
            sqlExpression: 'SUM(`Значение`) * 1000',
          },
          {
            expressionType: 'SQL',
            label: '%',
            sqlExpression:
              'SUM(if(`Дата` < now(),`Продажи: Сумма без НДС`, 0.)) / SUM(`Значение` * 1000)',
          },
        ],
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsWithDuplicateRawMetric as any);
    expect(result.metricNameMapping?.['Продажи: Сумма без НДС']).toBe('Факт');
  });

  it('preserves explicit per-metric column total formatting settings', () => {
    const chartPropsWithColumnTotalOverrides = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        globalTableSettings: {
          columnTotalsLabel: 'Total',
          columnTotalsMetricSettings: {
            metric1: {
              totalAggregation: 'formula',
              totalValueFormat: {
                valueFormat: '.1%',
              },
            },
          },
        },
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsWithColumnTotalOverrides as any);
    expect(result.globalTableSettings?.columnTotalsMetricSettings).toEqual({
      metric1: {
        totalAggregation: 'formula',
        totalValueFormat: {
          valueFormat: '.1%',
        },
      },
    });
  });

  it('migrates legacy column total number format to per-metric overrides', () => {
    const chartPropsWithLegacyColumnTotalsFormat = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        globalTableSettings: {
          columnTotalsLabel: 'Total',
          columnTotalsValueFormat: {
            valueFormat: '.1%',
            fontColor: '#123456',
          },
        },
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsWithLegacyColumnTotalsFormat as any);
    expect(result.globalTableSettings?.columnTotalsValueFormat).toEqual({
      valueFormat: '.1%',
      fontColor: '#123456',
    });
    expect(result.globalTableSettings?.columnTotalsMetricSettings).toEqual({
      metric1: {
        totalValueFormat: {
          valueFormat: '.1%',
        },
      },
      metric2: {
        totalValueFormat: {
          valueFormat: '.1%',
        },
      },
    });
  });

  it('preserves column total font size and column subtotal formatting settings', () => {
    const chartPropsWithColumnFormatting = new ChartProps<QueryFormData>({
      formData: {
        ...formData,
        globalTableSettings: {
          columnTotalsLabel: 'Total',
          columnTotalsValueFormat: {
            fontSize: 18,
            fontColor: '#111111',
          },
          colSubTotalsLabel: 'Subtotal',
          colSubTotalsValueFormat: {
            fontSize: 14,
            fontColor: '#222222',
            backgroundColor: '#eeeeee',
          },
        },
      } as QueryFormData,
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      hooks: { setDataMask },
      filterState: { selectedFilters: {} },
      datasource: { verboseMap: {}, columnFormats: {} },
      theme: supersetTheme,
    });

    const result = transformProps(chartPropsWithColumnFormatting as any);
    expect(result.globalTableSettings?.columnTotalsValueFormat).toEqual({
      fontSize: 18,
      fontColor: '#111111',
    });
    expect(result.globalTableSettings?.colSubTotalsLabel).toBe('Subtotal');
    expect(result.globalTableSettings?.colSubTotalsValueFormat).toEqual({
      fontSize: 14,
      fontColor: '#222222',
      backgroundColor: '#eeeeee',
    });
  });
});
