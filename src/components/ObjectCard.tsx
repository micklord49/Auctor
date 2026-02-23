
import { useState, useEffect } from 'react';
import { Save, Package } from 'lucide-react'; // Changed icon to Package

interface ObjectData {
  name: string;
  aka: string;
  description: string;
  properties: string;
}

interface ObjectCardProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
}

export function ObjectCard({ initialContent, onSave, fileName }: ObjectCardProps) {
  const [data, setData] = useState<ObjectData>({
    name: fileName.replace('.json', ''),
    aka: '',
    description: '',
    properties: ''
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    try {
      if (initialContent) {
        const parsed = JSON.parse(initialContent);
        setData({
             name: parsed.name || fileName.replace('.json', ''),
             aka: parsed.aka || '',
             description: parsed.description || '',
             properties: parsed.properties || ''
        });
        setIsDirty(false);
      }
    } catch (e) {
      console.error("Failed to parse object data", e);
    }
  }, [initialContent, fileName]);

  const handleChange = (field: keyof ObjectData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(JSON.stringify(data, null, 2));
    setIsDirty(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-neutral-900 overflow-hidden text-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-950">
        <div className="flex items-center gap-2">
            <Package className="text-amber-500" size={18} />
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         
         <div className="grid grid-cols-2 gap-4">
             {/* Name Field */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">Object Name</label>
                <input 
                    type="text" 
                    value={data.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    title="Object name"
                    placeholder="Object name"
                    className="w-full bg-white dark:bg-neutral-800 border-l-2 border-amber-500 p-3 text-gray-900 dark:text-white focus:outline-none transition-colors"
                />
             </div>
             {/* AKA Field */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Also Known As</label>
                <input 
                    type="text" 
                    value={data.aka}
                    onChange={(e) => handleChange('aka', e.target.value)}
                    className="w-full bg-white dark:bg-neutral-800 border-l-2 border-gray-300 dark:border-neutral-700 p-3 text-gray-900 dark:text-white focus:outline-none transition-colors placeholder-gray-400 dark:placeholder-neutral-600"
                    placeholder="Aliases, technical names..."
                />
             </div>
         </div>

         {/* Description */}
         <div className="space-y-2">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">Description</label>
            <textarea 
                value={data.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full h-32 bg-white dark:bg-neutral-800 border-l-2 border-amber-500 p-3 text-gray-800 dark:text-white focus:outline-none transition-colors resize-none placeholder-gray-400 dark:placeholder-neutral-500 text-sm leading-relaxed"
                placeholder="Describe the object..."
            />
         </div>

         {/* Properties */}
         <div className="space-y-2">
            <label className="text-xs font-bold text-orange-400 uppercase tracking-wider">Properties</label>
            <textarea 
                value={data.properties}
                onChange={(e) => handleChange('properties', e.target.value)}
                className="w-full h-32 bg-white dark:bg-neutral-800 border-l-2 border-orange-500 p-3 text-gray-800 dark:text-white focus:outline-none transition-colors resize-none placeholder-gray-400 dark:placeholder-neutral-500 font-mono text-sm"
                placeholder="List special properties, stats, or magical effects..."
            />
         </div>

      </div>
    </div>
  );
}
