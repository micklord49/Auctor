import { useState, useEffect, useRef, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold, Italic, Heading1, Heading2,
  ArrowDownFromLine, ArrowUpFromLine,
  RefreshCw, MessageSquare,
  Check, X, Loader2
} from 'lucide-react';

interface RefineDialogProps {
  selectedHtml: string;
  fullChapterText: string;
  chapterSummary: string;
  ageOffset: string;
  style: string;
  onAccept: (refinedHtml: string) => void;
  onReject: () => void;
}

export function RefineDialog({
  selectedHtml,
  fullChapterText,
  chapterSummary,
  ageOffset,
  style,
  onAccept,
  onReject,
}: RefineDialogProps) {
  const [critique, setCritique] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const critiqueBufferRef = useRef('');
  const rewriteBufferRef = useRef('');
  const isRewritingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
    ],
    content: selectedHtml,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-base max-w-none focus:outline-none min-h-[120px] p-4',
      },
    },
  });

  // Fetch project context (characters, places, objects) for prompts
  const fetchContext = useCallback(async () => {
    let projectOverview = '';
    try {
      // @ts-ignore
      const settingsResult = await window.ipcRenderer.invoke('get-project-settings');
      if (settingsResult.success && settingsResult.settings) {
        const { title, author, plot } = settingsResult.settings;
        let header = '';
        if (title) header += `Novel: ${title}`;
        if (author) header += ` by ${author}`;
        if (header) projectOverview += header + '\n';
        if (plot) projectOverview += `Overall Plot: ${plot}\n`;
      }
    } catch {}

    let entityContext = '';
    try {
      // @ts-ignore
      const files: any[] = await window.ipcRenderer.invoke('get-files');
      const entityFiles = files.filter((f: any) =>
        (f.category === 'Characters' || f.category === 'Places' || f.category === 'Objects' || f.category === 'Organisations')
      );
      const lines: string[] = [];
      for (const file of entityFiles) {
        // @ts-ignore
        const res = await window.ipcRenderer.invoke('read-file', file.path);
        if (!res?.success) continue;
        try {
          const json = JSON.parse(res.content);
          const name = json.name || file.name.replace('.json', '');
          const aka = json.aka ? ` (aka ${json.aka})` : '';
          if (file.category === 'Characters') {
            const stage = json.lifeStages?.[0] || {};
            lines.push(`[Character: ${name}${aka}. Appearance: ${stage.appearance || 'N/A'}. Personality: ${stage.personality || 'N/A'}. Motivation: ${stage.motivation || 'N/A'}]`);
          } else if (file.category === 'Places') {
            lines.push(`[Place: ${name}${aka}. Description: ${json.description || 'N/A'}]`);
          } else if (file.category === 'Objects') {
            lines.push(`[Object: ${name}${aka}. Description: ${json.description || 'N/A'}]`);
          } else if (file.category === 'Organisations') {
            const members = Array.isArray(json.members) ? json.members.map((m: any) => `${m.name}${m.role ? ' (' + m.role + ')' : ''}`).join(', ') : 'N/A';
            lines.push(`[Organisation: ${name}. Goals: ${json.goals || 'N/A'}. Members: ${members}]`);
          }
        } catch {}
      }
      entityContext = lines.join('\n');
    } catch {}

    return { projectOverview, entityContext };
  }, []);

  // Build context sections for prompts
  const buildContextSections = useCallback(async () => {
    const { projectOverview, entityContext } = await fetchContext();
    const sections: string[] = [];
    if (projectOverview) sections.push(`Project Overview:\n${projectOverview}`);
    if (chapterSummary?.trim()) sections.push(`Chapter Summary:\n${chapterSummary.trim()}`);
    if (ageOffset?.trim() && ageOffset !== '0') sections.push(`Age Offset: ${ageOffset} years`);
    if (style?.trim()) sections.push(`Writing Style Notes:\n${style.trim()}`);
    if (entityContext) sections.push(`Characters, Places, Objects & Organisations:\n${entityContext}`);
    return sections;
  }, [fetchContext, chapterSummary, ageOffset, style]);

  // Run critique on mount
  useEffect(() => {
    runCritique();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCritique = async () => {
    if (!editor) return;
    setIsLoading(true);
    setLoadingAction('Critiquing...');
    setCritique('');
    critiqueBufferRef.current = '';

    const currentText = editor.getText();
    const sections = await buildContextSections();

    const prompt = `Critique the following selected passage from a novel chapter. Focus on pacing, tone, character voice, consistency with the established world and plot, and any issues with clarity or flow.

${sections.join('\n\n')}

Full Chapter Reference (DO NOT critique this, just use for context):
${fullChapterText}

---
Selected Passage to Critique:
${currentText}
---

Provide a concise, actionable critique of the selected passage only.`;

    // @ts-ignore
    window.ipcRenderer.send('refine-text-completion', { prompt, channel: 'critique' });
  };

  // Listen for critique streaming
  useEffect(() => {
    // @ts-ignore
    const removeChunk = window.ipcRenderer.on('refine-critique-chunk', (_event: any, chunk: string) => {
      critiqueBufferRef.current += chunk;
      setCritique(critiqueBufferRef.current);
    });
    // @ts-ignore
    const removeEnd = window.ipcRenderer.on('refine-critique-end', () => {
      setIsLoading(false);
      setLoadingAction(null);
    });
    // @ts-ignore
    const removeError = window.ipcRenderer.on('refine-critique-error', (_event: any, error: string) => {
      setIsLoading(false);
      setLoadingAction(null);
      setCritique(`Error: ${error}`);
    });

    return () => {
      removeChunk();
      removeEnd();
      removeError();
    };
  }, []);

  // Listen for rewrite streaming
  useEffect(() => {
    // @ts-ignore
    const removeChunk = window.ipcRenderer.on('refine-rewrite-chunk', (_event: any, chunk: string) => {
      if (!isRewritingRef.current) return;
      editor?.commands.insertContent(chunk);
    });
    // @ts-ignore
    const removeEnd = window.ipcRenderer.on('refine-rewrite-end', () => {
      isRewritingRef.current = false;
      setIsLoading(false);
      setLoadingAction(null);
    });
    // @ts-ignore
    const removeError = window.ipcRenderer.on('refine-rewrite-error', (_event: any, error: string) => {
      isRewritingRef.current = false;
      setIsLoading(false);
      setLoadingAction(null);
      editor?.commands.insertContent(` [Error: ${error}] `);
    });

    return () => {
      removeChunk();
      removeEnd();
      removeError();
    };
  }, [editor]);

  const runRewrite = async (mode: 'rewrite' | 'shorter' | 'longer') => {
    if (!editor || isLoading) return;

    setIsLoading(true);
    isRewritingRef.current = true;

    const currentText = editor.getText();
    const sections = await buildContextSections();

    let instruction = '';
    if (mode === 'rewrite') {
      instruction = 'Rewrite the text to improve flow, tone, and clarity while maintaining the author\'s voice.';
      setLoadingAction('Rewriting...');
    } else if (mode === 'shorter') {
      instruction = 'Rewrite the text to be more concise while staying true to the author\'s voice, meaning, tense, and point-of-view. Do not add new information or change events.';
      setLoadingAction('Making shorter...');
    } else {
      instruction = 'Expand the text by adding vivid detail and color while staying true to the author\'s voice, tense, and point-of-view. Add concrete sensory detail, subtext, action beats, and specificity.';
      setLoadingAction('Making longer...');
    }

    const critiqueGuidance = critique?.trim()
      ? `\nCritique (use this feedback to guide your rewrite):\n${critique.trim()}\n`
      : '';

    const prompt = `You are an expert story editor.

Task:
${instruction}
${critiqueGuidance}
${sections.join('\n\n')}

Full Chapter Reference (DO NOT output this):
${fullChapterText}

Text to ${mode}:
${currentText}

Output only the rewritten text. Do not include any explanation or markdown formatting unless appropriate for the story (e.g. italics).`;

    // Clear editor and stream new content
    editor.commands.clearContent();
    rewriteBufferRef.current = '';

    // @ts-ignore
    window.ipcRenderer.send('refine-text-completion', { prompt, channel: 'rewrite' });
  };

  const handleAccept = () => {
    if (!editor) return;
    onAccept(editor.getHTML());
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) onReject(); }}>
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl w-[700px] max-h-[85vh] flex flex-col border border-gray-200 dark:border-neutral-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950 rounded-t-lg">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-purple-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Refine Selection</h3>
          </div>
          {isLoading && loadingAction && (
            <div className="flex items-center gap-1 text-yellow-500 text-xs animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              <span>{loadingAction}</span>
            </div>
          )}
        </div>

        {/* Toolbar */}
        {editor && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900">
            {/* Formatting */}
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 ${editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-neutral-400'}`}
              title="Bold"
            >
              <Bold size={15} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 ${editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-neutral-400'}`}
              title="Italic"
            >
              <Italic size={15} />
            </button>
            <div className="w-px h-4 bg-gray-300 dark:bg-neutral-700 mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-neutral-400'}`}
              title="Heading 1"
            >
              <Heading1 size={15} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-neutral-400'}`}
              title="Heading 2"
            >
              <Heading2 size={15} />
            </button>

            <div className="w-px h-4 bg-gray-300 dark:bg-neutral-700 mx-1" />

            {/* AI Actions */}
            <button
              onClick={() => runRewrite('shorter')}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400 disabled:opacity-40"
              title="Make Shorter"
            >
              <ArrowUpFromLine size={15} />
            </button>
            <button
              onClick={() => runRewrite('longer')}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400 disabled:opacity-40"
              title="Make Longer"
            >
              <ArrowDownFromLine size={15} />
            </button>
            <button
              onClick={() => runRewrite('rewrite')}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400 text-xs disabled:opacity-40"
              title="Rewrite"
            >
              <RefreshCw size={14} />
              <span>Rewrite</span>
            </button>
            <button
              onClick={runCritique}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400 text-xs disabled:opacity-40"
              title="Re-critique"
            >
              <MessageSquare size={14} />
              <span>Re-critique</span>
            </button>
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto min-h-0 border-b border-gray-200 dark:border-neutral-700 max-h-[35vh]">
          <EditorContent editor={editor} />
        </div>

        {/* Critique area */}
        <div className="border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-neutral-800">
            <MessageSquare size={13} className="text-green-500" />
            <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Critique</span>
          </div>
          <div className="overflow-y-auto max-h-[25vh] px-4 py-3">
            {critique ? (
              <div className="text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {critique}
                {isLoading && loadingAction === 'Critiquing...' && <span className="animate-pulse">_</span>}
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2 text-gray-400 dark:text-neutral-500 text-sm">
                <Loader2 size={14} className="animate-spin" />
                <span>Generating critique...</span>
              </div>
            ) : (
              <div className="text-sm text-gray-400 dark:text-neutral-600">No critique yet</div>
            )}
          </div>
        </div>

        {/* Footer with Accept/Reject */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-gray-50 dark:bg-neutral-950 rounded-b-lg">
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors"
          >
            <X size={14} />
            Reject
          </button>
          <button
            onClick={handleAccept}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Check size={14} />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
