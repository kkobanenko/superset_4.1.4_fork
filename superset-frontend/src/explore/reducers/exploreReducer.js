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
/* eslint camelcase: 0 */
import { ensureIsArray } from '@superset-ui/core';
import { omit, pick } from 'lodash';
import { DYNAMIC_PLUGIN_CONTROLS_READY } from 'src/components/Chart/chartAction';
import { getControlsState } from 'src/explore/store';
import {
  getControlConfig,
  getControlStateFromControlConfig,
  getControlValuesCompatibleWithDatasource,
  StandardizedFormData,
} from 'src/explore/controlUtils';
import * as actions from 'src/explore/actions/exploreActions';
import { HYDRATE_EXPLORE } from '../actions/hydrateExplore';

const MAX_FIELD_FORMATTING_SLOTS = 10;
const FIELD_SELECTOR_REGEX = /^field_formatting_field(\d+)_selector$/;
const FIELD_REMOVE_REGEX = /^field_formatting_field(\d+)_remove$/;

function getFieldSelectorName(index) {
  return `field_formatting_field${index}_selector`;
}

function compactPivotFieldFormattingState(formData, changedIndex, nextValue) {
  const nextFormData = { ...formData };
  const changedSelectorName = getFieldSelectorName(changedIndex);

  if (typeof nextValue === 'string' && nextValue.length > 0) {
    nextFormData[changedSelectorName] = nextValue;
  } else {
    nextFormData[changedSelectorName] = undefined;
  }

  const snapshot = { ...nextFormData };

  const compactSourceIndexes = [];
  const seenSelected = new Set();
  for (let index = 0; index < MAX_FIELD_FORMATTING_SLOTS; index += 1) {
    const selectorValue = snapshot[getFieldSelectorName(index)];
    if (
      typeof selectorValue === 'string' &&
      selectorValue.length > 0 &&
      !seenSelected.has(selectorValue)
    ) {
      seenSelected.add(selectorValue);
      compactSourceIndexes.push(index);
    }
  }

  Object.keys(nextFormData).forEach(key => {
    if (/^field_formatting_field\d+_/.test(key)) {
      delete nextFormData[key];
    }
  });

  for (let destIndex = 0; destIndex < MAX_FIELD_FORMATTING_SLOTS; destIndex += 1) {
    const sourceIndex = compactSourceIndexes[destIndex];
    if (sourceIndex === undefined) {
      continue;
    }

    const sourcePrefix = `field_formatting_field${sourceIndex}_`;
    const destPrefix = `field_formatting_field${destIndex}_`;

    Object.entries(snapshot).forEach(([key, slotValue]) => {
      if (key.startsWith(sourcePrefix)) {
        const suffix = key.slice(sourcePrefix.length);
        nextFormData[`${destPrefix}${suffix}`] = slotValue;
      }
    });

    const selectedField = snapshot[getFieldSelectorName(sourceIndex)];
    nextFormData[getFieldSelectorName(destIndex)] =
      typeof selectedField === 'string' && selectedField.length > 0
        ? selectedField
        : undefined;
    nextFormData[`field_formatting_field${destIndex}_remove`] = false;
  }

  const selected = compactSourceIndexes
    .map(sourceIndex => snapshot[getFieldSelectorName(sourceIndex)])
    .filter(
      selectorValue =>
        typeof selectorValue === 'string' && selectorValue.length > 0,
    );

  const settings =
    nextFormData.fieldGroupingSettings &&
    typeof nextFormData.fieldGroupingSettings === 'object'
      ? nextFormData.fieldGroupingSettings
      : {};
  const selectedSet = new Set(selected);
  const sanitizedSettings = {};
  Object.entries(settings).forEach(([fieldName, fieldSettings]) => {
    if (selectedSet.has(fieldName) && fieldSettings !== null) {
      sanitizedSettings[fieldName] = fieldSettings;
    }
  });
  nextFormData.fieldGroupingSettings = sanitizedSettings;

  return nextFormData;
}

export default function exploreReducer(state = {}, action) {
  const actionHandlers = {
    [DYNAMIC_PLUGIN_CONTROLS_READY]() {
      return {
        ...state,
        controls: action.controlsState,
      };
    },
    [actions.TOGGLE_FAVE_STAR]() {
      return {
        ...state,
        isStarred: action.isStarred,
      };
    },
    [actions.POST_DATASOURCE_STARTED]() {
      return {
        ...state,
        isDatasourceMetaLoading: true,
      };
    },
    [actions.START_METADATA_LOADING]() {
      return {
        ...state,
        isDatasourceMetaLoading: true,
      };
    },
    [actions.STOP_METADATA_LOADING]() {
      return {
        ...state,
        isDatasourceMetaLoading: false,
      };
    },
    [actions.SYNC_DATASOURCE_METADATA]() {
      return {
        ...state,
        datasource: action.datasource,
      };
    },
    [actions.UPDATE_FORM_DATA_BY_DATASOURCE]() {
      const newFormData = { ...state.form_data };
      const { prevDatasource, newDatasource } = action;
      const controls = { ...state.controls };
      const controlsTransferred = [];

      if (
        prevDatasource.id !== newDatasource.id ||
        prevDatasource.type !== newDatasource.type
      ) {
        newFormData.datasource = newDatasource.uid;
      }
      // reset control values for column/metric related controls
      Object.entries(controls).forEach(([controlName, controlState]) => {
        if (
          // for direct column select controls
          controlState.valueKey === 'column_name' ||
          // for all other controls
          'savedMetrics' in controlState ||
          'columns' in controlState ||
          ('options' in controlState && !Array.isArray(controlState.options))
        ) {
          newFormData[controlName] = getControlValuesCompatibleWithDatasource(
            newDatasource,
            controlState,
            controlState.value,
          );
          if (
            ensureIsArray(newFormData[controlName]).length > 0 &&
            newFormData[controlName] !== controls[controlName].default
          ) {
            controlsTransferred.push(controlName);
          }
        }
      });

      const newState = {
        ...state,
        controls,
        datasource: action.newDatasource,
      };
      return {
        ...newState,
        form_data: newFormData,
        controls: getControlsState(newState, newFormData),
        controlsTransferred,
      };
    },
    [actions.FETCH_DATASOURCES_STARTED]() {
      return {
        ...state,
        isDatasourcesLoading: true,
      };
    },
    [actions.SET_FIELD_VALUE]() {
      const { controlName, value, validationErrors } = action;
      let new_form_data = { ...state.form_data, [controlName]: value };
      const selectorMatch = FIELD_SELECTOR_REGEX.exec(controlName);
      const isPivotFieldControl = Boolean(selectorMatch || FIELD_REMOVE_REGEX.exec(controlName));
      if (selectorMatch) {
        const changedIndex = Number(selectorMatch[1]);
        if (Number.isInteger(changedIndex) && changedIndex >= 0) {
          new_form_data = compactPivotFieldFormattingState(
            new_form_data,
            changedIndex,
            value,
          );
        }
      }
      const removeMatch = FIELD_REMOVE_REGEX.exec(controlName);
      if (removeMatch && value === true) {
        const changedIndex = Number(removeMatch[1]);
        if (Number.isInteger(changedIndex) && changedIndex >= 0) {
          new_form_data = compactPivotFieldFormattingState(
            new_form_data,
            changedIndex,
            undefined,
          );
          delete new_form_data[controlName];
        }
      }
      const old_metrics_data = state.form_data.metrics;
      const new_column_config = state.form_data.column_config;

      const vizType = new_form_data.viz_type;

      // if the controlName is metrics, and the metric column name is updated,
      // need to update column config as well to keep the previous config.
      if (controlName === 'metrics' && old_metrics_data && new_column_config) {
        value.forEach((item, index) => {
          const itemExist = old_metrics_data.some(
            oldItem => oldItem?.label === item?.label,
          );

          if (
            !itemExist &&
            item?.label !== old_metrics_data[index]?.label &&
            !!new_column_config[old_metrics_data[index]?.label]
          ) {
            new_column_config[item.label] =
              new_column_config[old_metrics_data[index].label];

            delete new_column_config[old_metrics_data[index].label];
          }
        });
        new_form_data.column_config = new_column_config;
      }

      // Use the processed control config (with overrides and everything)
      // if `controlName` does not exist in current controls,
      const controlConfig =
        state.controls[action.controlName] ||
        getControlConfig(action.controlName, vizType) ||
        null;

      // Optional: let control config transform formData when value changes (e.g. clear fieldGroupingSettings)
      // For dynamic controls (generated names), config can exist only in state.controls.
      const rawConfig = controlConfig || getControlConfig(action.controlName, vizType);
      if (
        !isPivotFieldControl &&
        rawConfig?.formDataOnChange &&
        typeof rawConfig.formDataOnChange === 'function'
      ) {
        try {
          const prevValue = state.form_data?.[controlName];
          const updated = rawConfig.formDataOnChange(
            action.value,
            prevValue,
            new_form_data,
          );
          if (updated && typeof updated === 'object' && !Array.isArray(updated)) {
            new_form_data = updated;
          }
        } catch (err) {
          // ignore formDataOnChange errors
        }
      }

      // will call validators again
      const nextControlValue = Object.prototype.hasOwnProperty.call(
        new_form_data,
        controlName,
      )
        ? new_form_data[controlName]
        : action.value;
      const control = {
        ...getControlStateFromControlConfig(
          controlConfig,
          state,
          nextControlValue,
        ),
      };

      const column_config = {
        ...state.controls.column_config,
        ...(new_column_config && { value: new_column_config }),
      };

      const newState = {
        ...state,
        controls: {
          ...state.controls,
          ...(controlConfig && { [controlName]: control }),
          ...(controlName === 'metrics' && { column_config }),
        },
      };

      const rerenderedControls = {};
      if (Array.isArray(control.rerender)) {
        control.rerender.forEach(controlName => {
          const rerenderValue = Object.prototype.hasOwnProperty.call(
            new_form_data,
            controlName,
          )
            ? new_form_data[controlName]
            : newState.controls[controlName].value;
          rerenderedControls[controlName] = {
            ...getControlStateFromControlConfig(
              newState.controls[controlName],
              newState,
              rerenderValue,
            ),
          };
        });
      }

      // combine newly detected errors with errors from `onChange` event of
      // each control component (passed via reducer action).
      const errors = control.validationErrors || [];
      (validationErrors || []).forEach(err => {
        // skip duplicated errors
        if (!errors.includes(err)) {
          errors.push(err);
        }
      });
      const hasErrors = errors && errors.length > 0;

      const isVizSwitch =
        action.controlName === 'viz_type' &&
        action.value !== state.controls.viz_type.value;
      let currentControlsState = state.controls;
      if (isVizSwitch) {
        // get StandardizedFormData from source form_data
        const sfd = new StandardizedFormData(state.form_data);
        const transformed = sfd.transform(action.value, state);
        new_form_data = transformed.formData;
        currentControlsState = transformed.controlsState;
      }

      const dependantControls = Object.entries(state.controls)
        .filter(
          ([, item]) =>
            Array.isArray(item?.validationDependancies) &&
            item.validationDependancies.includes(controlName),
        )
        .map(([key, item]) => ({
          controlState: item,
          dependantControlName: key,
        }));

      let updatedControlStates = {};
      if (dependantControls.length > 0) {
        const updatedControls = dependantControls.map(
          ({ controlState, dependantControlName }) => {
            // use transformed form_data to validate dependent controls consistently
            const overWrittenState = {
              ...state,
              form_data: new_form_data,
            };

            return {
              // Re run validation for dependent controls
              controlState: getControlStateFromControlConfig(
                controlState,
                overWrittenState,
                controlState?.value,
              ),
              dependantControlName,
            };
          },
        );

        updatedControlStates = updatedControls.reduce(
          (acc, { controlState, dependantControlName }) => {
            acc[dependantControlName] = { ...controlState };
            return acc;
          },
          {},
        );
      }

      return {
        ...state,
        form_data: new_form_data,
        triggerRender: isPivotFieldControl
          ? true
          : control.renderTrigger && !hasErrors,
        controls: isPivotFieldControl
          ? getControlsState(
              {
                ...state,
                form_data: new_form_data,
                controls: currentControlsState,
              },
              new_form_data,
            )
          : {
              ...currentControlsState,
              ...(controlConfig && {
                [action.controlName]: {
                  ...control,
                  validationErrors: errors,
                },
              }),
              ...rerenderedControls,
              ...updatedControlStates,
            },
      };
    },
    [actions.SET_EXPLORE_CONTROLS]() {
      return {
        ...state,
        controls: getControlsState(state, action.formData),
      };
    },
    [actions.SET_FORM_DATA]() {
      return {
        ...state,
        form_data: action.formData,
      };
    },
    [actions.UPDATE_CHART_TITLE]() {
      return {
        ...state,
        sliceName: action.sliceName,
      };
    },
    [actions.SET_SAVE_ACTION]() {
      return {
        ...state,
        saveAction: action.saveAction,
      };
    },
    [actions.CREATE_NEW_SLICE]() {
      return {
        ...state,
        slice: action.slice,
        controls: getControlsState(state, action.form_data),
        can_add: action.can_add,
        can_download: action.can_download,
        can_overwrite: action.can_overwrite,
      };
    },
    [actions.SET_STASH_FORM_DATA]() {
      const { form_data, hiddenFormData } = state;
      const { fieldNames, isHidden } = action;
      if (isHidden) {
        return {
          ...state,
          hiddenFormData: {
            ...hiddenFormData,
            ...pick(form_data, fieldNames),
          },
          form_data: omit(form_data, fieldNames),
        };
      }

      const restoredField = pick(hiddenFormData, fieldNames);
      return Object.keys(restoredField).length === 0
        ? state
        : {
            ...state,
            form_data: {
              ...form_data,
              ...restoredField,
            },
            hiddenFormData: omit(hiddenFormData, fieldNames),
          };
    },
    [actions.SLICE_UPDATED]() {
      return {
        ...state,
        slice: {
          ...state.slice,
          ...action.slice,
          owners: action.slice.owners
            ? action.slice.owners.map(owner => owner.value)
            : null,
        },
        sliceName: action.slice.slice_name ?? state.sliceName,
        metadata: {
          ...state.metadata,
          owners: action.slice.owners
            ? action.slice.owners.map(owner => owner.label)
            : null,
        },
      };
    },
    [actions.SET_FORCE_QUERY]() {
      return {
        ...state,
        force: action.force,
      };
    },
    [HYDRATE_EXPLORE]() {
      return {
        ...action.data.explore,
      };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
