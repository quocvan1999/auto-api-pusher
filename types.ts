export interface ApiConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyTemplate: Record<string, any>; // The structure extracted from cURL
}

export interface CsvRow {
  [key: string]: string;
}

export interface Mapping {
  jsonPath: string; // e.g., "productId" or "details.sku"
  csvHeader: string; // e.g., "A" or "SKU_CODE"
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