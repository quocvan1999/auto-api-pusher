import { CsvRow, Mapping } from "../types";

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
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    
    // Check if the row is effectively empty
    const hasData = values.some(v => v !== '');
    if (!hasData) continue;

    const row: CsvRow = {};
    headers.forEach((header, index) => {
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

// Get value from object by path: get(obj, "a.b")
export const getDeep = (obj: any, path: string): any => {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
};

// Core logic to convert a CSV Row + Mappings into the final JSON Body
export const constructPayload = (row: CsvRow, mappings: Mapping[]): any => {
    const body = {};
    mappings.forEach(m => {
      let value: any = row[m.csvHeader];

      // --- TRANSFORMATION LOGIC (SPLIT & MAP) ---
      if (m.transformation?.enabled && typeof value === 'string') {
          const separator = m.transformation.separator || '|';
          // Split and trim each item
          const parts = value.split(separator).map(s => s.trim()).filter(s => s !== '');
          
          if (m.transformation.itemKey) {
              // Support nested keys in array items (e.g. "registration.code")
              value = parts.map(part => {
                  const itemObj = {};
                  setDeep(itemObj, m.transformation.itemKey!, part);
                  return itemObj;
              });
          } else {
              // Just array of strings: ["A", "B"]
              value = parts;
          }
      } 
      // --- SMART PARSING LOGIC (Legacy / Fallback) ---
      else if (typeof value === 'string') {
          let trimmed = value.trim();
          trimmed = trimmed.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
              (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              try {
                  value = JSON.parse(trimmed);
              } catch (e) { }
          }
          else if (trimmed.toLowerCase() === 'true') {
              value = true;
          }
          else if (trimmed.toLowerCase() === 'false') {
              value = false;
          }
          else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
               // Prevent converting "0123" to number (keep as string), but convert "123" or "1.5"
               if (!(trimmed.startsWith('0') && trimmed.length > 1 && !trimmed.startsWith('0.'))) {
                    const num = Number(trimmed);
                    if (!isNaN(num)) value = num;
               }
          }
      }

      setDeep(body, m.jsonPath, value);
    });
    return body;
};