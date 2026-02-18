
import { useState, useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Heading1, Heading2, Save, PenTool, Settings, MessageSquare, Loader2 } from 'lucide-react';

type Tab = 'text' | 'settings' | 'critique';

interface ChapterCardProps {
  content: string;
  onSave: (content: string) => void;
  fileName: string;
  forceTab?: Tab;
}

export function ChapterCard({ content, onSave, fileName, forceTab }: ChapterCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [isRewriting, setIsRewriting] = useState(false);
  const rewriteBufferRef = useRef('');
    const [caretLine, setCaretLine] = useState(1);
    const [caretColumn, setCaretColumn] = useState(1);
    const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
      if (forceTab) setActiveTab(forceTab);
  }, [forceTab]);

  // State for the three sections
  const [textContent, setTextContent] = useState('');
  
  // Settings State
  const [chapterSummary, setChapterSummary] = useState('');
  const [ageOffset, setAgeOffset] = useState('');
  const [style, setStyle] = useState('');

  const [critiqueContent, setCritiqueContent] = useState('');

  // Initial Parse
  useEffect(() => {
    // Default format:
    // <text>...</text>
    // <settings>...</settings>
    // <critique>...</critique>

    // If file is empty or doesn't have tags, treat all as text
    if (!content.includes('<text>')) {
        setTextContent(content);
        return;
    }

    const textMatch = content.match(/<text>([\s\S]*?)<\/text>/);
    const settingsMatch = content.match(/<settings>([\s\S]*?)<\/settings>/);
    const critiqueMatch = content.match(/<critique>([\s\S]*?)<\/critique>/);

    if (textMatch) setTextContent(textMatch[1].trim());
    
    if (settingsMatch) {
       const rawSettings = settingsMatch[1].trim();
       try {
           const parsed = JSON.parse(rawSettings);
           setChapterSummary(parsed.summary || '');
           setAgeOffset(parsed.ageOffset || '');
           setStyle(parsed.style || '');
       } catch (e) {
           // Fallback: older format was just the summary text
           setChapterSummary(rawSettings);
       }
    }

    if (critiqueMatch) setCritiqueContent(critiqueMatch[1].trim());

  }, [content, fileName]);

  const handleSave = () => {
      // Serialize settings
      const settingsJson = JSON.stringify({
          summary: chapterSummary,
          ageOffset: ageOffset,
          style: style
      }, null, 2);

      // Reconstruct file
      const fileData = `
<text>
${textContent}
</text>
<settings>
${settingsJson}
</settings>
<critique>
${critiqueContent}
</critique>
`.trim();
      onSave(fileData);
  };

  // --- TipTap Editor for Text Section ---
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your chapter...' }),
    ],
    content: textContent,
    onUpdate: ({ editor }) => {
        setTextContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-lg max-w-none focus:outline-none min-h-[500px] p-8',
      },
    },
  });

  // Status bar: caret position + word count
  useEffect(() => {
      if (!editor) return;

      const updateStatus = () => {
          const pos = editor.state.selection.anchor;
          const textUpToCaret = editor.state.doc.textBetween(0, pos, '\n', '\n');
          const lines = textUpToCaret.split('\n');
          const line = Math.max(1, lines.length);
          const column = (lines[lines.length - 1]?.length ?? 0) + 1;

          const text = editor.getText();
          const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean) : [];

          setCaretLine(line);
          setCaretColumn(column);
          setWordCount(words.length);
      };

      updateStatus();
      editor.on('selectionUpdate', updateStatus);
      editor.on('update', updateStatus);

      return () => {
          editor.off('selectionUpdate', updateStatus);
          editor.off('update', updateStatus);
      };
  }, [editor]);

  // Sync editor content when tab changes or file changes
  useEffect(() => {
      if (editor && activeTab === 'text') {
        // Only update if different to avoid cursor jumps, though simplified here
        if (editor.getHTML() !== textContent) {
           editor.commands.setContent(textContent);
        }
      }
  }, [activeTab, textContent, editor]);

  // Helper ref for rewrite status to avoid stale closures in event listeners
  const isRewritingRef = useRef(false);
  useEffect(() => { isRewritingRef.current = isRewriting; }, [isRewriting]);

  // Re-write the effect to use isRewritingRef
  useEffect(() => {
    if (!editor) return;

    const fetchProjectContext = async () => {
        // @ts-ignore
        const files: any[] = await window.ipcRenderer.invoke('get-files');
        const contextFiles = files.filter((f: any) =>
            f.category === 'Characters' || f.category === 'Places' || f.category === 'Objects'
        );

        let contextString = "";
        for (const file of contextFiles) {
            // @ts-ignore
            const res = await window.ipcRenderer.invoke('read-file', file.path);
            if (!res?.success) continue;

            try {
                const json = JSON.parse(res.content);
                const summary = json.description || json.summary || json.content || JSON.stringify(json);
                contextString += `[${file.category.slice(0, -1)}: ${json.name || file.name}]\n${summary}\n\n`;
            } catch {
                contextString += `[${file.category.slice(0, -1)}: ${file.name}]\n${res.content}\n\n`;
            }
        }

        return contextString;
    };

    const runRewrite = async (mode: 'rewrite' | 'shorter' | 'longer') => {
        if (isRewritingRef.current) return;

        const { from, to, empty } = editor.state.selection;
        if (empty) return;

        setIsRewriting(true);
        isRewritingRef.current = true;

        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        const fullText = editor.getText();
        const contextString = await fetchProjectContext();

        let instructionBlock = '';
        if (mode === 'rewrite') {
            instructionBlock = `Rewrite the selected text to improve flow, tone, and clarity while maintaining the author's voice.`;
        } else if (mode === 'shorter') {
            instructionBlock = `Rewrite the selected text to be more concise while staying true to the author's voice, meaning, tense, and point-of-view. Do not add new information or change events; keep the same intent and key beats, just tighter.`;
        } else {
            instructionBlock = `Expand the selected text by adding vivid detail and color while staying true to the author's voice, tense, and point-of-view. Add concrete sensory detail, subtext, action beats, and specificity where it fits. Use the provided Characters/Places/Objects context when relevant to enrich the prose (without inventing new named entities or contradicting established facts).`;
        }

        const styleNotes = style?.trim() ? `\nStyle Notes (from this chapter's settings):\n${style.trim()}\n` : '';

        const prompt = `
You are an expert story editor.

Task:
${instructionBlock}
${styleNotes}

Project Context (Characters, Places, Objects):
${contextString}

Create Reference (Chapter Context - DO NOT OUTPUT THIS):
${fullText}

Selected Text:
${selectedText}

Output only the rewritten text. Do not include any explanation or markdown formatting unless appropriate for the story (e.g. italics).
`;

        rewriteBufferRef.current = '';
        editor.chain().deleteSelection().run();

        // @ts-ignore
        window.ipcRenderer.send('rewrite-text-completion', { prompt });
    };

    // @ts-ignore
    const removeRewriteListener = window.ipcRenderer.on('rewrite-selection', async () => {
        await runRewrite('rewrite');
    });

    // @ts-ignore
    const removeShorterListener = window.ipcRenderer.on('make-shorter-selection', async () => {
        await runRewrite('shorter');
    });

    // @ts-ignore
    const removeLongerListener = window.ipcRenderer.on('make-longer-selection', async () => {
        await runRewrite('longer');
    });

    // @ts-ignore
    const removeChunkListener = window.ipcRenderer.on('rewrite-text-chunk', (event, chunk) => {
        if (!isRewritingRef.current) return;
        editor.commands.insertContent(chunk);
    });

    // @ts-ignore
    const removeEndListener = window.ipcRenderer.on('rewrite-text-end', () => {
        setIsRewriting(false);
        isRewritingRef.current = false;
    });

    // @ts-ignore
    const removeErrorListener = window.ipcRenderer.on('rewrite-text-error', (event, error) => {
        setIsRewriting(false);
        isRewritingRef.current = false;
        editor.commands.insertContent(` [Rewrite Error: ${error}] `);
    });

    return () => {
        removeRewriteListener();
        removeShorterListener();
        removeLongerListener();
        removeChunkListener();
        removeEndListener();
        removeErrorListener();
    };
  }, [editor]); // Re-bind only if editor instance changes

  return (
    <div className="flex flex-col h-full bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-950">
        <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <PenTool className="text-purple-500" size={18} />
                <h2 className="font-bold text-white max-w-xs truncate">{fileName.replace('.md', '')}</h2>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-neutral-900 rounded p-1 border border-neutral-800">
                <button
                    onClick={() => setActiveTab('text')}
                    className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-2 ${activeTab === 'text' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                    <PenTool size={14} /> Text
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                    <Settings size={14} /> Settings
                </button>
                <button
                    onClick={() => setActiveTab('critique')}
                    className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-2 ${activeTab === 'critique' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                    <MessageSquare size={14} /> Critique
                </button>
            </div>
        </div>

        <div className="flex items-center gap-2">
            {isRewriting && (
                <div className="flex items-center gap-1 text-yellow-500 text-sm animate-pulse mr-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Rewriting...</span>
                </div>
            )}
            <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
            >
            <Save size={14} /> Save
            </button>
        </div>
      </div>


      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-neutral-800">
        
        {/* TEXT TAB */}
        <div className={activeTab === 'text' ? 'block h-full' : 'hidden'}>
             {/* Toolbar for Editor */}
             {editor && (
                <div className="flex items-center gap-1 p-2 border-b border-neutral-700 bg-neutral-900 sticky top-0 z-10">
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded hover:bg-neutral-700 ${editor.isActive('bold') ? 'bg-blue-600' : 'text-neutral-400'}`}
                        title="Bold (Ctrl+B)"
                    >
                        <Bold size={16} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded hover:bg-neutral-700 ${editor.isActive('italic') ? 'bg-blue-600' : 'text-neutral-400'}`}
                         title="Italic (Ctrl+I)"
                    >
                        <Italic size={16} />
                    </button>
                     <div className="w-px h-4 bg-neutral-700 mx-2" />
                    <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={`p-1.5 rounded hover:bg-neutral-700 ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-600' : 'text-neutral-400'}`}
                        title="Heading 1"
                    >
                        <Heading1 size={16} />
                    </button>
                     <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`p-1.5 rounded hover:bg-neutral-700 ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-600' : 'text-neutral-400'}`}
                         title="Heading 2"
                    >
                        <Heading2 size={16} />
                    </button>
                </div>
             )}
             <EditorContent editor={editor} />

             {/* Status Bar */}
             <div className="sticky bottom-0 z-10 flex items-center justify-end gap-4 px-3 py-1.5 border-t border-neutral-700 bg-neutral-900 text-xs text-neutral-400">
                 <span>Ln {caretLine}, Col {caretColumn}</span>
                 <span>Words: {wordCount}</span>
             </div>
        </div>

        {/* SETTINGS TAB */}
        <div className={activeTab === 'settings' ? 'block p-8 h-full bg-neutral-925' : 'hidden'}>
            <div className="max-w-3xl mx-auto space-y-6">
                 
                 <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-400 uppercase tracking-wider block">Age Offset</label>
                    <input 
                        type="number"
                        className="w-full bg-neutral-900 border border-neutral-700 rounded p-3 text-neutral-200 focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="0"
                        value={ageOffset}
                        onChange={(e) => setAgeOffset(e.target.value)}
                    />
                    <p className="text-xs text-neutral-500">Years to offset character ages for this chapter (e.g., -5 for a flashback).</p>
                 </div>

                 <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-400 uppercase tracking-wider block">Chapter Summary</label>
                    <textarea 
                        className="w-full h-32 bg-neutral-900 border border-neutral-700 rounded p-4 text-neutral-200 focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="What happens in this chapter?"
                        value={chapterSummary} 
                        onChange={(e) => setChapterSummary(e.target.value)}
                    />
                    <p className="text-xs text-neutral-500">This summary is used by the AI to understand the context of this chapter.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-neutral-400 uppercase tracking-wider block">Writing Style</label>
                    <textarea 
                        className="w-full h-24 bg-neutral-900 border border-neutral-700 rounded p-4 text-neutral-200 focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="Describe the writing style for this chapter (e.g., tense, POV, mood)..."
                        value={style} 
                        onChange={(e) => setStyle(e.target.value)}
                    />
                    <p className="text-xs text-neutral-500">Instructions for the AI regarding tone, voice, and perspective.</p>
                </div>
            </div>
        </div>

        {/* CRITIQUE TAB */}
        <div className={activeTab === 'critique' ? 'block p-8 h-full' : 'hidden'}>
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <MessageSquare className="text-green-500" size={20} />
                        AI Critique & Notes
                    </h3>
                    <textarea 
                        className="w-full h-[60vh] bg-neutral-950 border border-neutral-800 rounded p-4 text-neutral-300 font-mono text-sm focus:outline-none focus:border-green-500/50 leading-relaxed"
                        placeholder="Paste AI critique here or assume one will be generated..."
                        value={critiqueContent}
                        onChange={(e) => setCritiqueContent(e.target.value)}
                    />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
