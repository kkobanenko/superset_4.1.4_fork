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
import React, { useCallback, useMemo } from 'react';
import { t, ensureIsArray, QueryFormMetric } from '@superset-ui/core';
import { useTheme, SupersetTheme } from '@apache-superset/core/ui';
import { ControlHeader, D3_FORMAT_OPTIONS } from '@superset-ui/chart-controls';
import { Collapse, Select, Typography } from 'antd';
import { MetricTotalSettingsType } from '../../types';

const { Panel } = Collapse;
const { Text } = Typography;

export interface MetricTotalSettingsControlProps {
  value?: Record<string, MetricTotalSettingsType>;
  onChange: (value: Record<string, MetricTotalSettingsType>) => void;
  metrics?: QueryFormMetric[];
}

const MetricTotalSettingsControl: React.FC<MetricTotalSettingsControlProps> = ({
  value = {},
  onChange,
  metrics = [],
}) => {
  const theme = useTheme() as SupersetTheme;

  const metricLabels = useMemo(
    () =>
      ensureIsArray(metrics)
        .map((metric: QueryFormMetric) => {
          if (typeof metric === 'string') return metric;
          if (metric && typeof metric === 'object' && 'label' in metric)
            return metric.label;
          if (metric && typeof metric === 'object' && 'sqlExpression' in metric)
            return metric.sqlExpression;
          return '';
        })
        .filter((label): label is string => !!label),
    [metrics],
  );

  const handleFormatChange = useCallback(
    (
      metricLabel: string,
      formatChanges: Partial<NonNullable<MetricTotalSettingsType['totalValueFormat']>>,
    ) => {
      const currentSettings = value[metricLabel] || {};
      const currentFormat = currentSettings.totalValueFormat || {};
      const nextFormat = { ...currentFormat, ...formatChanges };

      onChange({
        ...value,
        [metricLabel]: {
          ...currentSettings,
          totalValueFormat: nextFormat,
        },
      });
    },
    [value, onChange],
  );

  const handleAggregationChange = useCallback(
    (metricLabel: string, totalAggregation: 'sum' | 'max' | 'min' | 'formula') => {
      const currentSettings = value[metricLabel] || {};
      onChange({
        ...value,
        [metricLabel]: {
          ...currentSettings,
          totalAggregation,
        },
      });
    },
    [value, onChange],
  );

  if (metricLabels.length === 0) {
    return (
      <div
        style={{ color: theme.colorTextDisabled, fontStyle: 'italic', padding: '8px 0' }}
      >
        {t('No metrics selected')}
      </div>
    );
  }

  return (
    <div className="metric-total-settings-control">
      <ControlHeader label={t('Per-Metric Total Overrides')} />
      <div
        style={{ marginBottom: 8, fontSize: '12px', color: theme.colorTextSecondary }}
      >
        {t(
          'Per metric: choose aggregation and optionally override the total number format. Total label and total colors are set below.',
        )}
      </div>
      <Collapse ghost>
        {metricLabels.map(metricLabel => {
          const settings = value[metricLabel] || {};
          return (
            <Panel
              className="ant-collapse-item"
              header={<Text strong>{metricLabel}</Text>}
              key={metricLabel}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  paddingLeft: '24px',
                  paddingBottom: '12px',
                }}
              >
                <div>
                  <div className="control-label">{t('Aggregation')}</div>
                  <Select
                    size="small"
                    value={settings.totalAggregation || 'sum'}
                    onChange={val =>
                      handleAggregationChange(
                        metricLabel,
                        val as 'sum' | 'max' | 'min' | 'formula',
                      )
                    }
                    options={[
                      { value: 'sum', label: t('Sum') },
                      { value: 'max', label: t('Maximum') },
                      { value: 'min', label: t('Minimum') },
                      { value: 'formula', label: t('Formula') },
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <div className="control-label">{t('Number Format (D3)')}</div>
                  <Select
                    size="small"
                    showSearch
                    allowClear
                    value={settings.totalValueFormat?.valueFormat || undefined}
                    placeholder={t('Use total/global fallback')}
                    onChange={val =>
                      handleFormatChange(metricLabel, { valueFormat: val || '' })
                    }
                    options={D3_FORMAT_OPTIONS.map(([formatValue, label]) => ({
                      value: formatValue,
                      label,
                    }))}
                    style={{ width: '100%' }}
                    filterOption={(input, option) =>
                      (option?.label ?? '')
                        .toString()
                        .toLowerCase()
                        .includes(input.toLowerCase()) ||
                      (option?.value ?? '')
                        .toString()
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  />
                </div>
              </div>
            </Panel>
          );
        })}
      </Collapse>
    </div>
  );
};

export default MetricTotalSettingsControl;
