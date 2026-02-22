import { useState } from 'react';

interface NewProjectModalProps {
  onConfirm: (data: { name: string; location: string; overview: string }) => void;
  onCancel: () => void;
}

export function NewProjectModal({ onConfirm, onCancel }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [overview, setOverview] = useState('');

  const handleBrowse = async () => {
     // @ts-ignore
     const result = await window.ipcRenderer.invoke('select-directory');
     if (result) {
         setLocation(result);
     }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(name && location) {
        onConfirm({ name, location, overview });
        setName('');
        setLocation('');
        setOverview('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 p-6 rounded-lg w-[500px] shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Project</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-neutral-400 mb-1">Project Name</label>
            <input
              type="text"
              required
              className="w-full bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded p-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Great Novel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-neutral-400 mb-1">Location</label>
            <div className="flex gap-2">
                <input
                type="text"
                required
                readOnly
                className="flex-1 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded p-2 text-gray-700 dark:text-white focus:outline-none focus:border-blue-500 cursor-not-allowed"
                value={location}
                placeholder="Select a folder..."
                />
                <button 
                  type="button" 
                  onClick={handleBrowse}
                  className="bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-900 dark:text-white px-3 py-2 rounded"
                >
                    Browse
                </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-neutral-400 mb-1">Story Overview</label>
            <textarea
              className="w-full bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded p-2 text-gray-900 dark:text-white h-24 focus:outline-none focus:border-blue-500"
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="A brief summary of what your story is about..."
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name || !location}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
