
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
      }
    } catch (e) {
      console.error("Failed to parse object data", e);
    }
  }, [initialContent, fileName]);

  const handleChange = (field: keyof ObjectData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(JSON.stringify(data, null, 2));
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
           className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
        >
           <Save size={14} /> Save
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         
         <div className="grid grid-cols-2 gap-4">
             {/* Name Field */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Object Name</label>
                <input 
                    type="text" 
                    value={data.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded p-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none transition-colors"
                />
             </div>
             {/* AKA Field */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Also Known As</label>
                <input 
                    type="text" 
                    value={data.aka}
                    onChange={(e) => handleChange('aka', e.target.value)}
                    className="w-full bg-white dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded p-2 text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="Aliases, technical names..."
                />
             </div>
         </div>

         {/* Description */}
         <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Description</label>
            <textarea 
                value={data.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full h-32 bg-white dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded p-2 text-gray-800 dark:text-white focus:border-blue-500 focus:outline-none transition-colors resize-y"
                placeholder="Describe the object..."
            />
         </div>

         {/* Properties */}
         <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Properties</label>
            <textarea 
                value={data.properties}
                onChange={(e) => handleChange('properties', e.target.value)}
                className="w-full h-32 bg-white dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded p-2 text-gray-800 dark:text-white focus:border-blue-500 focus:outline-none transition-colors resize-y px-2 font-mono text-sm"
                placeholder="List special properties, stats, or magical effects..."
            />
         </div>

      </div>
    </div>
  );
}
