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
  Behavior,
  ChartMetadata,
  ChartPlugin,
  ChartProps,
  QueryFormData,
  t,
} from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from '../images/thumbnail.png';
import thumbnailDark from '../images/thumbnail-dark.png';
import example from '../images/example.jpg';
import exampleDark from '../images/example-dark.jpg';
import { PivotTableV2QueryFormData } from '../types';

export default class PivotTableV2ChartPlugin extends ChartPlugin<
  PivotTableV2QueryFormData,
  ChartProps<QueryFormData>
> {
  /**
   * The constructor is used to pass relevant metadata and callbacks that get
   * registered in respective registries that are used throughout the library
   * and application. A more thorough description of each property is given in
   * the respective imported file.
   *
   * It is worth noting that `buildQuery` and is optional, and only needed for
   * advanced visualizations that require either post processing operations
   * (pivoting, rolling aggregations, sorting etc) or submitting multiple queries.
   */
  constructor() {
    const metadata = new ChartMetadata({
      behaviors: [
        Behavior.InteractiveChart,
        Behavior.DrillToDetail,
        Behavior.DrillBy,
      ],
      category: t('Table'),
      description: t(
        'Enhanced pivot table with advanced formatting options for each grouping field. Supports custom column widths, sorting, subtotals, value formatting (absolute/percentage/combined), font and background styling, and configurable totals. Version 0.0.11',
      ),
      exampleGallery: [{ url: example, urlDark: exampleDark }],
      name: t('Pivot Table V2'),
      tags: [t('Additive'), t('Report'), t('Tabular'), t('Featured')],
      thumbnail,
      thumbnailDark,
    });

    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../PivotTableV2Chart'),
      metadata,
      transformProps,
    });
  }
}
