import { useState, useEffect } from 'react';
import { Save, BookOpen, Settings, Plus, Trash2, ChevronDown, ChevronUp, GitBranch, Upload } from 'lucide-react';

type Tab = 'novel' | 'subplots' | 'settings';

interface Subplot {
  id: string;
  title: string;
  description: string;
  characters: string[];
}

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

  // Subplots
  const [subplots, setSubplots] = useState<Subplot[]>([]);
  const [expandedSubplot, setExpandedSubplot] = useState<string | null>(null);
  const [availableCharacters, setAvailableCharacters] = useState<string[]>([]);

  // Appearance
  const [theme, setTheme] = useState('dark');
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontSize, setFontSize] = useState(16);
  
  // AI
  const [aiProvider, setAiProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [xaiApiKey, setXaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [googleModel, setGoogleModel] = useState('gemini-1.5-flash');
  const [openaiModel, setOpenaiModel] = useState('gpt-4-turbo');
  const [anthropicModel, setAnthropicModel] = useState('claude-sonnet-4-20250514');
  const [xaiModel, setXaiModel] = useState('grok-beta');
  const [availableModels, setAvailableModels] = useState<{id: string, name: string}[]>([]);
  const [availableOpenaiModels, setAvailableOpenaiModels] = useState<{id: string, name: string}[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchingOpenaiModels, setFetchingOpenaiModels] = useState(false);

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
    if (aiProvider === 'openai' && apiKey) {
        setFetchingOpenaiModels(true);
        // @ts-ignore
        window.ipcRenderer.invoke('list-openai-models', apiKey)
            .then((res: any) => {
                if (res.success) {
                    setAvailableOpenaiModels(res.models);
                }
            })
            .catch(() => {})
            .finally(() => setFetchingOpenaiModels(false));
    }
  }, [aiProvider, apiKey]);

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
            setSubplots(Array.isArray(s.subplots) ? s.subplots : []);

            setTheme(s.theme || 'dark');
            setFontFamily(s.fontFamily || 'sans-serif');
            setFontSize(s.fontSize || 16);
            
            setAiProvider(s.aiProvider || 'openai');
            setApiKey(s.apiKey || '');
            setGoogleApiKey(s.googleApiKey || '');
            setXaiApiKey(s.xaiApiKey || '');
            setAnthropicApiKey(s.anthropicApiKey || '');
            if (s.googleModel) setGoogleModel(s.googleModel);
            if (s.openaiModel) setOpenaiModel(s.openaiModel);
            if (s.anthropicModel) setAnthropicModel(s.anthropicModel);
            if (s.xaiModel) setXaiModel(s.xaiModel);
        }
        // @ts-ignore
        const charsResult = await window.ipcRenderer.invoke('list-characters');
        if (charsResult.success) {
            setAvailableCharacters(charsResult.characters);
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
        subplots,
        theme, 
        fontFamily, 
        fontSize, 
        aiProvider,
        apiKey,
        googleApiKey,
        xaiApiKey,
        anthropicApiKey,
        googleModel,
        openaiModel,
        anthropicModel,
        xaiModel
    });
  };

  const handleImportLlmSettings = async () => {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('import-llm-settings');
    if (!result.success) {
        if (result.cancelled) return;
        alert(result.error || 'Failed to import LLM settings.');
        return;
    }
    const s = result.settings;
    setAiProvider(s.aiProvider);
    setApiKey(s.apiKey || '');
    setGoogleApiKey(s.googleApiKey || '');
    setXaiApiKey(s.xaiApiKey || '');
    setAnthropicApiKey(s.anthropicApiKey || '');
    if (s.openaiModel) setOpenaiModel(s.openaiModel);
    if (s.googleModel) setGoogleModel(s.googleModel);
    if (s.anthropicModel) setAnthropicModel(s.anthropicModel);
    if (s.xaiModel) setXaiModel(s.xaiModel);
  };

  const addSubplot = () => {
    const newId = crypto.randomUUID();
    setSubplots(prev => [...prev, { id: newId, title: '', description: '', characters: [] }]);
    setExpandedSubplot(newId);
  };

  const removeSubplot = (id: string) => {
    setSubplots(prev => prev.filter(s => s.id !== id));
    if (expandedSubplot === id) setExpandedSubplot(null);
  };

  const updateSubplotDescription = (id: string, description: string) => {
    setSubplots(prev => prev.map(s => s.id === id ? { ...s, description } : s));
  };

  const updateSubplotTitle = (id: string, title: string) => {
    setSubplots(prev => prev.map(s => s.id === id ? { ...s, title } : s));
  };

  const toggleSubplotCharacter = (subplotId: string, character: string) => {
    setSubplots(prev => prev.map(s => {
      if (s.id !== subplotId) return s;
      const has = s.characters.includes(character);
      return { ...s, characters: has ? s.characters.filter(c => c !== character) : [...s.characters, character] };
    }));
  };

  const inputClass = "w-full bg-white dark:bg-neutral-800 border-l-2 border-blue-500 p-3 text-gray-900 dark:text-white focus:outline-none transition-colors";
  const inputClassMuted = "w-full bg-white dark:bg-neutral-800 border-l-2 border-gray-300 dark:border-neutral-700 p-3 text-gray-900 dark:text-white focus:outline-none transition-colors placeholder-gray-400 dark:placeholder-neutral-600";
  const labelClass = "block text-sm text-gray-600 dark:text-neutral-300 mb-1";

  if (loading) return null;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-neutral-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-900 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Project Settings</h2>
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
            onClick={() => setActiveTab('subplots')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'subplots'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'
            }`}
          >
            <GitBranch size={15} />
            Subplots
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
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* === NOVEL TAB === */}
          {activeTab === 'novel' && (
            <div className="p-6 space-y-5 flex flex-col h-full">
              <div className="shrink-0">
                <label className={labelClass}>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="The name of your novel..."
                  className={inputClass}
                />
              </div>
              <div className="shrink-0">
                <label className={labelClass}>Subtitle</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="An optional subtitle..."
                  className={inputClassMuted}
                />
              </div>
              <div className="shrink-0">
                <label className={labelClass}>Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name or pen name..."
                  className={inputClass}
                />
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <label className={`${labelClass} shrink-0`}>Plot</label>
                <textarea
                  value={plot}
                  onChange={(e) => setPlot(e.target.value)}
                  placeholder="Summarise the overall plot of your novel. This is used by the AI to provide better context-aware assistance..."
                  className={`${inputClass} flex-1 resize-none leading-relaxed min-h-[100px]`}
                />
              </div>
            </div>
          )}

          {/* === SUBPLOTS TAB === */}
          {activeTab === 'subplots' && (
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Subplots</h3>
                <button
                  onClick={addSubplot}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition-colors"
                >
                  <Plus size={14} /> Add Subplot
                </button>
              </div>

              {subplots.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-neutral-500 italic">No subplots yet. Click "Add Subplot" to create one.</p>
              )}

              {subplots.map((subplot, idx) => (
                <div key={subplot.id} className="border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-900">
                  {/* Subplot header */}
                  <div
                    className="flex items-center justify-between px-3 py-2 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => setExpandedSubplot(expandedSubplot === subplot.id ? null : subplot.id)}
                  >
                    <span className="text-sm text-gray-700 dark:text-neutral-200 truncate flex-1">
                      {subplot.title || `Subplot ${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSubplot(subplot.id); }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove subplot"
                      >
                        <Trash2 size={14} />
                      </button>
                      {expandedSubplot === subplot.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </div>

                  {/* Subplot body (expanded) */}
                  {expandedSubplot === subplot.id && (
                    <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-neutral-700">
                      <div className="mt-2">
                        <label className={labelClass}>Title</label>
                        <input
                          type="text"
                          value={subplot.title}
                          onChange={(e) => updateSubplotTitle(subplot.id, e.target.value)}
                          placeholder="A short name for this subplot..."
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Description</label>
                        <textarea
                          value={subplot.description}
                          onChange={(e) => updateSubplotDescription(subplot.id, e.target.value)}
                          placeholder="Describe this subplot..."
                          className={`${inputClass} resize-none min-h-[60px]`}
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Characters</label>
                        {availableCharacters.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-neutral-500 italic">No characters in project yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {availableCharacters.map(char => {
                              const selected = subplot.characters.includes(char);
                              return (
                                <button
                                  key={char}
                                  onClick={() => toggleSubplotCharacter(subplot.id, char)}
                                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                                    selected
                                      ? 'bg-blue-600 border-blue-500 text-white'
                                      : 'bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-300 hover:border-blue-400'
                                  }`}
                                >
                                  {char}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">AI Integration</h3>
                  <button
                    onClick={handleImportLlmSettings}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 text-gray-600 dark:text-neutral-300 transition-colors"
                  >
                    <Upload size={12} /> Import from Project…
                  </button>
                </div>
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
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="xai">xAI (Grok)</option>
                  </select>
                </div>

                {aiProvider === 'openai' && (
                  <div className="space-y-4">
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
                    <div>
                      <label className={labelClass}>
                        Model
                        {fetchingOpenaiModels && <span className="ml-2 text-xs text-gray-400 dark:text-neutral-500">(Loading models...)</span>}
                      </label>
                      <select
                        value={openaiModel}
                        title="Select OpenAI model"
                        onChange={(e) => setOpenaiModel(e.target.value)}
                        disabled={fetchingOpenaiModels || availableOpenaiModels.length === 0}
                        className={`${inputClass} disabled:opacity-50`}
                      >
                        {availableOpenaiModels.length > 0 ? (
                          availableOpenaiModels.map(model => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))
                        ) : (
                          <option value={openaiModel}>{openaiModel || 'Enter API Key to load models'}</option>
                        )}
                      </select>
                    </div>
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
                        title="Select generative model"
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

                {aiProvider === 'anthropic' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Anthropic API Key</label>
                      <input 
                        type="password"
                        value={anthropicApiKey}
                        onChange={(e) => setAnthropicApiKey(e.target.value)}
                        placeholder="sk-ant-..."
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Model</label>
                      <select
                        value={anthropicModel}
                        title="Select Claude model"
                        onChange={(e) => setAnthropicModel(e.target.value)}
                        className={inputClass}
                      >
                        <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                        <option value="claude-opus-4-20250514">Claude Opus 4</option>
                        <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</option>
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                      </select>
                    </div>
                  </div>
                )}

                {aiProvider === 'xai' && (
                  <div className="space-y-4">
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
                    <div>
                      <label className={labelClass}>xAI Model</label>
                      <select
                        value={xaiModel}
                        onChange={(e) => setXaiModel(e.target.value)}
                        className={inputClass}
                        title="xAI Model"
                      >
                        <option value="grok-3">Grok 3</option>
                        <option value="grok-3-fast">Grok 3 Fast</option>
                        <option value="grok-3-mini">Grok 3 Mini</option>
                        <option value="grok-3-mini-fast">Grok 3 Mini Fast</option>
                        <option value="grok-2">Grok 2</option>
                        <option value="grok-2-mini">Grok 2 Mini</option>
                        <option value="grok-beta">Grok Beta</option>
                      </select>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 dark:text-neutral-500">Keys are stored locally in your project's .env file</p>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-300 dark:border-neutral-700 flex justify-end gap-2 bg-gray-100 dark:bg-neutral-900 shrink-0">
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
  );
}
