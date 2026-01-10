import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApiConfig, CsvRow, Mapping, JobLog } from '../types';
import { setDeep } from '../utils/dataUtils';
import { Play, Square, RefreshCcw, CheckCircle2, XCircle, Clock, AlertTriangle, Timer } from 'lucide-react';

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
  const [delay, setDelay] = useState(5000); // Default 5s delay
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Initialize logs
  useEffect(() => {
    const initialLogs: JobLog[] = data.map((row, index) => ({
      id: index,
      status: 'pending',
      data: row,
      timestamp: new Date()
    }));
    setLogs(initialLogs);
  }, [data]);

  // Auto-scroll logs
  useEffect(() => {
    if (isRunning) {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRunning]);

  const constructBody = (row: CsvRow) => {
    const body = {};
    mappings.forEach(m => {
      const value = row[m.csvHeader];
      setDeep(body, m.jsonPath, value);
    });
    return body;
  };

  const executeJob = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    abortControllerRef.current = new AbortController();

    // We iterate through original indices to update correct log entries
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        if (log.status === 'success') continue; // Skip already successful

        if (abortControllerRef.current?.signal.aborted) {
            setIsRunning(false);
            return;
        }

        try {
            const body = constructBody(log.data as CsvRow);
            
            const response = await fetch(apiConfig.url, {
                method: apiConfig.method,
                headers: {
                    ...apiConfig.headers,
                    // Ensure content type is set if not present
                    ...(!Object.keys(apiConfig.headers).find(k => k.toLowerCase() === 'content-type') 
                        ? { 'Content-Type': 'application/json' } 
                        : {})
                },
                body: JSON.stringify(body),
                signal: abortControllerRef.current.signal
            });

            const resText = await response.text();
            
            setLogs(prev => {
                const newLogs = [...prev];
                newLogs[i] = {
                    ...newLogs[i],
                    status: response.ok ? 'success' : 'error',
                    statusCode: response.status,
                    response: resText.substring(0, 200) + (resText.length > 200 ? '...' : ''),
                    timestamp: new Date()
                };
                return newLogs;
            });

            setStats(prev => ({
                success: prev.success + (response.ok ? 1 : 0),
                error: prev.error + (response.ok ? 0 : 1),
                pending: prev.pending - 1
            }));

        } catch (err: any) {
            if (err.name === 'AbortError') break;
            
            setLogs(prev => {
                const newLogs = [...prev];
                newLogs[i] = {
                    ...newLogs[i],
                    status: 'error',
                    statusCode: 0,
                    response: err.message,
                    timestamp: new Date()
                };
                return newLogs;
            });
            setStats(prev => ({ ...prev, error: prev.error + 1, pending: prev.pending - 1 }));
        }

        // Update progress bar
        setProgress(((i + 1) / logs.length) * 100);
        
        // Wait for configured delay (min 50ms for UI responsiveness)
        // If it's the last item, we don't strictly need to wait, but good for consistency
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
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
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
                               setStats({ success: 0, error: 0, pending: data.length });
                               setProgress(0);
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
            <div className="p-4 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700">
                Execution Log
            </div>
            <div className="flex-1 overflow-auto p-0">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 text-xs uppercase text-slate-500 font-semibold">
                        <tr>
                            <th className="p-3 border-b border-slate-200">Status</th>
                            <th className="p-3 border-b border-slate-200">Row ID</th>
                            <th className="p-3 border-b border-slate-200">Payload (Preview)</th>
                            <th className="p-3 border-b border-slate-200">Response</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {logs.map((log) => (
                            <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-3 w-32">
                                    {log.status === 'pending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"><Clock size={12}/> Pending</span>}
                                    {log.status === 'success' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={12}/> {log.statusCode}</span>}
                                    {log.status === 'error' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={12}/> {log.statusCode || 'Err'}</span>}
                                </td>
                                <td className="p-3 font-mono text-slate-500">#{log.id + 1}</td>
                                <td className="p-3 max-w-xs truncate font-mono text-xs text-slate-600" title={JSON.stringify(log.data)}>
                                    {Object.values(log.data).join(', ')}
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
    </div>
  );
};

export default JobRunner;