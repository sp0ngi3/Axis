import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { EditorDrawer, EmptyState, PaginationControls, TextArea, TextField } from '../components/common';
import { formatDateTime, paginate } from '../lib/format';
import type { FocusNote } from '../types';

const pageSize = 12;
type Visibility = 'active' | 'archived' | 'all';

type Props = {
  notes: FocusNote[];
  busy: boolean;
  onSave: (body: unknown, id?: string) => void;
  onDelete: (id: string) => void;
};

export function FocusNotesPage({ notes, busy, onSave, onDelete }: Props) {
  const [selected, setSelected] = useState<FocusNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('active');
  const [page, setPage] = useState(1);

  const labels = useMemo(
    () => Array.from(new Set(notes.map((note) => note.label).filter(Boolean))).sort(),
    [notes]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = notes.filter((note) => {
    const matchesQuery = !normalizedQuery
      || `${note.title} ${note.content} ${note.label}`.toLowerCase().includes(normalizedQuery);
    const matchesLabel = !label || note.label === label;
    const matchesVisibility = visibility === 'all'
      || (visibility === 'archived' ? note.isArchived : !note.isArchived);
    return matchesQuery && matchesLabel && matchesVisibility;
  });
  const paged = paginate(filtered, page, pageSize);

  useEffect(() => setPage(1), [query, label, visibility]);

  function closeEditor() {
    setIsCreating(false);
    setSelected(null);
  }

  function updateNote(note: FocusNote, changes: Partial<FocusNote>) {
    onSave({
      title: note.title,
      content: note.content,
      label: note.label,
      color: note.color,
      isPinned: note.isPinned,
      isArchived: note.isArchived,
      ...changes
    }, note.id);
  }

  function deleteNote(note: FocusNote) {
    if (window.confirm('Delete this focus note?')) onDelete(note.id);
  }

  return (
    <section className="workspace-grid drawer-workspace focus-page">
      <div className="workspace-main">
        <section className="focus-board-header">
          <div><p className="eyebrow">Attention board</p><h3>{notes.filter((note) => !note.isArchived).length} active focus notes</h3><p>Keep the current week visible. Pin the few notes that should win your attention.</p></div>
          <button onClick={() => { setSelected(null); setIsCreating(true); }}>New focus note</button>
        </section>

        <div className="filter-bar focus-filter-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search focus notes" />
          <select value={label} onChange={(event) => setLabel(event.target.value)}><option value="">All labels</option>{labels.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select>
        </div>

        <div className="focus-note-grid">
          {paged.items.map((note) => <FocusNoteCard key={note.id} note={note} busy={busy} onUpdate={updateNote} onEdit={setSelected} onDelete={deleteNote} />)}
        </div>

        {filtered.length === 0 && <EmptyState text="No focus notes match this view." />}
        <PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} />
      </div>

      <EditorDrawer open={isCreating || selected !== null} label={selected ? 'Edit focus note' : 'New focus note'} onClose={closeEditor}>
        <FocusNoteForm note={selected} busy={busy} onSave={(body) => { onSave(body, selected?.id); closeEditor(); }} />
      </EditorDrawer>
    </section>
  );
}

function FocusNoteCard(props: {
  note: FocusNote;
  busy: boolean;
  onUpdate: (note: FocusNote, changes: Partial<FocusNote>) => void;
  onEdit: (note: FocusNote) => void;
  onDelete: (note: FocusNote) => void;
}) {
  const note = props.note;
  return (
    <article className={`focus-note ${note.isPinned ? 'pinned' : ''} ${note.isArchived ? 'archived' : ''}`} style={{ '--focus-color': note.color } as CSSProperties}>
      <i className="focus-note-fold" aria-hidden="true" />
      <div className="focus-note-meta"><span>{note.label || 'Focus'}</span>{note.isPinned && <strong>PINNED</strong>}</div>
      <h3>{note.title || 'Untitled focus'}</h3>
      <p>{note.content || 'No details yet.'}</p>
      <small>Updated {formatDateTime(note.updatedAt)}</small>
      <div className="focus-note-actions">
        <button className="secondary-button" disabled={props.busy} onClick={() => props.onUpdate(note, { isPinned: !note.isPinned })}>{note.isPinned ? 'Unpin' : 'Pin'}</button>
        <button className="secondary-button" disabled={props.busy} onClick={() => props.onUpdate(note, { isArchived: !note.isArchived })}>{note.isArchived ? 'Restore' : 'Archive'}</button>
        <button className="secondary-button" onClick={() => props.onEdit(note)}>Edit</button>
        <button className="danger-button" onClick={() => props.onDelete(note)}>Delete</button>
      </div>
    </article>
  );
}

function FocusNoteForm(props: { note: FocusNote | null; busy: boolean; onSave: (body: unknown) => void }) {
  const [draft, setDraft] = useState({
    title: props.note?.title ?? '',
    content: props.note?.content ?? '',
    label: props.note?.label ?? '',
    color: props.note?.color ?? '#7f6cff',
    isPinned: props.note?.isPinned ?? true,
    isArchived: props.note?.isArchived ?? false
  });

  return (
    <form className="editor-form focus-note-form" onSubmit={(event) => { event.preventDefault(); props.onSave(draft); }}>
      <TextField label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
      <TextArea label="What matters right now" value={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      <TextField label="Label" value={draft.label} onChange={(label) => setDraft({ ...draft, label })} />
      <label className="field"><span>Note color</span><div className="focus-color-control"><input aria-label="Focus note color picker" type="color" value={isHexColor(draft.color) ? draft.color : '#7f6cff'} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /><input aria-label="Focus note color hex" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} placeholder="#7f6cff" /></div></label>
      <label className="toggle-field"><input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })} /><span>Pin on Today</span></label>
      <label className="toggle-field"><input type="checkbox" checked={draft.isArchived} onChange={(event) => setDraft({ ...draft, isArchived: event.target.checked })} /><span>Archived</span></label>
      <button disabled={props.busy || (!draft.title.trim() && !draft.content.trim())}>Save focus note</button>
    </form>
  );
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value);
}
