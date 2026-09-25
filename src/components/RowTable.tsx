import { useState, type ReactNode } from 'react';
import { rowHasFacet } from '../model/facets';
import type { Grain, Mark, Model } from '../model/types';

export interface Col {
  h: string;
  cls?: string;
  cell: (row: Row) => ReactNode;
  sort?: (row: Row) => string | number;
}

export interface Row {
  id: string;
  rank: number;
  [key: string]: unknown;
}

const BUCKET_LABEL = ['In your build', 'Available', 'Ruled out'];

function bucketOf(grain: Grain, id: string, mark: Mark | undefined, model: Model, tier?: string) {
  if (mark === 'out') return { b: 2 as const, label: BUCKET_LABEL[2] };
  if (grain === 'fmt') {
    if (model.inF.has(id)) return { b: 0 as const, label: BUCKET_LABEL[0] };
    if (model.reachF.has(id)) return { b: 1 as const, label: tier || BUCKET_LABEL[1] };
    return { b: 2 as const, label: BUCKET_LABEL[2] };
  }
  if (grain === 'chn') {
    if (model.buildC.has(id)) return { b: 0 as const, label: BUCKET_LABEL[0] };
    if (model.reachC.has(id)) return { b: 1 as const, label: BUCKET_LABEL[1] };
    return { b: 2 as const, label: BUCKET_LABEL[2] };
  }
  if (grain === 'mut') {
    if (model.buildM.has(id)) return { b: 0 as const, label: BUCKET_LABEL[0] };
    if (model.reachM.has(id)) return { b: 1 as const, label: BUCKET_LABEL[1] };
    return { b: 2 as const, label: BUCKET_LABEL[2] };
  }
  if (model.buildV.has(id)) return { b: 0 as const, label: BUCKET_LABEL[0] };
  if (model.reachV.has(id)) return { b: 1 as const, label: BUCKET_LABEL[1] };
  return { b: 2 as const, label: BUCKET_LABEL[2] };
}

function cmp(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function RowTable({
  grain,
  title,
  rows,
  cols,
  model,
  marks,
  query,
  facetSel,
  hideOut,
  text,
  onMark,
  onHideOut,
}: {
  grain: Grain;
  title: string;
  rows: Row[];
  cols: Col[];
  model: Model;
  marks: Record<string, Mark | undefined>;
  query: string;
  facetSel: Record<string, Set<string>>;
  hideOut: boolean;
  text: (row: Row) => string;
  onMark: (id: string, v: Mark) => void;
  onHideOut: () => void;
}) {
  const [sort, setSort] = useState<{ h: string; dir: 1 | -1 } | null>(null);
  const q = String(query ?? '').trim().toLowerCase();
  const items = rows
    .filter((r) => {
      const { b } = bucketOf(grain, r.id, marks[r.id], model, String(r.tier ?? ''));
      if (hideOut && b === 2) return false;
      for (const k of Object.keys(facetSel)) {
        const st = facetSel[k];
        if (st && st.size && !rowHasFacet(r, k, st)) return false;
      }
      if (q && !text(r).toLowerCase().includes(q)) return false;
      return true;
    })
    .map((r) => ({ r, ...bucketOf(grain, r.id, marks[r.id], model, String(r.tier ?? '')) }))
    .sort((a, z) => {
      if (a.b !== z.b) return a.b - z.b;
      if (sort) {
        const col = cols.find((c) => c.h === sort.h);
        const av = col?.sort ? col.sort(a.r) : a.r.id;
        const zv = col?.sort ? col.sort(z.r) : z.r.id;
        const d = cmp(av, zv);
        if (d) return d * sort.dir;
      }
      return (a.r.rank || 999) - (z.r.rank || 999) || a.r.id.localeCompare(z.r.id);
    });

  const nOut = rows.filter((r) => bucketOf(grain, r.id, marks[r.id], model).b === 2).length;
  const ncol = cols.length + 2;

  let lastGroup: string | null = null;
  const body: ReactNode[] = [];
  items.forEach((it) => {
    if (it.label !== lastGroup) {
      lastGroup = it.label;
      body.push(
        <tr key={`g-${it.b}-${it.label}`} className={`grp ${it.b === 2 ? 'o' : it.b === 0 ? 'b' : ''}`}>
          <td colSpan={ncol}>{it.label}</td>
        </tr>,
      );
    }
    const s = marks[it.r.id];
    const claimed =
      grain === 'chn'
        ? model.claimC.has(it.r.id)
        : grain === 'con'
          ? model.claimV.has(it.r.id)
          : grain === 'mut'
            ? model.claimM.has(it.r.id)
            : false;
    let status: ReactNode = null;
    if (it.b === 2 && s !== 'out') {
      status =
        grain === 'chn' ? (
          <span className="pill blk">No format in play uses this</span>
        ) : grain === 'con' ? (
          <span className="pill blk">No chain in play needs this</span>
        ) : grain === 'mut' ? (
          <span className="pill blk">Not used by the current format</span>
        ) : (
          <span className="pill blk">Blocked by a rule-out</span>
        );
    } else if (claimed && s !== 'in') {
      status = <span className="pill imp">Comes with your format</span>;
    } else if (grain === 'mut' && it.r.partner && it.r.partner !== 'None' && s !== 'out' && it.b < 2) {
      status = <span className="pill on">Needs {String(it.r.partner)}</span>;
    }
    const dis = it.b === 2 && s !== 'out';
    const st = s === 'out' ? 'out' : it.b === 2 ? 'unreach' : s === 'in' ? 'in' : claimed ? 'claim' : '';
    body.push(
      <tr key={it.r.id} data-s={st}>
        <td>
          <span className={`tri ${claimed && s !== 'in' ? 'claimed' : ''}`}>
            <button
              type="button"
              data-v="in"
              aria-pressed={s === 'in'}
              disabled={dis}
              title="Add"
              onClick={() => onMark(it.r.id, 'in')}
            >
              ✓
            </button>
            <button
              type="button"
              data-v="out"
              aria-pressed={s === 'out'}
              title="Rule out"
              onClick={() => onMark(it.r.id, 'out')}
            >
              ×
            </button>
          </span>
        </td>
        {cols.map((c) => (
          <td key={c.h} className={c.cls || ''}>
            {c.cell(it.r)}
          </td>
        ))}
        <td>{status}</td>
      </tr>,
    );
  });

  return (
    <main className="panel list">
      <div className="pathbar" aria-label="Folder path">
        <span>Local</span>
        <span className="path-sep" aria-hidden="true">
          ▸
        </span>
        <span>{title}</span>
      </div>
      <div className="panel-h">
        <h2>{title}</h2>
        <span className="count">
          {nOut ? `${rows.length - nOut} available, ${nOut} ruled out` : `${rows.length} documents`}
        </span>
        <span className="flex-1" />
        {nOut > 0 && (
          <button className="btn sm" type="button" onClick={onHideOut}>
            {hideOut ? 'Show the ruled out' : 'Hide the ruled out'}
          </button>
        )}
      </div>
      <div className="rows">
        <table>
          <thead>
            <tr>
              <th style={{ width: 86 }}>In / out</th>
              {cols.map((c) => {
                const active = sort?.h === c.h;
                const aria = active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none';
                return (
                  <th key={c.h} aria-sort={aria}>
                    <button
                      type="button"
                      className="th-sort"
                      onClick={() =>
                        setSort((s) =>
                          s?.h === c.h ? (s.dir === 1 ? { h: c.h, dir: -1 } : null) : { h: c.h, dir: 1 },
                        )
                      }
                    >
                      {c.h}
                      <span className="th-dir" aria-hidden="true">
                        {active ? (sort.dir === 1 ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {body.length ? (
              body
            ) : (
              <tr>
                <td colSpan={ncol} style={{ padding: '14px 13px', color: 'var(--ink-3)' }}>
                  Nothing matches those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
