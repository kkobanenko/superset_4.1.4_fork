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

import { Component } from 'react';
import { getNumberFormatter, getTimeFormatter, SMART_DATE_ID, t, safeHtmlSpan } from '@superset-ui/core';
import PropTypes from 'prop-types';
import { PivotData, flatKey } from './utilities';
import { Styles } from './Styles';

// Russian month names
const RUSSIAN_MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

// Custom formatter for MONTH_YEAR_RU format
function formatMonthYearRu(date) {
  let dateObj;
  if (typeof date === 'number') {
    dateObj = new Date(date);
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  if (isNaN(dateObj.getTime())) {
    return String(date);
  }
  
  const month = dateObj.getMonth(); // 0-11
  const year = dateObj.getFullYear();
  return `${RUSSIAN_MONTHS[month]} ${year}`;
}

const parseLabel = value => {
  if (typeof value === 'string') {
    if (value === 'metric') return t('metric');
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  return String(value);
};

function displayCell(value, allowRenderHtml) {
  if (allowRenderHtml && typeof value === 'string') {
    return safeHtmlSpan(value);
  }
  return parseLabel(value);
}
function displayHeaderCell(
  needToggle,
  ArrowIcon,
  onArrowClick,
  value,
  namesMapping,
  allowRenderHtml,
) {
  const name = namesMapping[value] || value;
  const parsedLabel = parseLabel(name);
  const labelContent =
    allowRenderHtml && typeof parsedLabel === 'string'
      ? safeHtmlSpan(parsedLabel)
      : parsedLabel;
  return needToggle ? (
    <span className="toggle-wrapper">
      <span
        role="button"
        tabIndex="0"
        className="toggle"
        onClick={onArrowClick}
      >
        {ArrowIcon}
      </span>
      <span className="toggle-val">{labelContent}</span>
    </span>
  ) : (
    labelContent
  );
}

export class TableRenderer extends Component {
  constructor(props) {
    super(props);

    // We need state to record which entries are collapsed and which aren't.
    // This is an object with flat-keys indicating if the corresponding rows
    // should be collapsed.
    this.state = { collapsedRows: {}, collapsedCols: {} };

    this.clickHeaderHandler = this.clickHeaderHandler.bind(this);
    this.clickHandler = this.clickHandler.bind(this);
  }

  getBasePivotSettings() {
    // One-time extraction of pivot settings that we'll use throughout the render.

    const { props } = this;
    const colAttrs = props.cols;
    const rowAttrs = props.rows;

    const tableOptions = {
      rowTotals: true,
      colTotals: true,
      ...props.tableOptions,
    };
    const rowTotals = tableOptions.rowTotals || colAttrs.length === 0;
    const colTotals = tableOptions.colTotals || rowAttrs.length === 0;

    const namesMapping = props.namesMapping || {};
    const subtotalOptions = {
      arrowCollapsed: '\u25B2',
      arrowExpanded: '\u25BC',
      ...props.subtotalOptions,
    };

    const colSubtotalDisplay = {
      displayOnTop: false,
      enabled: tableOptions.colSubTotals,
      hideOnExpand: false,
      ...subtotalOptions.colSubtotalDisplay,
    };

    const rowSubtotalDisplay = {
      displayOnTop: false,
      enabled: tableOptions.rowSubTotals,
      hideOnExpand: false,
      ...subtotalOptions.rowSubtotalDisplay,
    };

    const pivotData = new PivotData(props, {
      rowEnabled: rowSubtotalDisplay.enabled,
      colEnabled: colSubtotalDisplay.enabled,
      rowPartialOnTop: rowSubtotalDisplay.displayOnTop,
      colPartialOnTop: colSubtotalDisplay.displayOnTop,
    });
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();

    // Also pre-calculate all the callbacks for cells, etc... This is nice to have to
    // avoid re-calculations of the call-backs on cell expansions, etc...
    const cellCallbacks = {};
    const rowTotalCallbacks = {};
    const colTotalCallbacks = {};
    let grandTotalCallback = null;
    if (tableOptions.clickCallback) {
      rowKeys.forEach(rowKey => {
        const flatRowKey = flatKey(rowKey);
        if (!(flatRowKey in cellCallbacks)) {
          cellCallbacks[flatRowKey] = {};
        }
        colKeys.forEach(colKey => {
          cellCallbacks[flatRowKey][flatKey(colKey)] = this.clickHandler(
            pivotData,
            rowKey,
            colKey,
          );
        });
      });

      // Add in totals as well.
      if (rowTotals) {
        rowKeys.forEach(rowKey => {
          rowTotalCallbacks[flatKey(rowKey)] = this.clickHandler(
            pivotData,
            rowKey,
            [],
          );
        });
      }
      if (colTotals) {
        colKeys.forEach(colKey => {
          colTotalCallbacks[flatKey(colKey)] = this.clickHandler(
            pivotData,
            [],
            colKey,
          );
        });
      }
      if (rowTotals && colTotals) {
        grandTotalCallback = this.clickHandler(pivotData, [], []);
      }
    }

    return {
      pivotData,
      colAttrs,
      rowAttrs,
      colKeys,
      rowKeys,
      rowTotals,
      colTotals,
      arrowCollapsed: subtotalOptions.arrowCollapsed,
      arrowExpanded: subtotalOptions.arrowExpanded,
      colSubtotalDisplay,
      rowSubtotalDisplay,
      cellCallbacks,
      rowTotalCallbacks,
      colTotalCallbacks,
      grandTotalCallback,
      namesMapping,
      allowRenderHtml: props.allowRenderHtml,
    };
  }

  // Получить настройки форматирования для поля группировки
  getFieldSettings(attrName) {
    const { tableOptions } = this.props;
    const fieldGroupingSettings =
      tableOptions?.fieldGroupingSettings || {};
    return fieldGroupingSettings[attrName] || {};
  }

  getMetricKey() {
    return this.props.tableOptions?.metricKey;
  }

  getGlobalTableSettings() {
    return this.props.tableOptions?.globalTableSettings || {};
  }

  buildTextStyle(settings, includeWidth = false) {
    const style = {};
    if (settings.fontSize) {
      style.fontSize = `${settings.fontSize}px`;
    }
    if (settings.fontColor) {
      style.color = settings.fontColor;
    }
    if (settings.backgroundColor) {
      style.backgroundColor = settings.backgroundColor;
    }
    if (includeWidth && settings.maxWidth) {
      style.maxWidth = `${settings.maxWidth}px`;
      style.overflow = settings.truncate ? 'hidden' : 'visible';
      style.textOverflow = settings.truncate ? 'ellipsis' : 'clip';
      style.whiteSpace = settings.truncate ? 'nowrap' : 'normal';
    }
    return style;
  }

  // Стиль для value-ячеек totals/subtotals (без maxWidth/truncate).
  // Возвращает объект стилей для использования в style={}
  buildValueCellStyle(formatSettings) {
    const style = {};
    if (!formatSettings || typeof formatSettings !== 'object') {
      return style;
    }
    if (formatSettings.fontSize) {
      // Используем setProperty с !important для перезаписи CSS правил с !important
      // В React нужно использовать строку стилей или установить через setProperty
      // Для inline стилей используем объект, но для !important нужен другой подход
      style.fontSize = `${formatSettings.fontSize}px`;
    }
    if (formatSettings.fontColor) {
      style.color = formatSettings.fontColor;
    }
    if (formatSettings.backgroundColor) {
      style.backgroundColor = formatSettings.backgroundColor;
    }
    return style;
  }

  // Создает ref callback для установки стилей с !important
  buildValueCellStyleRef(formatSettings) {
    if (!formatSettings || typeof formatSettings !== 'object') {
      return null;
    }
    return (element) => {
      if (element) {
        if (formatSettings.fontSize) {
          element.style.setProperty('font-size', `${formatSettings.fontSize}px`, 'important');
        }
        if (formatSettings.fontColor) {
          element.style.setProperty('color', formatSettings.fontColor, 'important');
        }
        if (formatSettings.backgroundColor) {
          element.style.setProperty('background-color', formatSettings.backgroundColor, 'important');
        }
      }
    };
  }

  // Форматировать значение заголовка (row/col) с учетом per-field настроек.
  formatHeaderValue(attrName, rawValue, dateFormatters) {
    const settings = this.getFieldSettings(attrName);

    if (
      dateFormatters &&
      dateFormatters[attrName] &&
      typeof dateFormatters[attrName] === 'function'
    ) {
      return dateFormatters[attrName](rawValue);
    }

    if (
      settings &&
      typeof settings.valueFormat === 'string' &&
      settings.valueFormat.length > 0 &&
      typeof rawValue === 'number'
    ) {
      try {
        return getNumberFormatter(settings.valueFormat)(rawValue);
      } catch (e) {
        return rawValue;
      }
    }

    if (
      settings &&
      typeof settings.dateFormat === 'string' &&
      settings.dateFormat.length > 0 &&
      settings.dateFormat !== SMART_DATE_ID
    ) {
      try {
        if (settings.dateFormat === 'MONTH_YEAR_RU') {
          return formatMonthYearRu(rawValue);
        }
        return getTimeFormatter(settings.dateFormat)(rawValue);
      } catch (e) {
        return rawValue;
      }
    }

    return rawValue;
  }

  // Форматировать агрегированное значение (metric value / totals/subtotals).
  // Если formatSettings содержит dateFormat/valueFormat, они перекрывают agg.format(...).
  formatAggValue(aggValue, formattedByAgg, formatSettings) {
    if (!formatSettings || typeof formatSettings !== 'object') {
      return formattedByAgg;
    }

    if (
      formatSettings.dateFormat &&
      typeof formatSettings.dateFormat === 'string' &&
      formatSettings.dateFormat.length > 0 &&
      formatSettings.dateFormat !== SMART_DATE_ID
    ) {
      try {
        if (formatSettings.dateFormat === 'MONTH_YEAR_RU') {
          return formatMonthYearRu(aggValue);
        }
        return getTimeFormatter(formatSettings.dateFormat)(aggValue);
      } catch (e) {
        return formattedByAgg;
      }
    }

    if (
      formatSettings.valueFormat &&
      typeof formatSettings.valueFormat === 'string' &&
      formatSettings.valueFormat.length > 0
    ) {
      try {
        return getNumberFormatter(formatSettings.valueFormat)(aggValue);
      } catch (e) {
        return formattedByAgg;
      }
    }

    return formattedByAgg;
  }

  // Получить стиль для заголовка колонки/строки
  getHeaderStyle(attrName) {
    const settings = this.getFieldSettings(attrName);
    return this.buildTextStyle(settings, true);
  }

  // Получить стиль для ячейки данных
  getCellStyle(attrName) {
    const settings = this.getFieldSettings(attrName);
    return this.buildTextStyle(settings, false);
  }

  getMetricHeaderStyle(metricName) {
    const settings = this.getFieldSettings(metricName);
    const normalized = {
      ...settings,
      fontSize: settings.metricHeaderFontSize ?? settings.fontSize,
      fontColor: settings.metricHeaderFontColor ?? settings.fontColor,
      backgroundColor:
        settings.metricHeaderBackgroundColor ?? settings.backgroundColor,
    };
    // Header also supports width/truncation
    return this.buildTextStyle(normalized, true);
  }

  getMetricValueStyle(metricName) {
    const settings = this.getFieldSettings(metricName);
    const normalized = {
      ...settings,
      fontSize: settings.metricValueFontSize ?? settings.fontSize,
      fontColor: settings.metricValueFontColor ?? settings.fontColor,
      backgroundColor:
        settings.metricValueBackgroundColor ?? settings.backgroundColor,
    };
    return this.buildTextStyle(normalized, false);
  }

  getMetricNameForCell(rowKey, colKey, rowAttrs, colAttrs) {
    const metricKey = this.getMetricKey();
    if (!metricKey) {
      return null;
    }

    const colIdx = colAttrs.indexOf(metricKey);
    if (colIdx !== -1 && colIdx < colKey.length) {
      return String(colKey[colIdx]);
    }

    const rowIdx = rowAttrs.indexOf(metricKey);
    if (rowIdx !== -1 && rowIdx < rowKey.length) {
      return String(rowKey[rowIdx]);
    }

    return null;
  }

  // Обрезать текст значения, если нужно
  truncateValue(value, attrName) {
    const settings = this.getFieldSettings(attrName);
    if (settings.truncate && settings.maxWidth && typeof value === 'string') {
      // Простая обрезка на уровне CSS, более точная обрезка будет через CSS
      return value;
    }
    return value;
  }

  clickHandler(pivotData, rowValues, colValues) {
    const colAttrs = this.props.cols;
    const rowAttrs = this.props.rows;
    const value = pivotData.getAggregator(rowValues, colValues).value();
    const filters = {};
    const colLimit = Math.min(colAttrs.length, colValues.length);
    for (let i = 0; i < colLimit; i += 1) {
      const attr = colAttrs[i];
      if (colValues[i] !== null) {
        filters[attr] = colValues[i];
      }
    }
    const rowLimit = Math.min(rowAttrs.length, rowValues.length);
    for (let i = 0; i < rowLimit; i += 1) {
      const attr = rowAttrs[i];
      if (rowValues[i] !== null) {
        filters[attr] = rowValues[i];
      }
    }
    return e =>
      this.props.tableOptions.clickCallback(e, value, filters, pivotData);
  }

  clickHeaderHandler(
    pivotData,
    values,
    attrs,
    attrIdx,
    callback,
    isSubtotal = false,
    isGrandTotal = false,
  ) {
    const filters = {};
    for (let i = 0; i <= attrIdx; i += 1) {
      const attr = attrs[i];
      filters[attr] = values[i];
    }
    return e =>
      callback(
        e,
        values[attrIdx],
        filters,
        pivotData,
        isSubtotal,
        isGrandTotal,
      );
  }

  collapseAttr(rowOrCol, attrIdx, allKeys) {
    return e => {
      // Collapse an entire attribute.
      e.stopPropagation();
      const keyLen = attrIdx + 1;
      const collapsed = allKeys.filter(k => k.length === keyLen).map(flatKey);

      const updates = {};
      collapsed.forEach(k => {
        updates[k] = true;
      });

      if (rowOrCol) {
        this.setState(state => ({
          collapsedRows: { ...state.collapsedRows, ...updates },
        }));
      } else {
        this.setState(state => ({
          collapsedCols: { ...state.collapsedCols, ...updates },
        }));
      }
    };
  }

  expandAttr(rowOrCol, attrIdx, allKeys) {
    return e => {
      // Expand an entire attribute. This implicitly implies expanding all of the
      // parents as well. It's a bit inefficient but ah well...
      e.stopPropagation();
      const updates = {};
      allKeys.forEach(k => {
        for (let i = 0; i <= attrIdx; i += 1) {
          updates[flatKey(k.slice(0, i + 1))] = false;
        }
      });

      if (rowOrCol) {
        this.setState(state => ({
          collapsedRows: { ...state.collapsedRows, ...updates },
        }));
      } else {
        this.setState(state => ({
          collapsedCols: { ...state.collapsedCols, ...updates },
        }));
      }
    };
  }

  toggleRowKey(flatRowKey) {
    return e => {
      e.stopPropagation();
      this.setState(state => ({
        collapsedRows: {
          ...state.collapsedRows,
          [flatRowKey]: !state.collapsedRows[flatRowKey],
        },
      }));
    };
  }

  toggleColKey(flatColKey) {
    return e => {
      e.stopPropagation();
      this.setState(state => ({
        collapsedCols: {
          ...state.collapsedCols,
          [flatColKey]: !state.collapsedCols[flatColKey],
        },
      }));
    };
  }

  calcAttrSpans(attrArr, numAttrs) {
    // Given an array of attribute values (i.e. each element is another array with
    // the value at every level), compute the spans for every attribute value at
    // every level. The return value is a nested array of the same shape. It has
    // -1's for repeated values and the span number otherwise.

    const spans = [];
    // Index of the last new value
    const li = Array(numAttrs).map(() => 0);
    let lv = Array(numAttrs).map(() => null);
    for (let i = 0; i < attrArr.length; i += 1) {
      // Keep increasing span values as long as the last keys are the same. For
      // the rest, record spans of 1. Update the indices too.
      const cv = attrArr[i];
      const ent = [];
      let depth = 0;
      const limit = Math.min(lv.length, cv.length);
      while (depth < limit && lv[depth] === cv[depth]) {
        ent.push(-1);
        spans[li[depth]][depth] += 1;
        depth += 1;
      }
      while (depth < cv.length) {
        li[depth] = i;
        ent.push(1);
        depth += 1;
      }
      spans.push(ent);
      lv = cv;
    }
    return spans;
  }

  renderColHeaderRow(attrName, attrIdx, pivotSettings) {
    // Render a single row in the column header at the top of the pivot table.

    const {
      rowAttrs,
      colAttrs,
      colKeys,
      visibleColKeys,
      colAttrSpans,
      rowTotals,
      arrowExpanded,
      arrowCollapsed,
      colSubtotalDisplay,
      maxColVisible,
      pivotData,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;
    const {
      highlightHeaderCellsOnHover,
      omittedHighlightHeaderGroups = [],
      highlightedHeaderCells,
      dateFormatters,
    } = this.props.tableOptions;

    const spaceCell =
      attrIdx === 0 && rowAttrs.length !== 0 ? (
        <th
          key="padding"
          colSpan={rowAttrs.length}
          rowSpan={colAttrs.length}
          aria-hidden="true"
        />
      ) : null;

    const needToggle =
      colSubtotalDisplay.enabled && attrIdx !== colAttrs.length - 1;
    let arrowClickHandle = null;
    let subArrow = null;
    if (needToggle) {
      arrowClickHandle =
        attrIdx + 1 < maxColVisible
          ? this.collapseAttr(false, attrIdx, colKeys)
          : this.expandAttr(false, attrIdx, colKeys);
      subArrow = attrIdx + 1 < maxColVisible ? arrowExpanded : arrowCollapsed;
    }
    // Применяем стили форматирования к заголовку колонки
    const headerStyle = this.getHeaderStyle(attrName);
    const attrNameCell = (
      <th key="label" className="pvtAxisLabel" style={headerStyle}>
        {displayHeaderCell(
          needToggle,
          subArrow,
          arrowClickHandle,
          attrName,
          namesMapping,
          allowRenderHtml,
        )}
      </th>
    );

    const attrValueCells = [];
    const rowIncrSpan = rowAttrs.length !== 0 ? 1 : 0;
    // Iterate through columns. Jump over duplicate values.
    let i = 0;
    while (i < visibleColKeys.length) {
      let handleContextMenu;
      const colKey = visibleColKeys[i];
      const colSpan = attrIdx < colKey.length ? colAttrSpans[i][attrIdx] : 1;
      let colLabelClass = 'pvtColLabel';
      if (attrIdx < colKey.length) {
        if (!omittedHighlightHeaderGroups.includes(colAttrs[attrIdx])) {
          if (highlightHeaderCellsOnHover) {
            colLabelClass += ' hoverable';
          }
          handleContextMenu = e =>
            this.props.onContextMenu(e, colKey, undefined, {
              [attrName]: colKey[attrIdx],
            });
        }
        if (
          highlightedHeaderCells &&
          Array.isArray(highlightedHeaderCells[colAttrs[attrIdx]]) &&
          highlightedHeaderCells[colAttrs[attrIdx]].includes(colKey[attrIdx])
        ) {
          colLabelClass += ' active';
        }

        const rowSpan = 1 + (attrIdx === colAttrs.length - 1 ? rowIncrSpan : 0);
        const flatColKey = flatKey(colKey.slice(0, attrIdx + 1));
        const onArrowClick = needToggle ? this.toggleColKey(flatColKey) : null;

        const headerCellFormattedValue = this.formatHeaderValue(
          attrName,
          colKey[attrIdx],
          dateFormatters,
        );
        // Apply metric-specific header formatting when this header belongs to a metric value.
        const metricKey = this.getMetricKey();
        const rawHeaderValue = colKey[attrIdx];
        const valueHeaderStyle =
          metricKey &&
          attrName === metricKey &&
          (typeof rawHeaderValue === 'string' || typeof rawHeaderValue === 'number')
            ? this.getMetricHeaderStyle(String(rawHeaderValue))
            : this.getHeaderStyle(attrName);
        attrValueCells.push(
          <th
            className={colLabelClass}
            key={`colKey-${flatColKey}`}
            colSpan={colSpan}
            rowSpan={rowSpan}
            role="columnheader button"
            style={valueHeaderStyle}
            onClick={this.clickHeaderHandler(
              pivotData,
              colKey,
              this.props.cols,
              attrIdx,
              this.props.tableOptions.clickColumnHeaderCallback,
            )}
            onContextMenu={handleContextMenu}
          >
            {displayHeaderCell(
              needToggle,
              this.state.collapsedCols[flatColKey]
                ? arrowCollapsed
                : arrowExpanded,
              onArrowClick,
              headerCellFormattedValue,
              namesMapping,
              allowRenderHtml,
            )}
          </th>,
        );
      } else if (attrIdx === colKey.length) {
        const rowSpan = colAttrs.length - colKey.length + rowIncrSpan;
        // Подытог по колонкам: глобальная метка (если задана) перекрывает per-field subtotalLabel.
        const globalTableSettings = this.getGlobalTableSettings();
        const fieldSettings = this.getFieldSettings(attrName);
        const subtotalLabel =
          globalTableSettings?.colSubTotalsLabel ||
          fieldSettings?.subtotalLabel ||
          t('Subtotal');
        // Применяем стили форматирования для colSubTotals
        const colSubtotalLabelStyleRef = globalTableSettings?.colSubTotalsValueFormat
          ? this.buildValueCellStyleRef(globalTableSettings.colSubTotalsValueFormat)
          : null;
        attrValueCells.push(
          <th
            className={`${colLabelClass} pvtSubtotalLabel`}
            key={`colKeyBuffer-${flatKey(colKey)}`}
            colSpan={colSpan}
            rowSpan={rowSpan}
            role="columnheader button"
            ref={colSubtotalLabelStyleRef}
            onClick={this.clickHeaderHandler(
              pivotData,
              colKey,
              this.props.cols,
              attrIdx,
              this.props.tableOptions.clickColumnHeaderCallback,
              true,
            )}
          >
            {subtotalLabel}
          </th>,
        );
      }
      // The next colSpan columns will have the same value anyway...
      i += colSpan;
    }

    // Итог по строкам (total колонка): используем rowTotalsLabel.
    const globalTableSettings = this.getGlobalTableSettings();
    const rowTotalsLabel =
      globalTableSettings?.rowTotalsLabel ||
      t('Total (%(aggregatorName)s)', {
        aggregatorName: t(this.props.aggregatorName),
      });
    // Применяем те же настройки форматирования, что и к значениям total по строкам,
    // чтобы шрифт/цвет/фон были согласованы у заголовка и ячеек.
    const rowTotalsLabelStyleRef = globalTableSettings?.rowTotalsValueFormat
      ? this.buildValueCellStyleRef(globalTableSettings.rowTotalsValueFormat)
      : null;
    const totalCell =
      attrIdx === 0 && rowTotals ? (
        <th
          key="total"
          className="pvtTotalLabel pvtColTotalLabel"
          rowSpan={colAttrs.length + Math.min(rowAttrs.length, 1)}
          role="columnheader button"
          ref={rowTotalsLabelStyleRef}
          onClick={this.clickHeaderHandler(
            pivotData,
            [],
            this.props.cols,
            attrIdx,
            this.props.tableOptions.clickColumnHeaderCallback,
            false,
            true,
          )}
        >
          {rowTotalsLabel}
        </th>
      ) : null;

    const cells = [spaceCell, attrNameCell, ...attrValueCells, totalCell];
    return <tr key={`colAttr-${attrIdx}`}>{cells}</tr>;
  }

  renderRowHeaderRow(pivotSettings) {
    // Render just the attribute names of the rows (the actual attribute values
    // will show up in the individual rows).

    const {
      rowAttrs,
      colAttrs,
      rowKeys,
      arrowCollapsed,
      arrowExpanded,
      rowSubtotalDisplay,
      maxRowVisible,
      pivotData,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;
    return (
      <tr key="rowHdr">
        {rowAttrs.map((r, i) => {
          const needLabelToggle =
            rowSubtotalDisplay.enabled && i !== rowAttrs.length - 1;
          let arrowClickHandle = null;
          let subArrow = null;
          if (needLabelToggle) {
            arrowClickHandle =
              i + 1 < maxRowVisible
                ? this.collapseAttr(true, i, rowKeys)
                : this.expandAttr(true, i, rowKeys);
            subArrow = i + 1 < maxRowVisible ? arrowExpanded : arrowCollapsed;
          }
          // Применяем стили форматирования к заголовкам строк
          const rowHeaderStyle = this.getHeaderStyle(r);
          return (
            <th className="pvtAxisLabel" key={`rowAttr-${i}`} style={rowHeaderStyle}>
              {displayHeaderCell(
                needLabelToggle,
                subArrow,
                arrowClickHandle,
                r,
                namesMapping,
                allowRenderHtml,
              )}
            </th>
          );
        })}
        <th
          className="pvtTotalLabel"
          key="padding"
          role="columnheader button"
          onClick={this.clickHeaderHandler(
            pivotData,
            [],
            this.props.rows,
            0,
            this.props.tableOptions.clickRowHeaderCallback,
            false,
            true,
          )}
        >
          {colAttrs.length === 0
            ? t('Total (%(aggregatorName)s)', {
                aggregatorName: t(this.props.aggregatorName),
              })
            : null}
        </th>
      </tr>
    );
  }

  renderTableRow(rowKey, rowIdx, pivotSettings) {
    // Render a single row in the pivot table.

    const {
      rowAttrs,
      colAttrs,
      rowAttrSpans,
      visibleColKeys,
      pivotData,
      rowTotals,
      rowSubtotalDisplay,
      arrowExpanded,
      arrowCollapsed,
      cellCallbacks,
      rowTotalCallbacks,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;

    const {
      highlightHeaderCellsOnHover,
      omittedHighlightHeaderGroups = [],
      highlightedHeaderCells,
      cellColorFormatters,
      dateFormatters,
    } = this.props.tableOptions;
    const flatRowKey = flatKey(rowKey);
    const globalTableSettings = this.getGlobalTableSettings();
    const isRowSubtotalRow = rowKey.length < rowAttrs.length;

    const colIncrSpan = colAttrs.length !== 0 ? 1 : 0;
    const attrValueCells = rowKey.map((r, i) => {
      let handleContextMenu;
      let valueCellClassName = 'pvtRowLabel';
      if (!omittedHighlightHeaderGroups.includes(rowAttrs[i])) {
        if (highlightHeaderCellsOnHover) {
          valueCellClassName += ' hoverable';
        }
        handleContextMenu = e =>
          this.props.onContextMenu(e, undefined, rowKey, {
            [rowAttrs[i]]: r,
          });
      }
      if (
        highlightedHeaderCells &&
        Array.isArray(highlightedHeaderCells[rowAttrs[i]]) &&
        highlightedHeaderCells[rowAttrs[i]].includes(r)
      ) {
        valueCellClassName += ' active';
      }
      const rowSpan = rowAttrSpans[rowIdx][i];
      if (rowSpan > 0) {
        const flatRowKey = flatKey(rowKey.slice(0, i + 1));
        const colSpan = 1 + (i === rowAttrs.length - 1 ? colIncrSpan : 0);
        const needRowToggle =
          rowSubtotalDisplay.enabled && i !== rowAttrs.length - 1;
        const onArrowClick = needRowToggle
          ? this.toggleRowKey(flatRowKey)
          : null;

        const headerCellFormattedValue = this.formatHeaderValue(
          rowAttrs[i],
          r,
          dateFormatters,
        );
        // Apply metric-specific header formatting when metric dimension is placed on rows.
        const metricKey = this.getMetricKey();
        const rowValueHeaderStyle =
          metricKey &&
          rowAttrs[i] === metricKey &&
          (typeof r === 'string' || typeof r === 'number')
            ? this.getMetricHeaderStyle(String(r))
            : this.getHeaderStyle(rowAttrs[i]);
        return (
          <th
            key={`rowKeyLabel-${i}`}
            className={valueCellClassName}
            rowSpan={rowSpan}
            colSpan={colSpan}
            role="columnheader button"
            style={rowValueHeaderStyle}
            onClick={this.clickHeaderHandler(
              pivotData,
              rowKey,
              this.props.rows,
              i,
              this.props.tableOptions.clickRowHeaderCallback,
            )}
            onContextMenu={handleContextMenu}
          >
            {displayHeaderCell(
              needRowToggle,
              this.state.collapsedRows[flatRowKey]
                ? arrowCollapsed
                : arrowExpanded,
              onArrowClick,
              headerCellFormattedValue,
              namesMapping,
              allowRenderHtml,
            )}
          </th>
        );
      }
      return null;
    });

    // Получаем кастомную метку подытога для строки, если она задана
    const rowSubtotalAttrName =
      rowKey.length > 0 && rowKey.length <= rowAttrs.length
        ? rowAttrs[rowKey.length - 1]
        : null;
    const rowFieldSettings = rowSubtotalAttrName
      ? this.getFieldSettings(rowSubtotalAttrName)
      : {};
    const rowSubtotalLabel =
      globalTableSettings?.rowSubTotalsLabel ||
      rowFieldSettings?.subtotalLabel ||
      t('Subtotal');
    // Для заголовка строки подытога применяем глобальный стиль rowSubTotalsValueFormat,
    // чтобы настройки шрифта и цветов были заметны не только в числовых ячейках.
    const rowSubtotalLabelStyleRef = globalTableSettings?.rowSubTotalsValueFormat
      ? this.buildValueCellStyleRef(globalTableSettings.rowSubTotalsValueFormat)
      : null;
    const attrValuePaddingCell =
      rowKey.length < rowAttrs.length ? (
        <th
          className="pvtRowLabel pvtSubtotalLabel"
          key="rowKeyBuffer"
          colSpan={rowAttrs.length - rowKey.length + colIncrSpan}
          rowSpan={1}
          role="columnheader button"
          ref={rowSubtotalLabelStyleRef}
          onClick={this.clickHeaderHandler(
            pivotData,
            rowKey,
            this.props.rows,
            rowKey.length,
            this.props.tableOptions.clickRowHeaderCallback,
            true,
          )}
        >
          {rowSubtotalLabel}
        </th>
      ) : null;

    const rowClickHandlers = cellCallbacks[flatRowKey] || {};
    const valueCells = visibleColKeys.map(colKey => {
      const flatColKey = flatKey(colKey);
      const agg = pivotData.getAggregator(rowKey, colKey);
      const aggValue = agg.value();
      const isColSubtotalCol = colKey.length < colAttrs.length;

      const keys = [...rowKey, ...colKey];
      let backgroundColor;
      if (cellColorFormatters) {
        Object.values(cellColorFormatters).forEach(cellColorFormatter => {
          if (Array.isArray(cellColorFormatter)) {
            keys.forEach(key => {
              if (backgroundColor) {
                return;
              }
              cellColorFormatter
                .filter(formatter => formatter.column === key)
                .forEach(formatter => {
                  const formatterResult = formatter.getColorFromValue(aggValue);
                  if (formatterResult) {
                    backgroundColor = formatterResult;
                  }
                });
            });
          }
        });
      }

      // Apply formatting to data cells:
      // - field-based cell style (e.g. last col attr)
      // - metric-specific value style (based on concrete metric name, like "Факт")
      const cellAttrName =
        colKey.length > 0 ? colAttrs[colKey.length - 1] : null;
      const cellStyle = cellAttrName ? this.getCellStyle(cellAttrName) : {};

      const metricName = this.getMetricNameForCell(
        rowKey,
        colKey,
        rowAttrs,
        colAttrs,
      );
      const metricValueStyle = metricName
        ? this.getMetricValueStyle(metricName)
        : {};
      
      // Объединяем стили: сначала стили форматирования, затем цвет фона из formatter
      // Создаем ref callback для применения стилей с !important для totals/subtotals
      const rowSubtotalStyleRef = isRowSubtotalRow && globalTableSettings?.rowSubTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.rowSubTotalsValueFormat)
        : null;
      const colSubtotalStyleRef = isColSubtotalCol && globalTableSettings?.colSubTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.colSubTotalsValueFormat)
        : null;
      // Объединяем ref callbacks, если оба присутствуют
      const combinedStyleRef = rowSubtotalStyleRef && colSubtotalStyleRef
        ? (element) => {
            rowSubtotalStyleRef(element);
            colSubtotalStyleRef(element);
          }
        : rowSubtotalStyleRef || colSubtotalStyleRef;

      const finalStyle = {
        ...cellStyle,
        ...metricValueStyle,
        ...(agg.isSubtotal ? { fontWeight: 'bold' } : {}),
        ...(backgroundColor ? { backgroundColor } : {}),
      };

      const formattedByAgg = agg.format(aggValue);
      // Per-metric override для форматирования значений метрики:
      // если у конкретной метрики задан valueFormat/dateFormat, применяем их к value-cell.
      // Важно: totals/subtotals форматы (globalTableSettings.*ValueFormat) имеют приоритет.
      const metricFormatSettings = metricName ? this.getFieldSettings(metricName) : undefined;
      const overrideFormatSettings =
        (isRowSubtotalRow && globalTableSettings?.rowSubTotalsValueFormat) ||
        (isColSubtotalCol && globalTableSettings?.colSubTotalsValueFormat) ||
        metricFormatSettings ||
        undefined;
      const formattedValue = this.formatAggValue(
        aggValue,
        formattedByAgg,
        overrideFormatSettings,
      );

      return (
        <td
          role="gridcell"
          className="pvtVal"
          key={`pvtVal-${flatColKey}`}
          ref={combinedStyleRef}
          onClick={rowClickHandlers[flatColKey]}
          onContextMenu={e => this.props.onContextMenu(e, colKey, rowKey)}
          style={finalStyle}
        >
          {displayCell(formattedValue, allowRenderHtml)}
        </td>
      );
    });

    let totalCell = null;
    if (rowTotals) {
      const agg = pivotData.getAggregator(rowKey, []);
      const aggValue = agg.value();
      const totalStyleRef = globalTableSettings?.rowTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.rowTotalsValueFormat)
        : null;
      const totalFormattedValue = this.formatAggValue(
        aggValue,
        agg.format(aggValue),
        globalTableSettings?.rowTotalsValueFormat,
      );
      totalCell = (
        <td
          role="gridcell"
          key="total"
          className="pvtTotal"
          ref={totalStyleRef}
          onClick={rowTotalCallbacks[flatRowKey]}
          onContextMenu={e => this.props.onContextMenu(e, undefined, rowKey)}
        >
          {displayCell(totalFormattedValue, allowRenderHtml)}
        </td>
      );
    }

    const rowCells = [
      ...attrValueCells,
      attrValuePaddingCell,
      ...valueCells,
      totalCell,
    ];

    return <tr key={`keyRow-${flatRowKey}`}>{rowCells}</tr>;
  }

  renderTotalsRow(pivotSettings) {
    // Render the final totals rows that has the totals for all the columns.

    const {
      rowAttrs,
      colAttrs,
      visibleColKeys,
      rowTotals,
      pivotData,
      colTotalCallbacks,
      grandTotalCallback,
    } = pivotSettings;

    // Итог по колонкам (Total строка): используем columnTotalsLabel.
    const globalTableSettings = this.getGlobalTableSettings();
    const colTotalsLabel =
      globalTableSettings?.columnTotalsLabel ||
      t('Total (%(aggregatorName)s)', {
        aggregatorName: t(this.props.aggregatorName),
      });
    // Для заголовка строки итогов по колонкам используем columnTotalsValueFormat,
    // чтобы настройки форматирования были едины для заголовка и значений.
    const colTotalsLabelStyleRef = globalTableSettings?.columnTotalsValueFormat
      ? this.buildValueCellStyleRef(globalTableSettings.columnTotalsValueFormat)
      : null;

    const totalLabelCell = (
      <th
        key="label"
        className="pvtTotalLabel pvtRowTotalLabel"
        colSpan={rowAttrs.length + Math.min(colAttrs.length, 1)}
        role="columnheader button"
        ref={colTotalsLabelStyleRef}
        onClick={this.clickHeaderHandler(
          pivotData,
          [],
          this.props.rows,
          0,
          this.props.tableOptions.clickRowHeaderCallback,
          false,
          true,
        )}
      >
        {colTotalsLabel}
      </th>
    );

    const totalValueCells = visibleColKeys.map(colKey => {
      const flatColKey = flatKey(colKey);
      const agg = pivotData.getAggregator([], colKey);
      const aggValue = agg.value();
      const totalRowStyleRef = globalTableSettings?.columnTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.columnTotalsValueFormat)
        : null;
      const totalRowFormattedValue = this.formatAggValue(
        aggValue,
        agg.format(aggValue),
        globalTableSettings?.columnTotalsValueFormat,
      );

      return (
        <td
          role="gridcell"
          className="pvtTotal pvtRowTotal"
          key={`total-${flatColKey}`}
          ref={totalRowStyleRef}
          onClick={colTotalCallbacks[flatColKey]}
          onContextMenu={e => this.props.onContextMenu(e, colKey, undefined)}
          style={{ padding: '5px' }}
        >
          {displayCell(totalRowFormattedValue, this.props.allowRenderHtml)}
        </td>
      );
    });

    let grandTotalCell = null;
    if (rowTotals) {
      const agg = pivotData.getAggregator([], []);
      const aggValue = agg.value();
      const grandTotalStyleRef = globalTableSettings?.columnTotalsValueFormat
        ? this.buildValueCellStyleRef(globalTableSettings.columnTotalsValueFormat)
        : null;
      const grandTotalFormattedValue = this.formatAggValue(
        aggValue,
        agg.format(aggValue),
        globalTableSettings?.columnTotalsValueFormat,
      );
      grandTotalCell = (
        <td
          role="gridcell"
          key="total"
          className="pvtGrandTotal pvtRowTotal"
          ref={grandTotalStyleRef}
          onClick={grandTotalCallback}
          onContextMenu={e => this.props.onContextMenu(e, undefined, undefined)}
        >
          {displayCell(grandTotalFormattedValue, this.props.allowRenderHtml)}
        </td>
      );
    }

    const totalCells = [totalLabelCell, ...totalValueCells, grandTotalCell];

    return (
      <tr key="total" className="pvtRowTotals">
        {totalCells}
      </tr>
    );
  }

  visibleKeys(keys, collapsed, numAttrs, subtotalDisplay) {
    return keys.filter(
      key =>
        // Is the key hidden by one of its parents?
        !key.some((k, j) => collapsed[flatKey(key.slice(0, j))]) &&
        // Leaf key.
        (key.length === numAttrs ||
          // Children hidden. Must show total.
          flatKey(key) in collapsed ||
          // Don't hide totals.
          !subtotalDisplay.hideOnExpand),
    );
  }

  isDashboardEditMode() {
    return document.contains(document.querySelector('.dashboard--editing'));
  }

  render() {
    if (this.cachedProps !== this.props) {
      this.cachedProps = this.props;
      this.cachedBasePivotSettings = this.getBasePivotSettings();
    }
    const {
      colAttrs,
      rowAttrs,
      rowKeys,
      colKeys,
      colTotals,
      rowSubtotalDisplay,
      colSubtotalDisplay,
      allowRenderHtml,
    } = this.cachedBasePivotSettings;

    // Need to account for exclusions to compute the effective row
    // and column keys.
    const visibleRowKeys = this.visibleKeys(
      rowKeys,
      this.state.collapsedRows,
      rowAttrs.length,
      rowSubtotalDisplay,
    );
    const visibleColKeys = this.visibleKeys(
      colKeys,
      this.state.collapsedCols,
      colAttrs.length,
      colSubtotalDisplay,
    );

    const pivotSettings = {
      visibleRowKeys,
      maxRowVisible: Math.max(...visibleRowKeys.map(k => k.length)),
      visibleColKeys,
      maxColVisible: Math.max(...visibleColKeys.map(k => k.length)),
      rowAttrSpans: this.calcAttrSpans(visibleRowKeys, rowAttrs.length),
      colAttrSpans: this.calcAttrSpans(visibleColKeys, colAttrs.length),
      allowRenderHtml,
      ...this.cachedBasePivotSettings,
    };

    return (
      <Styles isDashboardEditMode={this.isDashboardEditMode()}>
        <table className="pvtTable" role="grid">
          <thead>
            {colAttrs.map((c, j) =>
              this.renderColHeaderRow(c, j, pivotSettings),
            )}
            {rowAttrs.length !== 0 && this.renderRowHeaderRow(pivotSettings)}
          </thead>
          <tbody>
            {visibleRowKeys.map((r, i) =>
              this.renderTableRow(r, i, pivotSettings),
            )}
            {colTotals && this.renderTotalsRow(pivotSettings)}
          </tbody>
        </table>
      </Styles>
    );
  }
}

TableRenderer.propTypes = {
  ...PivotData.propTypes,
  tableOptions: PropTypes.object,
  onContextMenu: PropTypes.func,
};
TableRenderer.defaultProps = { ...PivotData.defaultProps, tableOptions: {} };
