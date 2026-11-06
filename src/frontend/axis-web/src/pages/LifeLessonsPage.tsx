import { useEffect, useMemo, useState } from 'react';
import { EditorDrawer, EmptyState, PaginationControls, TextArea, TextField } from '../components/common';
import { formatShortDate, paginate } from '../lib/format';
import type { LifeLesson } from '../types';

const pageSize = 12;

type Props = {
  lessons: LifeLesson[];
  busy: boolean;
  onSave: (body: unknown, id?: string) => void;
  onDelete: (id: string) => void;
};

export function LifeLessonsPage({ lessons, busy, onSave, onDelete }: Props) {
  const [selected, setSelected] = useState<LifeLesson | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => Array.from(new Set(lessons.map((lesson) => lesson.category).filter(Boolean))).sort(),
    [lessons]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = lessons.filter((lesson) => {
    const matchesQuery = !normalizedQuery
      || `${lesson.title} ${lesson.content} ${lesson.source}`.toLowerCase().includes(normalizedQuery);
    return matchesQuery && (!category || lesson.category === category);
  });
  const paged = paginate(filtered, page, pageSize);

  useEffect(() => setPage(1), [query, category]);

  function closeEditor() {
    setIsCreating(false);
    setSelected(null);
  }

  function deleteLesson(lesson: LifeLesson) {
    if (window.confirm('Delete this lesson?')) onDelete(lesson.id);
  }

  return (
    <section className="workspace-grid drawer-workspace lessons-page">
      <div className="workspace-main">
        <section className="collection-header">
          <div><p className="eyebrow">Personal operating manual</p><h3>{lessons.length} life lessons</h3></div>
          <button onClick={() => { setSelected(null); setIsCreating(true); }}>Add lesson</button>
        </section>

        <div className="filter-bar">
          <input placeholder="Search lessons" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="lesson-grid">
          {paged.items.map((lesson) => (
            <article className={`entity-card lesson-card ${lesson.isPinned ? 'pinned' : ''}`} key={lesson.id}>
              <div className="entity-card-top"><span className="color-chip">{lesson.category || 'Life'}</span>{lesson.isPinned && <strong>PINNED</strong>}</div>
              <h3>{lesson.title}</h3>
              <blockquote>{lesson.content}</blockquote>
              {lesson.source && <p className="muted-copy">Source: {lesson.source}</p>}
              <small>{formatShortDate(lesson.createdAt)}</small>
              <div className="card-actions">
                <button className="secondary-button" onClick={() => { setSelected(lesson); setIsCreating(false); }}>Edit</button>
                <button className="danger-button" onClick={() => deleteLesson(lesson)}>Delete</button>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && <EmptyState text="No lessons match this search." />}
        <PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} />
      </div>

      <EditorDrawer open={isCreating || selected !== null} label={selected ? 'Edit life lesson' : 'Add life lesson'} onClose={closeEditor}>
        <LifeLessonForm
          lesson={selected}
          busy={busy}
          onSave={(body) => {
            onSave(body, selected?.id);
            closeEditor();
          }}
        />
      </EditorDrawer>
    </section>
  );
}

function LifeLessonForm(props: { lesson: LifeLesson | null; busy: boolean; onSave: (body: unknown) => void }) {
  const [draft, setDraft] = useState({
    title: props.lesson?.title ?? '',
    content: props.lesson?.content ?? '',
    category: props.lesson?.category ?? '',
    source: props.lesson?.source ?? '',
    isPinned: props.lesson?.isPinned ?? false
  });

  return (
    <form className="editor-form" onSubmit={(event) => { event.preventDefault(); props.onSave(draft); }}>
      <TextField label="Lesson title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
      <TextArea label="Advice to future me" value={draft.content} onChange={(content) => setDraft({ ...draft, content })} />
      <TextField label="Category" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} />
      <TextField label="Source or situation" value={draft.source} onChange={(source) => setDraft({ ...draft, source })} />
      <label className="toggle-field"><input type="checkbox" checked={draft.isPinned} onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })} /><span>Pin this lesson</span></label>
      <button disabled={props.busy}>Save lesson</button>
    </form>
  );
}
