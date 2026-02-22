import { useState, useEffect } from 'react';
import { Save, MapPin } from 'lucide-react';

interface PlaceData {
  name: string;
  aka: string;
  description: string;
}

interface PlaceCardProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
}

export function PlaceCard({ initialContent, onSave, fileName }: PlaceCardProps) {
  const [data, setData] = useState<PlaceData>({
    name: fileName.replace('.json', ''),
    aka: '',
    description: ''
  });

  useEffect(() => {
    try {
      if (initialContent) {
        const parsed = JSON.parse(initialContent);
        setData({
             name: parsed.name || fileName.replace('.json', ''),
             aka: parsed.aka || '',
             description: parsed.description || ''
        });
      }
    } catch (e) {
      console.error("Failed to parse place data", e);
    }
  }, [initialContent, fileName]);

  const handleChange = (field: keyof PlaceData, value: string) => {
    setData({ ...data, [field]: value });
  };

  const handleSave = () => {
    onSave(JSON.stringify(data, null, 2));
  };return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-950">
        <div className="flex items-center gap-2">
            <MapPin className="text-emerald-500" size={18} />
            <h2 className="font-bold text-gray-900 dark:text-white max-w-xs truncate">{data.name}</h2>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
        >
          <Save size={14} /> Save
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Identity Group */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Name</label>
                    <input 
                        type="text" 
                        value={data.name} 
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded p-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Also Known As</label>
                    <input 
                        type="text" 
                        value={data.aka} 
                        onChange={(e) => handleChange('aka', e.target.value)}
                        className="w-full bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded p-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
                        placeholder="nicknames, alternate names..."
                    />
                </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Description</label>
                <textarea 
                    value={data.description} 
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full h-64 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded p-4 text-gray-800 dark:text-white focus:border-blue-500 focus:outline-none text-base leading-relaxed"
                    placeholder="Describe the sensory details, atmosphere, history, and significance of this place..."
                />
            </div>

        </div>
      </div>
    </div>
  );
}
