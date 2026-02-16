import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onSave: (settings: any) => void;
}

export function SettingsModal({ onClose, onSave }: SettingsModalProps) {
  const [theme, setTheme] = useState('dark');
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontSize, setFontSize] = useState(16);
  
  const [aiProvider, setAiProvider] = useState('openai');
  const [apiKey, setApiKey] = useState(''); // OpenAI
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [xaiApiKey, setXaiApiKey] = useState('');

  const [googleModel, setGoogleModel] = useState('gemini-1.5-flash');
  const [availableModels, setAvailableModels] = useState<{id: string, name: string}[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (aiProvider === 'google' && googleApiKey) {
        setFetchingModels(true);
        // @ts-ignore
        window.ipcRenderer.invoke('list-google-models', googleApiKey)
            .then((res: any) => {
                if (res.success) {
                    setAvailableModels(res.models);
                }
            })
            .catch(() => {}) 
            .finally(() => setFetchingModels(false));
    }
  }, [aiProvider, googleApiKey]);

  useEffect(() => {
    // Load current settings
    const loadSettings = async () => {
        // @ts-ignore
        const result = await window.ipcRenderer.invoke('get-project-settings');
        if (result.success && result.settings) {
            setTheme(result.settings.theme);
            setFontFamily(result.settings.fontFamily);
            setFontSize(result.settings.fontSize);
            
            setAiProvider(result.settings.aiProvider || 'openai');
            setApiKey(result.settings.apiKey || '');
            setGoogleApiKey(result.settings.googleApiKey || '');
            setXaiApiKey(result.settings.xaiApiKey || '');
            if (result.settings.googleModel) {
                setGoogleModel(result.settings.googleModel);
            }
        }
        setLoading(false);
    };
    loadSettings();
  }, []);

  const handleSave = () => {
    onSave({ 
        theme, 
        fontFamily, 
        fontSize, 
        aiProvider,
        apiKey,
        googleApiKey,
        xaiApiKey,
        googleModel
    });
  };

  if(loading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50">
      <div className="bg-neutral-800 border border-neutral-700 w-[500px] rounded-lg shadow-2xl flex flex-col max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700 bg-neutral-900 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-white">Project Settings</h2>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
            title="Close Settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
            
            {/* Appearance */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Appearance</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-neutral-300 mb-1">Theme</label>
                        <select 
                            value={theme}
                            title="Select Theme"
                            onChange={(e) => setTheme(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-blue-500"
                        >
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm text-neutral-300 mb-1">Font Size (px)</label>
                        <input 
                            type="number"
                            title="Font Size"
                            placeholder="16"
                            value={fontSize}
                            onChange={(e) => setFontSize(Number(e.target.value))}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                 <div>
                    <label className="block text-sm text-neutral-300 mb-1">Editor Font Family</label>
                    <input 
                        type="text"
                        title="Font Family"
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        placeholder="sans-serif, Merriweather, etc."
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* AI Settings */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">AI Integration</h3>
                
                <div>
                     <label className="block text-sm text-neutral-300 mb-1">AI Provider</label>
                     <select 
                        value={aiProvider}
                        title="Select AI Provider"
                        onChange={(e) => setAiProvider(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-blue-500 mb-4"
                     >
                         <option value="openai">OpenAI (GPT-4)</option>
                         <option value="google">Google Gemini</option>
                         <option value="xai">xAI (Grok)</option>
                     </select>
                </div>

                {/* Conditional Inputs */}
                {aiProvider === 'openai' && (
                    <div>
                        <label className="block text-sm text-neutral-300 mb-1">OpenAI API Key</label>
                        <input 
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-blue-500 font-mono"
                        />
                    </div>
                )}
                
                {aiProvider === 'google' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-neutral-300 mb-1">Google Gemini API Key</label>
                            <input 
                                type="password"
                                value={googleApiKey}
                                onChange={(e) => setGoogleApiKey(e.target.value)}
                                placeholder="AIza..."
                                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-blue-500 font-mono"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm text-neutral-300 mb-1">
                                Generative Model
                                {fetchingModels && <span className="ml-2 text-xs text-neutral-500">(Loading models...)</span>}
                            </label>
                            <select 
                                value={googleModel}
                                onChange={(e) => setGoogleModel(e.target.value)}
                                disabled={fetchingModels || availableModels.length === 0}
                                className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                {availableModels.length > 0 ? (
                                    availableModels.map(model => (
                                        <option key={model.id} value={model.id}>
                                            {model.name.replace('models/', '')} ({model.id.replace('models/', '')})
                                        </option>
                                    ))
                                ) : (
                                    <option value={googleModel}>{googleModel || 'Enter API Key to load models'}</option>
                                )}
                            </select>
                        </div>
                    </div>
                )}

                {aiProvider === 'xai' && (
                    <div>
                        <label className="block text-sm text-neutral-300 mb-1">xAI API Key (Grok)</label>
                        <input 
                            type="password"
                            value={xaiApiKey}
                            onChange={(e) => setXaiApiKey(e.target.value)}
                            placeholder="xai-..."
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-white text-sm outline-none focus:border-blue-500 font-mono"
                        />
                    </div>
                )}


                <p className="text-xs text-neutral-500 mt-1">Keys are stored locally in your project's .env file</p>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-700 flex justify-end gap-2 bg-neutral-900 rounded-b-lg shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded text-sm hover:bg-neutral-800 text-neutral-300 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Save size={16} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
