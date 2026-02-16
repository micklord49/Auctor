import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Heading1, Heading2 } from 'lucide-react';

interface EditorProps {
  content?: string;
  onChange?: (content: string) => void;
  onBlur?: (content: string) => void;
}

export function Editor({ content = '', onChange, onBlur }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your masterpiece...',
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-lg max-w-none focus:outline-none min-h-[500px]',
      },
    },
    onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML());
    },
    onBlur: ({ editor }) => {
        onBlur?.(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-neutral-800">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-neutral-700 bg-neutral-900 sticky top-0 z-10">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-neutral-700 transition-colors ${editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-neutral-400'}`}
          title="Bold (Ctrl+B)"
        >
          <Bold size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-neutral-700 transition-colors ${editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-neutral-400'}`}
          title="Italic (Ctrl+I)"
        >
          <Italic size={18} />
        </button>
        
        <div className="w-px h-6 bg-neutral-700 mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-neutral-700 transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white' : 'text-neutral-400'}`}
          title="Heading 1"
        >
          <Heading1 size={18} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-neutral-700 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'text-neutral-400'}`}
          title="Heading 2"
        >
          <Heading2 size={18} />
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
