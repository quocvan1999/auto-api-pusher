import React, { useState, useRef, useEffect } from 'react';
import { ApiConfig, CsvRow, Mapping, TransformationConfig, DataType, InternalFieldMapping } from '../types';
import { flattenObjectKeys, constructPayload } from '../utils/dataUtils';
import { Table, Database, ArrowRight, ArrowLeft, Settings2, Trash2, FileSpreadsheet, Plus, Maximize2, X, Minimize2, HelpCircle, Wand2, Split, Eye, FileJson, Hash, Type, GripVertical, List, Braces } from 'lucide-react';
import { read, utils } from 'xlsx';

interface Props {
  apiConfig: ApiConfig;
  initialData?: CsvRow[];
  initialMappings?: Mapping[];
  onBack: () => void;
  onNext: (data: CsvRow[], mappings: Mapping[]) => void;
}

const DataMapper: React.FC<Props> = ({ apiConfig, initialData, initialMappings, onBack, onNext }) => {
  const [parsedRows, setParsedRows] = useState<CsvRow[]>(initialData || []);
  const [csvHeaders, setCsvHeaders] = useState<string[]>(
    initialData && initialData.length > 0 ? Object.keys(initialData[0]) : []
  );
  
  const [mappings, setMappings] = useState<Mapping[]>(() => {
      if (initialMappings && initialMappings.length > 0) return initialMappings;
      
      const flatKeys = flattenObjectKeys(apiConfig.bodyTemplate || {});
      return flatKeys.map((k, idx) => ({
          id: `map-${idx}-${Date.now()}`,
          jsonPath: k.path,
          dataType: k.type,
          csvHeader: '',
          defaultValue: ''
      }));
  });

  const [activeTransformKey, setActiveTransformKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const modalTableContainerRef = useRef<HTMLDivElement>(null);

  const autoMapHeaders = (headers: string[]) => {
    if (headers.length === 0) return;
    setMappings(prev => prev.map(m => {
        if (m.csvHeader) return m; 
        
        const cleanKey = m.jsonPath.replace(/\[\]/g, ''); 
        const lastPart = cleanKey.split('.').pop()?.toLowerCase();
        
        const match = headers.find(h => 
          h.toLowerCase() === cleanKey.toLowerCase() || 
          h.toLowerCase() === lastPart
        );
        return match ? { ...m, csvHeader: match } : m;
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = utils.sheet_to_json<CsvRow>(worksheet, { defval: '', raw: false });

      if (jsonData.length > 0) {
          const headers = Object.keys(jsonData[0]);
          setParsedRows(jsonData);
          setCsvHeaders(headers);
          autoMapHeaders(headers);
      } else {
          alert("File appears to be empty.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error("Error reading Excel file:", error);
      alert("Failed to read the file. Please ensure it is a valid .xlsx or .csv file.");
    }
  };

  const clearData = () => {
    if (parsedRows.length > 0 && confirm("Clear all imported data?")) {
      setParsedRows([]);
      setCsvHeaders([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addMappingField = () => {
      setMappings(prev => [...prev, {
          id: `new-${Date.now()}`,
          jsonPath: 'newField',
          dataType: 'string',
          csvHeader: '',
          defaultValue: ''
      }]);
  };

  const removeMappingField = (id: string) => {
      setMappings(prev => prev.filter(m => m.id !== id));
  };

  const updateMapping = (id: string, updates: Partial<Mapping>) => {
      setMappings(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const updateTransformation = (id: string, config: TransformationConfig) => {
      setMappings(prev => prev.map(m => 
          m.id === id ? { ...m, transformation: config } : m
      ));
  };
  
  const updateInternalField = (mappingId: string, index: number, fieldUpdates: Partial<InternalFieldMapping>) => {
      setMappings(prev => prev.map(m => {
          if (m.id !== mappingId) return m;
          const newFields = [...(m.internalFields || [])];
          newFields[index] = { ...newFields[index], ...fieldUpdates };
          return { ...m, internalFields: newFields };
      }));
  };

  const addInternalField = (mappingId: string) => {
      setMappings(prev => prev.map(m => {
          if (m.id !== mappingId) return m;
          const currentFields = m.internalFields || [];
          return {
              ...m,
              internalFields: [...currentFields, { key: '', index: currentFields.length, dataType: 'string' }]
          };
      }));
  };

  const removeInternalField = (mappingId: string, index: number) => {
      setMappings(prev => prev.map(m => {
          if (m.id !== mappingId) return m;
          const newFields = (m.internalFields || []).filter((_, i) => i !== index);
          return { ...m, internalFields: newFields };
      }));
  };

  const removeRow = (indexToRemove: number) => {
    setParsedRows(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const addRow = () => {
    let currentHeaders = csvHeaders;
    if (currentHeaders.length === 0) {
        currentHeaders = ['Column 1'];
        setCsvHeaders(['Column 1']);
    }
    const newRow: CsvRow = {};
    currentHeaders.forEach(h => newRow[h] = '');
    setParsedRows(prev => [...prev, newRow]);
  };

  const updateRowCell = (rowIndex: number, header: string, value: string) => {
    setParsedRows(prev => {
      const newRows = [...prev];
      newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };
      return newRows;
    });
  };

  const renderDataTable = (containerRef: React.RefObject<HTMLDivElement | null>, maxHeightClass?: string) => (
       <div className="flex-1 flex flex-col h-full relative">
           <div className={`flex-1 overflow-auto bg-slate-50 ${maxHeightClass || ''}`} ref={containerRef}>
               {parsedRows.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                       <Database size={32} className="mb-2 opacity-50" />
                       <p className="text-sm">No data found.</p>
                       <p className="text-xs mt-1">Import a file or add a row manually.</p>
                   </div>
               ) : (
                   <table className="min-w-full text-left border-collapse text-xs">
                       <thead className="bg-slate-100 sticky top-0 z-10 font-semibold text-slate-600 shadow-sm">
                           <tr>
                               <th className="p-2 w-10 text-center border-b border-slate-200 bg-slate-100 sticky left-0 z-20">#</th>
                               <th className="p-2 w-10 border-b border-slate-200 bg-slate-100 sticky left-10 z-20"></th>
                               {csvHeaders.map(h => (
                                   <th key={h} className="p-2 border-l border-b border-slate-200 min-w-[120px] whitespace-nowrap bg-slate-100" title={h}>
                                      {h}
                                   </th>
                               ))}
                           </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-slate-100">
                           {parsedRows.map((row, idx) => (
                               <tr key={idx} className="hover:bg-indigo-50/50 group">
                                   <td className="p-2 text-center text-slate-400 font-mono bg-white group-hover:bg-indigo-50/50 sticky left-0 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] border-r border-slate-100">{idx + 1}</td>
                                   <td className="p-2 bg-white group-hover:bg-indigo-50/50 sticky left-10 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] border-r border-slate-100 text-center">
                                       <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors"><Trash2 size={14} /></button>
                                   </td>
                                   {csvHeaders.map((h, i) => (
                                       <td key={i} className="border-l border-slate-100 min-w-[120px] p-0">
                                           <input
                                              type="text"
                                              value={row[h] || ''}
                                              onChange={(e) => updateRowCell(idx, h, e.target.value)}
                                              className="w-full h-full p-2 bg-transparent border-none outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 focus:bg-white text-slate-700"
                                           />
                                       </td>
                                   ))}
                               </tr>
                           ))}
                       </tbody>
                   </table>
               )}
           </div>
           
           <div className="p-2 bg-white border-t border-slate-200 shrink-0 flex justify-center sticky bottom-0 z-20">
                <button onClick={addRow} className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-4 py-1.5 rounded-lg border border-indigo-200 border-dashed w-full justify-center transition-colors">
                    <Plus size={14} /> Add Row
                </button>
           </div>
       </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex justify-between items-center text-sm">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Target URL</span>
            <span className="font-mono text-slate-700 font-medium truncate max-w-md">{apiConfig.url}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Method</span>
            <span className={`font-bold ${apiConfig.method === 'POST' ? 'text-green-600' : 'text-blue-600'}`}>{apiConfig.method}</span>
          </div>
        </div>
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <Settings2 size={14} /> Edit Config
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[650px] flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database size={18} className="text-indigo-600" />
                      <h3 className="font-semibold text-slate-800 text-sm">Data Source</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsExpanded(true)} className="p-1 text-slate-500 hover:text-indigo-600 rounded"><Maximize2 size={16} /></button>
                      {parsedRows.length > 0 && <button onClick={clearData} className="p-1 text-slate-500 hover:text-red-600 rounded"><Trash2 size={16} /></button>}
                      <input type="file" ref={fileInputRef} accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded transition-colors">
                        <FileSpreadsheet size={14} className="text-green-600"/> Import
                      </button>
                    </div>
                </div>
                <div className="flex-1 flex flex-col relative overflow-hidden">
                   {renderDataTable(tableContainerRef)}
                </div>
            </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[650px] flex flex-col">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Table size={18} className="text-indigo-600" />
                        <h3 className="font-semibold text-slate-800 text-sm">Payload Schema & Mapping</h3>
                    </div>
                    <button onClick={addMappingField} className="flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-100 transition-colors">
                        <Plus size={14} /> Add Field
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                    {/* List Header */}
                    <div className="flex gap-2 text-[10px] uppercase font-bold text-slate-400 px-2">
                        <div className="flex-1">JSON Field (Path)</div>
                        <div className="w-24">Type</div>
                        <div className="w-1/3">Map To</div>
                        <div className="w-6"></div>
                    </div>

                    {mappings.map((map) => {
                        const previewValue = parsedRows.length > 0 && map.csvHeader ? parsedRows[0][map.csvHeader] : map.defaultValue;
                        const isArrayKey = map.jsonPath.includes('[]');
                        const isArrayObject = map.dataType === 'array_object';

                        return (
                            <div key={map.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 group hover:border-indigo-300 transition-all">
                                {/* Top Row: Field Config */}
                                <div className="flex gap-2 items-start">
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            value={map.jsonPath}
                                            onChange={(e) => updateMapping(map.id, { jsonPath: e.target.value })}
                                            className={`w-full text-xs font-mono p-1.5 border rounded focus:ring-1 focus:ring-indigo-500 outline-none ${isArrayKey ? 'text-indigo-600 font-bold border-indigo-100 bg-indigo-50/30' : 'text-slate-700 border-slate-200'}`}
                                            placeholder="e.g. data.items[].id"
                                        />
                                    </div>

                                    <div className="w-24">
                                        <div className="relative">
                                            <Type size={12} className="absolute left-1.5 top-2 text-slate-400" />
                                            <select 
                                                value={map.dataType}
                                                onChange={(e) => updateMapping(map.id, { dataType: e.target.value as DataType })}
                                                className="w-full text-xs p-1.5 pl-5 border border-slate-200 rounded focus:border-indigo-500 outline-none bg-white appearance-none"
                                            >
                                                <option value="string">String</option>
                                                <option value="number">Number</option>
                                                <option value="boolean">Boolean</option>
                                                <option value="object">Object</option>
                                                <option value="array_string">Array(Str)</option>
                                                <option value="array_number">Array(Num)</option>
                                                <option value="array_object">Array(Obj)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="w-1/3 flex flex-col gap-1">
                                        <select 
                                            value={map.csvHeader || ''}
                                            onChange={(e) => updateMapping(map.id, { csvHeader: e.target.value, defaultValue: '' })}
                                            className={`w-full text-xs p-1.5 border rounded focus:border-indigo-500 outline-none ${map.csvHeader ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-medium' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                                        >
                                            <option value="">-- Fixed Value --</option>
                                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                        {!map.csvHeader && (
                                            <input 
                                                type="text"
                                                value={map.defaultValue || ''}
                                                onChange={(e) => updateMapping(map.id, { defaultValue: e.target.value })}
                                                placeholder="Default value"
                                                className="w-full text-xs p-1 border border-slate-200 rounded bg-slate-50 focus:bg-white"
                                            />
                                        )}
                                    </div>

                                    <button onClick={() => removeMappingField(map.id)} className="text-slate-300 hover:text-red-500 p-1.5"><X size={14} /></button>
                                </div>

                                {/* Bottom Row: Actions */}
                                <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {/* If Array Object, we show Config button instead of generic Transform */}
                                        {isArrayObject && map.csvHeader && (
                                             <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded flex items-center gap-1">
                                                <Braces size={12}/> Structured Array Parsing
                                             </div>
                                        )}

                                        {!isArrayObject && map.csvHeader && (
                                            <button 
                                                onClick={() => setActiveTransformKey(activeTransformKey === map.id ? null : map.id)}
                                                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${map.transformation?.enabled ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                <Wand2 size={10} /> Split / Transform
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 overflow-hidden max-w-[150px]">
                                        <Eye size={10} /> 
                                        <span className="truncate font-mono">{String(previewValue || '')}</span>
                                    </div>
                                </div>

                                {/* ARRAY OBJECT CONFIG PANEL */}
                                {isArrayObject && map.csvHeader && (
                                    <div className="mt-2 p-3 bg-indigo-50/60 rounded border border-indigo-200 text-xs animate-in slide-in-from-top-2">
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                             <div>
                                                <label className="block text-[10px] font-bold text-indigo-800 mb-0.5">List Separator</label>
                                                <input 
                                                    type="text" 
                                                    value={map.transformation?.separator || ','}
                                                    onChange={(e) => updateTransformation(map.id, { ...map.transformation!, enabled: true, separator: e.target.value })}
                                                    className="w-full p-1 border border-indigo-200 rounded font-mono text-center text-indigo-900 bg-white"
                                                    placeholder=","
                                                />
                                                <div className="text-[9px] text-indigo-400 mt-0.5">Splits objects: (A), (B)</div>
                                             </div>
                                             <div>
                                                <label className="block text-[10px] font-bold text-indigo-800 mb-0.5">Inner Separator</label>
                                                <input 
                                                    type="text" 
                                                    value={map.transformation?.itemSeparator || '*'}
                                                    onChange={(e) => updateTransformation(map.id, { ...map.transformation!, enabled: true, itemSeparator: e.target.value })}
                                                    className="w-full p-1 border border-indigo-200 rounded font-mono text-center text-indigo-900 bg-white"
                                                    placeholder="*"
                                                />
                                                <div className="text-[9px] text-indigo-400 mt-0.5">Splits props: A*B</div>
                                             </div>
                                        </div>

                                        <div className="border-t border-indigo-200 pt-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-indigo-800">Object Fields Mapping</span>
                                                <button onClick={() => addInternalField(map.id)} className="text-[9px] bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <Plus size={10}/> Add Property
                                                </button>
                                            </div>
                                            
                                            <div className="space-y-1.5">
                                                {(map.internalFields || []).map((field, fIdx) => (
                                                    <div key={fIdx} className="flex gap-1 items-center">
                                                        <div className="flex-1">
                                                            <input 
                                                                type="text"
                                                                placeholder="Key (e.g. details.color)"
                                                                value={field.key}
                                                                onChange={(e) => updateInternalField(map.id, fIdx, { key: e.target.value })}
                                                                className="w-full p-1 text-xs border border-indigo-200 rounded text-indigo-900 placeholder-indigo-300"
                                                            />
                                                        </div>
                                                        <div className="w-16">
                                                            <div className="relative">
                                                                <span className="absolute left-1 top-1.5 text-[9px] text-indigo-400 font-bold">Idx:</span>
                                                                <input 
                                                                    type="number"
                                                                    min="0"
                                                                    value={field.index}
                                                                    onChange={(e) => updateInternalField(map.id, fIdx, { index: parseInt(e.target.value) || 0 })}
                                                                    className="w-full p-1 pl-7 text-xs border border-indigo-200 rounded text-indigo-900 font-mono text-center"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="w-24">
                                                            <select 
                                                                value={field.dataType}
                                                                onChange={(e) => updateInternalField(map.id, fIdx, { dataType: e.target.value as DataType })}
                                                                className="w-full p-1 text-[10px] border border-indigo-200 rounded text-indigo-900"
                                                            >
                                                                <option value="string">String</option>
                                                                <option value="number">Number</option>
                                                                <option value="boolean">Boolean</option>
                                                                <option value="object">Object (JSON)</option>
                                                            </select>
                                                        </div>
                                                        <button onClick={() => removeInternalField(map.id, fIdx)} className="text-indigo-300 hover:text-red-500"><X size={12}/></button>
                                                    </div>
                                                ))}
                                                {(!map.internalFields || map.internalFields.length === 0) && (
                                                    <div className="text-center text-[10px] text-indigo-400 italic py-1">No fields defined. Will return empty objects.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* GENERIC TRANSFORMATION PANEL */}
                                {activeTransformKey === map.id && map.csvHeader && !isArrayObject && (
                                    <div className="mt-2 p-3 bg-indigo-50/50 rounded border border-indigo-100 text-xs animate-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-indigo-800 flex items-center gap-1"><Split size={12}/> Split Configuration</span>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <span className="text-slate-500">Enable</span>
                                                <input 
                                                    type="checkbox" 
                                                    checked={map.transformation?.enabled || false}
                                                    onChange={(e) => updateTransformation(map.id, { 
                                                        enabled: e.target.checked, 
                                                        separator: map.transformation?.separator || ',',
                                                        itemSeparator: map.transformation?.itemSeparator || '',
                                                        itemIndex: map.transformation?.itemIndex || 0
                                                    })}
                                                />
                                            </label>
                                        </div>
                                        
                                        {map.transformation?.enabled && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-0.5">List Separator</label>
                                                    <input 
                                                        type="text" 
                                                        value={map.transformation.separator}
                                                        onChange={(e) => updateTransformation(map.id, { ...map.transformation!, separator: e.target.value })}
                                                        className="w-full p-1 border border-indigo-200 rounded font-mono text-center"
                                                        placeholder=","
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-0.5">Inner Separator</label>
                                                    <input 
                                                        type="text" 
                                                        value={map.transformation.itemSeparator || ''}
                                                        onChange={(e) => updateTransformation(map.id, { ...map.transformation!, itemSeparator: e.target.value })}
                                                        className="w-full p-1 border border-indigo-200 rounded font-mono text-center"
                                                        placeholder="*"
                                                    />
                                                </div>
                                                {map.transformation.itemSeparator && (
                                                    <div className="col-span-2 flex items-center gap-2 bg-white p-1 rounded border border-indigo-100">
                                                        <label className="text-[10px] whitespace-nowrap">Pick Index:</label>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            value={map.transformation.itemIndex || 0}
                                                            onChange={(e) => updateTransformation(map.id, { ...map.transformation!, itemIndex: parseInt(e.target.value) || 0 })}
                                                            className="w-12 p-0.5 text-center font-bold text-indigo-700 border border-slate-200 rounded"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100"><ArrowLeft size={18} /> Back</button>
        <div className="flex gap-3">
             <button 
                onClick={() => setShowPreviewModal(true)}
                disabled={parsedRows.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
             >
                <Eye size={18} />
                Preview Payloads
             </button>
             <button 
                onClick={() => onNext(parsedRows, mappings)} 
                disabled={parsedRows.length === 0 || mappings.length === 0} 
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
             >
                Review & Start Upload <ArrowRight size={18} />
            </button>
        </div>
      </div>

      {showPreviewModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                          <FileJson size={20} className="text-indigo-600" />
                          <h3 className="font-bold text-slate-800 text-lg">Payload Preview (First 5 Rows)</h3>
                      </div>
                      <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-8">
                        {parsedRows.slice(0, 5).map((row, index) => {
                            const payload = constructPayload(row, mappings);
                            return (
                                <div key={index} className="space-y-2">
                                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                                        <span className="bg-indigo-500/20 px-2 py-0.5 rounded">Row #{index + 1}</span>
                                    </div>
                                    <div className="bg-black/30 rounded-lg p-4 border border-white/10 font-mono text-sm text-green-400 overflow-x-auto">
                                        <pre>{JSON.stringify(payload, null, 2)}</pre>
                                    </div>
                                </div>
                            );
                        })}
                  </div>
                  
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                      <button onClick={() => setShowPreviewModal(false)} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100">
                        Close
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {isExpanded && (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2"><Database size={20} className="text-indigo-600" /><h3 className="font-bold text-slate-800 text-lg">Raw Data Editor</h3></div>
                      <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded"><X size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-hidden p-0">{renderDataTable(modalTableContainerRef)}</div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end"><button onClick={() => setIsExpanded(false)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium">Done</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DataMapper;