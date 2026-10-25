'use client';

import { useState } from 'react';
import { FolderIcon } from './Icons';
import './views.css';

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
    <div className="v-page">
      <div className="v-page-inner narrow">
        <header className="v-head">
          <div>
            <h1>Files &amp; folders</h1>
            <p className="sub">
              Create or open a file using Node&apos;s <code className="mono">fs</code> layer in the Electron main process.
            </p>
          </div>
        </header>

        <section className="glass v-card flex flex-col gap-4">
          <h2 className="v-card-title">
            <FolderIcon width={16} height={16} /> File
          </h2>
          <div>
            <label className="v-field-label" htmlFor="files-path">
              File path
            </label>
            <input
              id="files-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="e.g. notes.txt"
              className="field"
            />
          </div>
          <div>
            <label className="v-field-label" htmlFor="files-content">
              Content <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· used when creating</span>
            </label>
            <textarea
              id="files-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="field"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreate} className="btn accent">
              Create file
            </button>
            <button onClick={handleOpen} className="btn">
              Open file
            </button>
          </div>
          {status && <p className="v-caption">{status}</p>}
        </section>
      </div>
    </div>
  );
}
