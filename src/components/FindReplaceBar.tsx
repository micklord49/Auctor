import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { X, ChevronUp, ChevronDown, Replace } from 'lucide-react';

interface Match { from: number; to: number }

function getMatches(editor: Editor, query: string): Match[] {
  if (!query) return [];
  const queryLower = query.toLowerCase();
  const matches: Match[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const textLower = node.text.toLowerCase();
    let index = textLower.indexOf(queryLower);
    while (index !== -1) {
      matches.push({ from: pos + index + 1, to: pos + index + 1 + query.length });
      index = textLower.indexOf(queryLower, index + query.length);
    }
  });
  return matches;
}

interface FindReplaceBarProps {
  editor: Editor | null;
  visible: boolean;
  defaultMode?: 'find' | 'replace';
  onClose: () => void;
  externalAction?: 'next' | 'previous' | null;
  onExternalActionHandled?: () => void;
}

export function FindReplaceBar({
  editor, visible, defaultMode = 'find', onClose,
  externalAction, onExternalActionHandled,
}: FindReplaceBarProps) {
  const [mode, setMode] = useState<'find' | 'replace'>(defaultMode);
  const [findQuery, setFindQuery] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [matchInfo, setMatchInfo] = useState('');
  const findInputRef = useRef<HTMLInputElement>(null);

  // When the bar becomes visible focus the find input and switch mode
  useEffect(() => {
    if (visible) {
      setMode(defaultMode);
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [visible, defaultMode]);

  // Recompute match count whenever query changes
  useEffect(() => {
    if (!editor || !findQuery) { setMatchInfo(''); return; }
    const matches = getMatches(editor, findQuery);
    setMatchInfo(matches.length === 0 ? 'No results' : `${matches.length} match${matches.length === 1 ? '' : 'es'}`);
  }, [findQuery, editor]);

  const navigate = useCallback((direction: 'next' | 'previous') => {
    if (!editor || !findQuery) return;
    const matches = getMatches(editor, findQuery);
    if (matches.length === 0) return;
    const { from: selFrom, to: selTo } = editor.state.selection;
    if (direction === 'next') {
      const next = matches.find(m => m.from > selTo) ?? matches[0];
      editor.chain().focus().setTextSelection(next).scrollIntoView().run();
    } else {
      const reversed = [...matches].reverse();
      const prev = reversed.find(m => m.to < selFrom) ?? reversed[0];
      editor.chain().focus().setTextSelection(prev).scrollIntoView().run();
    }
  }, [editor, findQuery]);

  // Handle find-next / find-previous triggered from outside (e.g. Edit menu)
  useEffect(() => {
    if (externalAction && visible) {
      navigate(externalAction);
      onExternalActionHandled?.();
    }
  }, [externalAction, visible, navigate, onExternalActionHandled]);

  const replaceNext = useCallback(() => {
    if (!editor || !findQuery) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to);
    // If current selection matches, replace it; otherwise jump to first match
    if (selected.toLowerCase() === findQuery.toLowerCase()) {
      editor.chain().focus().insertContentAt({ from, to }, replaceValue).scrollIntoView().run();
    } else {
      navigate('next');
    }
  }, [editor, findQuery, replaceValue, navigate]);

  const replaceAll = useCallback(() => {
    if (!editor || !findQuery) return;
    const matches = getMatches(editor, findQuery);
    if (matches.length === 0) { setMatchInfo('No results'); return; }
    let tr = editor.state.tr;
    for (let i = matches.length - 1; i >= 0; i--) {
      tr = tr.insertText(replaceValue, matches[i].from, matches[i].to);
    }
    editor.view.dispatch(tr);
    editor.commands.focus();
    setMatchInfo(`Replaced ${matches.length}`);
  }, [editor, findQuery, replaceValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); editor?.commands.focus(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate(e.shiftKey ? 'previous' : 'next');
    }
  };

  if (!visible) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-950 border-b border-neutral-700 text-sm"
      onKeyDown={handleKeyDown}
    >
      {/* Mode toggle */}
      <button
        onClick={() => setMode(m => m === 'find' ? 'replace' : 'find')}
        className="text-neutral-400 hover:text-white transition-colors p-0.5"
        title="Toggle Replace"
      >
        <Replace size={14} />
      </button>

      {/* Find row */}
      <div className="flex items-center gap-1 flex-1">
        <input
          ref={findInputRef}
          type="text"
          placeholder="Find"
          value={findQuery}
          onChange={e => setFindQuery(e.target.value)}
          className="bg-neutral-800 border border-neutral-600 rounded px-2 py-0.5 text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 w-44"
        />
        <span className="text-neutral-500 text-xs w-20 shrink-0">{matchInfo}</span>
        <button
          onClick={() => navigate('previous')}
          className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          title="Previous (Shift+Enter)"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => navigate('next')}
          className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
          title="Next (Enter)"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Replace row (inline) */}
      {mode === 'replace' && (
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="Replace"
            value={replaceValue}
            onChange={e => setReplaceValue(e.target.value)}
            className="bg-neutral-800 border border-neutral-600 rounded px-2 py-0.5 text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 w-36"
          />
          <button
            onClick={replaceNext}
            className="px-2 py-0.5 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-200 transition-colors text-xs"
          >
            Replace
          </button>
          <button
            onClick={replaceAll}
            className="px-2 py-0.5 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-200 transition-colors text-xs"
          >
            All
          </button>
        </div>
      )}

      {/* Close */}
      <button
        onClick={() => { onClose(); editor?.commands.focus(); }}
        className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors ml-1"
        title="Close (Esc)"
      >
        <X size={14} />
      </button>
    </div>
  );
}
