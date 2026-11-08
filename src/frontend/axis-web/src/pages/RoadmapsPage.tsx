import { type CSSProperties, type KeyboardEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from 'react';
import { EditorDrawer, EmptyState, PaginationControls, TextArea, TextField } from '../components/common';
import { formatShortDate, paginate } from '../lib/format';
import { layoutRoadmap } from '../lib/roadmapLayout';
import type { Goal, Roadmap, RoadmapItem, RoadmapItemStatus, RoadmapLayoutDirection } from '../types';

const pageSize = 8;
const roadmapStatuses: RoadmapItemStatus[] = ['Planned', 'InProgress', 'Completed', 'Skipped'];

type RoadmapBody = {
  title: string;
  description: string;
  color: string;
  layoutDirection: RoadmapLayoutDirection;
  isArchived: boolean;
};

type RoadmapItemBody = {
  goalId: string | null;
  title: string;
  description: string;
  status: RoadmapItemStatus;
  targetDate: string | null;
  sortOrder: number | null;
  dependencyIds: string[];
};

type Props = {
  roadmaps: Roadmap[];
  goals: Goal[];
  busy: boolean;
  onSaveRoadmap: (body: RoadmapBody, id?: string) => void;
  onDeleteRoadmap: (id: string) => void;
  onSaveItem: (roadmapId: string, body: RoadmapItemBody, id?: string) => void;
  onMoveItem: (id: string, direction: number) => void;
  onDeleteItem: (id: string) => void;
};

export function RoadmapsPage(props: Props) {
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<'active' | 'archived' | 'all'>('active');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [creatingRoadmap, setCreatingRoadmap] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [newItemDependencies, setNewItemDependencies] = useState<string[]>([]);
  const [zoom, setZoom] = useState(responsiveRoadmapZoom);
  const [centerRequest, setCenterRequest] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => props.roadmaps.filter((roadmap) => {
    const matchesQuery = !normalizedQuery
      || `${roadmap.title} ${roadmap.description} ${roadmap.items.map((item) => item.title).join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesVisibility = visibility === 'all'
      || (visibility === 'archived' ? roadmap.isArchived : !roadmap.isArchived);
    return matchesQuery && matchesVisibility;
  }), [normalizedQuery, props.roadmaps, visibility]);
  const paged = paginate(filtered, page, pageSize);
  const selected = filtered.find((roadmap) => roadmap.id === selectedId) ?? filtered[0] ?? null;
  const selectedItem = selected?.items.find((item) => item.id === selectedItemId) ?? null;

  useEffect(() => setPage(1), [query, visibility]);
  useEffect(() => {
    if (!selectedId || !filtered.some((roadmap) => roadmap.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);
  useEffect(() => {
    if (!selected?.items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(selected?.items[0]?.id ?? null);
    }
  }, [selected?.id, selected?.items, selectedItemId]);
  useEffect(() => {
    setZoom(responsiveRoadmapZoom());
    setCenterRequest((value) => value + 1);
  }, [selected?.id]);

  const totalItems = props.roadmaps.reduce((sum, roadmap) => sum + roadmap.items.length, 0);
  const completedItems = props.roadmaps.reduce(
    (sum, roadmap) => sum + roadmap.items.filter((item) => item.status === 'Completed').length,
    0
  );
  const linkedGoals = new Set(
    props.roadmaps.flatMap((roadmap) => roadmap.items.map((item) => item.goalId).filter(Boolean))
  ).size;

  function closeRoadmapEditor() {
    setCreatingRoadmap(false);
    setEditingRoadmap(null);
  }

  function closeItemEditor() {
    setCreatingItem(false);
    setEditingItem(null);
    setNewItemDependencies([]);
  }

  function addCheckpoint(dependencyIds: string[] = []) {
    setEditingItem(null);
    setNewItemDependencies(dependencyIds);
    setCreatingItem(true);
  }

  function deleteRoadmap(roadmap: Roadmap) {
    if (window.confirm(`Delete “${roadmap.title}” and its roadmap steps? Linked Goals will not be deleted.`)) {
      props.onDeleteRoadmap(roadmap.id);
    }
  }

  function setDirection(direction: RoadmapLayoutDirection) {
    if (!selected || (selected.layoutDirection ?? 'Vertical') === direction) return;
    props.onSaveRoadmap(roadmapBody(selected, direction), selected.id);
  }

  return (
    <section className="roadmaps-page" style={{ '--roadmap-color': selected?.color ?? '#7f6cff' } as CSSProperties}>
      <section className="roadmap-hero surface">
        <div className="roadmap-hero-copy">
          <p className="eyebrow">Strategic navigation</p>
          <h3>Build a route that branches, converges, and stays readable.</h3>
          <p>Connect checkpoints into a visual graph. Each node can stand alone or mirror a live Goal and its milestones.</p>
        </div>
        <div className="roadmap-hero-stats" aria-label="Roadmap summary">
          <RoadmapStat label="Roadmaps" value={props.roadmaps.filter((item) => !item.isArchived).length} />
          <RoadmapStat label="Completed nodes" value={`${completedItems}/${totalItems}`} />
          <RoadmapStat label="Linked goals" value={linkedGoals} />
        </div>
        <button onClick={() => { setEditingRoadmap(null); setCreatingRoadmap(true); }}>New roadmap</button>
        <div className="roadmap-horizon" aria-hidden="true"><i /><i /><i /></div>
      </section>

      <section className="roadmap-library surface">
        <div className="section-heading roadmap-library-heading">
          <div><p className="eyebrow">Route library</p><h3>Your roadmaps</h3></div>
          <div className="filter-row compact">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roadmaps or nodes" />
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <div className="roadmap-library-grid">
          {paged.items.map((roadmap) => (
            <RoadmapLibraryCard key={roadmap.id} roadmap={roadmap} selected={selected?.id === roadmap.id} onSelect={() => setSelectedId(roadmap.id)} />
          ))}
        </div>
        {filtered.length === 0 && <EmptyState text="No roadmaps match this view." />}
        <PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} />
      </section>

      {selected && (
        <section className="roadmap-workspace surface">
          <header className="roadmap-workspace-header">
            <div>
              <p className="eyebrow">Visual route</p>
              <h2>{selected.title}</h2>
              <p>{selected.description || 'No roadmap description yet.'}</p>
            </div>
            <RoadmapProgress roadmap={selected} />
            <div className="roadmap-header-actions">
              <button className="secondary-button" onClick={() => setEditingRoadmap(selected)}>Edit roadmap</button>
              <button onClick={() => addCheckpoint()}>Add node</button>
              <button className="danger-button" onClick={() => deleteRoadmap(selected)}>Delete</button>
            </div>
          </header>

          {selected.items.length > 0 ? (
            <>
              <div className="roadmap-graph-toolbar">
                <div className="roadmap-direction-toggle" aria-label="Roadmap direction">
                  <button className={(selected.layoutDirection ?? 'Vertical') === 'Vertical' ? 'active' : ''} onClick={() => setDirection('Vertical')}>↓ Down</button>
                  <button className={(selected.layoutDirection ?? 'Vertical') === 'Horizontal' ? 'active' : ''} onClick={() => setDirection('Horizontal')}>→ Right</button>
                </div>
                <div className="roadmap-zoom-controls" aria-label="Roadmap zoom">
                  <button className="secondary-button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(.65, value - .1))}>−</button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button className="secondary-button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.35, value + .1))}>+</button>
                  <button className="secondary-button" onClick={() => setZoom(responsiveRoadmapZoom())}>Fit</button>
                  <button className="secondary-button" onClick={() => setCenterRequest((value) => value + 1)}>Center</button>
                </div>
              </div>
              <div className="roadmap-map-guide" id="roadmap-map-guide">
                <span><b>↕</b> Scroll the page normally</span>
                <span><b>↔</b> Swipe or Shift + wheel to move the map</span>
                <span><b>⌁</b> Select a node for details</span>
              </div>
              <RoadmapGraph
                roadmap={selected}
                goals={props.goals}
                zoom={zoom}
                centerRequest={centerRequest}
                selectedItemId={selectedItem?.id ?? null}
                onSelect={setSelectedItemId}
              />
              {selectedItem && (
                <RoadmapNodeDetails
                  roadmap={selected}
                  item={selectedItem}
                  goal={props.goals.find((goal) => goal.id === selectedItem.goalId)}
                  busy={props.busy}
                  onAddNext={() => addCheckpoint([selectedItem.id])}
                  onEdit={() => setEditingItem(selectedItem)}
                  onDelete={() => {
                    if (window.confirm(`Delete node “${selectedItem.title}”? Its connections will also be removed.`)) props.onDeleteItem(selectedItem.id);
                  }}
                  onStatus={(status) => props.onSaveItem(selected.id, itemBody(selectedItem, status), selectedItem.id)}
                />
              )}
            </>
          ) : (
            <div className="roadmap-empty-route">
              <span aria-hidden="true">/~</span>
              <h3>This graph has no nodes yet.</h3>
              <p>Add an independent node or link one to an existing Goal.</p>
              <button onClick={() => addCheckpoint()}>Add first node</button>
            </div>
          )}
        </section>
      )}

      <EditorDrawer open={creatingRoadmap || editingRoadmap !== null} label={editingRoadmap ? 'Edit roadmap' : 'Create roadmap'} onClose={closeRoadmapEditor}>
        <RoadmapForm key={editingRoadmap?.id ?? 'new-roadmap'} roadmap={editingRoadmap} busy={props.busy} onSave={(body) => { props.onSaveRoadmap(body, editingRoadmap?.id); closeRoadmapEditor(); }} />
      </EditorDrawer>

      <EditorDrawer open={Boolean(selected) && (creatingItem || editingItem !== null)} label={editingItem ? 'Edit roadmap node' : 'Add roadmap node'} onClose={closeItemEditor}>
        {selected && (
          <RoadmapItemForm
            key={editingItem?.id ?? `new-item-${selected.id}-${newItemDependencies.join('-')}`}
            item={editingItem}
            items={selected.items}
            defaultDependencyIds={newItemDependencies}
            goals={props.goals}
            busy={props.busy}
            onSave={(body) => { props.onSaveItem(selected.id, body, editingItem?.id); closeItemEditor(); }}
          />
        )}
      </EditorDrawer>
    </section>
  );
}

function RoadmapGraph(props: {
  roadmap: Roadmap;
  goals: Goal[];
  zoom: number;
  centerRequest: number;
  selectedItemId: string | null;
  onSelect: (id: string) => void;
}) {
  const layout = useMemo(() => layoutRoadmap(props.roadmap.items, props.roadmap.layoutDirection ?? 'Vertical'), [props.roadmap.items, props.roadmap.layoutDirection]);
  const markerId = `roadmap-arrow-${props.roadmap.id.replace(/[^a-z0-9]/gi, '')}`;
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const selectedNode = layout.nodes.find((node) => node.item.id === props.selectedItemId) ?? layout.nodes[0];
    if (!viewport || !selectedNode) return;

    const selectedCenter = (selectedNode.x + selectedNode.width / 2) * props.zoom;
    const targetLeft = Math.max(0, selectedCenter - viewport.clientWidth / 2);
    if (typeof viewport.scrollTo === 'function') {
      viewport.scrollTo({ left: targetLeft, behavior: 'smooth' });
    } else {
      viewport.scrollLeft = targetLeft;
    }
  }, [layout, props.centerRequest, props.roadmap.layoutDirection, props.selectedItemId, props.zoom]);

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaY;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const distance = event.key === 'ArrowLeft' ? -180 : 180;
    if (typeof event.currentTarget.scrollBy === 'function') {
      event.currentTarget.scrollBy({ left: distance, behavior: 'smooth' });
    } else {
      event.currentTarget.scrollLeft += distance;
    }
  }

  return (
    <div
      ref={viewportRef}
      className="roadmap-graph-viewport"
      role="region"
      tabIndex={0}
      aria-label={`${props.roadmap.title} visual roadmap`}
      aria-describedby="roadmap-map-guide"
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
    >
      <div className="roadmap-graph-stage" style={{ width: layout.width * props.zoom, height: layout.height * props.zoom }}>
        <div className="roadmap-graph-canvas" style={{ width: layout.width, height: layout.height, transform: `scale(${props.zoom})` }}>
          <svg className="roadmap-connectors" width={layout.width} height={layout.height} aria-hidden="true">
            <defs><marker id={markerId} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M 0 0 L 9 4.5 L 0 9 z" /></marker></defs>
            {layout.edges.map((edge) => <path key={edge.id} d={edge.path} markerEnd={`url(#${markerId})`} />)}
          </svg>
          {layout.nodes.map((node) => {
            const goal = props.goals.find((item) => item.id === node.item.goalId);
            const progress = goal ? goalProgress(goal) : node.item.status === 'Completed' ? 100 : node.item.status === 'InProgress' ? 50 : 0;
            return (
              <button
                key={node.item.id}
                className={`roadmap-graph-node status-${node.item.status.toLowerCase()} ${props.selectedItemId === node.item.id ? 'selected' : ''}`}
                style={{ left: node.x, top: node.y, width: node.width, height: node.height } as CSSProperties}
                onClick={() => props.onSelect(node.item.id)}
                aria-pressed={props.selectedItemId === node.item.id}
              >
                <span className="roadmap-node-kicker">{goal ? 'GOAL NODE' : node.item.status.replace('InProgress', 'IN PROGRESS')}</span>
                <strong>{node.item.title}</strong>
                <span className="roadmap-node-meta">{node.item.targetDate ? formatShortDate(node.item.targetDate) : `${node.item.dependencyIds?.length ?? 0} incoming`}</span>
                <i><b style={{ width: `${progress}%` }} /></i>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RoadmapNodeDetails(props: {
  roadmap: Roadmap;
  item: RoadmapItem;
  goal?: Goal;
  busy: boolean;
  onAddNext: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: RoadmapItemStatus) => void;
}) {
  const completedMilestones = props.goal?.milestones.filter((milestone) => milestone.status === 'Completed').length ?? 0;
  const predecessors = (props.item.dependencyIds ?? []).map((id) => props.roadmap.items.find((item) => item.id === id)?.title).filter(Boolean);

  return (
    <article className="roadmap-node-details">
      <div className="roadmap-node-details-copy">
        <p className="eyebrow">Selected node · {props.item.status === 'InProgress' ? 'In progress' : props.item.status}</p>
        <h3>{props.item.title}</h3>
        <p>{props.item.description || 'No description for this node yet.'}</p>
        <div className="roadmap-node-relations"><span>Comes after</span><strong>{predecessors.length ? predecessors.join(' · ') : 'Start node'}</strong></div>
      </div>

      {props.goal && (
        <section className="roadmap-linked-goal">
          <div className="roadmap-goal-heading"><div><small>Linked goal</small><strong>{props.goal.title}</strong></div><span>{props.goal.status}</span></div>
          <div className="roadmap-goal-progress"><i style={{ width: `${goalProgress(props.goal)}%` }} /></div>
          <details className="roadmap-milestones" open>
            <summary>Milestones {completedMilestones}/{props.goal.milestones.length}</summary>
            {props.goal.milestones.length > 0 ? props.goal.milestones.map((milestone) => (
              <div className="roadmap-milestone" key={milestone.id}>
                <span className={milestone.status === 'Completed' ? 'complete' : ''} aria-hidden="true" />
                <div><strong>{milestone.title}</strong><small>{Math.round(milestone.progress)}%{milestone.dueDate ? ` · ${formatShortDate(milestone.dueDate)}` : ''}</small></div>
                <i><b style={{ width: `${Math.max(0, Math.min(100, milestone.progress))}%` }} /></i>
              </div>
            )) : <p>No milestones in this Goal yet.</p>}
          </details>
        </section>
      )}

      <div className="roadmap-node-detail-actions">
        <button onClick={props.onAddNext}>Add next</button>
        <button className={props.item.status === 'Completed' ? 'secondary-button' : ''} disabled={props.busy} onClick={() => props.onStatus(props.item.status === 'Completed' ? 'Planned' : 'Completed')}>
          {props.item.status === 'Completed' ? 'Reopen' : 'Complete'}
        </button>
        <button className="secondary-button" onClick={props.onEdit}>Edit</button>
        <button className="danger-button" onClick={props.onDelete}>Delete</button>
      </div>
    </article>
  );
}

function RoadmapStat({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function RoadmapLibraryCard(props: { roadmap: Roadmap; selected: boolean; onSelect: () => void }) {
  const progress = roadmapProgress(props.roadmap);
  return (
    <button className={`roadmap-library-card ${props.selected ? 'selected' : ''}`} style={{ '--card-roadmap-color': props.roadmap.color } as CSSProperties} onClick={props.onSelect}>
      <span className="roadmap-library-signal" aria-hidden="true" />
      <small>{props.roadmap.isArchived ? 'Archived route' : (props.roadmap.layoutDirection ?? 'Vertical') === 'Horizontal' ? 'Flows right' : 'Flows down'}</small>
      <strong>{props.roadmap.title}</strong>
      <p>{props.roadmap.description || 'No description yet.'}</p>
      <div className="roadmap-mini-progress"><i style={{ width: `${progress}%` }} /></div>
      <span>{props.roadmap.completedItems}/{props.roadmap.totalItems} nodes · {progress}%</span>
    </button>
  );
}

function RoadmapProgress({ roadmap }: { roadmap: Roadmap }) {
  const progress = roadmapProgress(roadmap);
  return <div className="roadmap-progress-orbit" style={{ '--route-progress': `${progress * 3.6}deg` } as CSSProperties}><div><strong>{progress}%</strong><span>route complete</span></div></div>;
}

function RoadmapForm(props: { roadmap: Roadmap | null; busy: boolean; onSave: (body: RoadmapBody) => void }) {
  const [draft, setDraft] = useState<RoadmapBody>({
    title: props.roadmap?.title ?? '',
    description: props.roadmap?.description ?? '',
    color: props.roadmap?.color ?? '#7f6cff',
    layoutDirection: props.roadmap?.layoutDirection ?? 'Vertical',
    isArchived: props.roadmap?.isArchived ?? false
  });

  return (
    <form className="editor-form roadmap-form" onSubmit={(event) => { event.preventDefault(); props.onSave(draft); }}>
      <div className="roadmap-form-preview" style={{ '--preview-color': draft.color } as CSSProperties}>
        <i /><span>{draft.layoutDirection === 'Vertical' ? '↓ DOWNWARD GRAPH' : '→ RIGHTWARD GRAPH'}</span><strong>{draft.title || 'Untitled roadmap'}</strong>
      </div>
      <TextField label="Roadmap title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
      <TextArea label="Description and destination" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
      <label className="field"><span>Graph direction</span><select value={draft.layoutDirection} onChange={(event) => setDraft({ ...draft, layoutDirection: event.target.value as RoadmapLayoutDirection })}><option value="Vertical">Down — top to bottom</option><option value="Horizontal">Right — left to right</option></select></label>
      <label className="field">
        <span>Roadmap color</span>
        <div className="roadmap-color-control">
          <input aria-label="Roadmap color picker" type="color" value={isHexColor(draft.color) ? draft.color : '#7f6cff'} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
          <input aria-label="Roadmap color hex" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} placeholder="#7f6cff" />
        </div>
      </label>
      <label className="toggle-field"><input type="checkbox" checked={draft.isArchived} onChange={(event) => setDraft({ ...draft, isArchived: event.target.checked })} /><span>Archive this roadmap</span></label>
      <button disabled={props.busy || !draft.title.trim()}>Save roadmap</button>
    </form>
  );
}

function RoadmapItemForm(props: { item: RoadmapItem | null; items: RoadmapItem[]; defaultDependencyIds: string[]; goals: Goal[]; busy: boolean; onSave: (body: RoadmapItemBody) => void }) {
  const [draft, setDraft] = useState({
    goalId: props.item?.goalId ?? '',
    title: props.item?.title ?? '',
    description: props.item?.description ?? '',
    status: props.item?.status ?? 'Planned' as RoadmapItemStatus,
    targetDate: props.item?.targetDate?.slice(0, 10) ?? '',
    sortOrder: props.item?.sortOrder ?? null,
    dependencyIds: props.item?.dependencyIds ?? props.defaultDependencyIds
  });
  const availableDependencies = props.items.filter((item) => item.id !== props.item?.id);

  function selectGoal(goalId: string) {
    const goal = props.goals.find((item) => item.id === goalId);
    setDraft({ ...draft, goalId, title: draft.title.trim() ? draft.title : goal?.title ?? '' });
  }

  function toggleDependency(id: string) {
    setDraft({ ...draft, dependencyIds: draft.dependencyIds.includes(id) ? draft.dependencyIds.filter((value) => value !== id) : [...draft.dependencyIds, id] });
  }

  return (
    <form className="editor-form roadmap-item-form" onSubmit={(event) => { event.preventDefault(); props.onSave({ ...draft, goalId: draft.goalId || null, targetDate: draft.targetDate || null }); }}>
      <label className="field full"><span>Connected Goal (optional)</span><select value={draft.goalId} onChange={(event) => selectGoal(event.target.value)}><option value="">Independent roadmap node</option>{props.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title} · {goal.status}</option>)}</select></label>
      <TextField label="Node title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required />
      <TextArea label="What needs to happen here" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
      <label className="field"><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as RoadmapItemStatus })}>{roadmapStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label className="field"><span>Target date (optional)</span><input type="date" value={draft.targetDate} onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })} /></label>
      <fieldset className="roadmap-dependency-picker">
        <legend>Comes after (optional)</legend>
        <p>Select one predecessor for a normal path, several to merge branches, or none for a new start.</p>
        {availableDependencies.length > 0 ? (
          <div>{availableDependencies.map((item) => <label key={item.id}><input type="checkbox" checked={draft.dependencyIds.includes(item.id)} onChange={() => toggleDependency(item.id)} /><span><strong>{item.title}</strong><small>{item.status}</small></span></label>)}</div>
        ) : <span className="muted">This will be the first node.</span>}
      </fieldset>
      {draft.goalId && <p className="roadmap-form-hint">Goal milestones are displayed live in the selected-node panel. They remain editable in Goals.</p>}
      <button disabled={props.busy || !draft.title.trim()}>Save node</button>
    </form>
  );
}

function itemBody(item: RoadmapItem, status: RoadmapItemStatus): RoadmapItemBody {
  return { goalId: item.goalId ?? null, title: item.title, description: item.description, status, targetDate: item.targetDate ?? null, sortOrder: item.sortOrder, dependencyIds: item.dependencyIds ?? [] };
}

function roadmapBody(roadmap: Roadmap, direction = roadmap.layoutDirection ?? 'Vertical'): RoadmapBody {
  return { title: roadmap.title, description: roadmap.description, color: roadmap.color, layoutDirection: direction, isArchived: roadmap.isArchived };
}

function roadmapProgress(roadmap: Roadmap) {
  if (roadmap.totalItems === 0) return 0;
  return Math.round(roadmap.completedItems / roadmap.totalItems * 100);
}

function goalProgress(goal: Goal) {
  if (goal.targetValue <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, goal.currentValue / goal.targetValue * 100)));
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value);
}

function responsiveRoadmapZoom() {
  if (typeof window === 'undefined') return 1;
  if (window.innerWidth <= 560) return .86;
  if (window.innerWidth <= 960) return .94;
  return 1;
}
