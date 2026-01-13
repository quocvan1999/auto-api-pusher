import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ApiConfig, CsvRow, Mapping, TransformationConfig } from '../types';
import { flattenObjectKeys, getDeep, constructPayload } from '../utils/dataUtils';
import { Table, Database, ArrowRight, ArrowLeft, Settings2, Trash2, FileSpreadsheet, Plus, AlertCircle, Maximize2, X, Minimize2, HelpCircle, Copy, Check, Wand2, Split, Eye, FileJson } from 'lucide-react';
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
  const [mappings, setMappings] = useState<Mapping[]>(initialMappings || []);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // State for modals
  const [activeTransformKey, setActiveTransformKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const modalTableContainerRef = useRef<HTMLDivElement>(null);
  
  const bodyKeys = useMemo(() => {
    return flattenObjectKeys(apiConfig.bodyTemplate || {});
  }, [apiConfig.bodyTemplate]);

  const autoMapHeaders = (headers: string[]) => {
    if (headers.length === 0) return;
    
    const newMappings: Mapping[] = [];
    bodyKeys.forEach(key => {
      const existing = mappings.find(m => m.jsonPath === key);
      if (existing) {
          newMappings.push(existing);
          return;
      }
      const lastPart = key.split('.').pop()?.toLowerCase();
      const match = headers.find(h => 
        h.toLowerCase() === key.toLowerCase() || 
        h.toLowerCase() === lastPart
      );
      if (match) {
        newMappings.push({ jsonPath: key, csvHeader: match });
      }
    });
    setMappings(newMappings);
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

  const handleMappingChange = (jsonPath: string, csvHeader: string) => {
    setMappings(prev => {
      const filtered = prev.filter(m => m.jsonPath !== jsonPath);
      if (!csvHeader) return filtered;
      // Preserve existing transformation if re-selecting header
      const existing = prev.find(m => m.jsonPath === jsonPath);
      return [...filtered, { jsonPath, csvHeader, transformation: existing?.transformation }];
    });
  };

  const updateTransformation = (jsonPath: string, config: TransformationConfig) => {
      setMappings(prev => prev.map(m => 
          m.jsonPath === jsonPath ? { ...m, transformation: config } : m
      ));
  };

  const removeRow = (indexToRemove: number) => {
    setParsedRows(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const addRow = () => {
    let currentHeaders = csvHeaders;
    if (currentHeaders.length === 0) {
        if (bodyKeys.length > 0) {
            currentHeaders = bodyKeys;
            setCsvHeaders(bodyKeys);
        } else {
            currentHeaders = ['Column 1'];
            setCsvHeaders(['Column 1']);
        }
    }
    const newRow: CsvRow = {};
    currentHeaders.forEach(h => newRow[h] = '');
    setParsedRows(prev => [...prev, newRow]);
    setTimeout(() => {
        if (isExpanded && modalTableContainerRef.current) {
             modalTableContainerRef.current.scrollTop = modalTableContainerRef.current.scrollHeight;
        } else if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
        }
    }, 100);
  };

  const updateRowCell = (rowIndex: number, header: string, value: string) => {
    setParsedRows(prev => {
      const newRows = [...prev];
      newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };
      return newRows;
    });
  };

  const copyToClipboard = (text: string, key: string) => {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
  };

  const getMapping = (path: string) => mappings.find(m => m.jsonPath === path);

  // Render Table Helper
  const renderDataTable = (containerRef: React.RefObject<HTMLDivElement | null>, maxHeightClass?: string) => (
       <div className="flex-1 flex flex-col h-full relative">
           <div className={`flex-1 overflow-auto bg-slate-50 ${maxHeightClass || ''}`} ref={containerRef}>
               {parsedRows.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                       <Database size={32} className="mb-2 opacity-50" />
                       <p className="text-sm">No data found.</p>
                       <p className="text-xs mt-1">Import a file or add a row manually to get started.</p>
                   </div>
               ) : (
                   <table className="min-w-full text-left border-collapse text-xs">
                       <thead className="bg-slate-100 sticky top-0 z-10 font-semibold text-slate-600 shadow-sm">
                           <tr>
                               <th className="p-2 w-10 text-center border-b border-slate-200 bg-slate-100 sticky left-0 z-20">#</th>
                               <th className="p-2 w-10 border-b border-slate-200 bg-slate-100 sticky left-10 z-20"></th>
                               {csvHeaders.map(h => (
                                   <th key={h} className="p-2 border-l border-b border-slate-200 min-w-[150px] whitespace-nowrap bg-slate-100" title={h}>
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
                                       <button 
                                            onClick={() => removeRow(idx)}
                                            className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors"
                                            title="Delete this row"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                   </td>
                                   {csvHeaders.map((h, i) => (
                                       <td key={i} className="border-l border-slate-100 min-w-[150px] p-0 relative">
                                           <input
                                              type="text"
                                              value={row[h] || ''}
                                              onChange={(e) => updateRowCell(idx, h, e.target.value)}
                                              className="w-full h-full p-2 bg-transparent border-none outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:bg-white text-slate-700 placeholder-slate-300"
                                           />
                                       </td>
                                   ))}
                               </tr>
                           ))}
                       </tbody>
                   </table>
               )}
           </div>
           
           <div className="p-3 bg-white border-t border-slate-200 shrink-0 flex justify-center sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={addRow}
                    className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200 border-dashed w-full justify-center transition-colors"
                >
                    <Plus size={16} />
                    Add Empty Row
                </button>
           </div>
       </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Configuration Review */}
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
        {/* Left Column: Data Input */}
        <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[600px] flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database size={18} className="text-indigo-600" />
                      <h3 className="font-semibold text-slate-800">Data Source</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsExpanded(true)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors mr-1" title="Maximize View"><Maximize2 size={16} /></button>
                      <input type="file" ref={fileInputRef} accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                        <FileSpreadsheet size={14} className="text-green-600"/> Import Excel
                      </button>
                    </div>
                </div>
                <div className="flex-1 flex flex-col relative overflow-hidden">
                   {renderDataTable(tableContainerRef)}
                </div>
            </div>
        </div>

        {/* Right Column: Mapping */}
        <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[600px] flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Table size={18} className="text-indigo-600" />
                    <h3 className="font-semibold text-slate-800">Field Mapping</h3>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                    {bodyKeys.length === 0 ? (
                        <div className="text-center text-slate-400 py-10">No body fields detected.</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-50 text-blue-900 text-xs rounded border border-blue-100">
                                <div className="flex gap-2 mb-1 font-semibold">
                                    <HelpCircle size={14} className="shrink-0 mt-0.5" />
                                    <span>Tips for User:</span>
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-blue-800/80">
                                    <li>For arrays like <code>VNA886|VNA889</code>, use the <Wand2 size={10} className="inline"/> icon.</li>
                                    <li><strong>Pro Tip:</strong> Use dots for nested keys (e.g., <code>registration.code</code>) in the "Item Key" box to create objects inside the array.</li>
                                </ul>
                            </div>
                            
                            {bodyKeys.map((key) => {
                                const mapping = getMapping(key);
                                const selectedHeader = mapping?.csvHeader || '';
                                const previewValue = parsedRows.length > 0 && selectedHeader ? parsedRows[0][selectedHeader] : null;
                                const templateValue = getDeep(apiConfig.bodyTemplate, key);
                                const isComplex = typeof templateValue === 'object' && templateValue !== null;

                                return (
                                    <div key={key} className="p-3 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors bg-white shadow-sm relative group">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 max-w-[50%]">
                                              <div className="font-mono text-xs font-bold text-slate-700 truncate" title={key}>{key}</div>
                                              {isComplex && (
                                                <button onClick={() => copyToClipboard(JSON.stringify(templateValue), key)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Copy sample JSON">
                                                  {copiedKey === key ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                                </button>
                                              )}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 w-1/2 justify-end">
                                                {/* Transformation Trigger */}
                                                {selectedHeader && (
                                                    <button 
                                                        onClick={() => setActiveTransformKey(activeTransformKey === key ? null : key)}
                                                        className={`p-1.5 rounded transition-colors ${mapping?.transformation?.enabled ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-500'}`}
                                                        title="Format settings (Split string, Map to object...)"
                                                    >
                                                        <Wand2 size={14} />
                                                    </button>
                                                )}
                                                <div className="flex-1">
                                                    <select 
                                                        value={selectedHeader}
                                                        onChange={(e) => handleMappingChange(key, e.target.value)}
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-slate-50 text-slate-900"
                                                    >
                                                        <option value="">-- Ignore --</option>
                                                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Transformation Configuration Panel */}
                                        {activeTransformKey === key && mapping && (
                                            <div className="mt-2 mb-2 p-3 bg-indigo-50/80 rounded border border-indigo-100 text-xs animate-in slide-in-from-top-2">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-indigo-800 flex items-center gap-1"><Split size={12}/> Smart Split (Tách mảng)</span>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <span className="text-slate-500">Enable</span>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={mapping.transformation?.enabled || false}
                                                            onChange={(e) => updateTransformation(key, { 
                                                                enabled: e.target.checked, 
                                                                separator: mapping.transformation?.separator || '|',
                                                                itemKey: mapping.transformation?.itemKey || ''
                                                            })}
                                                        />
                                                    </label>
                                                </div>
                                                
                                                {mapping.transformation?.enabled && (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-slate-500 mb-1">Separator</label>
                                                            <input 
                                                                type="text" 
                                                                value={mapping.transformation.separator}
                                                                onChange={(e) => updateTransformation(key, { ...mapping.transformation!, separator: e.target.value })}
                                                                className="w-full p-1 border border-indigo-200 rounded text-center font-mono"
                                                                placeholder="|"
                                                            />
                                                            <div className="text-[10px] text-slate-400 mt-1">e.g. A|B|C</div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-slate-500 mb-1">Item Key (Dot notation)</label>
                                                            <input 
                                                                type="text" 
                                                                value={mapping.transformation.itemKey || ''}
                                                                onChange={(e) => updateTransformation(key, { ...mapping.transformation!, itemKey: e.target.value })}
                                                                className="w-full p-1 border border-indigo-200 rounded font-mono"
                                                                placeholder="e.g. reg.code"
                                                            />
                                                            <div className="text-[10px] text-slate-400 mt-1 truncate" title={mapping.transformation.itemKey ? `[{"${mapping.transformation.itemKey}": "val"}]` : `["val"]`}>
                                                                {mapping.transformation.itemKey 
                                                                    ? `Result: [{"${mapping.transformation.itemKey}": "val"}]` 
                                                                    : `Result: ["val"]`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        <div className="mt-1 pt-2 border-t border-slate-100 flex items-start gap-2 text-xs">
                                            <span className="text-slate-400 font-medium whitespace-nowrap">Preview:</span>
                                            {selectedHeader ? (
                                                <span className="font-mono text-slate-600 break-all bg-slate-50 px-1 rounded line-clamp-2">
                                                    {previewValue !== null && previewValue !== undefined && previewValue !== '' 
                                                        ? String(previewValue) 
                                                        : <span className="text-slate-300 italic">empty</span>}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 italic">Not mapped</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100"><ArrowLeft size={18} /> Back</button>
        <div className="flex gap-3">
             <button 
                onClick={() => setShowPreviewModal(true)}
                disabled={parsedRows.length === 0 || mappings.length === 0}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                    parsedRows.length === 0 || mappings.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
             >
                <Eye size={18} />
                Preview Payloads
             </button>
             <button 
                onClick={() => onNext(parsedRows, mappings)} 
                disabled={parsedRows.length === 0 || mappings.length === 0} 
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${parsedRows.length === 0 || mappings.length === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'}`}
             >
                Review & Start Upload <ArrowRight size={18} />
            </button>
        </div>
      </div>

      {/* Raw Data Editor Modal */}
      {isExpanded && (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2"><Database size={20} className="text-indigo-600" /><h3 className="font-bold text-slate-800 text-lg">Raw Data Editor ({parsedRows.length} rows)</h3></div>
                      <div className="flex items-center gap-2">
                         <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><Minimize2 size={20} /></button>
                         <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-red-100 rounded-lg text-slate-500 hover:text-red-600 transition-colors"><X size={20} /></button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-hidden p-0">{renderDataTable(modalTableContainerRef)}</div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end"><button onClick={() => setIsExpanded(false)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Done</button></div>
              </div>
          </div>
      )}

      {/* Payload Preview Modal */}
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
                        {parsedRows.length > 5 && (
                            <div className="text-center text-slate-500 italic text-sm py-4">
                                ... and {parsedRows.length - 5} more rows
                            </div>
                        )}
                  </div>
                  
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                      <button onClick={() => setShowPreviewModal(false)} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100">
                        Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DataMapper;