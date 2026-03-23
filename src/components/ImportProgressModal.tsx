import { useState, useEffect } from 'react';
import { FileText, BookOpen, Users, MapPin, Package, Building2, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';

interface ImportSummary {
    chapters: number;
    characters: number;
    places: number;
    objects: number;
    organisations: number;
}

interface ImportProgressModalProps {
    filePath: string;
    onClose: () => void;
    onComplete: () => void;
}

type Stage = 'reading' | 'analyzing' | 'parsing' | 'creating' | 'finalizing' | 'done' | 'error';

const stageConfig: Record<Stage, { icon: typeof FileText; label: string }> = {
    reading: { icon: FileText, label: 'Reading file' },
    analyzing: { icon: BookOpen, label: 'Analysing with AI' },
    parsing: { icon: FileText, label: 'Parsing results' },
    creating: { icon: Package, label: 'Creating project files' },
    finalizing: { icon: Building2, label: 'Finalising' },
    done: { icon: CheckCircle2, label: 'Import complete' },
    error: { icon: AlertCircle, label: 'Error' },
};

const stageOrder: Stage[] = ['reading', 'analyzing', 'parsing', 'creating', 'finalizing', 'done'];

export function ImportProgressModal({ filePath, onClose, onComplete }: ImportProgressModalProps) {
    const [currentStage, setCurrentStage] = useState<Stage>('reading');
    const [detail, setDetail] = useState('Starting import...');
    const [summary, setSummary] = useState<ImportSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [completedStages, setCompletedStages] = useState<Set<Stage>>(new Set());

    useEffect(() => {
        // Listen for progress updates
        const removeProgress = window.ipcRenderer.on('import-text-progress', (_: any, data: { stage: string; detail: string }) => {
            const stage = data.stage as Stage;
            setCurrentStage(stage);
            setDetail(data.detail);

            // Mark previous stages as completed
            const idx = stageOrder.indexOf(stage);
            if (idx > 0) {
                setCompletedStages(prev => {
                    const next = new Set(prev);
                    for (let i = 0; i < idx; i++) {
                        next.add(stageOrder[i]);
                    }
                    return next;
                });
            }
            if (stage === 'done') {
                setCompletedStages(prev => {
                    const next = new Set(prev);
                    stageOrder.forEach(s => next.add(s));
                    return next;
                });
            }
        });

        // Start the import
        (async () => {
            try {
                // @ts-ignore
                const result = await window.ipcRenderer.invoke('import-text', filePath);
                if (result.success) {
                    setSummary(result.summary);
                    setCurrentStage('done');
                    setDetail('Import complete!');
                    setCompletedStages(new Set(stageOrder));
                } else {
                    setError(result.error || 'Unknown error');
                    setCurrentStage('error');
                }
            } catch (e) {
                setError(String(e));
                setCurrentStage('error');
            }
        })();

        return () => {
            removeProgress();
        };
    }, [filePath]);

    const isDone = currentStage === 'done';
    const isError = currentStage === 'error';

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-700">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileText size={20} />
                        Import Text
                    </h2>
                    {(isDone || isError) && (
                        <button onClick={isDone ? () => { onComplete(); onClose(); } : onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200" title="Close">
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Progress Steps */}
                <div className="px-6 py-4 space-y-3">
                    {stageOrder.filter(s => s !== 'done').map((stage) => {
                        const config = stageConfig[stage];
                        const Icon = config.icon;
                        const isActive = currentStage === stage;
                        const isCompleted = completedStages.has(stage);

                        return (
                            <div key={stage} className={`flex items-center gap-3 transition-opacity ${isActive || isCompleted ? 'opacity-100' : 'opacity-40'}`}>
                                {isCompleted ? (
                                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                                ) : isActive ? (
                                    <Loader2 size={18} className="text-blue-500 animate-spin shrink-0" />
                                ) : (
                                    <Icon size={18} className="text-neutral-400 shrink-0" />
                                )}
                                <span className={`text-sm ${isActive ? 'font-medium text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-700 dark:text-green-400' : ''}`}>
                                    {config.label}
                                </span>
                                {isActive && (
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate ml-auto max-w-[200px]">
                                        {detail}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Error */}
                {isError && error && (
                    <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-2 text-red-700 dark:text-red-400">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <p className="text-sm">{error}</p>
                        </div>
                    </div>
                )}

                {/* Summary */}
                {isDone && summary && (
                    <div className="px-6 py-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-3">Successfully imported:</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-green-700 dark:text-green-400">
                            <div className="flex items-center gap-2"><BookOpen size={14} /> {summary.chapters} chapters</div>
                            <div className="flex items-center gap-2"><Users size={14} /> {summary.characters} characters</div>
                            <div className="flex items-center gap-2"><MapPin size={14} /> {summary.places} places</div>
                            <div className="flex items-center gap-2"><Package size={14} /> {summary.objects} objects</div>
                            <div className="flex items-center gap-2"><Building2 size={14} /> {summary.organisations} organisations</div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-200 dark:border-neutral-700 flex justify-end">
                    {isDone ? (
                        <button
                            onClick={() => { onComplete(); onClose(); }}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                            Done
                        </button>
                    ) : isError ? (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-neutral-600 text-white rounded hover:bg-neutral-700 transition-colors text-sm font-medium"
                        >
                            Close
                        </button>
                    ) : (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            This may take a minute for large texts...
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
