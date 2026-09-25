import type { Grain } from '../model/types';

export interface FacetDef {
  k: string;
  h: string;
}

export function FacetRail({
  title,
  facets,
  rows,
  facetSel,
  query,
  onQuery,
  onToggle,
  onClear,
}: {
  grain?: Grain;
  title: string;
  facets: FacetDef[];
  rows: Record<string, unknown>[];
  facetSel: Record<string, Set<string>>;
  query: string;
  onQuery: (q: string) => void;
  onToggle: (key: string, value: string, on: boolean) => void;
  onClear: () => void;
}) {
  return (
    <aside className="panel rail" aria-label="Filters">
      <div className="panel-h">
        <h2>{title}</h2>
        <button className="btn sm" type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="rail-body">
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
                  <span>{k || '—'}</span>
                  <span className="n">{counts[k]}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
