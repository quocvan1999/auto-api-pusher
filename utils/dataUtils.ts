import { CsvRow } from "../types";

export const parseCSV = (text: string): { headers: string[], data: CsvRow[] } => {
  if (!text.trim()) return { headers: [], data: [] };

  // Detect delimiter: tab for Excel paste, comma for CSV
  const firstLine = text.split('\n')[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const lines = text.trim().split('\n');
  
  // Return empty if only whitespace
  if (lines.length === 0) return { headers: [], data: [] };

  // Remove quotes from headers
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  
  const data: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split values by delimiter
    // Note: This is a simple split. Complex CSVs with commas inside quotes might need a library like PapaParse,
    // but this suffices for standard data exports.
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    
    // FIX: Check if the row is effectively empty (e.g., ",,,," or empty strings)
    // This eliminates "ghost" rows often found at the end of Excel exports.
    const hasData = values.some(v => v !== '');
    if (!hasData) continue;

    const row: CsvRow = {};
    headers.forEach((header, index) => {
      // Safely map value to header
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return { headers, data };
};

// Flatten an object to array of paths: { a: { b: 1 } } -> ["a.b"]
export const flattenObjectKeys = (obj: any, prefix = ''): string[] => {
  let keys: string[] = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(flattenObjectKeys(obj[key], prefix ? `${prefix}.${key}` : key));
    } else {
      keys.push(prefix ? `${prefix}.${key}` : key);
    }
  }
  return keys;
};

// Set value in object by path: set(obj, "a.b", 1)
export const setDeep = (obj: any, path: string, value: any) => {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) current[key] = {};
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
};