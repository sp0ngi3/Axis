import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mobilePageIds, pageGroups, pages, primaryPageIds, type Page } from '../config';
import { VaporNavButton } from './common';

type NavigationProps = {
  activePage: Page;
  versionLabel: string;
  open: boolean;
  theme: 'light' | 'dark';
  utilities: ReactNode;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (page: Page) => void;
  onToggleTheme: () => void;
};

export function AppNavigation(props: NavigationProps) {
  const activeItem = pages.find((item) => item.id === props.activePage) ?? pages[0];

  return (
    <>
      <aside className="app-sidebar">
        <div className="brand-block">
          <span className="brand-mark">AX</span>
          <div className="brand-copy">
            <p className="eyebrow">Neon local-first</p>
            <h1>Axis</h1>
            <span className="app-version"><i aria-hidden="true" />{props.versionLabel}</span>
          </div>
          <div className="mobile-page-identity" aria-hidden="true">
            <small>{activeItem.kicker}</small>
            <strong>{activeItem.label}</strong>
          </div>
        </div>

        <nav className="main-nav" aria-label="Primary Axis sections">
          {pages.filter((item) => primaryPageIds.includes(item.id)).map((item) => (
            <VaporNavButton
              key={item.id}
              item={item}
              isActive={props.activePage === item.id}
              onSelect={() => props.onSelect(item.id)}
            />
          ))}
        </nav>

        <button type="button" className="navigation-directory-trigger" onClick={props.onOpen} aria-expanded={props.open}>
          <span className="navigation-directory-glyph" aria-hidden="true">•••</span>
          <span><strong>All sections</strong><small>Search and browse {pages.length} tools</small></span>
          <b aria-hidden="true">→</b>
        </button>
      </aside>

      <MobileBottomNavigation activePage={props.activePage} onSelect={props.onSelect} onOpen={props.onOpen} />

      <NavigationDirectory {...props} />
    </>
  );
}

function MobileBottomNavigation(props: { activePage: Page; onSelect: (page: Page) => void; onOpen: () => void }) {
  const isDirectoryActive = !mobilePageIds.includes(props.activePage);

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {pages.filter((item) => mobilePageIds.includes(item.id)).map((item) => (
        <button key={item.id} type="button" className={props.activePage === item.id ? 'active' : ''} onClick={() => props.onSelect(item.id)}>
          <i aria-hidden="true">{item.icon}</i>
          <span>{item.label}</span>
        </button>
      ))}
      <button type="button" className={isDirectoryActive ? 'active' : ''} onClick={props.onOpen} aria-label="Open all Axis sections">
        <i aria-hidden="true">•••</i>
        <span>More</span>
      </button>
    </nav>
  );
}

function NavigationDirectory(props: NavigationProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredGroups = useMemo(() => pageGroups.map((group) => ({
    ...group,
    items: pages.filter((item) => group.pageIds.includes(item.id)).filter((item) => (
      !normalizedQuery || `${item.label} ${item.kicker}`.toLocaleLowerCase().includes(normalizedQuery)
    ))
  })).filter((group) => group.items.length > 0), [normalizedQuery]);

  useEffect(() => {
    if (!props.open) {
      setQuery('');
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 120);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="navigation-directory-layer">
      <button className="navigation-directory-backdrop" type="button" aria-label="Close section directory" onClick={props.onClose} />
      <aside className="navigation-directory" role="dialog" aria-modal="true" aria-label="All Axis sections">
        <header className="navigation-directory-header">
          <div>
            <p className="eyebrow">Command directory</p>
            <h2>Where do you want to go?</h2>
          </div>
          <button type="button" className="icon-button navigation-directory-close" aria-label="Close section directory" onClick={props.onClose}>×</button>
        </header>

        <label className="navigation-search">
          <span aria-hidden="true">⌕</span>
          <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sections" aria-label="Search Axis sections" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear section search">×</button>}
        </label>

        <div className="navigation-groups">
          {filteredGroups.map((group) => (
            <section className="navigation-group" key={group.label}>
              <div className="navigation-group-heading"><strong>{group.label}</strong><span>{group.description}</span></div>
              <div className="navigation-group-grid">
                {group.items.map((item) => (
                  <button key={item.id} type="button" className={`navigation-item ${props.activePage === item.id ? 'active' : ''}`} onClick={() => props.onSelect(item.id)}>
                    <i aria-hidden="true">{item.icon}</i>
                    <span><strong>{item.label}</strong><small>{item.kicker}</small></span>
                    <b aria-hidden="true">→</b>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {filteredGroups.length === 0 && <p className="navigation-no-results">No section matches “{query}”.</p>}
        </div>

        <footer className="navigation-directory-footer">
          <div className="navigation-utilities">{props.utilities}</div>
          <button type="button" className="navigation-theme-button" onClick={props.onToggleTheme}>
            <span aria-hidden="true">{props.theme === 'dark' ? '☼' : '◐'}</span>
            <span><strong>{props.theme === 'dark' ? 'Light mode' : 'Dark mode'}</strong><small>Switch appearance</small></span>
          </button>
          <span className="navigation-version">{props.versionLabel}</span>
        </footer>
      </aside>
    </div>
  );
}
