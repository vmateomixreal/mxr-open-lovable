'use client';

import { FiFile, SiCss3, SiJavascript, SiJson, SiReact } from '@/lib/icons';

export type GenerationFileItem = {
  path: string;
  type?: string;
  content?: string;
};

type GenerationFileListProps = {
  title?: string;
  files: GenerationFileItem[];
  currentFile?: GenerationFileItem | null;
  /** Si true, todos los archivos se muestran como completados (tick). */
  allComplete?: boolean;
  selectedPath?: string | null;
  onFileClick?: (file: GenerationFileItem) => void;
};

function getFileMeta(path: string, typeHint?: string) {
  const name = path.split('/').pop() || path;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const type = (typeHint || ext).toLowerCase();

  if (ext === 'tsx' || ext === 'jsx' || type === 'javascript' || type.includes('react')) {
    return { name, label: ext.toUpperCase() || 'JSX', Icon: SiReact, tone: 'react' as const };
  }
  if (ext === 'css' || ext === 'scss' || type === 'css') {
    return { name, label: 'CSS', Icon: SiCss3, tone: 'css' as const };
  }
  if (ext === 'json' || type === 'json') {
    return { name, label: 'JSON', Icon: SiJson, tone: 'json' as const };
  }
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') {
    return { name, label: 'JS', Icon: SiJavascript, tone: 'js' as const };
  }
  if (ext === 'html' || type === 'html') {
    return { name, label: 'HTML', Icon: FiFile, tone: 'html' as const };
  }
  return { name, label: ext ? ext.toUpperCase() : 'FILE', Icon: FiFile, tone: 'file' as const };
}

function FileRow({
  file,
  status,
  delayMs,
  selected,
  onClick,
}: {
  file: GenerationFileItem;
  status: 'done' | 'loading';
  delayMs: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const { name, label, Icon, tone } = getFileMeta(file.path, file.type);
  const folder = file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '';
  const clickable = Boolean(onClick);

  return (
    <button
      type="button"
      className={[
        'mx-file-row',
        `mx-file-row--${status}`,
        clickable ? 'mx-file-row--clickable' : '',
        selected ? 'mx-file-row--selected' : '',
      ].filter(Boolean).join(' ')}
      style={{ animationDelay: `${delayMs}ms` }}
      onClick={onClick}
      disabled={!clickable}
      title={clickable ? `Ver código de ${name}` : undefined}
    >
      <div className={`mx-file-row__icon mx-file-row__icon--${tone}`} aria-hidden>
        <Icon />
      </div>
      <div className="mx-file-row__meta">
        <span className="mx-file-row__name">{name}</span>
        {folder ? <span className="mx-file-row__path">{folder}</span> : null}
      </div>
      <span className="mx-file-row__badge">{label}</span>
      <div className="mx-file-row__status" aria-label={status === 'done' ? 'Completado' : 'Generando'}>
        {status === 'loading' ? (
          <span className="mx-file-row__spinner" />
        ) : (
          <span className="mx-file-row__check">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 10.5L8.5 14L15 6.5"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}

export default function GenerationFileList({
  title,
  files,
  currentFile,
  allComplete = false,
  selectedPath = null,
  onFileClick,
}: GenerationFileListProps) {
  if (!files.length && !currentFile) return null;

  return (
    <div className="mx-file-list">
      {title ? (
        <div className="mx-file-list__header">
          <span className="mx-file-list__title">{title}</span>
          {!allComplete && currentFile ? (
            <span className="mx-file-list__live">En curso</span>
          ) : null}
        </div>
      ) : null}
      <div className="mx-file-list__body">
        {files.map((file, idx) => (
          <FileRow
            key={`done-${file.path}-${idx}`}
            file={file}
            status="done"
            delayMs={idx * 40}
            selected={selectedPath === file.path}
            onClick={onFileClick ? () => onFileClick(file) : undefined}
          />
        ))}
        {currentFile && !allComplete ? (
          <FileRow
            key={`current-${currentFile.path}`}
            file={currentFile}
            status="loading"
            delayMs={files.length * 40}
            selected={selectedPath === currentFile.path}
            onClick={onFileClick ? () => onFileClick(currentFile) : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
