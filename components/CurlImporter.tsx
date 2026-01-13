import React, { useState } from 'react';
import { parseCurlWithGemini } from '../services/aiService';
import { ApiConfig } from '../types';
import { Terminal, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  initialCurl?: string;
  onConfigParsed: (config: ApiConfig, rawCurl: string) => void;
}

const CurlImporter: React.FC<Props> = ({ initialCurl = '', onConfigParsed }) => {
  const [curlText, setCurlText] = useState(initialCurl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!curlText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const config = await parseCurlWithGemini(curlText);
      onConfigParsed(config, curlText);
    } catch (e: any) {
      setError(e.message || "Failed to parse cURL.");
    } finally {
      setLoading(false);
    }
  };

  const sampleCurl = `curl -X POST https://api.example.com/products \\
  -H "Authorization: Bearer 12345" \\
  -H "Content-Type: application/json" \\
  -d '{"sku": "ABC-123", "name": "Sample Product", "price": 100}'`;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <Terminal size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">API Configuration</h2>
            <p className="text-slate-500 text-sm">Paste a cURL command to automatically extract endpoint and headers.</p>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="relative">
            <textarea
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              placeholder={`Paste your cURL here...\n\nExample:\n${sampleCurl}`}
              className="w-full h-48 font-mono text-sm bg-slate-900 text-slate-50 p-4 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              spellCheck={false}
            />
            {error && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-500/10 border border-red-500/20 text-red-600 p-3 rounded flex items-start gap-2 text-sm backdrop-blur-sm">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="break-words max-h-20 overflow-y-auto w-full">{error}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleParse}
              disabled={loading || !curlText.trim()}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                loading || !curlText.trim()
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Analyzing cURL...
                </>
              ) : (
                <>
                  Parse Configuration
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurlImporter;