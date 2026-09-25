import { useMemo, useState } from 'react';
import {
  addToLibrary,
  filterCatalog,
  groupCatalog,
  libraryNames,
  parseLibrary,
  permuteCount,
  removeFromLibrary,
  taggedName,
} from '../model/library';
import type { Pairing, VPanel, VRegion } from '../model/types';

export function VLibraryRail({
  catalog,
  panels,
  selected,
  library,
  onLibrary,
  onPanels,
}: {
  catalog: VRegion[];
  panels: VPanel[];
  selected: string[];
  library: string;
  onLibrary: (text: string) => void;
  onPanels: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [pairing, setPairing] = useState<Pairing | 'all'>('all');
  const [pasteOpen, setPasteOpen] = useState(false);
  const lib = parseLibrary(library);
  const have = libraryNames(library);
  const picked = new Set(selected);
  const hits = useMemo(() => filterCatalog(catalog, query, pairing), [catalog, query, pairing]);
  const groups = useMemo(() => groupCatalog(hits), [hits]);
  const q = query.trim().toLowerCase();
  const shownPanels = panels.filter((p) => {
    if (!q) return true;
    return [p.name, p.target, p.notes, p.origin, ...p.clones].join(' ').toLowerCase().includes(q);
  });
  const fromGlyph = shownPanels.filter((p) => p.origin === 'bioglyph');
  const fromLuma = shownPanels.filter((p) => p.origin === 'luma');
  const sizes = selected
    .map((id) => panels.find((p) => p.id === id)?.clones.length ?? 0)
    .filter((n) => n > 0);
  const builds = permuteCount(sizes);
  const byT: Record<string, number> = {};
  lib.forEach((e) => {
    const k = e.t || 'untyped';
    byT[k] = (byT[k] || 0) + 1;
  });

  const toggleClone = (items: VRegion[], on: boolean) => {
    const names = items.map(taggedName);
    onLibrary(on ? addToLibrary(library, names) : removeFromLibrary(library, names));
  };

  const togglePanel = (id: string, on: boolean) => {
    onPanels(on ? [...selected.filter((x) => x !== id), id] : selected.filter((x) => x !== id));
  };

  const panelBlock = (title: string, hint: string, rows: VPanel[]) =>
    rows.length ? (
      <div className="facet">
        <h3>{title}</h3>
        <p className="empty" style={{ margin: '0 0 8px' }}>
          {hint}
        </p>
        {rows.map((p) => (
          <label className="opt" key={p.id}>
            <input
              type="checkbox"
              checked={picked.has(p.id)}
              onChange={(e) => togglePanel(p.id, e.target.checked)}
            />
            <span>
              {p.name}
              <span className="sm">
                {p.clones.length} sequences · {p.target}
              </span>
            </span>
            <span className="n">{p.clones.length}</span>
          </label>
        ))}
      </div>
    ) : null;

  return (
    <aside className="panel rail" aria-label="V region library">
      <div className="panel-h">
        <h2>V region library</h2>
        <span className="count">{lib.length ? `${lib.length} in build` : 'empty'}</span>
      </div>
      <div className="rail-body">
        <div className="facet">
          <input
            className="search"
            type="search"
            placeholder="Search clones or panels"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="pair-tog" role="group" aria-label="Pairing">
            {(
              [
                ['all', 'All'],
                ['paired', 'Paired'],
                ['unpaired', 'Unpaired'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className="btn sm"
                aria-pressed={pairing === k}
                onClick={() => setPairing(k)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {panelBlock(
          'From BioGlyph',
          'Panels already sent to Luma. Tick one or more; this bench builds them.',
          fromGlyph,
        )}
        {panelBlock(
          'Registered in Luma',
          'Sequences already in Luma. Combine with a BioGlyph panel to permute, or tick a custom set below.',
          fromLuma,
        )}
        {selected.length ? (
          <div className="facet">
            <p className="permute">
              {sizes.length > 1 ? (
                <>
                  {sizes.join(' × ')} = <strong>{builds}</strong> builds
                </>
              ) : (
                <>
                  <strong>{builds}</strong> builds from the selected panel
                </>
              )}
            </p>
          </div>
        ) : null}
        <div className="facet vlib-hits">
          {groups.length ? (
            groups.map((g) => {
              const allIn = g.items.every((v) => have.has(v.name));
              const head = g.items[0];
              const paired = head?.pairing === 'paired';
              return (
                <label className="vhit" key={g.clone}>
                  <input
                    type="checkbox"
                    checked={allIn}
                    onChange={(e) => toggleClone(g.items, e.target.checked)}
                  />
                  <span>
                    <span className="vhit-h">
                      <span className="nm">{g.clone}</span>
                      <span className={`pill ${paired ? 'on' : ''}`}>{paired ? 'paired' : 'unpaired'}</span>
                    </span>
                    <span className="sm">{head?.target}</span>
                    <div className="vhit-dom">
                      {g.items.map((v) => (
                        <span key={v.id} className="pill">
                          {v.t} {v.name}
                        </span>
                      ))}
                    </div>
                  </span>
                </label>
              );
            })
          ) : (
            <p className="empty" style={{ margin: 0 }}>
              Nothing matches that search.
            </p>
          )}
        </div>
        <div className="facet">
          <button className="btn sm" type="button" onClick={() => setPasteOpen((o) => !o)}>
            {pasteOpen ? 'Hide paste' : 'Paste names'}
          </button>
          {pasteOpen ? (
            <>
              <p style={{ margin: '8px 0 6px', fontSize: 12, color: 'var(--ink-2)' }}>
                Manual load. Paste FASTA headers or one name per line if a clone is not in the
                library.
              </p>
              <textarea
                className="search"
                style={{ minHeight: 110 }}
                placeholder={'>aTfR1-01-VH\n>aTfR1-01-VL\nCD3-huUCHT1-VH, VH'}
                value={library}
                onChange={(e) => onLibrary(e.target.value)}
              />
            </>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>
              Tick clones for a custom panel, or tick BioGlyph / Luma panels to permute them.
            </p>
          )}
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-2)' }}>
            {lib.length
              ? `${lib.length} in the build: ${Object.keys(byT)
                  .map((k) => `${byT[k]} ${k}`)
                  .join(', ')}`
              : 'None added yet. Slots fall back to names like aTfR1-01-VH.'}
          </p>
        </div>
      </div>
    </aside>
  );
}
