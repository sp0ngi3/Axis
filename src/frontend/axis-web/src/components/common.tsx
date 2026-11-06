import { type CSSProperties, type ReactNode, useEffect } from 'react';

export function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="section-title">
      <p className="eyebrow">{kicker}</p>
      <h3>{title}</h3>
    </div>
  );
}

export function EditorShell(props: { title: string; children: ReactNode; onCancel: () => void }) {
  return (
    <section className="surface editor-shell">
      <div className="editor-heading">
        <SectionTitle kicker="Editor" title={props.title} />
        <button className="ghost-button compact" onClick={props.onCancel}>
          Clear
        </button>
      </div>
      {props.children}
    </section>
  );
}

export function EditorDrawer(props: { open: boolean; label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!props.open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <>
      <button
        className="goal-drawer-backdrop"
        aria-label={`Close ${props.label}`}
        onClick={props.onClose}
      />
      <aside className="goals-editor-panel app-editor-drawer" aria-label={props.label}>
        {props.children}
      </aside>
    </>
  );
}

export function VaporNavButton(props: {
  item: { label: string; kicker: string; icon: string };
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={props.isActive ? 'vapor-nav-button active' : 'vapor-nav-button'}
      onClick={props.onSelect}
    >
      <i className="nav-glyph" aria-hidden="true">
        {props.item.icon}
      </i>
      <span className="nav-copy">
        <small>{props.item.kicker}</small>
        <strong>{props.item.label}</strong>
      </span>
    </button>
  );
}

export function GoalProgressRing(props: { value: number; color: string; label: string; size?: 'small' | 'large' }) {
  const value = Math.max(0, Math.min(100, Number(props.value) || 0));
  const style = {
    '--ring-value': `${value * 3.6}deg`,
    '--ring-color': props.color
  } as CSSProperties;

  return (
    <div
      className={`goal-progress-ring ${props.size ?? 'large'}`}
      style={style}
      aria-label={`${props.label}: ${value}%`}
    >
      <div>
        <strong>{Math.round(value)}%</strong>
        <span>{props.label}</span>
      </div>
    </div>
  );
}

export function SummaryPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="summary-pill">
      <span>{label}</span>
      <strong>{value}</strong>
      <i aria-hidden="true" />
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}

export function PaginationControls(props: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPage: (page: number) => void;
}) {
  if (props.totalPages <= 1) return null;

  return (
    <div className="pagination-bar">
      <span>
        {props.totalItems} items · page {props.page} of {props.totalPages}
      </span>
      <div className="button-row">
        <button
          className="secondary-button"
          disabled={props.page <= 1}
          onClick={() => props.onPage(props.page - 1)}
        >
          Previous
        </button>
        <button
          className="secondary-button"
          disabled={props.page >= props.totalPages}
          onClick={() => props.onPage(props.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function TextField(props: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        required={props.required}
      />
    </label>
  );
}

export function TextArea(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field full">
      <span>{props.label}</span>
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

export function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number | 'any';
  min?: number;
  max?: number;
}) {
  const inputMode = props.step && props.step !== 1 ? 'decimal' : 'numeric';
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        inputMode={inputMode}
        step={props.step ?? 1}
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function NumberOrBlankField(props: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  step?: number | 'any';
  min?: number;
  max?: number;
}) {
  const inputMode = props.step && props.step !== 1 ? 'decimal' : 'numeric';
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        inputMode={inputMode}
        step={props.step ?? 1}
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

export function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
