import React, { useState } from 'react';
import { AppStep, ApiConfig, CsvRow, Mapping } from './types';
import CurlImporter from './components/CurlImporter';
import DataMapper from './components/DataMapper';
import JobRunner from './components/JobRunner';
import { CloudLightning } from 'lucide-react';

function App() {
  const [step, setStep] = useState<AppStep>(AppStep.CONFIGURE);
  
  // State for the wizard
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [bulkData, setBulkData] = useState<CsvRow[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  const handleConfigParsed = (config: ApiConfig) => {
    setApiConfig(config);
    setStep(AppStep.DATA_ENTRY);
  };

  const handleDataReady = (data: CsvRow[], maps: Mapping[]) => {
    setBulkData(data);
    setMappings(maps);
    setStep(AppStep.EXECUTE);
  };

  return (
    <div className="min-h-screen flex flex-col">
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
          <div className="flex items-center gap-2 text-sm">
             <StepIndicator current={step} step={1} label="Config" />
             <div className="w-8 h-px bg-slate-300"></div>
             <StepIndicator current={step} step={2} label="Map Data" />
             <div className="w-8 h-px bg-slate-300"></div>
             <StepIndicator current={step} step={3} label="Execute" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 p-6 md:p-12 overflow-x-hidden">
        {step === AppStep.CONFIGURE && (
          <CurlImporter onConfigParsed={handleConfigParsed} />
        )}
        
        {step === AppStep.DATA_ENTRY && apiConfig && (
          <DataMapper 
            apiConfig={apiConfig} 
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
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-400 text-sm">
        <p>© {new Date().getFullYear()} AutoAPI Pusher. Powered by Gemini.</p>
      </footer>
    </div>
  );
}

const StepIndicator: React.FC<{current: number, step: number, label: string}> = ({ current, step, label }) => {
    const isActive = current === step;
    const isCompleted = current > step;
    
    return (
        <div className={`flex items-center gap-2 ${isActive ? 'text-indigo-600 font-bold' : isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${
                isActive ? 'border-indigo-600 bg-indigo-50' : 
                isCompleted ? 'border-green-600 bg-green-50' : 'border-slate-300 bg-white'
            }`}>
                {isCompleted ? '✓' : step}
            </div>
            <span>{label}</span>
        </div>
    )
}

export default App;
