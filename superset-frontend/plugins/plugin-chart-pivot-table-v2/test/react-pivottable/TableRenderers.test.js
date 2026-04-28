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

import { TableRenderer } from '../../src/react-pivottable/TableRenderers';

const METRIC_SUBTOTAL_MARKER = '\u200B__METRIC_SUBTOTAL__';

function createRenderer() {
  return new TableRenderer({
    tableOptions: {},
    cols: [],
    rows: [],
  });
}

test('parseSqlFormula handles nested aggregate expressions', () => {
  const renderer = createRenderer();
  const parsed = renderer.parseSqlFormula(
    'SUM(if(`Дата` < now(),`Продажи: Сумма без НДС`, 0.)) / SUM(`Значение` * 1000)',
    [],
    {
      'Продажи: Сумма без НДС': 'Факт',
      Значение: 'План',
    },
  );

  expect(parsed.isValid).toBe(true);
  expect(parsed.terms).toHaveLength(2);
  expect(parsed.baseMetrics).toEqual(['Факт', 'План']);
  expect(parsed.expression).toContain('__TERM_0__');
  expect(parsed.expression).toContain('__TERM_1__');
  expect(parsed.operations).toEqual(['/']);
});

test('evaluateFormulaExpression respects operator precedence', () => {
  const renderer = createRenderer();
  const result = renderer.evaluateFormulaExpression(
    '__TERM_0__/__TERM_1__+__TERM_2__*2',
    {
      __TERM_0__: 10,
      __TERM_1__: 5,
      __TERM_2__: 3,
    },
  );

  expect(result).toBe(8);
});

test('computeFormulaValue for row subtotal uses full row and column prefixes', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'metric',
      metricsOrder: ['Факт', 'План', '%'],
      metricsSqlExpressions: {
        '%': 'SUM(`Факт`) / SUM(`План`)',
      },
      metricNameMapping: {},
    },
    cols: ['Год', 'Месяц', 'metric'],
    rows: ['ОП', 'РМ'],
  });

  const rowKeys = [
    ['Волга', 'RM-1'],
    ['Волга', 'RM-2'],
    ['Сибирь', 'RM-3'],
  ];
  const colKeys = [
    ['2024', '01', 'Факт'],
    ['2024', '01', 'План'],
    ['2024', '01', '%'],
    ['2024', '02', 'Факт'],
    ['2024', '02', 'План'],
    ['2024', '02', '%'],
  ];

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };

  setValue(['Волга', 'RM-1'], ['2024', '01', 'Факт'], 10);
  setValue(['Волга', 'RM-1'], ['2024', '01', 'План'], 100);
  setValue(['Волга', 'RM-2'], ['2024', '01', 'Факт'], 20);
  setValue(['Волга', 'RM-2'], ['2024', '01', 'План'], 300);
  setValue(['Волга', 'RM-1'], ['2024', '02', 'Факт'], 1000);
  setValue(['Волга', 'RM-1'], ['2024', '02', 'План'], 1000);
  setValue(['Волга', 'RM-2'], ['2024', '02', 'Факт'], 2000);
  setValue(['Волга', 'RM-2'], ['2024', '02', 'План'], 1000);

  const pivotData = {
    getRowKeys() {
      return rowKeys;
    },
    getColKeys() {
      return colKeys;
    },
    getAggregator(rowKey, colKey) {
      const value = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => value ?? null,
      };
    },
  };

  const result = renderer.computeFormulaValue(
    '%',
    ['Волга'],
    ['2024', '01', `${METRIC_SUBTOTAL_MARKER}%`],
    true,
    false,
    pivotData,
    ['ОП', 'РМ'],
    ['Год', 'Месяц', 'metric'],
    'metric',
    { '%': 'SUM(`Факт`) / SUM(`План`)' },
    ['Факт', 'План', '%'],
    {},
  );

  expect(result).toBeCloseTo(30 / 400, 10);
});

test('parseSqlFormula falls back to last backtick when mapping is absent', () => {
  const renderer = createRenderer();
  const parsed = renderer.parseSqlFormula(
    'SUM(if(`Дата` < now(),`Продажи: Сумма без НДС`, 0.)) / SUM(`Значение` * 1000)',
    [],
    {},
  );

  expect(parsed.isValid).toBe(true);
  expect(parsed.baseMetrics).toEqual(['Продажи: Сумма без НДС', 'Значение']);
});

test('computeFormulaValue for column total uses metric labels in total keys', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'metric',
      metricsOrder: ['Факт', 'План', '%'],
      metricsSqlExpressions: {
        '%': 'SUM(`Факт`) / SUM(`План`)',
      },
      metricNameMapping: {},
    },
    cols: ['Год', 'metric'],
    rows: ['ОП'],
  });

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };

  setValue(['Волга'], ['2024', 'Факт'], 100);
  setValue(['Сибирь'], ['2024', 'Факт'], 50);
  setValue(['Волга'], ['2024', 'План'], 400);
  setValue(['Сибирь'], ['2024', 'План'], 100);
  setValue([], ['2024', 'Факт'], 150);
  setValue([], ['2024', 'План'], 500);

  const pivotData = {
    getAggregator(rowKey, colKey) {
      const value = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => value ?? null,
      };
    },
  };

  const result = renderer.computeFormulaValue(
    '%',
    [],
    ['2024', '%'],
    false,
    false,
    pivotData,
    ['ОП'],
    ['Год', 'metric'],
    'metric',
    { '%': 'SUM(`Факт`) / SUM(`План`)' },
    ['Факт', 'План', '%'],
    {},
  );

  expect(result).toBeCloseTo(150 / 500, 10);
});

test('computeFormulaValue supports NULLIF for row subtotal formula', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'metric',
      metricsOrder: ['Факт', 'План', 'Отклонение'],
      metricsSqlExpressions: {
        Отклонение:
          '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000)/NULLIF(SUM(`Значение`) * 1000, 0)',
      },
      metricNameMapping: {
        'Продажи: Сумма без НДС': 'Факт',
        Значение: 'План',
      },
    },
    cols: ['Месяц', 'metric'],
    rows: ['ОП', 'РМ'],
  });

  const rowKeys = [
    ['Волга', 'RM-1'],
    ['Волга', 'RM-2'],
  ];
  const colKeys = [
    ['Апрель 2026г', 'Факт'],
    ['Апрель 2026г', 'План'],
    ['Апрель 2026г', 'Отклонение'],
  ];

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };

  // Волга: Факт=18.4млн, План=86млн -> 18.4/86 - 1 = -0.786...
  setValue(['Волга', 'RM-1'], ['Апрель 2026г', 'Факт'], 10_000_000);
  setValue(['Волга', 'RM-2'], ['Апрель 2026г', 'Факт'], 8_400_000);
  setValue(['Волга', 'RM-1'], ['Апрель 2026г', 'План'], 40_000);
  setValue(['Волга', 'RM-2'], ['Апрель 2026г', 'План'], 46_000);

  const pivotData = {
    getRowKeys() {
      return rowKeys;
    },
    getColKeys() {
      return colKeys;
    },
    getAggregator(rowKey, colKey) {
      const value = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => value ?? null,
      };
    },
  };

  const result = renderer.computeFormulaValue(
    'Отклонение',
    ['Волга'],
    ['Апрель 2026г', 'Отклонение'],
    true,
    false,
    pivotData,
    ['ОП', 'РМ'],
    ['Месяц', 'metric'],
    'metric',
    {
      Отклонение:
        '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000)/NULLIF(SUM(`Значение`) * 1000, 0)',
    },
    ['Факт', 'План', 'Отклонение'],
    {
      'Продажи: Сумма без НДС': 'Факт',
      Значение: 'План',
    },
  );

  const parsed = renderer.parseSqlFormula(
    '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000)/NULLIF(SUM(`Значение`) * 1000, 0)',
    ['Факт', 'План', 'Отклонение'],
    {
      'Продажи: Сумма без НДС': 'Факт',
      Значение: 'План',
    },
  );
  expect(parsed.isValid).toBe(true);

  expect(result).toBeCloseTo(18_400_000 / (86_000 * 1000) - 1, 10);
});

test('computeFormulaValue supports NULLIF for column total formula', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'metric',
      metricsOrder: ['Факт', 'План', 'Отклонение'],
      metricsSqlExpressions: {
        Отклонение:
          '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000)/NULLIF(SUM(`Значение`) * 1000, 0)',
      },
      metricNameMapping: {
        'Продажи: Сумма без НДС': 'Факт',
        Значение: 'План',
      },
    },
    cols: ['Месяц', 'metric'],
    rows: ['ОП'],
  });

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };

  setValue([], ['Апрель 2026г', 'Факт'], 209_000_000);
  setValue([], ['Апрель 2026г', 'План'], 666_000);

  const pivotData = {
    getAggregator(rowKey, colKey) {
      const value = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => value ?? null,
      };
    },
  };

  const result = renderer.computeFormulaValue(
    'Отклонение',
    [],
    ['Апрель 2026г', 'Отклонение'],
    false,
    false,
    pivotData,
    ['ОП'],
    ['Месяц', 'metric'],
    'metric',
    {
      Отклонение:
        '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000)/NULLIF(SUM(`Значение`) * 1000, 0)',
    },
    ['Факт', 'План', 'Отклонение'],
    {
      'Продажи: Сумма без НДС': 'Факт',
      Значение: 'План',
    },
  );

  expect(result).toBeCloseTo(209_000_000 / (666_000 * 1000) - 1, 10);
});

test('computeFormulaValue works when base metric is absent in metricsOrder but exists in pivot keys', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'metric',
      // Специально не включаем raw-метрики из формулы в metricsOrder.
      metricsOrder: ['План', 'Факт', 'Отклонение'],
      metricsSqlExpressions: {
        Отклонение: 'SUM(`fact_raw`) / NULLIF(SUM(`plan_raw`), 0) - 1',
      },
      metricNameMapping: {},
    },
    cols: ['Месяц', 'metric'],
    rows: ['ОП'],
  });

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };

  setValue([], ['Апрель 2026г', 'fact_raw'], 209_000_000);
  setValue([], ['Апрель 2026г', 'plan_raw'], 666_000_000);

  const pivotData = {
    getAggregator(rowKey, colKey) {
      const value = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => value ?? null,
      };
    },
  };

  const result = renderer.computeFormulaValue(
    'Отклонение',
    [],
    ['Апрель 2026г', 'Отклонение'],
    false,
    false,
    pivotData,
    ['ОП'],
    ['Месяц', 'metric'],
    'metric',
    {
      Отклонение: 'SUM(`fact_raw`) / NULLIF(SUM(`plan_raw`), 0) - 1',
    },
    ['План', 'Факт', 'Отклонение'],
    {},
  );

  expect(result).toBeCloseTo(209_000_000 / 666_000_000 - 1, 10);
});

test('computeFormulaValue uses namesMapping fallback for raw SQL metric names', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'Metric',
      metricsOrder: ['План                            ', 'Факт', 'Отклонение'],
      metricsSqlExpressions: {
        Отклонение:
          '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000) / NULLIF(SUM(`Значение`) * 1000, 0)',
      },
      metricNameMapping: {
        Значение: 'План                            ',
      },
    },
    namesMapping: {
      'Продажи: Сумма без НДС': 'Факт',
    },
    cols: ['Дата', 'Metric'],
    rows: ['ОП'],
  });

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };

  setValue([], ['Апрель 2026', 'Факт'], 209_000_000);
  setValue([], ['Апрель 2026', 'План                            '], 666_000);

  const pivotData = {
    getAggregator(rowKey, colKey) {
      const value = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => value ?? null,
      };
    },
  };

  const result = renderer.computeFormulaValue(
    'Отклонение',
    [],
    ['Апрель 2026', 'Отклонение'],
    false,
    false,
    pivotData,
    ['ОП'],
    ['Дата', 'Metric'],
    'Metric',
    {
      Отклонение:
        '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000) / NULLIF(SUM(`Значение`) * 1000, 0)',
    },
    ['План                            ', 'Факт', 'Отклонение'],
    {
      Значение: 'План                            ',
    },
  );

  expect(result).toBeCloseTo(209_000_000 / (666_000 * 1000) - 1, 10);
});

test('computeFormulaValue falls back to remaining non-formula metric when one raw term is unmapped', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'Metric',
      metricsOrder: ['План                            ', 'Факт', 'Отклонение'],
      metricsSqlExpressions: {
        'План                            ': 'SUM(`Значение`) * 1000',
        Факт: null,
        Отклонение:
          '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000) / NULLIF(SUM(`Значение`) * 1000, 0)',
      },
      metricNameMapping: {
        Значение: 'План                            ',
      },
    },
    cols: ['Дата', 'Metric'],
    rows: ['ОП'],
  });

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };

  setValue([], ['Апрель 2026', 'План                            '], 666_000_000);
  setValue([], ['Апрель 2026', 'Факт'], 209_000_000);

  const pivotData = {
    getAggregator(rowKey, colKey) {
      const value = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => value ?? null,
      };
    },
  };

  const result = renderer.computeFormulaValue(
    'Отклонение',
    [],
    ['Апрель 2026', 'Отклонение'],
    false,
    false,
    pivotData,
    ['ОП'],
    ['Дата', 'Metric'],
    'Metric',
    {
      'План                            ': 'SUM(`Значение`) * 1000',
      Отклонение:
        '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000) / NULLIF(SUM(`Значение`) * 1000, 0)',
    },
    ['План                            ', 'Факт', 'Отклонение'],
    {
      Значение: 'План                            ',
    },
  );

  expect(result).toBeCloseTo(209_000_000 / 666_000_000 - 1, 10);
});

test('computeFormulaValue normalizes scaled base metric SUM(raw)*K back to raw SUM(raw)', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'Metric',
      metricsOrder: ['План                            ', 'Факт', 'Отклонение'],
      metricsSqlExpressions: {
        'План                            ': 'SUM(`Значение`) * 1000',
        Факт: null,
        Отклонение:
          '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000) / NULLIF(SUM(`Значение`) * 1000, 0)',
      },
      metricNameMapping: {
        Значение: 'План                            ',
      },
    },
    cols: ['Дата', 'Metric'],
    rows: ['ОП'],
  });

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };

  // План-метрика уже хранится как SUM(`Значение`) * 1000.
  setValue([], ['Апрель 2026', 'План                            '], 666_000_000);
  setValue([], ['Апрель 2026', 'Факт'], 209_000_000);

  const pivotData = {
    getAggregator(rowKey, colKey) {
      const value = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => value ?? null,
      };
    },
  };

  const result = renderer.computeFormulaValue(
    'Отклонение',
    [],
    ['Апрель 2026', 'Отклонение'],
    false,
    false,
    pivotData,
    ['ОП'],
    ['Дата', 'Metric'],
    'Metric',
    {
      'План                            ': 'SUM(`Значение`) * 1000',
      Отклонение:
        '(SUM(`Продажи: Сумма без НДС`) - SUM(`Значение`) * 1000) / NULLIF(SUM(`Значение`) * 1000, 0)',
    },
    ['План                            ', 'Факт', 'Отклонение'],
    {
      Значение: 'План                            ',
    },
  );

  expect(result).toBeCloseTo(209_000_000 / 666_000_000 - 1, 10);
});

test('getBaseMetricValue for row subtotal sums current metric column once, not N times (N=metrics in layout)', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'metric',
      metricsOrder: ['Факт', 'План', 'X'],
    },
    cols: ['M', 'metric'],
    rows: ['ОП', 'РМ'],
  });

  const rowKeys = [
    ['Восток', 'RM-1'],
    ['Восток', 'RM-2'],
  ];
  const colKeys = [
    ['G', 'Факт'],
    ['G', 'План'],
    ['G', 'X'],
  ];

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };
  setValue(['Восток', 'RM-1'], ['G', 'План'], 20.3e6);
  setValue(['Восток', 'RM-2'], ['G', 'План'], 44.6e6);
  setValue(['Восток', 'RM-1'], ['G', 'Факт'], 1);
  setValue(['Восток', 'RM-2'], ['G', 'Факт'], 2);
  setValue(['Восток', 'RM-1'], ['G', 'X'], 100);
  setValue(['Восток', 'RM-2'], ['G', 'X'], 200);

  const pivotData = {
    getRowKeys: () => rowKeys,
    getColKeys: () => colKeys,
    getAggregator(rowKey, colKey) {
      const v = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => v ?? null,
      };
    },
  };

  const result = renderer.getBaseMetricValue(
    'План',
    ['Восток'],
    ['G', 'План'],
    true,
    false,
    pivotData,
    ['ОП', 'РМ'],
    ['M', 'metric'],
    'metric',
  );

  expect(result).toBeCloseTo(20.3e6 + 44.6e6, 2);
});

test('getBaseMetricValue row subtotal with two period columns picks single leaf when colKey is fully specified', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'metric',
      metricsOrder: ['План'],
    },
    cols: ['Дата', 'metric'],
    rows: ['ОП', 'РМ'],
  });

  const rowKeys = [
    ['Восток', 'RM-1'],
    ['Восток', 'RM-2'],
  ];
  const colKeys = [
    ['2026-01-01', 'План'],
    ['2026-02-01', 'План'],
  ];

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };
  setValue(['Восток', 'RM-1'], ['2026-01-01', 'План'], 10e6);
  setValue(['Восток', 'RM-2'], ['2026-01-01', 'План'], 20e6);
  setValue(['Восток', 'RM-1'], ['2026-02-01', 'План'], 1e6);
  setValue(['Восток', 'RM-2'], ['2026-02-01', 'План'], 2e6);

  const pivotData = {
    getRowKeys: () => rowKeys,
    getColKeys: () => colKeys,
    getAggregator(rowKey, colKey) {
      const v = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => v ?? null,
      };
    },
  };

  const result = renderer.getBaseMetricValue(
    'План',
    ['Восток'],
    ['2026-01-01', 'План'],
    true,
    false,
    pivotData,
    ['ОП', 'РМ'],
    ['Дата', 'metric'],
    'metric',
  );

  expect(result).toBeCloseTo(30e6, 0);
});

test('getBaseMetricValue row subtotal uses colIndex+visibleColKeys to pick correct period when colKey mismatches pivot strings', () => {
  const renderer = new TableRenderer({
    tableOptions: {
      metricKey: 'metric',
      metricsOrder: ['План'],
    },
    cols: ['Дата', 'metric'],
    rows: ['ОП', 'РМ'],
  });

  const rowKeys = [
    ['Восток', 'RM-1'],
    ['Восток', 'RM-2'],
  ];
  // Pivot keys use canonical "P1"; ячейка передаёт «другой» label периода — без colIndex подобрались бы оба периода.
  const colKeys = [
    ['P1', 'План'],
    ['P2', 'План'],
  ];

  const values = new Map();
  const setValue = (rowKey, colKey, value) => {
    values.set(JSON.stringify([rowKey, colKey]), value);
  };
  setValue(['Восток', 'RM-1'], ['P1', 'План'], 10e6);
  setValue(['Восток', 'RM-2'], ['P1', 'План'], 20e6);
  setValue(['Восток', 'RM-1'], ['P2', 'План'], 999);
  setValue(['Восток', 'RM-2'], ['P2', 'План'], 1);

  const pivotData = {
    getRowKeys: () => rowKeys,
    getColKeys: () => colKeys,
    getAggregator(rowKey, colKey) {
      const v = values.get(JSON.stringify([rowKey, colKey]));
      return {
        value: () => v ?? null,
      };
    },
  };

  const visibleColKeys = [
    ['P1', 'План'],
    ['P2', 'План'],
  ];

  const result = renderer.getBaseMetricValue(
    'План',
    ['Восток'],
    ['WRONG_LABEL', 'План'],
    true,
    false,
    pivotData,
    ['ОП', 'РМ'],
    ['Дата', 'metric'],
    'metric',
    visibleColKeys,
    0,
  );

  expect(result).toBeCloseTo(30e6, 0);
});
