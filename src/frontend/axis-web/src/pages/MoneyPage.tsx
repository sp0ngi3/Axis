import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { ReadableChart } from '../ReadableChart';
import { EditorDrawer, EmptyState, NumberField, PaginationControls, SectionTitle, SummaryPill, TextArea, TextField } from '../components/common';
import { formatDateTime, formatMoney, formatShortDate, paginate } from '../lib/format';
import type { SavingsEntry, WishlistItem } from '../types';

const pageSize = 12;

type Props = {
  savings: SavingsEntry[];
  wishlist: WishlistItem[];
  busy: boolean;
  onSaveSavings: (body: unknown, id?: string) => void;
  onDeleteSavings: (id: string) => void;
  onSaveWish: (body: unknown, id?: string) => void;
  onDeleteWish: (id: string) => void;
};

export function MoneyPage(props: Props) {
  const [mode, setMode] = useState<'wishlist' | 'savings'>('wishlist');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [selectedWish, setSelectedWish] = useState<WishlistItem | null>(null);
  const [selectedSaving, setSelectedSaving] = useState<SavingsEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const currentSavings = useMemo(() => latestSavingsAmount(props.savings), [props.savings]);
  const activeTotal = props.wishlist.filter((item) => !item.isPurchased).reduce((sum, item) => sum + item.price, 0);
  const purchasedTotal = props.wishlist.filter((item) => item.isPurchased).reduce((sum, item) => sum + item.price, 0);
  const coverage = activeTotal <= 0 ? 0 : Math.min(100, Math.round(currentSavings / activeTotal * 100));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredWishlist = props.wishlist.filter((item) => {
    const matchesQuery = !normalizedQuery || `${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery);
    const matchesFilter = filter === 'all' || (filter === 'done' ? item.isPurchased : !item.isPurchased);
    return matchesQuery && matchesFilter;
  });
  const filteredSavings = props.savings.filter((item) => !normalizedQuery || item.note.toLowerCase().includes(normalizedQuery));
  const pagedWishlist = paginate(filteredWishlist, page, pageSize);
  const pagedSavings = paginate(filteredSavings, page, pageSize);

  useEffect(() => setPage(1), [query, filter, mode]);

  function closeEditor() {
    setIsCreating(false);
    setSelectedWish(null);
    setSelectedSaving(null);
  }

  function startCreating() {
    setSelectedWish(null);
    setSelectedSaving(null);
    setIsCreating(true);
  }

  return (
    <section className="workspace-grid drawer-workspace money-page">
      <div className="workspace-main">
        <section className="money-hero">
          <div><p className="eyebrow">Capital dashboard</p><h3>{formatMoney(currentSavings)} saved</h3><p>{coverage}% of the active wishlist is covered.</p></div>
          <div className="money-orbit" style={{ '--money-progress': `${coverage * 3.6}deg` } as CSSProperties}><strong>{coverage}%</strong><span>coverage</span></div>
        </section>

        <div className="money-metrics">
          <SummaryPill label="Saved" value={formatMoney(currentSavings)} />
          <SummaryPill label="Wishlist" value={formatMoney(activeTotal)} />
          <SummaryPill label="Purchased" value={formatMoney(purchasedTotal)} />
          <SummaryPill label="Items" value={props.wishlist.length} />
        </div>

        <MoneyTrajectoryChart entries={props.savings} wishlistTotal={activeTotal} />

        <div className="collection-header">
          <div className="segmented-control">
            <button className={mode === 'wishlist' ? 'active' : ''} onClick={() => setMode('wishlist')}>Wishlist</button>
            <button className={mode === 'savings' ? 'active' : ''} onClick={() => setMode('savings')}>Savings log</button>
          </div>
          <button onClick={startCreating}>{mode === 'wishlist' ? 'Add wish' : 'Record balance'}</button>
        </div>

        <div className="filter-bar">
          <input placeholder={`Search ${mode}`} value={query} onChange={(event) => setQuery(event.target.value)} />
          {mode === 'wishlist' && <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Wishlist</option><option value="done">Purchased</option><option value="all">All</option></select>}
        </div>

        {mode === 'wishlist'
          ? <WishlistGrid items={pagedWishlist.items} currentSavings={currentSavings} onSave={props.onSaveWish} onEdit={(item) => { setSelectedWish(item); setSelectedSaving(null); setIsCreating(false); }} onDelete={props.onDeleteWish} />
          : <SavingsTimeline items={pagedSavings.items} onEdit={(item) => { setSelectedSaving(item); setSelectedWish(null); setIsCreating(false); }} onDelete={props.onDeleteSavings} />}

        {(mode === 'wishlist' ? pagedWishlist.items.length : pagedSavings.items.length) === 0 && <EmptyState text="Nothing matches this view." />}
        <PaginationControls
          page={page}
          totalPages={mode === 'wishlist' ? pagedWishlist.totalPages : pagedSavings.totalPages}
          totalItems={mode === 'wishlist' ? filteredWishlist.length : filteredSavings.length}
          onPage={setPage}
        />
      </div>

      <EditorDrawer open={isCreating || selectedWish !== null || selectedSaving !== null} label={mode === 'wishlist' ? 'Wishlist item' : 'Savings balance'} onClose={closeEditor}>
        {mode === 'wishlist'
          ? <WishlistForm item={selectedWish} busy={props.busy} onSave={(body) => { props.onSaveWish(body, selectedWish?.id); closeEditor(); }} />
          : <SavingsForm entry={selectedSaving} busy={props.busy} onSave={(body) => { props.onSaveSavings(body, selectedSaving?.id); closeEditor(); }} />}
      </EditorDrawer>
    </section>
  );
}

function latestSavingsAmount(entries: SavingsEntry[]) {
  return entries.reduce<SavingsEntry | null>((latest, entry) => {
    if (!latest) return entry;
    return new Date(entry.recordedAt).getTime() > new Date(latest.recordedAt).getTime() ? entry : latest;
  }, null)?.amount ?? 0;
}

function WishlistGrid(props: {
  items: WishlistItem[];
  currentSavings: number;
  onSave: (body: unknown, id?: string) => void;
  onEdit: (item: WishlistItem) => void;
  onDelete: (id: string) => void;
}) {
  return <div className="entity-grid">{props.items.map((item) => {
    const affordable = props.currentSavings >= item.price;
    const progress = Math.min(100, props.currentSavings / Math.max(1, item.price) * 100);
    return <article className={`entity-card money-item ${item.isPurchased ? 'purchased' : ''}`} key={item.id}>
      <div className="entity-card-top"><span>Priority {item.priority}</span><strong>{formatMoney(item.price)}</strong></div>
      <h3>{item.name}</h3>
      <p>{item.description || 'No notes.'}</p>
      <div className="meter"><i style={{ width: `${progress}%` }} /></div>
      <small>{item.isPurchased ? `Purchased ${formatShortDate(item.purchasedAt ?? undefined)}` : affordable ? 'Affordable from current savings' : `${formatMoney(item.price - props.currentSavings)} still needed`}</small>
      <div className="card-actions">
        <button onClick={() => props.onSave({ name: item.name, description: item.description, price: item.price, priority: item.priority, isPurchased: !item.isPurchased }, item.id)}>{item.isPurchased ? 'Return to wishlist' : 'Mark purchased'}</button>
        <button className="secondary-button" onClick={() => props.onEdit(item)}>Edit</button>
        <button className="danger-button" onClick={() => props.onDelete(item.id)}>Delete</button>
      </div>
    </article>;
  })}</div>;
}

function SavingsTimeline(props: { items: SavingsEntry[]; onEdit: (item: SavingsEntry) => void; onDelete: (id: string) => void }) {
  return <div className="history-timeline">{props.items.map((item) => <article className="timeline-entry" key={item.id}>
    <time>{formatShortDate(item.recordedAt)}</time>
    <div><h4>{formatMoney(item.amount)}</h4><p>{item.note || 'Balance update'}</p></div>
    <div className="row-actions"><button className="secondary-button" onClick={() => props.onEdit(item)}>Edit</button><button className="danger-button" onClick={() => props.onDelete(item.id)}>Delete</button></div>
  </article>)}</div>;
}

function MoneyTrajectoryChart({ entries, wishlistTotal }: { entries: SavingsEntry[]; wishlistTotal: number }) {
  const [mode, setMode] = useState<'line' | 'bars'>('line');
  const rows = [...entries].sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime());
  const balances = rows.map((item) => item.amount);
  const current = rows.at(-1)?.amount ?? 0;
  const highest = balances.length ? Math.max(...balances) : 0;
  const delta = rows.length > 1 ? current - rows[0].amount : 0;
  const targetCoverage = wishlistTotal > 0 ? Math.min(100, current / wishlistTotal * 100) : 0;
  const targetFitsChart = wishlistTotal > 0 && wishlistTotal <= Math.max(1, highest) * 1.4;
  const data = rows.map((item) => ({
    id: item.id,
    label: formatShortDate(item.recordedAt),
    values: { balance: item.amount },
    detail: item.note || formatDateTime(item.recordedAt)
  }));

  return <section className="surface money-trend professional-chart">
    <div className="collection-header flush-header">
      <SectionTitle kicker="Savings history" title="Capital trajectory" />
      <div className="segmented-control compact"><button className={mode === 'line' ? 'active' : ''} onClick={() => setMode('line')}>Line</button><button className={mode === 'bars' ? 'active' : ''} onClick={() => setMode('bars')}>Bars</button></div>
    </div>
    <div className="chart-insight-strip">
      <span><small>Current</small><strong>{formatMoney(current)}</strong></span>
      <span><small>Change</small><strong>{delta >= 0 ? '+' : ''}{formatMoney(delta)}</strong></span>
      <span><small>Highest</small><strong>{formatMoney(highest)}</strong></span>
      <span><small>Wishlist target</small><strong>{formatMoney(wishlistTotal)}</strong></span>
    </div>
    <ReadableChart data={data} series={[{ key: 'balance', label: 'Saved balance', color: '#55f0d0' }]} mode={mode} min={0} references={targetFitsChart ? [{ label: 'Wishlist target', value: wishlistTotal, color: '#d66cf2' }] : []} formatValue={formatMoney} ariaLabel="Savings balance over time" emptyText="Record a savings balance to start the chart." />
    {wishlistTotal > 0 && <div className="money-target-progress">
      <div><span>Wishlist funding</span><strong>{targetCoverage.toFixed(1)}%</strong></div>
      <div className="meter" aria-label={`${targetCoverage.toFixed(1)}% of wishlist funded`}><i style={{ width: `${targetCoverage}%` }} /></div>
      <small>{current >= wishlistTotal ? 'Your current savings cover the active wishlist.' : `${formatMoney(wishlistTotal - current)} remains to cover the active wishlist.`}{!targetFitsChart && highest > 0 ? ' The target is shown separately so it does not flatten the balance chart.' : ''}</small>
    </div>}
  </section>;
}

function WishlistForm(props: { item: WishlistItem | null; busy: boolean; onSave: (body: unknown) => void }) {
  const [draft, setDraft] = useState({
    name: props.item?.name ?? '',
    description: props.item?.description ?? '',
    price: props.item?.price ?? 0,
    priority: props.item?.priority ?? 3,
    isPurchased: props.item?.isPurchased ?? false
  });

  return <form className="editor-form" onSubmit={(event) => { event.preventDefault(); props.onSave(draft); }}>
    <TextField label="Item" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
    <TextArea label="Why I want it" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} />
    <NumberField label="Price" value={draft.price} step={0.01} onChange={(price) => setDraft({ ...draft, price })} />
    <NumberField label="Priority 1-5" value={draft.priority} min={1} max={5} onChange={(priority) => setDraft({ ...draft, priority })} />
    <label className="toggle-field"><input type="checkbox" checked={draft.isPurchased} onChange={(event) => setDraft({ ...draft, isPurchased: event.target.checked })} /><span>Purchased</span></label>
    <button disabled={props.busy}>Save item</button>
  </form>;
}

function SavingsForm(props: { entry: SavingsEntry | null; busy: boolean; onSave: (body: unknown) => void }) {
  const [amount, setAmount] = useState(props.entry?.amount ?? 0);
  const [note, setNote] = useState(props.entry?.note ?? '');

  return <form className="editor-form" onSubmit={(event) => { event.preventDefault(); props.onSave({ amount, note }); }}>
    <NumberField label="Current saved amount" value={amount} step={0.01} onChange={setAmount} />
    <TextField label="Note" value={note} onChange={setNote} />
    <small className="helper-copy">A new balance creates a point on the savings chart.</small>
    <button disabled={props.busy}>Record balance</button>
  </form>;
}
