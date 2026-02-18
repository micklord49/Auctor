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
      // Store current mode to know how to handle the result
      window.sessionStorage.setItem('ai-mode', 'critique');

      // Scan for characters, places, and objects mentioned in the text
      let entityContext = "";
      try {
           // @ts-ignore
           const fileList = await window.ipcRenderer.invoke('get-files');
           const entityFiles = fileList.filter((f: any) => 
               (f.path.includes('Characters') || f.path.includes('Places') || f.path.includes('Objects')) &&
               f.name.endsWith('.json')
           );

           const foundEntities: string[] = [];

           for (const file of entityFiles) {
               // @ts-ignore
               const result = await window.ipcRenderer.invoke('read-file', file.path);
               if (result.success) {
                   try {
                       const data = JSON.parse(result.content);
                       const name = data.name || file.name.replace('.json', '');
                       const aka = data.aka || '';
                       
                       const normalize = (s: string) => s.toLowerCase();
                       const contentLower = normalize(contextContent);
                       
                       // Simple substring match for now
                       if (contentLower.includes(normalize(name)) || (aka && contentLower.includes(normalize(aka)))) {
                           let desc = "";
                           if (file.path.includes('Characters')) {
                               // Extract a brief summary for characters
                               const stage = data.lifeStages?.[0] || {};
                               desc = `[Character: ${name}. Appearance: ${stage.appearance || 'N/A'}. Personality: ${stage.personality || 'N/A'}. Motivation: ${stage.motivation || 'N/A'}]`;
                           } else if (file.path.includes('Places')) {
                               desc = `[Place: ${name}. Description: ${data.description || 'N/A'}]`;
                           } else if (file.path.includes('Objects')) {
                               desc = `[Object: ${name}. Description: ${data.description || 'N/A'}]`;
                           }
                           
                           if (desc) foundEntities.push(desc);
                       }
                   } catch (e) {
                       console.error("Failed to parse entity file", file.name, e);
                   }
               }
           }
           
           if (foundEntities.length > 0) {
               entityContext = "\n\nReferenced Entities Context:\n" + foundEntities.join('\n');
           }

      } catch (err) {
          console.error("Error scanning context entities", err);
      }
      
      const prompt = `Critique the following writing sample. Focus on pacing, tone, and character voice.${entityContext}\n\n---\n${contextContent}\n---`;
      
      // @ts-ignore
      window.ipcRenderer.send('generate-ai-completion', { prompt });
  };


  return (
    <div className="flex flex-col h-full bg-neutral-900 border-l border-neutral-800">
      <div className="p-3 border-b border-neutral-800 bg-neutral-950 flex justify-between items-center">
        <span className="uppercase text-xs font-bold text-neutral-500 tracking-wider">AI Assistant</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
         {messages.length === 0 && !isLoading && (
             <div className="text-center text-neutral-500 mt-10">
                 <Sparkles className="mx-auto mb-2 opacity-50" />
                 <p>Ask for help or request a critique.</p>
             </div>
         )}
         
         {messages.map((msg, idx) => (
             <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-900 text-blue-100' : 'bg-neutral-800 text-neutral-300'}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                 </div>
             </div>
         ))}

         {isLoading && !streamingContent && (
             <div className="flex justify-start">
                 <div className="max-w-[85%] p-3 rounded-lg bg-neutral-800 text-neutral-300 border border-blue-500/30">
                     <div className="flex space-x-1 h-5 items-center px-1">
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                     </div>
                 </div>
             </div>
         )}

         {!isLoading && externalThinkingCount > 0 && (
             <div className="flex justify-start">
                 <div className="max-w-[85%] p-3 rounded-lg bg-neutral-800 text-neutral-300 border border-blue-500/30">
                     <div className="flex space-x-1 h-5 items-center px-1">
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                     </div>
                 </div>
             </div>
         )}

         {isLoading && streamingContent && (
             <div className="flex justify-start">
                 <div className="max-w-[85%] p-3 rounded-lg bg-neutral-800 text-neutral-300 border border-blue-500/30">
                     <div className="whitespace-pre-wrap">{streamingContent}<span className="animate-pulse">_</span></div>
                 </div>
             </div>
         )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-neutral-800 bg-neutral-950 space-y-3">
         {/* Quick Actions */}
         <button 
            onClick={handleCritique}
            disabled={isLoading}
            className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-xs text-neutral-300 flex items-center justify-center gap-2 transition-colors"
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
                className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 pr-10 text-white focus:outline-none focus:border-blue-500 text-sm"
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
