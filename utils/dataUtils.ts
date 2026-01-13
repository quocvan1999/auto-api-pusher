import { CsvRow, Mapping, DataType } from "../types";

export const parseCSV = (text: string): { headers: string[], data: CsvRow[] } => {
  if (!text.trim()) return { headers: [], data: [] };

  const firstLine = text.split('\n')[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const lines = text.trim().split('\n');
  
  if (lines.length === 0) return { headers: [], data: [] };

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const data: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    
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

// Infers the data type from a value for initial setup
export const inferType = (value: any): DataType => {
    if (Array.isArray(value)) {
        if (value.length > 0) {
             const first = value[0];
             if (typeof first === 'number') return 'array_number';
             if (typeof first === 'object' && first !== null) return 'array_object';
        }
        return 'array_string'; 
    }
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'object' && value !== null) return 'object';
    return 'string';
};

export const flattenObjectKeys = (obj: any): { path: string, type: DataType }[] => {
  const result: { path: string, type: DataType }[] = [];
  
  for (const key in obj) {
    const value = obj[key];
    const type = inferType(value);
    result.push({ path: key, type });
  }
  return result;
};

const castValue = (val: any, type: DataType): any => {
    if (val === undefined || val === null) return val;
    if (typeof val === 'object') return val;

    const strVal = String(val).trim();

    switch (type) {
        case 'number':
        case 'array_number':
            if (strVal === '') return 0;
            const num = Number(strVal);
            return isNaN(num) ? 0 : num;
        case 'boolean':
            return strVal.toLowerCase() === 'true' || strVal === '1';
        case 'object':
            if (!strVal) return {};
            try { return JSON.parse(strVal); } catch { return {}; }
        case 'array_object':
            // Logic handled in constructPayload usually, but fallback here
            if (!strVal) return [];
            try { return JSON.parse(strVal); } catch { return []; }
        default: 
            return strVal;
    }
};

const setDeep = (obj: any, path: string, value: any) => {
    // Handle empty path case (root assignment - usually not applicable here but good safety)
    if (!path) return;
    
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isArrayPath = part.endsWith('[]');
        const key = isArrayPath ? part.slice(0, -2) : part;
        const isLast = i === parts.length - 1;

        if (isArrayPath) {
            if (!current[key] || !Array.isArray(current[key])) {
                current[key] = [];
            }
            const arrayRef = current[key];
            const valuesToAssign = Array.isArray(value) ? value : [value];

            if (isLast) {
                 current[key] = valuesToAssign;
            } else {
                 valuesToAssign.forEach((val: any, index: number) => {
                     if (!arrayRef[index]) arrayRef[index] = {};
                     const remainingPath = parts.slice(i + 1).join('.');
                     setDeep(arrayRef[index], remainingPath, val);
                 });
                 return;
            }
        } else {
            if (isLast) {
                current[key] = value;
            } else {
                if (!current[key]) current[key] = {};
                current = current[key];
            }
        }
    }
};

export const constructPayload = (row: CsvRow, mappings: Mapping[]): any => {
    const body = {};

    mappings.forEach(m => {
        // 1. Determine Raw Value
        let rawValue: any = undefined;
        if (m.csvHeader && row[m.csvHeader] !== undefined) {
            rawValue = row[m.csvHeader];
        } else if (m.defaultValue !== undefined && m.defaultValue !== '') {
            rawValue = m.defaultValue;
        }

        if (rawValue === undefined) return;

        let finalValue: any = rawValue;

        // 2. SPECIAL HANDLING FOR ARRAY OBJECT (Structured Parsing)
        if (m.dataType === 'array_object' && typeof rawValue === 'string' && m.csvHeader) {
            const separator = m.transformation?.separator || ',';
            const itemSeparator = m.transformation?.itemSeparator || '*';
            
            // a. Split main list: "(HAN*SGN), (HAN*AAA)" -> ["(HAN*SGN)", "(HAN*AAA)"]
            const rawList = rawValue.split(separator);
            
            finalValue = rawList.map(rawItem => {
                // b. Clean wrapper chars: "(HAN*SGN)" -> "HAN*SGN"
                const cleanItem = rawItem.trim().replace(/^[\(\[\{]+|[\)\]\}]+$/g, '');
                
                // c. Split internal values: "HAN*SGN" -> ["HAN", "SGN"]
                const values = cleanItem.split(itemSeparator).map(v => v.trim());
                
                // d. Map to object using internalFields
                const obj: any = {};
                if (m.internalFields && m.internalFields.length > 0) {
                    m.internalFields.forEach(field => {
                        const valAtIndex = values[field.index];
                        // Get the value. If missing, empty string.
                        const finalVal = valAtIndex !== undefined ? castValue(valAtIndex, field.dataType) : '';
                        
                        // Use setDeep to allow nested keys like "details.color" inside the array item
                        setDeep(obj, field.key, finalVal);
                    });
                } else {
                    // Fallback
                    return { raw: cleanItem }; 
                }
                return obj;
            });

            // Skip the generic transformation/casting below for this specific type
            setDeep(body, m.jsonPath, finalValue);
            return; 
        }

        // 3. Generic Transformation (Simple Arrays)
        if (m.transformation?.enabled && typeof rawValue === 'string') {
            const separator = m.transformation.separator || ',';
            let listParts = rawValue.split(separator).map(s => s.trim());
            
            // Inner Split (Positional) logic for simple arrays
            if (m.transformation.itemSeparator) {
                listParts = listParts.map(part => {
                    const cleanPart = part.replace(/^[\(\[\{]+|[\)\]\}]+$/g, '');
                    const subParts = cleanPart.split(m.transformation.itemSeparator!).map(s => s.trim());
                    const idx = m.transformation.itemIndex || 0;
                    return subParts[idx] !== undefined ? subParts[idx] : '';
                });
            }
            finalValue = listParts;
        }

        // 4. Generic Type Casting
        const isArrayType = m.dataType.startsWith('array_');
        
        if (isArrayType && !Array.isArray(finalValue)) {
            finalValue = [finalValue];
        }

        if (Array.isArray(finalValue)) {
            finalValue = finalValue.map(v => castValue(v, m.dataType));
        } else {
            finalValue = castValue(finalValue, m.dataType);
        }

        setDeep(body, m.jsonPath, finalValue);
    });

    return body;
};