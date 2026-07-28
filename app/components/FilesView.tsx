'use client';

import { useState } from 'react';
import { FolderIcon } from './Icons';

export default function FilesView() {
  const [path, setPath] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const isElectron = typeof window !== 'undefined' && !!window.jarvis?.isElectron;

  const handleCreate = async () => {
    if (!path.trim()) return;
    if (!isElectron) {
      setStatus('File operations require the Electron desktop build.');
      return;
    }
    const result = await window.jarvis!.createFile(path, content);
    setStatus(result.message);
  };

  const handleOpen = async () => {
    if (!path.trim()) return;
    if (!isElectron) {
      setStatus('File operations require the Electron desktop build.');
      return;
    }
    const result = await window.jarvis!.openFile(path);
    setStatus(result.message);
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-2xl">
      <h2 className="text-[15px] font-semibold mb-1 flex items-center gap-2">
        <FolderIcon width={18} height={18} /> Files &amp; Folders
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--jarvis-subtext)' }}>
        Create or open a file using Node&apos;s <code>fs</code> layer in the Electron main process.
      </p>

      <div className="glass-panel rounded-lg p-3.5 flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--jarvis-subtext)' }}>
            File path
          </label>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="e.g. notes.txt"
            className="w-full mt-1 rounded-lg px-3 py-2 text-sm glass-panel outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium" style={{ color: 'var(--jarvis-subtext)' }}>
            Content (used when creating)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full mt-1 rounded-lg px-3 py-2 text-sm glass-panel outline-none resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={handleCreate} className="px-3 py-1.5 rounded-md text-[12px] font-medium text-white" style={{ backgroundColor: 'var(--jarvis-accent)' }}>
            Create File
          </button>
          <button onClick={handleOpen} className="px-3 py-1.5 rounded-md text-[12px] font-medium glass-panel">
            Open File
          </button>
        </div>
        {status && (
          <p className="text-xs" style={{ color: 'var(--jarvis-subtext)' }}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
