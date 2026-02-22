import { useState, useEffect } from 'react';
import { Send, Sparkles, StopCircle } from 'lucide-react';

interface AIChatPanelProps {
  contextContent: string; // The content from the editor
  onCritique?: (critique: string) => void;
}

export function AIChatPanel({ contextContent, onCritique }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
    const [externalThinkingCount, setExternalThinkingCount] = useState(0);

    useEffect(() => {
        // Display a "thinking" bubble for non-chat LLM jobs (e.g. rewrite/make shorter/make longer).
        // @ts-ignore
        const removeStart = window.ipcRenderer.on('rewrite-text-start', () => {
            setExternalThinkingCount((prev) => prev + 1);
        });

        // @ts-ignore
        const removeEnd = window.ipcRenderer.on('rewrite-text-end', () => {
            setExternalThinkingCount((prev) => Math.max(0, prev - 1));
        });

        // @ts-ignore
        const removeError = window.ipcRenderer.on('rewrite-text-error', () => {
            setExternalThinkingCount((prev) => Math.max(0, prev - 1));
        });

        return () => {
            removeStart();
            removeEnd();
            removeError();
        };
    }, []);

  useEffect(() => {
    // Listen for streaming chunks
    // @ts-ignore
    const removeChunkListener = window.ipcRenderer.on('ai-completion-chunk', (event, chunk) => {
       setStreamingContent(prev => prev + chunk);
    });
    
    // @ts-ignore
    const removeEndListener = window.ipcRenderer.on('ai-completion-end', () => {
       setIsLoading(false);
       setMessages(prev => [...prev, { role: 'ai', content: streamingContent }]); // This might be stale due to closure, simpler to separate stream
    });

    // @ts-ignore
    const removeErrorListener = window.ipcRenderer.on('ai-completion-error', (event, error) => {
       setIsLoading(false);
       setMessages(prev => [...prev, { role: 'ai', content: `Error: ${error}` }]);
       setStreamingContent('');
    });

    return () => {
        // invoke the cleanup function returned by our custom preload
        removeChunkListener();
        removeEndListener();
        removeErrorListener();
    };
  }, [streamingContent]); // Dependency helps, but we need to precise logic for "commit stream to message"

  // Refined effect for committing stream
  useEffect(() => {
      // @ts-ignore
      const removeEndListener = window.ipcRenderer.on('ai-completion-end', () => {
         if (streamingContent) {
           setMessages(prev => [...prev, { role: 'ai', content: streamingContent }]);
           
           // Check mode
           const mode = window.sessionStorage.getItem('ai-mode');
           if (mode === 'critique' && onCritique) {
               onCritique(streamingContent);
               window.sessionStorage.removeItem('ai-mode');
           }
           
           setStreamingContent('');
         }
         setIsLoading(false);
      });
      return () => removeEndListener();
  }, [streamingContent, onCritique]);


  const sendMessage = (text: string) => {
      if(!text.trim() && !contextContent) return;
      
      const newMsg = { role: 'user', content: text } as const;
      setMessages(prev => [...prev, newMsg]);
      setInput('');
      setIsLoading(true);
      setStreamingContent('');

      // Construct prompt with context if needed
      // For general chat, we might just send the text.
      // For critique, we send the context.
      
      // If we are doing "Critique", the text param might be empty or specific instruction
      const prompt = text; 
      
      // @ts-ignore
      window.ipcRenderer.send('generate-ai-completion', { prompt });
  };

  const handleCritique = async () => {
      if (!contextContent) {
          alert("No content to critique! Write something first.");
          return;
      }
      
      setMessages(prev => [...prev, { role: 'user', content: "Critique this writing." }]);
      setIsLoading(true);
      setStreamingContent('');
      window.sessionStorage.setItem('ai-mode', 'critique');

      // Fetch project settings (plot, title, author)
      let plotContext = "";
      try {
          // @ts-ignore
          const settingsResult = await window.ipcRenderer.invoke('get-project-settings');
          if (settingsResult.success && settingsResult.settings) {
              const { title, author, plot } = settingsResult.settings;
              let header = '';
              if (title) header += `Novel: ${title}`;
              if (author) header += ` by ${author}`;
              if (header) plotContext += header + '\n';
              if (plot) plotContext += `Plot: ${plot}\n`;
          }
      } catch (err) {
          console.error("Error fetching project settings", err);
      }

      // Parse chapter settings from file content
      let chapterSettingsContext = "";
      const settingsMatch = contextContent.match(/<settings>([\s\S]*?)<\/settings>/);
      if (settingsMatch) {
          try {
              const parsed = JSON.parse(settingsMatch[1].trim());
              if (parsed.summary) chapterSettingsContext += `Chapter Summary: ${parsed.summary}\n`;
              if (parsed.ageOffset && parsed.ageOffset !== '0') chapterSettingsContext += `Age Offset: ${parsed.ageOffset} years\n`;
              if (parsed.style) chapterSettingsContext += `Writing Style Notes: ${parsed.style}\n`;
          } catch {}
      }

      // Load ALL entity files (characters, places, objects)
      let entityContext = "";
      try {
          // @ts-ignore
          const fileList = await window.ipcRenderer.invoke('get-files');
          const entityFiles = fileList.filter((f: any) => 
              (f.path.includes('Characters') || f.path.includes('Places') || f.path.includes('Objects')) &&
              f.name.endsWith('.json')
          );

          const entityLines: string[] = [];
          for (const file of entityFiles) {
              // @ts-ignore
              const result = await window.ipcRenderer.invoke('read-file', file.path);
              if (result.success) {
                  try {
                      const data = JSON.parse(result.content);
                      const name = data.name || file.name.replace('.json', '');
                      const akaStr = data.aka ? ` (aka ${data.aka})` : '';
                      let desc = "";
                      if (file.path.includes('Characters')) {
                          const stage = data.lifeStages?.[0] || {};
                          desc = `[Character: ${name}${akaStr}. Appearance: ${stage.appearance || 'N/A'}. Personality: ${stage.personality || 'N/A'}. Motivation: ${stage.motivation || 'N/A'}]`;
                      } else if (file.path.includes('Places')) {
                          desc = `[Place: ${name}${akaStr}. Description: ${data.description || 'N/A'}]`;
                      } else if (file.path.includes('Objects')) {
                          desc = `[Object: ${name}${akaStr}. Description: ${data.description || 'N/A'}]`;
                      }
                      if (desc) entityLines.push(desc);
                  } catch (e) {
                      console.error("Failed to parse entity file", file.name, e);
                  }
              }
          }
          
          if (entityLines.length > 0) {
              entityContext = entityLines.join('\n');
          }
      } catch (err) {
          console.error("Error loading entity files", err);
      }

      // Extract plain text from content (strip XML tags if present)
      const textMatch = contextContent.match(/<text>([\s\S]*?)<\/text>/);
      const chapterText = textMatch ? textMatch[1].trim() : contextContent;

      const sections: string[] = [];
      if (plotContext) sections.push(`Project Overview:\n${plotContext}`);
      if (chapterSettingsContext) sections.push(`Chapter Context:\n${chapterSettingsContext}`);
      if (entityContext) sections.push(`Characters, Places & Objects:\n${entityContext}`);

      const prompt = `Critique the following writing sample. Focus on pacing, tone, character voice, and consistency with the established world and plot.

${sections.join('\n\n')}

---
${chapterText}
---`;
      
      // @ts-ignore
      window.ipcRenderer.send('generate-ai-completion', { prompt });
  };


  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800">
      <div className="p-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-950 flex justify-between items-center">
        <span className="uppercase text-xs font-bold text-gray-400 dark:text-neutral-500 tracking-wider">AI Assistant</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
         {messages.length === 0 && !isLoading && (
             <div className="text-center text-gray-400 dark:text-neutral-500 mt-10">
                 <Sparkles className="mx-auto mb-2 opacity-50" />
                 <p>Ask for help or request a critique.</p>
             </div>
         )}
         
         {messages.map((msg, idx) => (
             <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 dark:bg-blue-900 text-white dark:text-blue-100' : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300'}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                 </div>
             </div>
         ))}

         {isLoading && !streamingContent && (
             <div className="flex justify-start">
                 <div className="max-w-[85%] p-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border border-blue-500/30">
                     <div className="flex space-x-1 h-5 items-center px-1">
                        <div className="w-2 h-2 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce"></div>
                     </div>
                 </div>
             </div>
         )}

         {!isLoading && externalThinkingCount > 0 && (
             <div className="flex justify-start">
                 <div className="max-w-[85%] p-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border border-blue-500/30">
                     <div className="flex space-x-1 h-5 items-center px-1">
                        <div className="w-2 h-2 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-400 dark:bg-neutral-400 rounded-full animate-bounce"></div>
                     </div>
                 </div>
             </div>
         )}

         {isLoading && streamingContent && (
             <div className="flex justify-start">
                 <div className="max-w-[85%] p-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border border-blue-500/30">
                     <div className="whitespace-pre-wrap">{streamingContent}<span className="animate-pulse">_</span></div>
                 </div>
             </div>
         )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-950 space-y-3">
         {/* Quick Actions */}
         <button 
            onClick={handleCritique}
            disabled={isLoading}
            className="w-full py-2 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 border border-gray-200 dark:border-neutral-700 rounded text-xs text-gray-600 dark:text-neutral-300 flex items-center justify-center gap-2 transition-colors"
         >
             <Sparkles size={14} className="text-purple-400" />
             Critique Current Chapter
         </button>

         {/* Input */}
         <div className="relative">
             <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                disabled={isLoading}
                placeholder="Ask about your story..." 
                className="w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded p-2 pr-10 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 text-sm"
             />
             <button 
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input}
                className="absolute right-2 top-2 text-neutral-400 hover:text-white disabled:opacity-50"
             >
                 {isLoading ? <StopCircle size={16} /> : <Send size={16} />}
             </button>
         </div>
      </div>
    </div>
  );
}
