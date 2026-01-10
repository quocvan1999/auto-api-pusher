import React, { useState } from 'react';
import { Key, ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';

interface Props {
  onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<Props> = ({ onSave }) => {
  const [inputKey, setInputKey] = useState('');

  const handleSave = () => {
    if (inputKey.trim()) {
      onSave(inputKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white text-center">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <Key size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold">Cấu hình API Key</h2>
          <p className="text-blue-100 text-sm mt-2">Nhập Google Gemini API Key để tiếp tục</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block">API Key của bạn</label>
            <input 
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-800"
              autoFocus
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-xl flex gap-3 items-start">
             <ShieldCheck size={20} className="text-blue-600 shrink-0 mt-0.5" />
             <p className="text-xs text-blue-700 leading-relaxed">
               Key của bạn được lưu cục bộ trong trình duyệt (LocalStorage) và gửi trực tiếp đến Google Servers. Chúng tôi không lưu trữ key này.
             </p>
          </div>

          <button 
            onClick={handleSave}
            disabled={!inputKey.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bắt đầu sử dụng
            <ArrowRight size={20} />
          </button>

          <div className="text-center">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors"
            >
              Chưa có key? Lấy miễn phí tại đây <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;