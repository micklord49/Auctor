import { useState, useEffect } from 'react';
import { X, Save, BookOpen, Settings } from 'lucide-react';

type Tab = 'novel' | 'settings';

interface SettingsModalProps {
  onClose: () => void;
  onSave: (settings: any) => void;
}

export function SettingsModal({ onClose, onSave }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('novel');

  // Novel Info
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [plot, setPlot] = useState('');

  // Appearance
  const [theme, setTheme] = useState('dark');
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontSize, setFontSize] = useState(16);
  
  // AI
  const [aiProvider, setAiProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
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
    const loadSettings = async () => {
        // @ts-ignore
        const result = await window.ipcRenderer.invoke('get-project-settings');
        if (result.success && result.settings) {
            const s = result.settings;
            setTitle(s.title || '');
            setSubtitle(s.subtitle || '');
            setAuthor(s.author || '');
            setPlot(s.plot || '');

            setTheme(s.theme || 'dark');
            setFontFamily(s.fontFamily || 'sans-serif');
            setFontSize(s.fontSize || 16);
            
            setAiProvider(s.aiProvider || 'openai');
            setApiKey(s.apiKey || '');
            setGoogleApiKey(s.googleApiKey || '');
            setXaiApiKey(s.xaiApiKey || '');
            if (s.googleModel) setGoogleModel(s.googleModel);
        }
        setLoading(false);
    };
    loadSettings();
  }, []);

  const handleSave = () => {
    onSave({ 
        title,
        subtitle,
        author,
        plot,
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

  const inputClass = "w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded px-3 py-2 text-gray-900 dark:text-white text-sm outline-none focus:border-blue-500 transition-colors";
  const labelClass = "block text-sm text-gray-600 dark:text-neutral-300 mb-1";

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-16 z-50">
      <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 w-[560px] rounded-lg shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-900 rounded-t-lg shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Project Settings</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="Close Settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-300 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-900 shrink-0">
          <button
            onClick={() => setActiveTab('novel')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'novel'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
            }`}
          >
            <BookOpen size={15} />
            Novel
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
            }`}
          >
            <Settings size={15} />
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">

          {/* === NOVEL TAB === */}
          {activeTab === 'novel' && (
            <div className="p-6 space-y-5">
              <div>
                <label className={labelClass}>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="The name of your novel..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Subtitle</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="An optional subtitle..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name or pen name..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Plot</label>
                <textarea
                  value={plot}
                  onChange={(e) => setPlot(e.target.value)}
                  placeholder="Summarise the overall plot of your novel. This is used by the AI to provide better context-aware assistance..."
                  rows={7}
                  className={`${inputClass} resize-none leading-relaxed`}
                />
              </div>
            </div>
          )}

          {/* === SETTINGS TAB === */}
          {activeTab === 'settings' && (
            <div className="p-6 space-y-6">

              {/* Appearance */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Appearance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Theme</label>
                    <select 
                      value={theme}
                      title="Select Theme"
                      onChange={(e) => setTheme(e.target.value)}
                      className={inputClass}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Font Size (px)</label>
                    <input 
                      type="number"
                      title="Font Size"
                      placeholder="16"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Editor Font Family</label>
                  <input 
                    type="text"
                    title="Font Family"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    placeholder="sans-serif, Merriweather, etc."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* AI Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">AI Integration</h3>
                <div>
                  <label className={labelClass}>AI Provider</label>
                  <select 
                    value={aiProvider}
                    title="Select AI Provider"
                    onChange={(e) => setAiProvider(e.target.value)}
                    className={inputClass}
                  >
                    <option value="openai">OpenAI (GPT-4)</option>
                    <option value="google">Google Gemini</option>
                    <option value="xai">xAI (Grok)</option>
                  </select>
                </div>

                {aiProvider === 'openai' && (
                  <div>
                    <label className={labelClass}>OpenAI API Key</label>
                    <input 
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                )}
                
                {aiProvider === 'google' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Google Gemini API Key</label>
                      <input 
                        type="password"
                        value={googleApiKey}
                        onChange={(e) => setGoogleApiKey(e.target.value)}
                        placeholder="AIza..."
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Generative Model
                        {fetchingModels && <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500">(Loading models...)</span>}
                      </label>
                      <select 
                        value={googleModel}
                        onChange={(e) => setGoogleModel(e.target.value)}
                        disabled={fetchingModels || availableModels.length === 0}
                        className={`${inputClass} disabled:opacity-50`}
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
                    <label className={labelClass}>xAI API Key (Grok)</label>
                    <input 
                      type="password"
                      value={xaiApiKey}
                      onChange={(e) => setXaiApiKey(e.target.value)}
                      placeholder="xai-..."
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                )}

                <p className="text-xs text-gray-400 dark:text-neutral-500">Keys are stored locally in your project's .env file</p>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-300 dark:border-neutral-700 flex justify-end gap-2 bg-gray-100 dark:bg-neutral-900 rounded-b-lg shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded text-sm hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-300 transition-colors"
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
