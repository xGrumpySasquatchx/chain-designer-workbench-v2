import { useId } from 'react';
import type { SearchField, SearchOp, SearchTerm } from '../model/vsearch';
import { blankTerm, opsFor, SEARCH_FIELDS } from '../model/vsearch';

export function VSearch({
  query,
  onQuery,
  open,
  onOpen,
  match,
  onMatch,
  terms,
  onTerms,
  targets,
  projects,
}: {
  query: string;
  onQuery: (q: string) => void;
  open: boolean;
  onOpen: (on: boolean) => void;
  match: 'all' | 'any';
  onMatch: (m: 'all' | 'any') => void;
  terms: SearchTerm[];
  onTerms: (terms: SearchTerm[]) => void;
  targets: string[];
  projects: string[];
}) {
  const box = useId();
  const setTerm = (id: string, patch: Partial<SearchTerm>) => {
    onTerms(terms.map((t) => (t.id === id ? normalize({ ...t, ...patch }) : t)));
  };
  const add = (after: string) => {
    const next = blankTerm(`t${Date.now()}`);
    const i = terms.findIndex((t) => t.id === after);
    const copy = terms.slice();
    copy.splice(i + 1, 0, next);
    onTerms(copy);
  };
  const drop = (id: string) => {
    const keep = terms.filter((t) => t.id !== id);
    onTerms(keep.length ? keep : [blankTerm()]);
  };

  return (
    <div className="facet">
      <label className="vsearch-lab" htmlFor={box}>
        Search clones or panels
      </label>
      <input
        id={box}
        className="search"
        type="search"
        placeholder="ID, target, date, project — or target:CD3"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <button className="btn sm vsearch-more" type="button" aria-expanded={open} onClick={() => onOpen(!open)}>
        {open ? 'Hide options' : 'More options'}
      </button>
      <datalist id="vsearch-target">
        {targets.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id="vsearch-project">
        {projects.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {open ? (
        <div className="vsearch-adv">
          <div className="vsearch-match" role="group" aria-label="Match">
            <span>Match</span>
            {(
              [
                ['all', 'all'],
                ['any', 'any'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className="btn sm"
                aria-pressed={match === k}
                onClick={() => onMatch(k)}
              >
                {label}
              </button>
            ))}
            <span>of the following</span>
          </div>
          {terms.map((term) => (
            <SearchRow
              key={term.id}
              term={term}
              targets={targets}
              projects={projects}
              onChange={(patch) => setTerm(term.id, patch)}
              onAdd={() => add(term.id)}
              onDrop={() => drop(term.id)}
            />
          ))}
        </div>
      ) : (
        <p className="empty" style={{ margin: '8px 0 0' }}>
          Type a value, or use <span className="mono">id:</span> <span className="mono">target:</span>{' '}
          <span className="mono">date:</span> <span className="mono">project:</span>
        </p>
      )}
    </div>
  );
}

function normalize(term: SearchTerm): SearchTerm {
  const allowed = opsFor(term.field).map((o) => o.id);
  if (allowed.includes(term.op)) return term;
  return { ...term, op: allowed[0] ?? 'contains', value2: undefined };
}

function SearchRow({
  term,
  targets,
  projects,
  onChange,
  onAdd,
  onDrop,
}: {
  term: SearchTerm;
  targets: string[];
  projects: string[];
  onChange: (patch: Partial<SearchTerm>) => void;
  onAdd: () => void;
  onDrop: () => void;
}) {
  const ops = opsFor(term.field);
  const list =
    term.field === 'target' ? targets : term.field === 'project' ? projects : undefined;
  const dateish = term.field === 'date' && term.op !== 'contains';
  return (
    <div className="vsearch-row">
      <select
        className="search-sel"
        aria-label="Field"
        value={term.field}
        onChange={(e) => onChange({ field: e.target.value as SearchField })}
      >
        {SEARCH_FIELDS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        className="search-sel"
        aria-label="Condition"
        value={term.op}
        onChange={(e) => onChange({ op: e.target.value as SearchOp })}
      >
        {ops.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="vsearch-val">
        {dateish ? (
          <>
            <input
              className="search"
              type="date"
              aria-label="Date"
              value={term.value}
              onChange={(e) => onChange({ value: e.target.value })}
            />
            {term.op === 'between' ? (
              <input
                className="search"
                type="date"
                aria-label="End date"
                value={term.value2 ?? ''}
                onChange={(e) => onChange({ value2: e.target.value })}
              />
            ) : null}
          </>
        ) : (
          <input
            className="search"
            type="search"
            aria-label="Value"
            list={list ? `vsearch-${term.field}` : undefined}
            placeholder={placeholder(term.field)}
            value={term.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        )}
      </div>
      <div className="vsearch-ops">
        <button className="btn sm" type="button" aria-label="Add criterion" onClick={onAdd}>
          +
        </button>
        <button className="btn sm" type="button" aria-label="Remove criterion" onClick={onDrop}>
          −
        </button>
      </div>
    </div>
  );
}

function placeholder(field: SearchField): string {
  if (field === 'id') return 'VR-001 or PN-…';
  if (field === 'date') return '2025 or 2025-03-03';
  if (field === 'project') return 'TCE CD3';
  if (field === 'target') return 'CD3';
  return 'Value';
}
