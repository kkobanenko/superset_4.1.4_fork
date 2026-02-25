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
  AdhocColumn,
  buildQueryContext,
  ensureIsArray,
  isPhysicalColumn,
  QueryFormColumn,
  QueryFormOrderBy,
} from '@superset-ui/core';
import { PivotTableV2QueryFormData } from '../types';

function normalizeAggregateForSql(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  const v = value.trim();

  // If user picked pivot-specific options, map them to a safe SQL aggregate.
  if (v.includes(' as Fraction of ') || v.includes(' as Share of Parent ')) {
    if (v.startsWith('Count')) {
      return 'COUNT';
    }
    return 'SUM';
  }

  // Pivot-friendly names -> SQL-ish names.
  switch (v) {
    case 'Sum':
      return 'SUM';
    case 'Average':
      return 'AVG';
    case 'Minimum':
      return 'MIN';
    case 'Maximum':
      return 'MAX';
    case 'Count':
      return 'COUNT';
    case 'Count Unique Values':
      return 'COUNT_DISTINCT';
    default:
      break;
  }

  // Keep known SQL aggregates; normalize to upper-case.
  switch (v.toUpperCase()) {
    case 'AVG':
    case 'COUNT':
    case 'COUNT_DISTINCT':
    case 'MAX':
    case 'MIN':
    case 'SUM':
      return v.toUpperCase();
    default:
      break;
  }

  // Fallback: keep query safe; pivot rendering uses the original value for client-side aggregation.
  return 'SUM';
}

function normalizeMetricsForQuery(metrics: unknown): unknown {
  if (!Array.isArray(metrics)) {
    return metrics;
  }
  return metrics.map(metric => {
    if (!metric || typeof metric !== 'object') {
      return metric;
    }
    const m = metric as Record<string, unknown>;
    if (!('aggregate' in m)) {
      return metric;
    }
    const normalized = normalizeAggregateForSql(m.aggregate);
    if (!normalized) {
      return metric;
    }
    return { ...m, aggregate: normalized };
  });
}

export default function buildQuery(formData: PivotTableV2QueryFormData) {
  const { groupbyColumns = [], groupbyRows = [], extra_form_data } = formData;
  const time_grain_sqla =
    extra_form_data?.time_grain_sqla || formData.time_grain_sqla;

  // TODO: add deduping of AdhocColumns
  const columns = Array.from(
    new Set([
      ...ensureIsArray<QueryFormColumn>(groupbyColumns),
      ...ensureIsArray<QueryFormColumn>(groupbyRows),
    ]),
  ).map(col => {
    if (
      isPhysicalColumn(col) &&
      time_grain_sqla &&
      (formData?.temporal_columns_lookup?.[col] ||
        formData.granularity_sqla === col)
    ) {
      return {
        timeGrain: time_grain_sqla,
        columnType: 'BASE_AXIS',
        sqlExpression: col,
        label: col,
        expressionType: 'SQL',
      } as AdhocColumn;
    }
    return col;
  });

  // Normalize "Simple metric -> aggregate" for SQL query safety.
  // Pivot-specific aggregates (e.g. "Sum as Share of Parent Row Group") are computed client-side.
  const queryFormData = {
    ...formData,
    metrics: normalizeMetricsForQuery(formData.metrics) as PivotTableV2QueryFormData['metrics'],
  };

  return buildQueryContext(queryFormData, baseQueryObject => {
    const { series_limit_metric, metrics, order_desc } = baseQueryObject;
    let orderBy: QueryFormOrderBy[] | undefined;
    if (series_limit_metric) {
      orderBy = [[series_limit_metric, !order_desc]];
    } else if (Array.isArray(metrics) && metrics[0]) {
      orderBy = [[metrics[0], !order_desc]];
    }
    return [
      {
        ...baseQueryObject,
        orderby: orderBy,
        columns,
      },
    ];
  });
}
