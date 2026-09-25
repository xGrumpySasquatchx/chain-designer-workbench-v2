import { useState, type ReactNode } from 'react';
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
  onToggle,
  onClear,
  expanded = true,
  onFold,
  fold,
  grip,
}: {
  grain?: Grain;
  title: string;
  facets: FacetDef[];
  rows: Record<string, unknown>[];
  facetSel: Record<string, Set<string>>;
  onToggle: (key: string, value: string, on: boolean) => void;
  onClear: () => void;
  expanded?: boolean;
  onFold?: () => void;
  fold?: ReactNode;
  grip?: ReactNode;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(facets.map((f) => f.k)));
  const shown = (key: string) => open.has(key);
  const toggleOpen = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside className={`panel rail${expanded ? '' : ' is-folded'}`} aria-label="Sources">
      <div className="panel-h" onClick={expanded ? undefined : onFold}>
        <h2>{title}</h2>
        <div className="panel-h-act">
          {fold}
        </div>
      </div>
      <div className="rail-body">
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
          const picked = facetSel[f.k]?.size ?? 0;
          const isOpen = shown(f.k);
          return (
            <div className="src-folder" key={f.k}>
              <button
                className="src-head"
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleOpen(f.k)}
              >
                <span className="src-chev" aria-hidden="true">
                  {isOpen ? '▾' : '▸'}
                </span>
                <span className="src-name">{f.h}</span>
                <span className="src-n">
                  {picked ? `${picked} of ${keys.length}` : `(${keys.length})`}
                </span>
              </button>
              {isOpen
                ? keys.map((k) => (
                    <label className="opt src-doc" key={k}>
                      <input
                        type="checkbox"
                        checked={!!facetSel[f.k]?.has(k)}
                        onChange={(e) => onToggle(f.k, k, e.target.checked)}
                      />
                      <span>{k || '—'}</span>
                      <span className="n">{counts[k]}</span>
                    </label>
                  ))
                : null}
            </div>
          );
        })}
      </div>
      <div className="src-options">
        <button className="btn sm" type="button" onClick={onClear}>
          Clear
        </button>
        <span className="src-hint">{rows.length} documents</span>
      </div>
      {expanded ? grip : null}
    </aside>
  );
}
