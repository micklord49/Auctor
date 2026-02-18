import { useState, useEffect, useRef } from 'react';
import { Save, User, UserCheck, Heart, Users, Target, Plus, X } from 'lucide-react';

interface Relationship {
  target: string;
  description: string;
}

interface LifeStage {
    id: string;
    age: string;
    appearance: string;
    personality: string;
    motivation: string;
}

interface CharacterData {
  name: string;
  aka: string;
  lifeStages: LifeStage[];
  relationships: Relationship[];
}

interface CharacterCardProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
}

export function CharacterCard({ initialContent, onSave, fileName }: CharacterCardProps) {
  const [data, setData] = useState<CharacterData>({
    name: fileName.replace('.json', ''),
    aka: '',
    lifeStages: [{ id: 'default', age: 'Current', appearance: '', personality: '', motivation: '' }],
    relationships: []
  });

  const [activeStageId, setActiveStageId] = useState<string>('default');
    const [characterFiles, setCharacterFiles] = useState<{ name: string; path: string }[]>([]);
    const reciprocalGuardRef = useRef<Set<string>>(new Set());

    const normalizeName = (s: string) => s.trim().toLowerCase();
    const sanitizeFileStem = (s: string) => s.trim().replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();

    const refreshCharacterFiles = async () => {
        try {
            // @ts-ignore
            const files: any[] = await window.ipcRenderer.invoke('get-files');
            const chars = (files || [])
                .filter((f: any) => f.category === 'Characters' && typeof f.name === 'string')
                .map((f: any) => ({ name: f.name, path: f.path }));
            setCharacterFiles(chars);
        } catch (e) {
            console.error('Failed to load character list', e);
        }
    };

    const getCharacterPathByName = (targetName: string) => {
        const targetNorm = normalizeName(targetName);
        if (!targetNorm) return null;

        const found = characterFiles.find((f) => {
            const stem = f.name.replace(/\.json$/i, '');
            return normalizeName(stem) === targetNorm;
        });
        return found?.path ?? null;
    };

    const ensureReciprocalRelationship = async (rel: Relationship) => {
        const target = rel.target?.trim();
        const description = rel.description?.trim();
        const selfName = data.name?.trim();

        if (!target || !description || !selfName) return;
        if (normalizeName(target) === normalizeName(selfName)) return;

        const targetPath = getCharacterPathByName(target);
        if (!targetPath) return;

        // Guard against overlapping writes for the same pair while the user is editing.
        const guardKey = `${normalizeName(selfName)}->${normalizeName(target)}`;
        if (reciprocalGuardRef.current.has(guardKey)) return;
        reciprocalGuardRef.current.add(guardKey);

        try {
            // @ts-ignore
            const readRes = await window.ipcRenderer.invoke('read-file', targetPath);
            if (!readRes?.success) return;

            let other: any;
            try {
                other = JSON.parse(readRes.content);
            } catch {
                other = {};
            }

            const existing: any[] = Array.isArray(other.relationships) ? other.relationships : [];
            const idx = existing.findIndex((r: any) => normalizeName(String(r?.target ?? '')) === normalizeName(selfName));

            if (idx === -1) {
                other.relationships = [...existing, { target: selfName, description }];
            } else {
                const currentDesc = String(existing[idx]?.description ?? '');
                if (currentDesc !== description) {
                    const updated = [...existing];
                    updated[idx] = { ...updated[idx], target: selfName, description };
                    other.relationships = updated;
                } else {
                    return;
                }
            }

            // @ts-ignore
            await window.ipcRenderer.invoke('save-file', targetPath, JSON.stringify(other, null, 2));

            // Let other parts of the UI know files may have changed.
            window.dispatchEvent(new Event('auctor-files-changed'));
        } catch (e) {
            console.error('Failed to write reciprocal relationship', e);
        } finally {
            reciprocalGuardRef.current.delete(guardKey);
        }
    };

  useEffect(() => {
    try {
      if (initialContent) {
        const parsed = JSON.parse(initialContent);

        // Migration for old data format
        let stages: LifeStage[] = [];
        if (parsed.lifeStages && Array.isArray(parsed.lifeStages)) {
            stages = parsed.lifeStages;
        } else {
            // Convert flat structure to first life stage
            stages = [{
                id: 'default',
                age: parsed.age || 'Current',
                appearance: parsed.appearance || '',
                personality: parsed.personality || '',
                motivation: parsed.motivation || ''
            }];
        }

        setData({
             name: parsed.name || fileName.replace('.json', ''),
             aka: parsed.aka || '',
             lifeStages: stages,
             relationships: parsed.relationships || []
        });

         if (stages.length > 0) {
            setActiveStageId(stages[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to parse character data", e);
    }
  }, [initialContent, fileName]);

    useEffect(() => {
        refreshCharacterFiles();
        // Reset the guard when switching characters to avoid suppressing legitimate updates
        reciprocalGuardRef.current = new Set();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileName]);

  const handleChange = (field: keyof CharacterData, value: any) => {
    const newData = { ...data, [field]: value };
    setData(newData);
  };

  const handleStageChange = (field: keyof LifeStage, value: string) => {
      const newStages = data.lifeStages.map(stage => {
          if (stage.id === activeStageId) {
              return { ...stage, [field]: value };
          }
          return stage;
      });
      setData({ ...data, lifeStages: newStages });
  };

  const addLifeStage = () => {
      const newId = Date.now().toString();
      const newStage: LifeStage = {
          id: newId,
          age: 'New Stage',
          appearance: '',
          personality: '',
          motivation: ''
      };
      setData({ ...data, lifeStages: [...data.lifeStages, newStage] });
      setActiveStageId(newId);
  };

  const removeLifeStage = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (data.lifeStages.length <= 1) return; // Prevent deleting last stage
      
      const newStages = data.lifeStages.filter(s => s.id !== id);
      setData({ ...data, lifeStages: newStages });
      
      if (activeStageId === id) {
          setActiveStageId(newStages[0].id);
      }
  };

    const handleSave = () => {
        onSave(JSON.stringify(data, null, 2));
        // Ensure reciprocals are synced with the final, full text.
        void Promise.all(data.relationships.map((r) => ensureReciprocalRelationship(r)));
    };
    
  const addRelationship = () => {
      setData({
          ...data,
          relationships: [...data.relationships, { target: '', description: '' }]
      });
  };

  const updateRelationship = (index: number, field: keyof Relationship, value: string) => {
      const newRels = [...data.relationships];
      newRels[index] = { ...newRels[index], [field]: value };
      setData({ ...data, relationships: newRels });
  };

    const createCharacterFromRelationship = async (targetName: string) => {
        const stem = sanitizeFileStem(targetName);
        if (!stem) return;

        const file = stem.endsWith('.json') ? stem : `${stem}.json`;
        const content = JSON.stringify(
            {
                name: stem.replace(/\.json$/i, ''),
                aka: '',
                lifeStages: [{ id: 'default', age: 'Current', appearance: '', personality: '', motivation: '' }],
                relationships: [],
            },
            null,
            2
        );

        try {
            // @ts-ignore
            await window.ipcRenderer.invoke('create-file', file, content, 'Characters');
            await refreshCharacterFiles();

            window.dispatchEvent(new Event('auctor-files-changed'));
            window.dispatchEvent(new CustomEvent('auctor-open-file', { detail: { path: `Characters/${file}` } }));
        } catch (e) {
            console.error('Failed to create character', e);
        }
    };
    
  const removeRelationship = (index: number) => {
       const newRels = data.relationships.filter((_, i) => i !== index);
       setData({ ...data, relationships: newRels });
  };

  const activeStage = data.lifeStages.find(s => s.id === activeStageId) || data.lifeStages[0];

  return (
    <div className="flex flex-col h-full bg-neutral-900 overflow-y-auto">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-950 sticky top-0 z-10">
        <div className="flex items-center gap-2">
            <User className="text-blue-500" size={18} />
            <h2 className="font-bold text-white max-w-xs truncate" title={data.name}>{data.name}</h2>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
        >
          <Save size={14} /> Save
        </button>
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full space-y-8 pb-20">
        
        {/* Basic Info */}
        <section className="space-y-4">
             <div className="space-y-1">
                <label className="text-sm font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <User size={14} /> Name
                </label>
                <input
                    type="text"
                    className="w-full bg-neutral-800 border-l-2 border-blue-500 p-3 text-white focus:outline-none focus:bg-neutral-750 transition-colors"
                    value={data.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Character Name"
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Also Known As
                </label>
                <input
                    type="text"
                    className="w-full bg-neutral-800 border-l-2 border-neutral-700 p-3 text-white focus:outline-none focus:bg-neutral-750 transition-colors placeholder-neutral-600"
                    value={data.aka || ''}
                    onChange={(e) => handleChange('aka', e.target.value)}
                    placeholder="Nicknames, titles, aliases..."
                />
            </div>
        </section>

        {/* Life Stages Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-800 overflow-x-auto">
            {data.lifeStages.map(stage => (
                <div 
                    key={stage.id}
                    onClick={() => setActiveStageId(stage.id)}
                    className={`
                        group relative px-4 py-2 text-sm font-medium cursor-pointer flex items-center gap-2 min-w-[100px] justify-center transition-colors select-none
                        ${activeStageId === stage.id 
                            ? 'text-white border-b-2 border-blue-500 bg-neutral-800/50' 
                            : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/30'}
                    `}
                >
                    <span className="truncate max-w-[120px]">{stage.age || 'Untitled'}</span>
                    {data.lifeStages.length > 1 && (
                        <button 
                            onClick={(e) => removeLifeStage(e, stage.id)}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded transition-all"
                            title="Remove Stage"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            ))}
            <button 
                onClick={addLifeStage}
                className="px-3 py-2 text-neutral-500 hover:text-blue-400 transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wide"
                title="Add Life Stage"
            >
                <Plus size={14} /> Add Stage
            </button>
        </div>

        {/* Active Stage Content */}
        {activeStage && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Age Label
                    </label>
                    <input 
                        type="text"
                        className="w-full bg-neutral-800 border-l-2 border-neutral-700 p-3 text-white focus:outline-none focus:bg-neutral-750 transition-colors placeholder-neutral-600 font-bold"
                        value={activeStage.age}
                        onChange={(e) => handleStageChange('age', e.target.value)}
                        placeholder="e.g. 24, Childhood, The War Years..."
                    />
                </div>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Appearance */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-green-400 uppercase tracking-wider flex items-center gap-2">
                            <UserCheck size={14} /> Appearance
                        </label>
                        <textarea
                            className="w-full h-40 bg-neutral-800 border-l-2 border-green-500 p-3 text-white focus:outline-none resize-none placeholder-neutral-500 text-sm leading-relaxed"
                            value={activeStage.appearance}
                            onChange={(e) => handleStageChange('appearance', e.target.value)}
                            placeholder="Height, build, hair color, distinctive features..."
                        />
                    </div>

                    {/* Personality */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                            <Heart size={14} /> Personality
                        </label>
                        <textarea
                            className="w-full h-40 bg-neutral-800 border-l-2 border-purple-500 p-3 text-white focus:outline-none resize-none placeholder-neutral-500 text-sm leading-relaxed"
                            value={activeStage.personality}
                            onChange={(e) => handleStageChange('personality', e.target.value)}
                            placeholder="Traits, flaws, fears, habits, how they speak..."
                        />
                    </div>
                </section>

                {/* Motivation */}
                <section className="space-y-2">
                    <label className="text-sm font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
                        <Target size={14} /> Motivation & Goals
                    </label>
                    <textarea
                        className="w-full h-24 bg-neutral-800 border-l-2 border-red-500 p-3 text-white focus:outline-none resize-none placeholder-neutral-500 text-sm leading-relaxed"
                        value={activeStage.motivation}
                        onChange={(e) => handleStageChange('motivation', e.target.value)}
                        placeholder="What do they want at this age? Why?"
                    />
                </section>
            </div>
        )}

        {/* Relationships */}
        <section className="space-y-4 pt-8 border-t border-neutral-800">
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                    <Users size={14} /> Relationships
                </label>
                <button 
                    onClick={addRelationship}
                    className="text-xs text-orange-400 hover:text-orange-300 bg-neutral-800 px-2 py-1 rounded"
                >
                    + Add Relationship
                </button>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
                {data.relationships.map((rel, idx) => (
                    <div key={idx} className="flex gap-2 bg-neutral-800 p-2 rounded border-l-2 border-orange-500">
                        <input 
                            type="text" 
                            className="bg-neutral-900 text-white px-2 py-1 rounded w-1/3 text-sm"
                            placeholder="Character Name"
                            value={rel.target}
                            onChange={(e) => updateRelationship(idx, 'target', e.target.value)}
                            onBlur={() => { void ensureReciprocalRelationship(data.relationships[idx]); }}
                        />
                        <input 
                            type="text" 
                            className="bg-neutral-900 text-white px-2 py-1 rounded flex-1 text-sm"
                            placeholder="Relationship description (e.g. Rival, Sibling)..."
                            value={rel.description}
                            onChange={(e) => updateRelationship(idx, 'description', e.target.value)}
                            onBlur={() => { void ensureReciprocalRelationship(data.relationships[idx]); }}
                        />

                        {rel.target.trim().length > 0 && !getCharacterPathByName(rel.target) && (
                            <button
                                onClick={() => createCharacterFromRelationship(rel.target)}
                                className="text-xs text-blue-300 hover:text-blue-200 bg-neutral-900 px-2 rounded border border-neutral-700"
                                title="Create a Character file for this name"
                            >
                                + Create
                            </button>
                        )}
                        <button 
                            onClick={() => removeRelationship(idx)}
                            className="text-neutral-500 hover:text-red-400 px-2"
                        >
                            ×
                        </button>
                    </div>
                ))}
                
                {data.relationships.length === 0 && (
                    <div className="text-neutral-600 text-sm italic text-center py-4 bg-neutral-800/30 rounded">
                        No relationships defined.
                    </div>
                )}
            </div>
        </section>

      </div>
    </div>
  );
}
