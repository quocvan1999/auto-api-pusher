import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ApiConfig, CsvRow, Mapping } from '../types';
import { parseCSV, flattenObjectKeys } from '../utils/dataUtils';
import { Table, Database, ArrowRight, ArrowLeft, Settings2, Trash2, FileSpreadsheet, Eye, Plus, AlertCircle, Maximize2, X, Minimize2 } from 'lucide-react';
import { read, utils } from 'xlsx';

interface Props {
  apiConfig: ApiConfig;
  onBack: () => void;
  onNext: (data: CsvRow[], mappings: Mapping[]) => void;
}

const DataMapper: React.FC<Props> = ({ apiConfig, onBack, onNext }) => {
  const [rawData, setRawData] = useState('');
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // State for fullscreen modal

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const modalTableContainerRef = useRef<HTMLDivElement>(null);
  
  // Extract JSON paths from the bodyTemplate extracted from cURL
  const bodyKeys = useMemo(() => {
    return flattenObjectKeys(apiConfig.bodyTemplate || {});
  }, [apiConfig.bodyTemplate]);

  // Helper to auto-map headers based on name similarity
  const autoMapHeaders = (headers: string[]) => {
    if (headers.length === 0) return;
    
    const newMappings: Mapping[] = [];
    bodyKeys.forEach(key => {
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

  // Handle manual text changes (Paste)
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawData(text);
    
    // Parse immediately
    const { headers, data } = parseCSV(text);
    setParsedRows(data);
    setCsvHeaders(headers);
    autoMapHeaders(headers);
  };

  // Handle Excel/CSV file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer);
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = utils.sheet_to_json<CsvRow>(worksheet, { 
          defval: '',
          raw: false 
      });

      if (jsonData.length > 0) {
          const headers = Object.keys(jsonData[0]);
          
          setParsedRows(jsonData);
          setCsvHeaders(headers);
          autoMapHeaders(headers);
          
          const csvView = utils.sheet_to_csv(worksheet);
          setRawData(csvView);
          
          setShowPreview(true);
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
      return [...filtered, { jsonPath, csvHeader }];
    });
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
    setShowPreview(true); 
    
    // Auto scroll to bottom - handle both normal and modal view
    setTimeout(() => {
        if (isExpanded && modalTableContainerRef.current) {
             modalTableContainerRef.current.scrollTop = modalTableContainerRef.current.scrollHeight;
        } else if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
        }
    }, 100);
  };

  // Function to handle cell edits
  const updateRowCell = (rowIndex: number, header: string, value: string) => {
    setParsedRows(prev => {
      const newRows = [...prev];
      newRows[rowIndex] = { ...newRows[rowIndex], [header]: value };
      return newRows;
    });
  };

  const getMappedHeader = (path: string) => mappings.find(m => m.jsonPath === path)?.csvHeader || '';

  // Reusable Table Render Function
  const renderDataTable = (containerRef: React.RefObject<HTMLDivElement | null>, maxHeightClass?: string) => (
       <div className="flex-1 flex flex-col h-full relative">
           <div className={`flex-1 overflow-auto bg-slate-50 ${maxHeightClass || ''}`} ref={containerRef}>
               {parsedRows.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                       <Database size={32} className="mb-2 opacity-50" />
                       <p className="text-sm">No data found.</p>
                       <p className="text-xs mt-1">Paste data, import a file, or add a row manually.</p>
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
                                              placeholder=""
                                           />
                                       </td>
                                   ))}
                               </tr>
                           ))}
                       </tbody>
                   </table>
               )}
           </div>
           
           {/* Add Row Button - Sticky at bottom */}
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
        {/* Left Column: Data Input (Takes up more space now 7/12) */}
        <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[600px] flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database size={18} className="text-indigo-600" />
                      <h3 className="font-semibold text-slate-800">Raw Data</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsExpanded(true)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors mr-1"
                        title="Maximize View"
                      >
                         <Maximize2 size={16} />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        accept=".csv, .xlsx, .xls"
                        className="hidden" 
                        onChange={handleFileUpload}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                      >
                        <FileSpreadsheet size={14} className="text-green-600"/>
                        Import Excel
                      </button>
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col relative overflow-hidden">
                   {/* Tabs / Toggle */}
                   <div className="flex border-b border-slate-100 bg-white shrink-0">
                      <button 
                        onClick={() => setShowPreview(false)}
                        className={`flex-1 py-2 text-xs font-medium text-center ${!showPreview ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        Paste Input
                      </button>
                      <button 
                        onClick={() => setShowPreview(true)}
                        className={`flex-1 py-2 text-xs font-medium text-center flex items-center justify-center gap-2 ${showPreview ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <Eye size={12}/> Preview & Edit ({parsedRows.length})
                      </button>
                   </div>

                   {!showPreview ? (
                       <div className="flex-1 flex flex-col p-4">
                            <textarea
                                value={rawData}
                                onChange={handleTextChange}
                                placeholder="Paste your Spreadsheet data here, or click 'Import Excel' for better accuracy..."
                                className="w-full flex-1 font-mono text-xs bg-white text-slate-900 border border-slate-300 p-4 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-400"
                                spellCheck={false}
                            />
                            <div className="mt-2 text-xs text-slate-500 flex justify-between">
                                <span>Detected from text: {parsedRows.length} rows</span>
                            </div>
                       </div>
                   ) : (
                       renderDataTable(tableContainerRef)
                   )}
                </div>
            </div>
        </div>

        {/* Right Column: Mapping (5/12) */}
        <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[600px] flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Table size={18} className="text-indigo-600" />
                    <h3 className="font-semibold text-slate-800">Field Mapping</h3>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                    {bodyKeys.length === 0 ? (
                        <div className="text-center text-slate-400 py-10">
                            No body fields detected in the cURL configuration.
                            <br/> This might be a GET request or has no body.
                        </div>
                    ) : (
                        <div className="space-y-4">
                             <div className="p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100 flex gap-2">
                                <AlertCircle size={16} className="shrink-0" />
                                Check the "Preview Value" to ensure you are sending the right data.
                             </div>
                            
                            {bodyKeys.map((key) => {
                                const selectedHeader = getMappedHeader(key);
                                // Get the value from the first row to preview
                                const previewValue = parsedRows.length > 0 && selectedHeader ? parsedRows[0][selectedHeader] : null;

                                return (
                                    <div key={key} className="p-3 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors bg-white shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="font-mono text-xs font-bold text-slate-700 truncate max-w-[150px]" title={`JSON Key: ${key}`}>
                                                {key}
                                            </div>
                                            <div className="text-slate-400">
                                                <ArrowRight size={14} />
                                            </div>
                                            <div className="w-1/2">
                                                <select 
                                                    value={selectedHeader}
                                                    onChange={(e) => handleMappingChange(key, e.target.value)}
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-slate-50 text-slate-900"
                                                >
                                                    <option value="">-- Ignore --</option>
                                                    {csvHeaders.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        
                                        {/* Value Preview Section */}
                                        <div className="mt-1 pt-2 border-t border-slate-100">
                                            <div className="flex items-start gap-2 text-xs">
                                                <span className="text-slate-400 font-medium whitespace-nowrap">Preview (Row 1):</span>
                                                {selectedHeader ? (
                                                    <span className="font-mono text-slate-600 break-all bg-slate-50 px-1 rounded">
                                                        {previewValue !== null && previewValue !== undefined && previewValue !== '' 
                                                            ? String(previewValue) 
                                                            : <span className="text-slate-300 italic">empty</span>}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 italic">Not mapped</span>
                                                )}
                                            </div>
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
        <button 
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100"
        >
            <ArrowLeft size={18} />
            Back
        </button>
        <button 
            onClick={() => onNext(parsedRows, mappings)}
            disabled={parsedRows.length === 0 || mappings.length === 0}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                parsedRows.length === 0 || mappings.length === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
            }`}
        >
            Review & Start Upload
            <ArrowRight size={18} />
        </button>
      </div>

      {/* Fullscreen Modal for Data Editing */}
      {isExpanded && (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                          <Database size={20} className="text-indigo-600" />
                          <h3 className="font-bold text-slate-800 text-lg">Raw Data Editor ({parsedRows.length} rows)</h3>
                      </div>
                      <div className="flex items-center gap-2">
                         <button 
                            onClick={() => setIsExpanded(false)}
                            className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                         >
                             <Minimize2 size={20} />
                         </button>
                         <button 
                            onClick={() => setIsExpanded(false)}
                            className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg text-slate-400 transition-colors"
                         >
                             <X size={20} />
                         </button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-hidden p-0 relative">
                     {renderDataTable(modalTableContainerRef)}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DataMapper;