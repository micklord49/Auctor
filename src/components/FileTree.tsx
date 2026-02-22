import { useState, useEffect } from 'react';
import { 
  FilePlus, 
  Trash2, 
  ChevronRight,
  ChevronDown,
  Edit2, 
  FileJson, 
  FileText,
  MapPin,
  Package
} from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  category: string;
  isDirectory: boolean;
}

interface FileTreeProps {
  onSelectFile: (path: string) => void;
  activeFile?: string | null;
}

const CATEGORIES = ['Chapters', 'Characters', 'Places', 'Objects'];

export function FileTree({ onSelectFile, activeFile }: FileTreeProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [chapterOrder, setChapterOrder] = useState<string[]>([]);
  const [draggedChapterName, setDraggedChapterName] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<{category: string} | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [editingFile, setEditingFile] = useState<{name: string, category: string} | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Chapters': true,
    'Characters': true,
    'Places': true,
    'Objects': true
  });

  const refreshFiles = async () => {
    // @ts-ignore - ipcRenderer exposed in preload
    const fileList = await window.ipcRenderer.invoke('get-files');
    // @ts-ignore - ipcRenderer exposed in preload
    const chapterOrderResult = await window.ipcRenderer.invoke('get-chapter-order');

    const normalizedChapterOrder = chapterOrderResult?.success && Array.isArray(chapterOrderResult.order)
      ? chapterOrderResult.order
      : [];

    setChapterOrder(normalizedChapterOrder);

    // Ensure we have correct categories associated if coming from legacy
    setFiles(fileList.map((f: any) => ({
       ...f,
       category: f.category || (f.path.includes('Characters') ? 'Characters' : 'Chapters') // fallback
    })));
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  useEffect(() => {
    const handler = () => {
      refreshFiles();
    };
    window.addEventListener('auctor-files-changed', handler);
    return () => window.removeEventListener('auctor-files-changed', handler);
  }, []);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName || !isCreating) return;
    
    // Auto-append extension if missing based on category defaults
    let finalName = newFileName;
    const defaultExt = isCreating.category === 'Chapters' ? '.md' : '.json';
    if (!finalName.includes('.')) {
        finalName += defaultExt;
    }

    const defaultContent = finalName.endsWith('.json') ? '{}' : '# New Chapter';
    
    // @ts-ignore
    await window.ipcRenderer.invoke('create-file', finalName, defaultContent, isCreating.category);
    setNewFileName('');
    setIsCreating(null);
    refreshFiles();
  };

  const handleDelete = async (file: FileItem) => {
    if (confirm(`Are you sure you want to delete ${file.name}?`)) {
      // @ts-ignore
      await window.ipcRenderer.invoke('delete-file', file.name, file.category);
      refreshFiles();
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile || !renameValue) return;

    // @ts-ignore
    await window.ipcRenderer.invoke('rename-file', editingFile.name, renameValue, editingFile.category);
    setEditingFile(null);
    setRenameValue('');
    refreshFiles();
  };

  const startRename = (file: FileItem) => {
    setEditingFile({ name: file.name, category: file.category });
    setRenameValue(file.name);
  };

  const startCreating = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: true }));
    setIsCreating({ category });
    setNewFileName('');
  }

  const getFilesByCategory = (category: string) => {
      const categoryFiles = files.filter(f => f.category === category);
      if (category !== 'Chapters') {
        return categoryFiles.sort((a,b) => a.name.localeCompare(b.name));
      }

      const chapterPosition = new Map(chapterOrder.map((name, index) => [name, index]));
      return categoryFiles.sort((a, b) => {
        const aPos = chapterPosition.get(a.name);
        const bPos = chapterPosition.get(b.name);
        if (aPos !== undefined && bPos !== undefined) return aPos - bPos;
        if (aPos !== undefined) return -1;
        if (bPos !== undefined) return 1;
        return a.name.localeCompare(b.name);
      });
  };

  const handleChapterDrop = async (targetChapterName: string) => {
    if (!draggedChapterName || draggedChapterName === targetChapterName) {
      setDraggedChapterName(null);
      return;
    }

    const chapters = getFilesByCategory('Chapters').map(file => file.name);
    const sourceIndex = chapters.indexOf(draggedChapterName);
    const targetIndex = chapters.indexOf(targetChapterName);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedChapterName(null);
      return;
    }

    const reordered = [...chapters];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setChapterOrder(reordered);
    setDraggedChapterName(null);
    // @ts-ignore - ipcRenderer exposed in preload
    await window.ipcRenderer.invoke('set-chapter-order', reordered);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 select-none">
      <div className="p-3 uppercase text-xs font-bold text-gray-400 dark:text-neutral-500 tracking-wider flex justify-between items-center bg-gray-50 dark:bg-neutral-900 sticky top-0">
        <span>Explorer</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        
        {CATEGORIES.map(category => (
            <div key={category} className="mb-1">
                <div 
                    className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer text-xs font-bold sticky top-0"
                    onClick={() => toggleCategory(category)}
                >
                    <div className="flex items-center gap-1 text-gray-500 dark:text-neutral-400">
                        {expandedCategories[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="uppercase">{category}</span>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); startCreating(category); }}
                        className="hover:text-gray-900 dark:hover:text-white p-0.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                        title={`New ${category.slice(0, -1)}`}
                    >
                        <FilePlus size={14} />
                    </button>
                </div>

                {expandedCategories[category] && (
                    <div className="ml-2 pl-2 border-l border-gray-200 dark:border-neutral-800">
                        {/* Creation Input */}
                        {isCreating?.category === category && (
                            <form onSubmit={handleCreateFile} className="px-2 py-1 mb-1">
                                <input
                                autoFocus
                                type="text"
                                className="w-full bg-white dark:bg-neutral-950 border border-blue-500 text-sm px-2 py-1 rounded outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600"
                                placeholder={`Name...`}
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                onBlur={() => { if(!newFileName) setIsCreating(null); }}
                                />
                            </form>
                        )}
                        
                        {/* File List */}
                        {getFilesByCategory(category).map((file) => (
                            <div 
                            key={file.name} 
                            draggable={category === 'Chapters'}
                            onDragStart={() => {
                              if (category === 'Chapters') {
                                setDraggedChapterName(file.name);
                              }
                            }}
                            onDragOver={(e) => {
                              if (category === 'Chapters') {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                              }
                            }}
                            onDrop={(e) => {
                              if (category === 'Chapters') {
                                e.preventDefault();
                                void handleChapterDrop(file.name);
                              }
                            }}
                            onDragEnd={() => {
                              if (category === 'Chapters') {
                                setDraggedChapterName(null);
                              }
                            }}
                            onClick={() => onSelectFile(file.path)} // Pass full relative path (e.g. "Chapters/Ch1.md")
                            className={`group flex items-center justify-between py-1 px-2 rounded text-sm ${category === 'Chapters' ? 'cursor-move' : 'cursor-pointer'} ${activeFile === file.name || activeFile === file.path ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-neutral-800'} ${draggedChapterName === file.name ? 'opacity-60' : ''}`}
                            >
                            <div className="flex items-center gap-2 overflow-hidden w-full">
                                {(() => {
                                    if (file.category === 'Places') {
                                        return <MapPin size={14} className="text-emerald-500 min-w-[14px]" />;
                                    }
                                    if (file.category === 'Objects') {
                                        return <Package size={14} className="text-amber-500 min-w-[14px]" />; // Changed icon to Package
                                    }
                                    if (file.name.endsWith('.json')) {
                                        return <FileJson size={14} className="text-yellow-500 min-w-[14px]" />;
                                    }
                                    return <FileText size={14} className="text-blue-400 min-w-[14px]" />;
                                })()}
                                
                                {editingFile?.name === file.name && editingFile?.category === file.category ? (
                                <form onSubmit={handleRename} className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                    <input
                                    autoFocus
                                    title='Rename file'
                                    placeholder='New name'
                                    type="text"
                                    className="w-full bg-white dark:bg-neutral-950 border border-blue-500 px-1 py-0.5 rounded outline-none text-gray-900 dark:text-white text-xs"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    // onBlur={() => setEditingFile(null)} // Conflict with save button click sometimes
                                    onClick={(e) => e.stopPropagation()}
                                    />
                                </form>
                                ) : (
                                <span className="truncate">{file.name.replace(/\.[^/.]+$/, "")}</span>
                                )}
                            </div>

                            {/* Actions on Hover */}
                            <div className="hidden group-hover:flex items-center gap-1 ml-2">
                                <button 
                                onClick={(e) => { e.stopPropagation(); startRename(file); }}
                                className="p-1 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-700 rounded"
                                title="Rename"
                                >
                                <Edit2 size={12} />
                                </button>
                                <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                                className="p-1 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded"
                                title="Delete"
                                >
                                <Trash2 size={12} />
                                </button>
                            </div>
                            </div>
                        ))}
                        {getFilesByCategory(category).length === 0 && !isCreating && (
                            <div className="text-xs text-gray-400 dark:text-neutral-600 px-2 py-1 italic">Empty</div>
                        )}
                    </div>
                )}
            </div>
        ))}
        
      </div>
    </div>
  );
}
