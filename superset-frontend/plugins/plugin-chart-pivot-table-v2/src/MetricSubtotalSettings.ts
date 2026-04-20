export interface ValueCellFormatSettings {
  valueFormat?: string; // D3 number format
  dateFormat?: string; // D3 time format
  fontSize?: number; // px
  fontColor?: string; // css color
  backgroundColor?: string; // css color
}

export interface MetricSubtotalSettingsType {
  subtotalEnabled?: boolean; // Show/Hide subtotal для данной метрики
  subtotalLabel?: string; // Переопределение лейбла для метрики
  subtotalAggregation?: 'sum' | 'max' | 'min' | 'formula'; // Переопределение агрегации для метрики
  subtotalValueFormat?: ValueCellFormatSettings; // Переопределение формата/цветов
}
