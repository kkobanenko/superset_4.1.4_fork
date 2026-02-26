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
import React, { useMemo, useCallback } from 'react';
import { t, ensureIsArray, QueryFormMetric } from '@superset-ui/core';
import { useTheme, SupersetTheme } from '@apache-superset/core/ui';
import { ControlHeader } from '@superset-ui/chart-controls';
import { Collapse, Checkbox, Input, Select, Typography } from 'antd';
import { MetricSubtotalSettingsType } from '../../types';

const { Panel } = Collapse;
const { Text } = Typography;

export interface MetricSubtotalSettingsControlProps {
  value?: Record<string, MetricSubtotalSettingsType>;
  onChange: (value: Record<string, MetricSubtotalSettingsType>) => void;
  metrics?: QueryFormMetric[];
}

const MetricSubtotalSettingsControl: React.FC<MetricSubtotalSettingsControlProps> = ({
  value = {},
  onChange,
  metrics = [],
}) => {
  const theme = useTheme() as SupersetTheme;

  const metricLabels = useMemo(() => {
    return ensureIsArray(metrics)
      .map((m: QueryFormMetric) => {
        if (typeof m === 'string') return m;
        if (m && typeof m === 'object' && 'label' in m) return m.label;
        if (m && typeof m === 'object' && 'sqlExpression' in m) return m.sqlExpression;
        return '';
      })
      .filter((m): m is string => !!m);
  }, [metrics]);

  const handleChange = useCallback(
    (metricLabel: string, changes: Partial<MetricSubtotalSettingsType>) => {
      const currentSettings = value[metricLabel] || {};
      const newSettings = { ...currentSettings, ...changes };
      onChange({
        ...value,
        [metricLabel]: newSettings,
      });
    },
    [value, onChange],
  );

  const handleFormatChange = useCallback(
    (metricLabel: string, formatChanges: Partial<NonNullable<MetricSubtotalSettingsType['subtotalValueFormat']>>) => {
      const currentSettings = value[metricLabel] || {};
      const currentFormat = currentSettings.subtotalValueFormat || {};
      const newFormat = { ...currentFormat, ...formatChanges };
      
      const newSettings = {
        ...currentSettings,
        subtotalValueFormat: newFormat,
      };

      onChange({
        ...value,
        [metricLabel]: newSettings,
      });
    },
    [value, onChange],
  );

  if (metricLabels.length === 0) {
    return (
      <div style={{ color: theme.colorTextDisabled, fontStyle: 'italic', padding: '8px 0' }}>
        {t('No metrics selected')}
      </div>
    );
  }

  return (
    <div className="metric-subtotal-settings-control">
      <ControlHeader label={t('Per-Metric Subtotal Overrides')} />
      <div style={{ marginBottom: 8, fontSize: '12px', color: theme.colorTextSecondary }}>
        {t('Customize subtotal calculation and style for each metric individually.')}
      </div>
      <Collapse ghost>
        {metricLabels.map(metricLabel => {
          const settings = value[metricLabel] || {};
          const isEnabled = settings.subtotalEnabled !== false;

          return (
            <Panel
              className="ant-collapse-item" 
              header={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={isEnabled}
                    onChange={e => handleChange(metricLabel, { subtotalEnabled: e.target.checked })}
                  />
                  <Text strong={isEnabled} style={{ color: isEnabled ? 'inherit' : theme.colorTextDisabled }}>
                    {metricLabel}
                  </Text>
                </div>
              }
              key={metricLabel}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '24px', paddingBottom: '12px' }}>
                {isEnabled && (
                  <>
                    <div>
                      <div className="control-label">{t('Label')}</div>
                      <Input
                        size="small"
                        value={settings.subtotalLabel || ''}
                        placeholder={t('Default logic')}
                        onChange={e => handleChange(metricLabel, { subtotalLabel: e.target.value })}
                      />
                    </div>
                    <div>
                      <div className="control-label">{t('Aggregation')}</div>
                      <Select
                        size="small"
                        value={settings.subtotalAggregation || 'sum'}
                        onChange={val => handleChange(metricLabel, { subtotalAggregation: val })}
                        options={[
                          { value: 'sum', label: t('Sum') },
                          { value: 'max', label: t('Maximum') },
                          { value: 'min', label: t('Minimum') },
                        ]}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <div className="control-label">{t('Number Format (D3)')}</div>
                      <Input
                        size="small"
                        value={settings.subtotalValueFormat?.valueFormat || ''}
                        placeholder={t('e.g. ,.2f')}
                        onChange={e => handleFormatChange(metricLabel, { valueFormat: e.target.value })}
                      />
                    </div>
                   <div style={{ display: 'flex', gap: '8px' }}>
                       <div style={{ flex: 1 }}>
                          <div className="control-label">{t('Font Color')}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <input 
                                type="color" 
                                value={settings.subtotalValueFormat?.fontColor || '#000000'}
                                onChange={e => handleFormatChange(metricLabel, { fontColor: e.target.value })}
                                style={{ height: '24px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', width: '24px' }}
                             />
                             <Input 
                                size="small"
                                value={settings.subtotalValueFormat?.fontColor || ''}
                                placeholder="#Hex"
                                onChange={e => handleFormatChange(metricLabel, { fontColor: e.target.value })}
                             />
                          </div>
                       </div>
                       <div style={{ flex: 1 }}>
                          <div className="control-label">{t('Background')}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <input 
                                type="color" 
                                value={settings.subtotalValueFormat?.backgroundColor || '#ffffff'}
                                onChange={e => handleFormatChange(metricLabel, { backgroundColor: e.target.value })}
                                style={{ height: '24px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', width: '24px' }}
                             />
                             <Input 
                                size="small"
                                value={settings.subtotalValueFormat?.backgroundColor || ''}
                                placeholder="#Hex"
                                onChange={e => handleFormatChange(metricLabel, { backgroundColor: e.target.value })}
                             />
                          </div>
                      </div>
                    </div>
                  </>
                )}
                 {!isEnabled && (
                   <div style={{ fontStyle: 'italic', color: theme.colorTextDisabled }}>
                       {t('Subtotal hidden for this metric')}
                   </div>
                )}
              </div>
            </Panel>
          );
        })}
      </Collapse>
    </div>
  );
};

export default MetricSubtotalSettingsControl;
