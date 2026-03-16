import { useState, useEffect } from 'react';
import { Save, Building2, Users, Plus, X } from 'lucide-react';

interface Member {
  name: string;
  role: string;
}

interface OrganisationData {
  name: string;
  goals: string;
  members: Member[];
}

interface OrganisationCardProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
}

export function OrganisationCard({ initialContent, onSave, fileName }: OrganisationCardProps) {
  const [data, setData] = useState<OrganisationData>({
    name: fileName.replace('.json', ''),
    goals: '',
    members: []
  });
  const [isDirty, setIsDirty] = useState(false);
  const [characterFiles, setCharacterFiles] = useState<{ name: string; path: string }[]>([]);

  useEffect(() => {
    try {
      if (initialContent) {
        const parsed = JSON.parse(initialContent);
        setData({
          name: parsed.name || fileName.replace('.json', ''),
          goals: parsed.goals || '',
          members: Array.isArray(parsed.members) ? parsed.members : []
        });
        setIsDirty(false);
      }
    } catch (e) {
      console.error("Failed to parse organisation data", e);
    }
  }, [initialContent, fileName]);

  useEffect(() => {
    refreshCharacterFiles();
  }, [fileName]);

  const refreshCharacterFiles = async () => {
    try {
      // @ts-ignore
      const files: any[] = await window.ipcRenderer.invoke('get-files');
      const chars = (files || [])
        .filter((f: any) => f.category === 'Characters' && typeof f.name === 'string')
        .map((f: any) => ({ name: f.name.replace('.json', ''), path: f.path }));
      setCharacterFiles(chars);
    } catch (e) {
      console.error('Failed to load character list', e);
    }
  };

  const handleChange = (field: 'name' | 'goals', value: string) => {
    setData({ ...data, [field]: value });
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(JSON.stringify(data, null, 2));
    setIsDirty(false);
  };

  const addMember = () => {
    setData({ ...data, members: [...data.members, { name: '', role: '' }] });
    setIsDirty(true);
  };

  const updateMember = (index: number, field: keyof Member, value: string) => {
    const newMembers = [...data.members];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setData({ ...data, members: newMembers });
    setIsDirty(true);
  };

  const removeMember = (index: number) => {
    const newMembers = data.members.filter((_, i) => i !== index);
    setData({ ...data, members: newMembers });
    setIsDirty(true);
  };

  const availableCharacters = characterFiles.filter(
    c => !data.members.some(m => m.name.toLowerCase() === c.name.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900 overflow-hidden text-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-950">
        <div className="flex items-center gap-2">
          <Building2 className="text-violet-500" size={18} />
          <h2 className="font-bold text-gray-900 dark:text-white max-w-xs truncate">{data.name}</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className={`flex items-center gap-2 text-white px-3 py-1.5 rounded text-sm transition-colors ${
            isDirty ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer' : 'bg-gray-300 dark:bg-neutral-700 cursor-default'
          }`}
        >
          <Save size={14} /> Save
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => handleChange('name', e.target.value)}
              title="Organisation name"
              placeholder="Organisation name"
              className="w-full bg-white dark:bg-neutral-800 border-l-2 border-violet-500 p-3 text-gray-900 dark:text-white focus:outline-none transition-colors"
            />
          </div>

          {/* Goals / Aims */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-fuchsia-400 uppercase tracking-wider">Goals / Aims</label>
            <textarea
              value={data.goals}
              onChange={(e) => handleChange('goals', e.target.value)}
              className="w-full h-40 bg-white dark:bg-neutral-800 border-l-2 border-fuchsia-500 p-4 text-gray-800 dark:text-white focus:outline-none text-sm leading-relaxed resize-none placeholder-gray-400 dark:placeholder-neutral-500"
              placeholder="What does this organisation aim to achieve? What are its motivations and objectives..."
            />
          </div>

          {/* Members */}
          <section className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Users size={14} /> Members
              </label>
              <button
                onClick={addMember}
                className="text-xs text-cyan-400 hover:text-cyan-300 bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded flex items-center gap-1"
              >
                <Plus size={12} /> Add Member
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {data.members.map((member, idx) => (
                <div key={idx} className="flex gap-2 bg-gray-100 dark:bg-neutral-800 p-2 rounded border-l-2 border-cyan-500 items-center">
                  <div className="w-1/3 relative">
                    <input
                      type="text"
                      list={`char-list-${idx}`}
                      className="w-full bg-white dark:bg-neutral-900 text-gray-900 dark:text-white px-2 py-1 rounded text-sm"
                      placeholder="Character name"
                      value={member.name}
                      onChange={(e) => updateMember(idx, 'name', e.target.value)}
                    />
                    <datalist id={`char-list-${idx}`}>
                      {availableCharacters.map(c => (
                        <option key={c.name} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <input
                    type="text"
                    className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white px-2 py-1 rounded flex-1 text-sm"
                    placeholder="Role (e.g. Leader, Spy, Treasurer)..."
                    value={member.role}
                    onChange={(e) => updateMember(idx, 'role', e.target.value)}
                  />
                  <button
                    onClick={() => removeMember(idx)}
                    className="text-neutral-500 hover:text-red-400 px-2"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {data.members.length === 0 && (
                <div className="text-gray-400 dark:text-neutral-600 text-sm italic text-center py-4 bg-gray-100/30 dark:bg-neutral-800/30 rounded">
                  No members added. Click "Add Member" to add characters to this organisation.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
