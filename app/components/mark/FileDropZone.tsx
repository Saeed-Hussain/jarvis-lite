'use client';

import { useRef, useState } from 'react';

// ── file helpers (Mark's _FILE_ICONS / _EXT_TO_CAT / _fmt_size) ─────────────

const FILE_ICONS: Record<string, [string, string]> = {
  image: ['🖼', '#00d4ff'],
  video: ['🎬', '#ff6b00'],
  audio: ['🎵', '#cc44ff'],
  pdf: ['📄', '#ff4444'],
  word: ['📝', '#4488ff'],
  excel: ['📊', '#44bb44'],
  code: ['💻', '#ffcc00'],
  archive: ['📦', '#ff8844'],
  pptx: ['📊', '#ff6622'],
  text: ['📃', '#aaaaaa'],
  data: ['🔧', '#88ddff'],
  unknown: ['📎', '#888888'],
};

const EXT_TO_CAT: Record<string, string> = {};
const cat = (exts: string, c: string) => exts.split(' ').forEach((e) => (EXT_TO_CAT[e] = c));
cat('jpg jpeg png gif webp bmp tiff svg ico', 'image');
cat('mp4 avi mov mkv wmv flv webm m4v', 'video');
cat('mp3 wav ogg m4a aac flac wma opus', 'audio');
cat('pdf', 'pdf');
cat('doc docx', 'word');
cat('xls xlsx ods', 'excel');
cat('ppt pptx', 'pptx');
cat('py js ts jsx tsx html css java c cpp cs go rs rb php swift kt sh sql lua', 'code');
cat('zip rar tar gz 7z bz2 xz', 'archive');
cat('txt md rst log', 'text');
cat('csv tsv json xml', 'data');

export interface PathParts {
  name: string;
  parent: string;
  /** Extension without the dot, as written ('' if none). */
  ext: string;
}

export function splitPath(p: string): PathParts {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
  const name = i >= 0 ? p.slice(i + 1) : p;
  const parent = i > 0 ? p.slice(0, i) : '';
  const dot = name.lastIndexOf('.');
  return { name, parent, ext: dot > 0 ? name.slice(dot + 1) : '' };
}

export function fileIcon(path: string): [string, string] {
  return FILE_ICONS[EXT_TO_CAT[splitPath(path).ext.toLowerCase()] || 'unknown'] || FILE_ICONS.unknown;
}

export function fmtSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(1)} GB`;
}

/** Electron gives renderer File objects their absolute path. */
function filePath(f: File | null | undefined): string | null {
  const p = (f as unknown as { path?: string } | null)?.path;
  return p || null;
}

// ── the zone ────────────────────────────────────────────────────────────────

interface Props {
  file: string | null;
  size: number | null;
  onPick(path: string, size: number | null): void;
  onClear(): void;
  assistantName?: string;
}

/** Drop a file or click to browse. One line at rest; the target grows while dragging. */
export default function FileDropZone({ file, size, onPick, onClear, assistantName = 'Jarvis' }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const browse = () => inputRef.current?.click();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // Only the first item, and only a real file — a dropped folder is refused,
    // as Mark's is_file() check refused it.
    const item = e.dataTransfer.items?.[0];
    const entry = item && typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
    if (entry && !entry.isFile) return;
    const f = e.dataTransfer.files?.[0];
    const p = filePath(f);
    if (f && p) onPick(p, f.size);
  };

  const name = assistantName.charAt(0).toUpperCase() + assistantName.slice(1).toLowerCase();

  return (
    <div
      className={`mk-drop${dragOver ? ' over' : ''}${file ? ' loaded' : ''}`}
      onClick={() => (file ? undefined : browse())}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!file && (e.key === 'Enter' || e.key === ' ')) browse();
      }}
    >
      {file ? <Loaded file={file} size={size} name={name} onClear={onClear} onReplace={browse} /> : dragOver ? <DragOver /> : <Idle />}
      <input
        ref={inputRef}
        type="file"
        hidden
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const f = e.target.files?.[0];
          const p = filePath(f);
          if (f && p) onPick(p, f.size);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Idle() {
  return (
    <>
      <span className="mk-drop-ico">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 16V4M7 9l5-5 5 5" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
      </span>
      <span className="mk-drop-text">
        <b>Drop a file</b> or click to browse
        <small>Images, PDFs, documents, code, data, audio, video</small>
      </span>
    </>
  );
}

function DragOver() {
  return (
    <>
      <span className="mk-drop-ico">⬇</span>
      <span className="mk-drop-text">
        <b>Release to load</b>
      </span>
    </>
  );
}

function Loaded({
  file,
  size,
  name,
  onClear,
  onReplace,
}: {
  file: string;
  size: number | null;
  name: string;
  onClear(): void;
  onReplace(): void;
}) {
  const { name: fname, ext } = splitPath(file);
  const [icon] = fileIcon(file);
  const meta = [ext.toUpperCase() || 'FILE', size != null ? fmtSize(size) : null].filter(Boolean).join(' · ');
  return (
    <>
      <span className="mk-drop-ico file" style={{ fontFamily: "'Segoe UI Emoji', 'Apple Color Emoji', sans-serif" }}>
        {icon}
      </span>
      <span className="mk-drop-text" title={file}>
        <b className="mk-ellipsis">{fname}</b>
        <small>
          {meta} · ask {name} what to do with it
        </small>
      </span>
      <button
        className="btn ghost icon sm"
        onClick={(e) => {
          e.stopPropagation();
          onReplace();
        }}
        title="Choose another file"
        aria-label="Choose another file"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <path d="M4 4v6h6M20 20v-6h-6" />
          <path d="M20 10a8 8 0 0 0-14.3-4.3L4 8M4 14a8 8 0 0 0 14.3 4.3L20 16" />
        </svg>
      </button>
      <button
        className="btn ghost icon sm danger"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        title="Remove"
        aria-label="Remove file"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </>
  );
}
