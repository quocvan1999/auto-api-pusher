export interface ApiConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyTemplate: Record<string, any>; // The structure extracted from cURL
}

export interface CsvRow {
  [key: string]: string;
}

export type DataType = 'string' | 'number' | 'boolean' | 'object' | 'array_string' | 'array_number' | 'array_object';

export interface TransformationConfig {
  enabled: boolean;
  separator: string; // The main list separator (e.g. "," or "|")
  itemSeparator?: string; // Optional: The separator INSIDE an item (e.g. "*")
  itemIndex?: number; // Optional: Which position to take (0, 1, 2...)
}

export interface InternalFieldMapping {
    key: string;       // e.g. "Depart"
    index: number;     // e.g. 0
    dataType: DataType;// e.g. "string"
}

export interface Mapping {
  id: string; // Unique ID for UI handling
  jsonPath: string; // e.g., "productId" or "items[].id" (User editable)
  dataType: DataType; // User selectable type
  csvHeader?: string; // e.g., "A" or "SKU_CODE"
  defaultValue?: string; // Value if no CSV header is mapped
  transformation?: TransformationConfig;
  internalFields?: InternalFieldMapping[]; // Only used when dataType is array_object
}

export interface JobLog {
  id: number;
  status: 'pending' | 'success' | 'error';
  statusCode?: number;
  response?: string;
  data: any;
  timestamp: Date;
}

export enum AppStep {
  CONFIGURE = 1,
  DATA_ENTRY = 2,
  EXECUTE = 3
}