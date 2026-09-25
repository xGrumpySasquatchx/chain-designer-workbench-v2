import { useMemo, useState } from 'react';
import { addToLibrary, filterCatalog, groupCatalog, libraryNames, parseLibrary } from '../model/library';
import type { Pairing, VRegion } from '../model/types';

export function VLibraryRail({
  catalog,
  library,
  onLibrary,
}: {
  catalog: VRegion[];
  library: string;
  onLibrary: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [pairing, setPairing] = useState<Pairing | 'all'>('all');
  const [pasteOpen, setPasteOpen] = useState(false);
  const lib = parseLibrary(library);
  const have = libraryNames(library);
  const hits = useMemo(() => filterCatalog(catalog, query, pairing), [catalog, query, pairing]);
  const groups = useMemo(() => groupCatalog(hits), [hits]);
  const byT: Record<string, number> = {};
  lib.forEach((e) => {
    const k = e.t || 'untyped';
    byT[k] = (byT[k] || 0) + 1;
  });

  const addNames = (names: string[]) => onLibrary(addToLibrary(library, names));

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
            placeholder="Search paired or unpaired V regions"
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
        <div className="facet vlib-hits">
          {groups.length ? (
            groups.map((g) => {
              const names = g.items.map((v) => {
                const u = v.name.toUpperCase();
                const tagged =
                  v.t === 'VHH'
                    ? u.includes('VHH')
                    : new RegExp(`(^|[^A-Z])${v.t}([^A-Z]|$)`).test(u);
                return tagged ? v.name : `${v.name}, ${v.t}`;
              });
              const allIn = g.items.every((v) => have.has(v.name));
              const head = g.items[0];
              const paired = head?.pairing === 'paired';
              return (
                <div className="vhit" key={g.clone}>
                  <div className="vhit-h">
                    <span className="nm">{g.clone}</span>
                    <span className={`pill ${paired ? 'on' : ''}`}>{paired ? 'paired' : 'unpaired'}</span>
                  </div>
                  <span className="sm">
                    {head?.target}
                    {head?.source ? ` · ${head.source}` : ''}
                  </span>
                  <div className="vhit-dom">
                    {g.items.map((v) => (
                      <span key={v.id} className="pill">
                        {v.t} {v.name}
                      </span>
                    ))}
                  </div>
                  <button
                    className="btn sm"
                    type="button"
                    disabled={allIn}
                    onClick={() => addNames(names)}
                  >
                    {allIn ? 'In library' : paired ? 'Add pair' : 'Add'}
                  </button>
                </div>
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
              Search is the usual way in. Paste stays here for names the library does not have.
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
