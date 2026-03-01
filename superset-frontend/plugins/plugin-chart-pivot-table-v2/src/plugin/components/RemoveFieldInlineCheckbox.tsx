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
import { useDispatch } from 'react-redux';
import { t } from '@superset-ui/core';

/**
 * Инлайн-кнопка «✕ Remove» для удаления блока настроек поля.
 *
 * Размещается как rightNode в заголовке SelectControl (лейбл «Field N»),
 * что позволяет разместить «Remove» на одной строке с названием поля.
 *
 * При клике диспатчит SET_FIELD_VALUE для контрола
 * field_formatting_field{fieldIndex}_remove = true, что запускает
 * стандартную логику удаления поля в exploreReducer
 * (compactPivotFieldFormattingState).
 */
export interface RemoveFieldInlineCheckboxProps {
  /** Индекс поля (0..9) */
  fieldIndex: number;
}

const RemoveFieldInlineCheckbox: React.FC<RemoveFieldInlineCheckboxProps> = ({
  fieldIndex,
}) => {
  const dispatch = useDispatch();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Останавливаем всплытие, чтобы клик не засчитался за клик на лейбл
      e.stopPropagation();
      e.preventDefault();
      dispatch({
        type: 'SET_FIELD_VALUE',
        controlName: `field_formatting_field${fieldIndex}_remove`,
        value: true,
        validationErrors: [],
      });
    },
    [dispatch, fieldIndex],
  );

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          e.preventDefault();
          dispatch({
            type: 'SET_FIELD_VALUE',
            controlName: `field_formatting_field${fieldIndex}_remove`,
            value: true,
            validationErrors: [],
          });
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        cursor: 'pointer',
        fontSize: '11px',
        color: '#999',
        fontWeight: 400,
        marginLeft: '8px',
        padding: '0 4px',
        borderRadius: '3px',
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = '#ff4d4f';
        (e.currentTarget as HTMLElement).style.background = '#fff1f0';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = '#999';
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
      title={t('Remove this field formatting block')}
    >
      ✕
      <span style={{ marginLeft: '2px' }}>{t('Remove')}</span>
    </span>
  );
};

export default RemoveFieldInlineCheckbox;
