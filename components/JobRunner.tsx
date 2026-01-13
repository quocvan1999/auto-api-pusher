import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiConfig, CsvRow, Mapping, JobLog } from '../types';
import { constructPayload } from '../utils/dataUtils';
import { Play, Square, RefreshCcw, CheckCircle2, XCircle, Clock, AlertTriangle, Timer, ArrowDownCircle, Edit2, RotateCw, Save, X } from 'lucide-react';

interface Props {
  apiConfig: ApiConfig;
  data: CsvRow[];
  mappings: Mapping[];
  onBack: () => void;
}

const JobRunner: React.FC<Props> = ({ apiConfig, data, mappings, onBack }) => {
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ success: 0, error: 0, pending: data.length });
  const [delay, setDelay] = useState(5000); 
  const [autoScroll, setAutoScroll] = useState(true); 
  
  const [editingRow, setEditingRow] = useState<{ index: number, data: CsvRow } | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initialLogs: JobLog[] = data.map((row, index) => ({
      id: index,
      status: 'pending',
      data: row,
      timestamp: new Date()
    }));
    setLogs(initialLogs);
  }, [data]);

  useEffect(() => {
    const newStats = logs.reduce((acc, log) => {
        if (log.status === 'success') acc.success++;
        else if (log.status === 'error') acc.error++;
        else acc.pending++;
        return acc;
    }, { success: 0, error: 0, pending: 0 });
    setStats(newStats);
    
    const completed = newStats.success + newStats.error;
    const total = logs.length;
    setProgress(total > 0 ? (completed / total) * 100 : 0);

  }, [logs]);

  useEffect(() => {
    if (isRunning && autoScroll) {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs, isRunning, autoScroll]);

  const sendRequest = async (rowData: CsvRow, signal?: AbortSignal) => {
    const body = constructPayload(rowData, mappings);
    try {
        const response = await fetch(apiConfig.url, {
            method: apiConfig.method,
            headers: {
                ...apiConfig.headers,
                ...(!Object.keys(apiConfig.headers).find(k => k.toLowerCase() === 'content-type') 
                    ? { 'Content-Type': 'application/json' } 
                    : {})
            },
            body: JSON.stringify(body),
            signal: signal
        });
        const text = await response.text();
        return { 
            ok: response.ok, 
            status: response.status, 
            response: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        };
    } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        return { ok: false, status: 0, response: err.message };
    }
  };

  const retryRow = async (index: number) => {
     if (isRunning) return;

     setLogs(prev => {
         const n = [...prev];
         n[index] = { ...n[index], status: 'pending', response: 'Retrying...' };
         return n;
     });

     const row = logs[index].data;
     try {
         const result = await sendRequest(row as CsvRow);
         setLogs(prev => {
             const n = [...prev];
             n[index] = {
                 ...n[index],
                 status: result.ok ? 'success' : 'error',
                 statusCode: result.status,
                 response: result.response,
                 timestamp: new Date()
             };
             return n;
         });
     } catch (e) { /* ignore */ }
  };

  const handleEditSave = (newData: CsvRow, shouldRetry: boolean) => {
      if (!editingRow) return;
      
      const idx = editingRow.index;
      setLogs(prev => {
          const n = [...prev];
          n[idx] = { ...n[idx], data: newData, status: 'error' }; 
          return n;
      });
      setEditingRow(null);

      if (shouldRetry) {
          setTimeout(() => retryRow(idx), 100);
      }
  };

  const executeJob = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    abortControllerRef.current = new AbortController();

    for (let i = 0; i < logs.length; i++) {
        const currentLog = logs[i]; 
        
        if (currentLog.status === 'success') continue; 

        if (abortControllerRef.current?.signal.aborted) {
            setIsRunning(false);
            return;
        }

        const result = await sendRequest(currentLog.data as CsvRow, abortControllerRef.current.signal);

        if (result.ok === false && result.status === 0 && result.response.includes('aborted')) {
             break;
        }
        
        setLogs(prev => {
            const newLogs = [...prev];
            newLogs[i] = {
                ...newLogs[i],
                status: result.ok ? 'success' : 'error',
                statusCode: result.status,
                response: result.response,
                timestamp: new Date()
            };
            return newLogs;
        });

        const waitTime = Math.max(50, delay);
        await new Promise(r => setTimeout(r, waitTime)); 
    }
    
    setIsRunning(false);
  }, [logs, apiConfig, mappings, isRunning, delay]);

  const stopJob = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 relative">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="text-slate-500 text-xs uppercase font-bold mb-1">Total Requests</div>
                <div className="text-2xl font-bold text-slate-800">{logs.length}</div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-green-500">
                <div className="text-green-600 text-xs uppercase font-bold mb-1">Success</div>
                <div className="text-2xl font-bold text-green-700">{stats.success}</div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-red-500">
                <div className="text-red-600 text-xs uppercase font-bold mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-700">{stats.error}</div>
             </div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
                <div className="text-amber-600 text-xs uppercase font-bold mb-1">Pending</div>
                <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
             </div>
        </div>

        {/* Controls & Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-4">
                    {!isRunning ? (
                        <button 
                            onClick={executeJob}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20"
                        >
                            <Play size={20} fill="currentColor" />
                            {progress > 0 && progress < 100 ? 'Resume' : 'Start Push'}
                        </button>
                    ) : (
                        <button 
                            onClick={stopJob}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        >
                            <Square size={20} fill="currentColor" />
                            Stop
                        </button>
                    )}
                    
                    {/* Delay Input */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 h-10">
                        <Timer size={16} className="text-slate-500" />
                        <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Delay (ms):</span>
                        <input
                            type="number"
                            min="50"
                            step="100"
                            value={delay}
                            onChange={(e) => setDelay(Math.max(0, Number(e.target.value)))}
                            className="w-20 text-sm bg-transparent outline-none font-mono text-slate-700 text-right"
                            disabled={isRunning}
                            title="Time to wait between requests"
                        />
                    </div>

                    {progress === 100 && (
                        <button 
                           onClick={() => {
                               const resetLogs = logs.map(l => ({ ...l, status: 'pending', response: undefined, statusCode: undefined })) as JobLog[];
                               setLogs(resetLogs);
                           }}
                           className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100"
                        >
                            <RefreshCcw size={16} /> Reset
                        </button>
                    )}
                </div>
                <div className="text-slate-500 font-mono text-sm">
                    {Math.round(progress)}% Complete
                </div>
            </div>
            
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                    className="bg-blue-600 h-3 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
             <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-sm rounded border border-amber-200 flex gap-2 items-start">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                    <strong>CORS Warning:</strong> Since this runs in your browser, the destination API must support Cross-Origin Resource Sharing (CORS). If requests fail instantly, check CORS settings.
                </p>
            </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700 flex justify-between items-center">
                <span>Execution Log</span>
                <label className="flex items-center gap-2 text-xs font-normal text-slate-600 cursor-pointer select-none bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <ArrowDownCircle size={14} className={autoScroll ? "text-indigo-600" : "text-slate-400"} />
                    Auto-scroll
                </label>
            </div>
            <div className="flex-1 overflow-auto p-0 scroll-smooth" ref={logsContainerRef}>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 text-xs uppercase text-slate-500 font-semibold shadow-sm">
                        <tr>
                            <th className="p-3 border-b border-slate-200 bg-slate-50 w-24">Actions</th>
                            <th className="p-3 border-b border-slate-200 bg-slate-50">Status</th>
                            <th className="p-3 border-b border-slate-200 bg-slate-50">Row ID</th>
                            <th className="p-3 border-b border-slate-200 bg-slate-50">Payload (Preview)</th>
                            <th className="p-3 border-b border-slate-200 bg-slate-50">Response</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {logs.map((log) => (
                            <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                                <td className="p-3 border-r border-slate-100 bg-slate-50/30">
                                    <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                        {!isRunning && (log.status === 'error' || log.status === 'pending') ? (
                                            <>
                                                <button 
                                                    onClick={() => setEditingRow({ index: log.id, data: { ...log.data } })}
                                                    className="p-1.5 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded transition-colors"
                                                    title="Edit Data"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => retryRow(log.id)}
                                                    className="p-1.5 hover:bg-green-100 text-slate-500 hover:text-green-600 rounded transition-colors"
                                                    title="Retry this row"
                                                >
                                                    <RotateCw size={14} />
                                                </button>
                                            </>
                                        ) : (
                                           <div className="w-14"></div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 w-32">
                                    {log.status === 'pending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"><Clock size={12}/> Pending</span>}
                                    {log.status === 'success' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={12}/> {log.statusCode}</span>}
                                    {log.status === 'error' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={12}/> {log.statusCode || 'Err'}</span>}
                                </td>
                                <td className="p-3 font-mono text-slate-500">#{log.id + 1}</td>
                                <td className="p-3 max-w-xs truncate font-mono text-xs text-slate-600" title={JSON.stringify(constructPayload(log.data, mappings))}>
                                    {JSON.stringify(constructPayload(log.data, mappings))}
                                </td>
                                <td className="p-3 max-w-xs truncate font-mono text-xs text-slate-500" title={log.response}>
                                    {log.response || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div ref={logsEndRef} />
            </div>
        </div>

        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 text-sm">
            &larr; Back to Mapping
        </button>

        {/* Edit Modal */}
        {editingRow && (
            <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Edit2 size={18} className="text-blue-600" />
                            <h3 className="font-bold text-slate-800">Edit Payload Data (Row #{editingRow.index + 1})</h3>
                        </div>
                        <button 
                            onClick={() => setEditingRow(null)}
                            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {mappings.map(mapping => (
                                <div key={mapping.jsonPath}>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                        {mapping.csvHeader} <span className="text-slate-300 font-normal normal-case">→ {mapping.jsonPath}</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={editingRow.data[mapping.csvHeader] || ''}
                                        onChange={(e) => setEditingRow({
                                            ...editingRow,
                                            data: { ...editingRow.data, [mapping.csvHeader]: e.target.value }
                                        })}
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                         <button 
                             onClick={() => setEditingRow(null)}
                             className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors"
                         >
                             Cancel
                         </button>
                         <button 
                             onClick={() => handleEditSave(editingRow.data, false)}
                             className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                         >
                             <Save size={16} /> Save
                         </button>
                         <button 
                             onClick={() => handleEditSave(editingRow.data, true)}
                             className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors shadow-md shadow-blue-500/20"
                         >
                             <RotateCw size={16} /> Save & Retry
                         </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default JobRunner;