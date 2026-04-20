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
