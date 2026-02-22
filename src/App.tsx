import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2, Plus } from "lucide-react";
import { FileTree } from "./components/FileTree";
import { Editor } from "./components/Editor";
import { NewProjectModal } from "./components/NewProjectModal";
import { CharacterCard } from "./components/CharacterCard";
import { ChapterCard } from "./components/ChapterCard";
import { PlaceCard } from "./components/PlaceCard";
import { ObjectCard } from "./components/ObjectCard";
import { AIChatPanel } from "./components/AIChatPanel";
import { SettingsModal } from "./components/SettingsModal";

function App() {
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeFile, setActiveFile] = useState<{ name: string; content: string } | null>(null);
  const [forcedChapterTab, setForcedChapterTab] = useState<'text' | 'settings' | 'critique' | undefined>(undefined);

  const activeFileRef = useRef(activeFile);
  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  
  // Clear forced tab when file changes
  useEffect(() => {
      setForcedChapterTab(undefined);
  }, [activeFile?.name]);

  const [editorSettings, setEditorSettings] = useState({ theme: 'dark', fontFamily: 'sans-serif', fontSize: 16 });
  
  // Use settings to avoid unused var warning (and actually apply font settings eventually)
  useEffect(() => {
     // Apply font settings globally or to relevant container if needed
     document.documentElement.style.setProperty('--editor-font-family', editorSettings.fontFamily);
     document.documentElement.style.setProperty('--editor-font-size', `${editorSettings.fontSize}px`);
  }, [editorSettings]);

  // Listen for menu events
  useEffect(() => {
    const removeSettings = window.ipcRenderer.on('open-settings', () => {
        console.log("App: open-settings event received");
        setShowSettingsModal(true);
    });
    const removeNewProject = window.ipcRenderer.on('new-project', () => {
        console.log("App: new-project event received");
        setShowNewProjectModal(true);
    });

    const removeSave = window.ipcRenderer.on('save-current-file', async () => {
        const file = activeFileRef.current;
        if (file) {
            console.log("App: Saving file", file.name);
            await window.ipcRenderer.invoke('save-file', file.name, file.content);
        }
    });
    
    // Initial load of settings
    loadSettings();

    return () => { 
        console.log("App: Cleaning up listeners");
        removeSettings();
        removeNewProject();
        removeSave();
    };
  }, []);

  const loadSettings = async () => {
       // @ts-ignore
       const result = await window.ipcRenderer.invoke('get-project-settings');
       if(result.success && result.settings) {
           setEditorSettings(result.settings);
           // Apply Theme via Tailwind's dark mode class strategy
           if(result.settings.theme === 'light') {
               document.documentElement.classList.remove('dark');
           } else {
               document.documentElement.classList.add('dark');
           }
       }
  };

  const handleCreateProject = async (data: { name: string; location: string; overview: string }) => {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('create-project', data);
    if(result.success) {
      setShowNewProjectModal(false);
      setRefreshTrigger(prev => prev + 1); // Force FileTree refresh
      setActiveFile(null);
    } else {
      alert("Failed to create project: " + result.error);
    }
  };

  const handleFileSelect = async (filePath: string) => {
      // filePath comes from FileTree as "Category/File.ext"
      
      // @ts-ignore
      const result = await window.ipcRenderer.invoke('read-file', filePath);
      if (result.success) {
          setActiveFile({ name: filePath, content: result.content });
      } else {
          console.error("Failed to read file");
      }
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const ce = event as CustomEvent<{ path?: string }>;
      const path = ce.detail?.path;
      if (path) {
        handleFileSelect(path);
      }
    };
    window.addEventListener('auctor-open-file', handler as EventListener);
    return () => window.removeEventListener('auctor-open-file', handler as EventListener);
  }, []);

  const handleSaveFile = async (content: string) => {
      if (!activeFile) return;
      
      // activeFile.name holds the relative path now
      const relativePath = activeFile.name;
      
      // @ts-ignore
      await window.ipcRenderer.invoke('save-file', relativePath, content);
      // update local content state just in case
      setActiveFile({ ...activeFile, content });
  };

  const handleCritiqueReceived = (critiqueText: string) => {
      if(!activeFile || (!activeFile.name.includes('Chapters/') && !activeFile.name.endsWith('.md'))) {
          alert("Please select a valid chapter file first.");
          return;
      }

      // We need to inject the critique into the file content
      const content = activeFile.content || '';
      const textMatch = content.match(/<text>([\s\S]*?)<\/text>/);
      const settingsMatch = content.match(/<settings>([\s\S]*?)<\/settings>/);
      
      let newContent = '';
      if (textMatch) newContent += `<text>${textMatch[1]}</text>\n`;
      else newContent += `<text>${content}</text>\n`; // Fallback if no tags

      if (settingsMatch) newContent += `<settings>${settingsMatch[1]}</settings>\n`;
      else newContent += `<settings></settings>\n`;

      newContent += `<critique>\n${critiqueText}\n</critique>`;
      
      // Update file content
      setActiveFile({ ...activeFile, content: newContent });
      handleSaveFile(newContent);
      
      // Force switch tab
      setForcedChapterTab('critique');
      // Reset after a moment so user can switch back? 
      // Actually ChapterCard listens to prop changes, so it sets active tab.
      // If user clicks another tab, ChapterCard state updates. 
      // If we keep passing 'critique' prop, does it lock it?
      // ChapterCard's useEffect([forceTab]) will fire only when forceTab changes.
      // But if we pass hardcoded 'critique', it might re-fire on every render?
      // No, only when prop changes. 
      // But to be safe, we might want to clear it after render? 
      // Let's rely on ChapterCard handling.
      setTimeout(() => setForcedChapterTab(undefined), 500);
  };

  return (
    <div className="h-screen w-screen bg-white text-black dark:bg-neutral-900 dark:text-white flex flex-col font-sans">
      {/* Top Bar / Menu (Placeholder) */}
      <div className="h-8 bg-gray-100 dark:bg-neutral-950 flex items-center justify-between px-4 border-b border-gray-300 dark:border-neutral-800 text-sm text-neutral-500 dark:text-neutral-400 select-none">
        <div className="flex items-center gap-4">
           <span className="font-semibold">Auctor</span>
           <button 
             onClick={() => setShowNewProjectModal(true)}
             className="flex items-center gap-1 hover:text-black dark:hover:text-white transition-colors text-xs"
           >
             <Plus size={12} /> New Project
           </button>
        </div>
        
        <button 
          onClick={() => setFocusMode(!focusMode)}
          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors ${focusMode ? 'text-blue-500' : 'text-neutral-500'}`}
          title={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
        >
          {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {showNewProjectModal && (
        <NewProjectModal 
          onConfirm={handleCreateProject} 
          onCancel={() => setShowNewProjectModal(false)} 
        />
      )}

      {showSettingsModal && (
          <SettingsModal 
            onClose={() => setShowSettingsModal(false)}
            onSave={async (settings) => {
                // @ts-ignore
                await window.ipcRenderer.invoke('save-project-settings', settings);
                setShowSettingsModal(false);
                loadSettings();
            }}
          />
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="persistence">
          {/* Left Sidebar (Explorer) */}
          {!focusMode && (
            <>
              <Panel defaultSize={20} minSize={10} maxSize={30} className="bg-gray-50 dark:bg-neutral-900 flex flex-col border-r border-gray-200 dark:border-neutral-800">
                <FileTree 
                    key={refreshTrigger} 
                    onSelectFile={handleFileSelect}
                    activeFile={activeFile?.name}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-gray-300 dark:bg-neutral-950 hover:bg-blue-600 transition-colors" />
            </>
          )}

          {/* Center Panel (Editor) */}
          <Panel minSize={30} className="bg-white dark:bg-neutral-800 flex flex-col">
             {(() => {
                 if (!activeFile) {
                     return (
                        <div className="h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500">
                            <div className="text-center">
                                <h2 className="text-xl font-semibold mb-2">Editor Area</h2>
                                <p>Select a file to start editing</p>
                            </div>
                        </div>
                     );
                 }

                 if ((activeFile.name.includes('Places/') || activeFile.name.includes('Places\\')) && activeFile.name.endsWith('.json')) {
                     return (
                        <PlaceCard 
                            initialContent={activeFile.content} 
                            onSave={handleSaveFile}
                            fileName={activeFile.name.split(/[/\\]/).pop() || activeFile.name}
                            key={activeFile.name} 
                        />
                     );
                 }

                 if ((activeFile.name.includes('Objects/') || activeFile.name.includes('Objects\\')) && activeFile.name.endsWith('.json')) {
                     return (
                        <ObjectCard 
                            initialContent={activeFile.content} 
                            onSave={handleSaveFile}
                            fileName={activeFile.name.split(/[/\\]/).pop() || activeFile.name}
                            key={activeFile.name} 
                        />
                     );
                 }

                 if (activeFile.name.endsWith('.json')) {
                     return (
                        <CharacterCard 
                            initialContent={activeFile.content} 
                            onSave={handleSaveFile}
                            fileName={activeFile.name.split(/[/\\]/).pop() || activeFile.name}
                            key={activeFile.name} // Force re-render when file changes
                        />
                     );
                 }
                 
                 if (activeFile.name.includes('Chapters/') || activeFile.name.includes('Chapters\\') || activeFile.name.endsWith('.md')) {
                     return (
                        <ChapterCard 
                            content={activeFile.content || ''} 
                            key={activeFile.name} 
                            onSave={handleSaveFile}
                            fileName={activeFile.name.split(/[/\\]/).pop() || activeFile.name}
                            forceTab={forcedChapterTab}
                        />
                     );
                 }

                 return (
                    <Editor 
                        content={activeFile.content || ''} 
                        key={activeFile.name} 
                        onChange={(newContent) => setActiveFile({ ...activeFile, content: newContent })}
                        onBlur={(content) => handleSaveFile(content)}
                    />
                 );
             })()}
          </Panel>

          {/* Right Panel (AI Tools/Context) */}
          {!focusMode && (
            <>
              <PanelResizeHandle className="w-1 bg-gray-300 dark:bg-neutral-950 hover:bg-blue-600 transition-colors" />
              <Panel defaultSize={25} minSize={15} maxSize={40} className="bg-gray-50 dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800">
                <AIChatPanel 
                contextContent={activeFile?.content || ''} 
                onCritique={(critique) => handleCritiqueReceived(critique)}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
      
      {/* Status Bar */}
      <div className="h-6 bg-blue-900 flex items-center px-3 text-xs text-blue-100 select-none">
        <span>Ready</span>
      </div>
    </div>
  );
}

export default App;
