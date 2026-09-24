import { parseLibrary } from '../model/library';
import type { Grain } from '../model/types';

export interface FacetDef {
  k: string;
  h: string;
}

export function FacetRail({
  grain,
  title,
  facets,
  rows,
  facetSel,
  query,
  library,
  onQuery,
  onToggle,
  onClear,
  onLibrary,
}: {
  grain: Grain;
  title: string;
  facets: FacetDef[];
  rows: Record<string, unknown>[];
  facetSel: Record<string, Set<string>>;
  query: string;
  library: string;
  onQuery: (q: string) => void;
  onToggle: (key: string, value: string, on: boolean) => void;
  onClear: () => void;
  onLibrary: (text: string) => void;
}) {
  const isVar = grain === 'var';
  const lib = parseLibrary(library);
  const byT: Record<string, number> = {};
  lib.forEach((e) => {
    const k = e.t || 'untyped';
    byT[k] = (byT[k] || 0) + 1;
  });

  return (
    <aside className="panel rail" aria-label="Filters">
      <div className="panel-h">
        <h2>{title}</h2>
        {!isVar && (
          <button className="btn sm" type="button" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {isVar ? (
        <div className="facet">
          <p style={{ margin: '0 0 6px', fontSize: 11.5, color: 'var(--ink-2)' }}>
            Paste FASTA headers or one name per line. Type is read from the name, or add it after a
            comma.
          </p>
          <textarea
            className="search"
            style={{ minHeight: 150 }}
            placeholder={'>aTfR1-01-VH\n>aTfR1-01-VL\nCD3-huUCHT1-VH, VH'}
            value={library}
            onChange={(e) => onLibrary(e.target.value)}
          />
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--ink-2)' }}>
            {lib.length
              ? `${lib.length} entries: ${Object.keys(byT)
                  .map((k) => `${byT[k]} ${k}`)
                  .join(', ')}`
              : 'Empty. Slots fall back to generated names like aTfR1-01-VH.'}
          </p>
        </div>
      ) : (
        <>
          <div className="facet">
            <input
              className="search"
              type="search"
              placeholder="Search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
          </div>
          {facets.map((f) => {
            const counts: Record<string, number> = {};
            rows.forEach((r) => {
              const v = String(r[f.k] ?? '');
              counts[v] = (counts[v] || 0) + 1;
            });
            const keys = Object.keys(counts).sort((a, b) => {
              const x = parseFloat(a);
              const y = parseFloat(b);
              return !Number.isNaN(x) && !Number.isNaN(y) ? x - y : a.localeCompare(b);
            });
            if (keys.length < 2) return null;
            return (
              <div className="facet" key={f.k}>
                <h3>{f.h}</h3>
                {keys.map((k) => (
                  <label className="opt" key={k}>
                    <input
                      type="checkbox"
                      checked={!!facetSel[f.k]?.has(k)}
                      onChange={(e) => onToggle(f.k, k, e.target.checked)}
                    />
                    <span>{k}</span>
                    <span className="n">{counts[k]}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </>
      )}
    </aside>
  );
}
