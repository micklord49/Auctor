import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, StopCircle, Search } from 'lucide-react';

interface AIChatPanelProps {
  contextContent: string; // The content from the editor
  onCritique?: (critique: string) => void;
}

export function AIChatPanel({ contextContent, onCritique }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai' | 'tool', content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
    const [externalThinkingCount, setExternalThinkingCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Listen for tool-call notifications
  useEffect(() => {
    // @ts-ignore
    const removeToolCall = window.ipcRenderer.on('ai-tool-call', (_event: any, message: string) => {
      setMessages(prev => [...prev, { role: 'tool', content: message }]);
    });
    return () => removeToolCall();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Use a ref to always have the latest streamingContent available in listeners
  const streamingRef = useRef('');
  useEffect(() => { streamingRef.current = streamingContent; }, [streamingContent]);

  useEffect(() => {
    // @ts-ignore
    const removeChunkListener = window.ipcRenderer.on('ai-completion-chunk', (_event: any, chunk: string) => {
       setStreamingContent(prev => prev + chunk);
    });

    // @ts-ignore
    const removeEndListener = window.ipcRenderer.on('ai-completion-end', () => {
       const final = streamingRef.current;
       if (final) {
         setMessages(prev => [...prev, { role: 'ai', content: final }]);

         const mode = window.sessionStorage.getItem('ai-mode');
         if (mode === 'critique' && onCritique) {
             onCritique(final);
             window.sessionStorage.removeItem('ai-mode');
         }

         setStreamingContent('');
       }
       setIsLoading(false);
    });

    // @ts-ignore
    const removeErrorListener = window.ipcRenderer.on('ai-completion-error', (_event: any, error: string) => {
       setIsLoading(false);
       setMessages(prev => [...prev, { role: 'ai', content: `Error: ${error}` }]);
       setStreamingContent('');
    });

    return () => {
        removeChunkListener();
        removeEndListener();
        removeErrorListener();
    };
  }, [onCritique]);


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

      // Fetch project settings (plot, title, author, subplots)
      let plotContext = "";
      let allSubplots: { id: string; title: string; description: string; characters: string[] }[] = [];
      try {
          // @ts-ignore
          const settingsResult = await window.ipcRenderer.invoke('get-project-settings');
          if (settingsResult.success && settingsResult.settings) {
              const { title, author, plot, subplots } = settingsResult.settings;
              let header = '';
              if (title) header += `Novel: ${title}`;
              if (author) header += ` by ${author}`;
              if (header) plotContext += header + '\n';
              if (plot) plotContext += `Plot: ${plot}\n`;
              if (Array.isArray(subplots)) allSubplots = subplots;
          }
      } catch (err) {
          console.error("Error fetching project settings", err);
      }

      // Parse chapter settings from file content
      let chapterSettingsContext = "";
      let chapterSubplotIds: string[] = [];
      const settingsMatch = contextContent.match(/<settings>([\s\S]*?)<\/settings>/);
      if (settingsMatch) {
          try {
              const parsed = JSON.parse(settingsMatch[1].trim());
              if (parsed.summary) chapterSettingsContext += `Chapter Summary: ${parsed.summary}\n`;
              if (parsed.ageOffset && parsed.ageOffset !== '0') chapterSettingsContext += `Age Offset: ${parsed.ageOffset} years\n`;
              if (parsed.style) chapterSettingsContext += `Writing Style Notes: ${parsed.style}\n`;
              if (Array.isArray(parsed.subplots)) chapterSubplotIds = parsed.subplots;
          } catch {}
      }

      // Build subplot context from chapter's assigned subplots
      let subplotContext = "";
      if (chapterSubplotIds.length > 0 && allSubplots.length > 0) {
          const relevant = allSubplots.filter(sp => chapterSubplotIds.includes(sp.id));
          if (relevant.length > 0) {
              subplotContext = relevant.map(sp => {
                  let entry = sp.title || 'Untitled subplot';
                  if (sp.description) entry += `: ${sp.description}`;
                  if (sp.characters?.length) entry += ` (Characters: ${sp.characters.join(', ')})`;
                  return `- ${entry}`;
              }).join('\n');
          }
      }

      // Extract plain text from content (strip XML tags if present)
      const textMatch = contextContent.match(/<text>([\s\S]*?)<\/text>/);
      const chapterText = textMatch ? textMatch[1].trim() : contextContent;

      const sections: string[] = [];
      if (plotContext) sections.push(`Project Overview:\n${plotContext}`);
      if (chapterSettingsContext) sections.push(`Chapter Context:\n${chapterSettingsContext}`);
      if (subplotContext) sections.push(`Active Subplots in this Chapter:\n${subplotContext}`);

      const prompt = `Critique the following writing sample. Focus on pacing, tone, character voice, and consistency with the established world and plot. Use your tools to look up characters, places, objects, and organisations as needed for context.

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
                 {msg.role === 'tool' ? (
                   <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 dark:text-neutral-500 italic">
                     <Search size={12} className="text-teal-400 shrink-0" />
                     {msg.content}
                   </div>
                 ) : (
                 <div className={`max-w-[85%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 dark:bg-blue-900 text-white dark:text-blue-100' : 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300'}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                 </div>
                 )}
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
         <div ref={messagesEndRef} />
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
