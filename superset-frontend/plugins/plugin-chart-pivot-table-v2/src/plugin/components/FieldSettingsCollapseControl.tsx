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
import React, { useCallback } from 'react';
import { t } from '@superset-ui/core';

/**
 * Контрол-переключатель для сворачивания/разворачивания блока
 * настроек форматирования конкретного поля в Field Formatting Settings.
 *
 * Значение (value):
 *   true  — блок развёрнут (показываем все настройки)
 *   false — блок свёрнут (скрываем настройки, только стрелка видна)
 *
 * Остальные контролы поля проверяют value этого контрола в visibility.
 */
export interface FieldSettingsCollapseControlProps {
  value?: boolean;
  onChange: (value: boolean) => void;
}

const FieldSettingsCollapseControl: React.FC<FieldSettingsCollapseControlProps> = ({
  value = false,
  onChange,
}) => {
  const isExpanded = !!value;

  const handleClick = useCallback(() => {
    onChange(!isExpanded);
  }, [isExpanded, onChange]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        padding: '4px 0',
        userSelect: 'none',
        fontSize: '13px',
        fontWeight: 500,
        color: '#666',
        borderTop: '1px solid #e8e8e8',
        marginTop: '4px',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          transition: 'transform 0.2s',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          fontSize: '10px',
        }}
      >
        ▶
      </span>
      <span>{isExpanded ? t('Hide settings') : t('Show settings')}</span>
    </div>
  );
};

export default FieldSettingsCollapseControl;
