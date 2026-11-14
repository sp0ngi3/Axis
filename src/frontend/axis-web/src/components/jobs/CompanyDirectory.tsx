import { useEffect, useMemo, useState } from 'react';
import { defaultPageSize } from '../../config';
import { paginate } from '../../lib/format';
import type { Company, CompanyLocation, LocationVisaSponsorship, VisaSponsorship } from '../../types';
import { EditorDrawer, EmptyState, NumberField, PaginationControls, SectionTitle, SelectField, TextArea, TextField } from '../common';

type CompanyDirectoryProps = {
  companies: Company[];
  busy: boolean;
  onCompanySave: (body: unknown, id?: string) => void;
  onCompanyDelete: (id: string) => void;
  onLocationSave: (companyId: string, body: unknown, id?: string) => void;
  onLocationDelete: (id: string) => void;
};

const visaOptions: Array<{ value: VisaSponsorship; label: string }> = [
  { value: 'Unknown', label: 'Unknown / research needed' },
  { value: 'No', label: 'No sponsorship' },
  { value: 'Limited', label: 'Limited / role dependent' },
  { value: 'Yes', label: 'Yes' }
];

const tierOptions = ['S', 'A', 'B', 'C', 'D'].map((value) => ({ value, label: `${value} tier` }));
const scoutingStatusOptions = [
  { value: 'Researching', label: 'Researching' },
  { value: 'Monitoring', label: 'Monitoring' },
  { value: 'OpenRoles', label: 'Open roles' },
  { value: 'NoSuitableRoles', label: 'No suitable roles' },
  { value: 'Priority', label: 'Priority target' }
];
const strategicValueOptions = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'VeryHigh', label: 'Very high' }
];

export function CompanyDirectory(props: CompanyDirectoryProps) {
  const [query, setQuery] = useState('');
  const [visaFilter, setVisaFilter] = useState('');
  const [offersFilter, setOffersFilter] = useState('');
  const [visibility, setVisibility] = useState('active');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => props.companies.filter((company) => {
    const locations = company.locations.map((location) => `${location.name} ${location.city} ${location.region} ${location.country}`).join(' ');
    const haystack = `${company.name} ${company.industry} ${company.headquarters} ${company.techStack} ${company.description} ${company.targetRole} ${company.mainGap} ${company.compensationNotes} ${company.usaOpportunity} ${company.notes} ${locations}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (!visaFilter || company.visaSponsorship === visaFilter || company.locations.some((location) => location.visaSponsorship === visaFilter))
      && (!offersFilter || (offersFilter === 'checked' ? company.jobOffersChecked : !company.jobOffersChecked))
      && (visibility === 'all' || (visibility === 'archived' ? company.isArchived : !company.isArchived));
  }).sort((first, second) => first.name.localeCompare(second.name)), [props.companies, query, visaFilter, offersFilter, visibility]);
  const paged = paginate(filtered, page, defaultPageSize);
  const selected = props.companies.find((company) => company.id === selectedId) ?? null;

  useEffect(() => setPage(1), [query, visaFilter, offersFilter, visibility]);

  return <section className="stack company-directory">
    <section className="surface collection-shell">
      <div className="collection-header">
        <SectionTitle kicker="Company intelligence" title="Companies and offices" />
        <div className="button-row"><span className="record-count">{filtered.length} companies</span><button onClick={() => setCreating(true)}>Add company</button></div>
      </div>
      <div className="filter-bar company-filter-bar">
        <input aria-label="Search companies" placeholder="Search company, technology, office or country..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filter companies by visa sponsorship" value={visaFilter} onChange={(event) => setVisaFilter(event.target.value)}><option value="">All visa policies</option>{visaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <select aria-label="Filter companies by job offer check" value={offersFilter} onChange={(event) => setOffersFilter(event.target.value)}><option value="">All offer checks</option><option value="checked">Offers checked</option><option value="pending">Still to check</option></select>
        <select aria-label="Filter company visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="active">Active companies</option><option value="archived">Archived</option><option value="all">All companies</option></select>
      </div>
      <div className="company-card-grid">
        {paged.items.map((company) => {
          const checkState = companyOfferCheckState(company);
          return <article className={['company-card', checkState, selectedId === company.id ? 'selected' : ''].filter(Boolean).join(' ')} key={company.id}>
          <button className="company-card-main" onClick={() => setSelectedId(company.id)}>
            <span className="company-card-heading"><b className={`company-tier tier-${company.tier.toLowerCase()}`}>{company.tier}</b><span className="company-card-kicker">{company.industry || 'Industry not set'}</span></span>
            <strong>{company.name}</strong>
            <div className="company-scouting-summary"><span><small>Target</small><b>{company.targetRole || 'Not set'}</b></span><span><small>My fit</small><b>{company.myFitRating}/10</b></span><span><small>Status</small><b>{humanize(company.scoutingStatus)}</b></span></div>
            <div className="company-location-preview">{company.locations.slice(0, 3).map((location) => <span key={location.id}>{location.city || location.name}{location.country ? ` · ${location.country}` : ''}</span>)}{company.locations.length > 3 && <span>+{company.locations.length - 3} more</span>}{!company.locations.length && <span className="missing">No locations — add offices</span>}</div>
            {company.mainGap && <small className="company-main-gap">Main gap: {company.mainGap}</small>}
            <div className="company-card-chips"><span className={`visa-chip visa-${company.visaSponsorship.toLowerCase()}`}>Visa: {company.visaSponsorship}</span><span className={company.jobOffersChecked ? 'offer-check-chip checked' : 'offer-check-chip'}>{offerCheckLabel(company)}</span></div>
          </button>
          <label className="company-offer-toggle"><input aria-label={`Job offers checked for ${company.name}`} type="checkbox" checked={company.jobOffersChecked} disabled={props.busy} onChange={(event) => props.onCompanySave(companyRequest(company, event.target.checked), company.id)} /><span>Current offers checked</span></label>
          <div className="row-actions"><button className="secondary-button" onClick={() => setSelectedId(company.id)}>Locations</button><button className="secondary-button" onClick={() => setEditing(company)}>Edit</button><button className="danger-button" onClick={() => window.confirm(`Delete ${company.name}? Applications keep their company and location text.`) && props.onCompanyDelete(company.id)}>Delete</button></div>
        </article>})}
      </div>
      {!paged.items.length && <EmptyState text="No companies match these filters." />}
      <PaginationControls page={page} totalPages={paged.totalPages} totalItems={filtered.length} onPage={setPage} />
    </section>

    {selected && <CompanyWorkspace company={selected} busy={props.busy} onClose={() => setSelectedId(null)} onEdit={() => setEditing(selected)} onLocationSave={props.onLocationSave} onLocationDelete={props.onLocationDelete} />}

    <EditorDrawer open={creating || editing !== null} label={editing ? `Edit ${editing.name}` : 'New company'} onClose={() => { setCreating(false); setEditing(null); }}>
      <CompanyForm company={editing} busy={props.busy} onSave={(body) => { props.onCompanySave(body, editing?.id); setCreating(false); setEditing(null); }} />
    </EditorDrawer>
  </section>;
}

function CompanyWorkspace(props: { company: Company; busy: boolean; onClose: () => void; onEdit: () => void; onLocationSave: CompanyDirectoryProps['onLocationSave']; onLocationDelete: (id: string) => void }) {
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CompanyLocation | null>(null);
  const company = props.company;
  return <section className="surface company-workspace">
    <div className="collection-header"><div><p className="eyebrow">Company profile</p><h3>{company.name}</h3><p>{company.industry || 'Industry not set'} · {company.companySize || 'Size not set'} · HQ: {company.headquarters || 'Not set'}</p></div><div className="button-row"><button className="secondary-button" onClick={props.onEdit}>Edit company</button><button className="secondary-button" onClick={props.onClose}>Close</button></div></div>
    <div className="company-fact-grid">
      <span><small>Visa sponsorship</small><strong>{company.visaSponsorship}</strong></span>
      <span><small>Relocation support</small><strong>{company.relocationSupport ? 'Available' : 'Not confirmed'}</strong></span>
      <span><small>Tracked offices</small><strong>{company.locations.length}</strong></span>
      <span><small>Tier / target</small><strong>{company.tier} · {company.targetRole || 'Not set'}</strong></span>
      <span><small>My fit</small><strong>{company.myFitRating}/10</strong></span>
      <span><small>Strategic value</small><strong>{humanize(company.strategicValue)}</strong></span>
      <span className={company.jobOffersChecked ? 'company-fact-checked' : ''}><small>Current job offers</small><strong>{offerCheckLabel(company)}</strong></span>
      <span><small>Status</small><strong>{company.isArchived ? 'Archived' : 'Active'}</strong></span>
    </div>
    <div className="job-links">{externalLink(company.website, 'Website')}{externalLink(company.careersUrl, 'Careers')}</div>
    {company.description && <section className="company-note"><small>Company brief</small><p>{company.description}</p></section>}
    {company.techStack && <section className="company-note"><small>Technology / domains</small><p>{company.techStack}</p></section>}
    {company.visaNotes && <section className="company-note"><small>Visa notes</small><p>{company.visaNotes}</p></section>}
    {company.mainGap && <section className="company-note"><small>Main preparation gap</small><p>{company.mainGap}</p></section>}
    {company.compensationNotes && <section className="company-note"><small>Compensation intelligence</small><p>{company.compensationNotes}</p></section>}
    {company.usaOpportunity && <section className="company-note"><small>USA opportunity / path</small><p>{company.usaOpportunity}</p></section>}
    {company.notes && <section className="company-note"><small>Research notes</small><p>{company.notes}</p></section>}

    <div className="collection-header company-location-heading"><SectionTitle kicker="Office network" title="Locations" /><button onClick={() => setCreatingLocation(true)}>Add location</button></div>
    <div className="company-location-grid">
      {company.locations.map((location) => <article className={location.isActive ? 'company-location-card' : 'company-location-card inactive'} key={location.id}>
        <div><span className="company-card-kicker">{location.isActive ? 'Active office' : 'Inactive office'}</span><h4>{location.name}</h4><p>{formatLocation(location)}</p></div>
        <span className={`visa-chip visa-${effectiveVisa(location, company).toLowerCase()}`}>Visa: {effectiveVisa(location, company)}</span>
        {location.address && <small>{location.address}</small>}
        {location.notes && <p>{location.notes}</p>}
        <div className="job-links">{externalLink(location.careersUrl, 'Office careers')}</div>
        <div className="row-actions"><button className="secondary-button" onClick={() => setEditingLocation(location)}>Edit</button><button className="danger-button" onClick={() => window.confirm(`Delete ${location.name}? Existing applications keep their location text.`) && props.onLocationDelete(location.id)}>Delete</button></div>
      </article>)}
      {!company.locations.length && <EmptyState text="No offices recorded yet. Add each location where you may apply." />}
    </div>

    <EditorDrawer open={creatingLocation || editingLocation !== null} label={editingLocation ? `Edit ${editingLocation.name}` : `Add ${company.name} location`} onClose={() => { setCreatingLocation(false); setEditingLocation(null); }}>
      <CompanyLocationForm location={editingLocation} busy={props.busy} onSave={(body) => { props.onLocationSave(company.id, body, editingLocation?.id); setCreatingLocation(false); setEditingLocation(null); }} />
    </EditorDrawer>
  </section>;
}

function CompanyForm(props: { company: Company | null; busy: boolean; onSave: (body: unknown) => void }) {
  const company = props.company;
  const [draft, setDraft] = useState({
    name: company?.name ?? '', website: company?.website ?? '', careersUrl: company?.careersUrl ?? '', industry: company?.industry ?? '', companySize: company?.companySize ?? '', headquarters: company?.headquarters ?? '',
    description: company?.description ?? '', techStack: company?.techStack ?? '', visaSponsorship: company?.visaSponsorship ?? 'Unknown' as VisaSponsorship, visaNotes: company?.visaNotes ?? '', relocationSupport: company?.relocationSupport ?? false,
    jobOffersChecked: company?.jobOffersChecked ?? false, jobOffersCheckedAt: company?.jobOffersCheckedAt ?? null, myFitRating: company?.myFitRating ?? 5,
    tier: company?.tier ?? 'B', targetRole: company?.targetRole ?? '', scoutingStatus: company?.scoutingStatus ?? 'Researching', mainGap: company?.mainGap ?? '', compensationNotes: company?.compensationNotes ?? '', strategicValue: company?.strategicValue ?? 'Medium', usaOpportunity: company?.usaOpportunity ?? '',
    notes: company?.notes ?? '', isArchived: company?.isArchived ?? false
  });
  const [locations, setLocations] = useState<CompanyLocationDraft[]>(company ? [] : [newLocationDraft()]);
  const update = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const updateLocation = (id: string, key: keyof Omit<CompanyLocationDraft, 'id'>, value: string) => setLocations((current) => current.map((location) => location.id === id ? { ...location, [key]: value } : location));
  return <form className="editor-form company-form" onSubmit={(event) => { event.preventDefault(); props.onSave({ ...draft, locations: company ? null : locations.filter((location) => location.city.trim() || location.name.trim()).map(toLocationRequest) }); }}>
    <div className="form-grid two"><TextField label="Company name" value={draft.name} onChange={(value) => update('name', value)} required /><TextField label="Industry" value={draft.industry} onChange={(value) => update('industry', value)} /></div>
    <section className="company-scouting-form"><div><p className="eyebrow">Scouting matrix</p><h4>Priority and fit</h4></div><div className="form-grid three"><SelectField label="Tier" value={draft.tier} onChange={(value) => update('tier', value)} options={tierOptions} /><TextField label="Target role" value={draft.targetRole} onChange={(value) => update('targetRole', value)} /><SelectField label="Scouting status" value={draft.scoutingStatus} onChange={(value) => update('scoutingStatus', value)} options={scoutingStatusOptions} /></div><div className="form-grid two"><NumberField label="My fit with this company (1-10)" value={draft.myFitRating} min={1} max={10} onChange={(value) => update('myFitRating', value)} /><SelectField label="Strategic value" value={draft.strategicValue} onChange={(value) => update('strategicValue', value)} options={strategicValueOptions} /></div><TextArea label="Main gap to close" value={draft.mainGap} onChange={(value) => update('mainGap', value)} /><TextArea label="Compensation intelligence" value={draft.compensationNotes} onChange={(value) => update('compensationNotes', value)} /><TextArea label="USA opportunity / long-term path" value={draft.usaOpportunity} onChange={(value) => update('usaOpportunity', value)} /></section>
    <div className="form-grid two"><TextField label="Headquarters" value={draft.headquarters} onChange={(value) => update('headquarters', value)} /><TextField label="Company size" value={draft.companySize} onChange={(value) => update('companySize', value)} /></div>
    <div className="form-grid two"><TextField label="Website" value={draft.website} onChange={(value) => update('website', value)} /><TextField label="Careers URL" value={draft.careersUrl} onChange={(value) => update('careersUrl', value)} /></div>
    {!company && <section className="company-create-locations"><div className="collection-header"><div><p className="eyebrow">Office network</p><h4>Locations available to me</h4><p>Add London, Berlin, Krakow or every other office you may target.</p></div><button type="button" className="secondary-button" onClick={() => setLocations((current) => [...current, newLocationDraft()])}>Add another location</button></div><div className="company-create-location-list">{locations.map((location, index) => <div className="company-create-location" key={location.id}><strong>Location {index + 1}</strong><div className="form-grid three"><TextField label="City" value={location.city} onChange={(value) => updateLocation(location.id, 'city', value)} /><TextField label="Country" value={location.country} onChange={(value) => updateLocation(location.id, 'country', value)} /><TextField label="Office name (optional)" value={location.name} onChange={(value) => updateLocation(location.id, 'name', value)} /></div><button type="button" className="danger-button" onClick={() => setLocations((current) => current.filter((item) => item.id !== location.id))}>Remove</button></div>)}</div></section>}
    {company && <p className="company-location-helper">Locations are preserved separately. Use the <strong>Locations</strong> action on the company card to add, edit or remove offices without overwriting the company profile.</p>}
    <div className="form-grid two"><SelectField label="Visa sponsorship" value={draft.visaSponsorship} onChange={(value) => update('visaSponsorship', value as VisaSponsorship)} options={visaOptions} /><label className="toggle-field company-toggle"><input type="checkbox" checked={draft.relocationSupport} onChange={(event) => update('relocationSupport', event.target.checked)} /><span>Relocation support is available</span></label></div>
    <label className="toggle-field company-offers-form-toggle"><input aria-label="I checked the current job offers" type="checkbox" checked={draft.jobOffersChecked} onChange={(event) => update('jobOffersChecked', event.target.checked)} /><span>I checked whether this company currently has suitable job offers</span></label>
    <TextArea label="Company brief" value={draft.description} onChange={(value) => update('description', value)} />
    <TextArea label="Technology, products and domains" value={draft.techStack} onChange={(value) => update('techStack', value)} />
    <TextArea label="Visa sponsorship notes" value={draft.visaNotes} onChange={(value) => update('visaNotes', value)} />
    <TextArea label="Research notes" value={draft.notes} onChange={(value) => update('notes', value)} />
    <label className="toggle-field"><input type="checkbox" checked={draft.isArchived} onChange={(event) => update('isArchived', event.target.checked)} /><span>Archive this company</span></label>
    <button disabled={props.busy}>Save company</button>
  </form>;
}

function CompanyLocationForm(props: { location: CompanyLocation | null; busy: boolean; onSave: (body: unknown) => void }) {
  const location = props.location;
  const locationVisaOptions: Array<{ value: LocationVisaSponsorship; label: string }> = [{ value: 'Inherit', label: 'Use company policy' }, ...visaOptions];
  const [draft, setDraft] = useState({
    name: location?.name ?? '', city: location?.city ?? '', region: location?.region ?? '', country: location?.country ?? '', address: location?.address ?? '', careersUrl: location?.careersUrl ?? '',
    visaSponsorship: location?.visaSponsorship ?? 'Inherit' as LocationVisaSponsorship, notes: location?.notes ?? '', isActive: location?.isActive ?? true
  });
  const update = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <form className="editor-form company-location-form" onSubmit={(event) => { event.preventDefault(); props.onSave(draft); }}>
    <div className="form-grid two"><TextField label="Office / location name" value={draft.name} onChange={(value) => update('name', value)} required /><TextField label="City" value={draft.city} onChange={(value) => update('city', value)} /></div>
    <div className="form-grid two"><TextField label="Region / state" value={draft.region} onChange={(value) => update('region', value)} /><TextField label="Country" value={draft.country} onChange={(value) => update('country', value)} /></div>
    <TextField label="Address" value={draft.address} onChange={(value) => update('address', value)} />
    <div className="form-grid two"><TextField label="Office careers URL" value={draft.careersUrl} onChange={(value) => update('careersUrl', value)} /><SelectField label="Visa sponsorship" value={draft.visaSponsorship} onChange={(value) => update('visaSponsorship', value as LocationVisaSponsorship)} options={locationVisaOptions} /></div>
    <TextArea label="Location notes" value={draft.notes} onChange={(value) => update('notes', value)} />
    <label className="toggle-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => update('isActive', event.target.checked)} /><span>This office is active</span></label>
    <button disabled={props.busy}>Save location</button>
  </form>;
}

function effectiveVisa(location: CompanyLocation, company: Company) {
  return location.visaSponsorship === 'Inherit' ? company.visaSponsorship : location.visaSponsorship;
}

function formatLocation(location: CompanyLocation) {
  return [location.city, location.region, location.country].filter(Boolean).join(', ') || 'Location details not set';
}

function externalLink(value: string, label: string) {
  if (!/^https?:\/\//i.test(value)) return null;
  return <a href={value} target="_blank" rel="noreferrer">{label} ↗</a>;
}

function companyRequest(company: Company, jobOffersChecked: boolean) {
  return {
    name: company.name,
    website: company.website,
    careersUrl: company.careersUrl,
    industry: company.industry,
    companySize: company.companySize,
    headquarters: company.headquarters,
    description: company.description,
    techStack: company.techStack,
    visaSponsorship: company.visaSponsorship,
    visaNotes: company.visaNotes,
    relocationSupport: company.relocationSupport,
    jobOffersChecked,
    jobOffersCheckedAt: jobOffersChecked ? company.jobOffersCheckedAt : null,
    myFitRating: company.myFitRating,
    tier: company.tier,
    targetRole: company.targetRole,
    scoutingStatus: company.scoutingStatus,
    mainGap: company.mainGap,
    compensationNotes: company.compensationNotes,
    strategicValue: company.strategicValue,
    usaOpportunity: company.usaOpportunity,
    notes: company.notes,
    isArchived: company.isArchived
  };
}

type CompanyLocationDraft = { id: string; name: string; city: string; country: string };

function newLocationDraft(): CompanyLocationDraft {
  return { id: Math.random().toString(36).slice(2), name: '', city: '', country: '' };
}

function toLocationRequest(location: CompanyLocationDraft) {
  return {
    name: location.name.trim() || location.city.trim(),
    city: location.city.trim(),
    region: '',
    country: location.country.trim(),
    address: '',
    careersUrl: '',
    visaSponsorship: 'Inherit',
    notes: '',
    isActive: true
  };
}

function companyOfferCheckState(company: Company) {
  if (!company.jobOffersChecked) return '';
  if (!company.jobOffersCheckedAt) return 'offers-stale';
  const ageDays = (Date.now() - new Date(company.jobOffersCheckedAt).getTime()) / 86400000;
  return ageDays <= 14 ? 'offers-recent' : 'offers-stale';
}

function offerCheckLabel(company: Company) {
  if (!company.jobOffersChecked) return 'Offers not checked';
  if (!company.jobOffersCheckedAt) return 'Checked — date unknown';
  return `Checked ${new Date(company.jobOffersCheckedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}
