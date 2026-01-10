import React, { useState, useEffect } from 'react';
import { AppStep, ApiConfig, CsvRow, Mapping } from './types';
import CurlImporter from './components/CurlImporter';
import DataMapper from './components/DataMapper';
import JobRunner from './components/JobRunner';
import ApiKeyModal from './components/ApiKeyModal';
import { CloudLightning, Key } from 'lucide-react';

function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [step, setStep] = useState<AppStep>(AppStep.CONFIGURE);
  
  // State for the wizard
  const [curlCommand, setCurlCommand] = useState<string>('');
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [bulkData, setBulkData] = useState<CsvRow[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const handleSaveKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const handleClearKey = () => {
    if (window.confirm("Bạn có chắc muốn xóa API Key khỏi trình duyệt?")) {
        setApiKey('');
        localStorage.removeItem('gemini_api_key');
        setStep(AppStep.CONFIGURE);
    }
  };

  const handleConfigParsed = (config: ApiConfig, rawCurl: string) => {
    setApiConfig(config);
    setCurlCommand(rawCurl);
    setStep(AppStep.DATA_ENTRY);
  };

  const handleDataReady = (data: CsvRow[], maps: Mapping[]) => {
    setBulkData(data);
    setMappings(maps);
    setStep(AppStep.EXECUTE);
  };

  const canNavigateTo = (targetStep: AppStep) => {
      if (!apiKey) return false;
      if (targetStep === AppStep.CONFIGURE) return true;
      if (targetStep === AppStep.DATA_ENTRY) return !!apiConfig;
      if (targetStep === AppStep.EXECUTE) return !!apiConfig && bulkData.length > 0;
      return false;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {!apiKey && <ApiKeyModal onSave={handleSaveKey} />}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <CloudLightning className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-blue-600 bg-clip-text text-transparent">
              AutoAPI Pusher
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
             <div className="hidden md:flex items-center gap-2">
                 <StepIndicator 
                    current={step} 
                    step={1} 
                    label="Config" 
                    onClick={() => canNavigateTo(AppStep.CONFIGURE) && setStep(AppStep.CONFIGURE)}
                    enabled={canNavigateTo(AppStep.CONFIGURE)}
                 />
                 <div className="w-8 h-px bg-slate-300"></div>
                 <StepIndicator 
                    current={step} 
                    step={2} 
                    label="Map Data" 
                    onClick={() => canNavigateTo(AppStep.DATA_ENTRY) && setStep(AppStep.DATA_ENTRY)}
                    enabled={canNavigateTo(AppStep.DATA_ENTRY)}
                 />
                 <div className="w-8 h-px bg-slate-300"></div>
                 <StepIndicator 
                    current={step} 
                    step={3} 
                    label="Execute" 
                    onClick={() => canNavigateTo(AppStep.EXECUTE) && setStep(AppStep.EXECUTE)}
                    enabled={canNavigateTo(AppStep.EXECUTE)}
                 />
             </div>

             {apiKey && (
                 <button 
                    onClick={handleClearKey}
                    className="ml-4 flex items-center gap-1.5 text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
                    title="Change API Key"
                 >
                     <Key size={14} />
                     <span className="hidden sm:inline">API Key</span>
                 </button>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 p-6 md:p-12 overflow-x-hidden relative">
        <div className={`${!apiKey ? 'blur-sm pointer-events-none select-none' : ''} transition-all duration-500`}>
            {step === AppStep.CONFIGURE && (
            <CurlImporter 
                apiKey={apiKey} 
                initialCurl={curlCommand}
                onConfigParsed={handleConfigParsed} 
            />
            )}
            
            {step === AppStep.DATA_ENTRY && apiConfig && (
            <DataMapper 
                apiConfig={apiConfig} 
                initialData={bulkData}
                initialMappings={mappings}
                onBack={() => setStep(AppStep.CONFIGURE)}
                onNext={handleDataReady}
            />
            )}

            {step === AppStep.EXECUTE && apiConfig && (
            <JobRunner 
                apiConfig={apiConfig}
                data={bulkData}
                mappings={mappings}
                onBack={() => setStep(AppStep.DATA_ENTRY)}
            />
            )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-400 text-sm">
        <p>© {new Date().getFullYear()} AutoAPI Pusher. Powered by Gemini.</p>
      </footer>
    </div>
  );
}

const StepIndicator: React.FC<{
    current: number, 
    step: number, 
    label: string, 
    onClick?: () => void,
    enabled?: boolean
}> = ({ current, step, label, onClick, enabled }) => {
    const isActive = current === step;
    const isCompleted = current > step;
    const isClickable = enabled && !isActive;
    
    return (
        <div 
            onClick={isClickable ? onClick : undefined}
            className={`flex items-center gap-2 transition-colors ${
                isActive ? 'text-indigo-600 font-bold' : 
                isCompleted ? 'text-green-600' : 
                enabled ? 'text-slate-600' : 'text-slate-300'
            } ${isClickable ? 'cursor-pointer hover:text-indigo-600' : 'cursor-default'}`}
        >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border transition-colors ${
                isActive ? 'border-indigo-600 bg-indigo-50' : 
                isCompleted ? 'border-green-600 bg-green-50' : 
                enabled ? 'border-slate-400 bg-white hover:border-indigo-400' : 'border-slate-200 bg-slate-50'
            }`}>
                {isCompleted ? '✓' : step}
            </div>
            <span>{label}</span>
        </div>
    )
}

export default App;