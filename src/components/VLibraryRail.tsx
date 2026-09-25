import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  addToLibrary,
  libraryNames,
  parseLibrary,
  permuteCount,
  removeFromLibrary,
  taggedName,
} from '../model/library';
import type { VPanel, VRegion } from '../model/types';
import {
  blankTerm,
  branchCount,
  compileSearch,
  panelMatches,
  searchActive,
  searchCatalog,
  treeCatalog,
  type CloneGroup,
  type SearchTerm,
} from '../model/vsearch';
import { VSearch } from './VSearch';

export function VLibraryRail({
  catalog,
  panels,
  selected,
  library,
  onLibrary,
  onPanels,
  expanded = true,
  onFold,
  fold,
  grip,
}: {
  catalog: VRegion[];
  panels: VPanel[];
  selected: string[];
  library: string;
  onLibrary: (text: string) => void;
  onPanels: (ids: string[]) => void;
  expanded?: boolean;
  onFold?: () => void;
  fold?: ReactNode;
  grip?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [match, setMatch] = useState<'all' | 'any'>('all');
  const [terms, setTerms] = useState<SearchTerm[]>([blankTerm()]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(['paired', 'unpaired', 'luma', 'paste']));
  const [pasteOpen, setPasteOpen] = useState(false);
  const lib = parseLibrary(library);
  const have = libraryNames(library);
  const picked = new Set(selected);
  const compiled = useMemo(
    () => compileSearch(query, advanced ? terms : [], match),
    [query, advanced, terms, match],
  );
  const hits = useMemo(() => searchCatalog(catalog, compiled), [catalog, compiled]);
  const tree = useMemo(() => treeCatalog(hits), [hits]);
  const shownPanels = panels.filter((p) => panelMatches(p, compiled));
  const searching = searchActive(compiled);
  const targets = useMemo(
    () => unique([...catalog.map((v) => v.target), ...panels.map((p) => p.target)]),
    [catalog, panels],
  );
  const projects = useMemo(
    () => unique([...catalog.map((v) => v.project), ...panels.map((p) => p.project)]),
    [catalog, panels],
  );
  const sizes = selected
    .map((id) => panels.find((p) => p.id === id)?.clones.length ?? 0)
    .filter((n) => n > 0);
  const builds = permuteCount(sizes);
  const byT: Record<string, number> = {};
  lib.forEach((e) => {
    const k = e.t || 'untyped';
    byT[k] = (byT[k] || 0) + 1;
  });

  const toggleOpen = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const shown = (key: string) => searching || open.has(key);

  const toggleClone = (items: VRegion[], on: boolean) => {
    const names = items.map(taggedName);
    onLibrary(on ? addToLibrary(library, names) : removeFromLibrary(library, names));
  };
  const toggleGroups = (groups: CloneGroup[], on: boolean) => {
    toggleClone(
      groups.flatMap((g) => g.items),
      on,
    );
  };
  const togglePanel = (id: string, on: boolean) => {
    onPanels(on ? [...selected.filter((x) => x !== id), id] : selected.filter((x) => x !== id));
  };

  return (
    <aside className={`panel rail${expanded ? '' : ' is-folded'}`} aria-label="Sources">
      <div className="panel-h" onClick={expanded ? undefined : onFold}>
        <h2>Sources</h2>
        <div className="panel-h-act">
          <span className="count">{lib.length ? `${lib.length} in build` : 'empty'}</span>
          {fold}
        </div>
      </div>
      <div className="rail-body">
        <VSearch
          query={query}
          onQuery={setQuery}
          open={advanced}
          onOpen={setAdvanced}
          match={match}
          onMatch={setMatch}
          terms={terms}
          onTerms={setTerms}
          targets={targets}
          projects={projects}
        />
        {shownPanels.length ? (
          <div className="src-folder">
            <button
              className="src-head"
              type="button"
              aria-expanded={shown('luma')}
              onClick={() => toggleOpen('luma')}
            >
              <span className="src-chev" aria-hidden="true">
                {shown('luma') ? '▾' : '▸'}
              </span>
              <span className="src-name">Registered in Luma</span>
              <span className="src-n">({shownPanels.length})</span>
            </button>
            {shown('luma')
              ? shownPanels.map((p) => (
                  <label className="opt src-doc" key={p.id}>
                    <input
                      type="checkbox"
                      checked={picked.has(p.id)}
                      onChange={(e) => togglePanel(p.id, e.target.checked)}
                    />
                    <span>
                      {p.name}
                      <span className="sm">
                        {p.id} · {p.project} · {p.date}
                      </span>
                    </span>
                    <span className="n">{p.clones.length}</span>
                  </label>
                ))
              : null}
          </div>
        ) : null}
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
          {tree.length ? (
            tree.map((branch) => {
              const key = branch.pairing;
              const n = branchCount(branch);
              const groups = branch.targets.flatMap((t) => t.groups);
              return (
                <div className="vtree" key={key}>
                  <FolderRow
                    depth={1}
                    label={branch.pairing === 'paired' ? 'Paired' : 'Unpaired'}
                    meta={`${n} clone${n === 1 ? '' : 's'}`}
                    open={shown(key)}
                    onToggle={() => toggleOpen(key)}
                    groups={groups}
                    have={have}
                    onCheck={(on) => toggleGroups(groups, on)}
                  />
                  {shown(key)
                    ? branch.targets.map((t) => {
                        const tkey = `${key}::${t.target}`;
                        return (
                          <div key={tkey}>
                            <FolderRow
                              depth={2}
                              label={t.target}
                              meta={`${t.groups.length}`}
                              open={shown(tkey)}
                              onToggle={() => toggleOpen(tkey)}
                              groups={t.groups}
                              have={have}
                              onCheck={(on) => toggleGroups(t.groups, on)}
                            />
                            {shown(tkey)
                              ? t.groups.map((g) => {
                                  const allIn = g.items.every((v) => have.has(v.name));
                                  return (
                                    <label className="vtree-row d3" key={g.clone}>
                                      <span className="vtree-chev" />
                                      <input
                                        type="checkbox"
                                        checked={allIn}
                                        onChange={(e) => toggleClone(g.items, e.target.checked)}
                                      />
                                      <span className="vtree-lab">
                                        <span className="nm">{g.clone}</span>
                                        <span className="sm">
                                          {g.ids} · {g.project} · {g.date}
                                        </span>
                                        <span className="vhit-dom">
                                          {g.items.map((v) => (
                                            <span key={v.id} className="pill">
                                              {v.t}
                                            </span>
                                          ))}
                                        </span>
                                      </span>
                                    </label>
                                  );
                                })
                              : null}
                          </div>
                        );
                      })
                    : null}
                </div>
              );
            })
          ) : (
            <p className="empty" style={{ margin: 0 }}>
              Nothing matches that search.
            </p>
          )}
        </div>
        <div className="src-folder">
          <button
            className="src-head"
            type="button"
            aria-expanded={pasteOpen}
            onClick={() => setPasteOpen((o) => !o)}
          >
            <span className="src-chev" aria-hidden="true">
              {pasteOpen ? '▾' : '▸'}
            </span>
            <span className="src-name">Paste names</span>
          </button>
          {pasteOpen ? (
            <div className="facet" style={{ borderBottom: 0 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--ink-2)' }}>
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
            </div>
          ) : null}
        </div>
      </div>
      <div className="src-options">
        <span className="src-hint">
          {lib.length
            ? `${lib.length} in the build: ${Object.keys(byT)
                .map((k) => `${byT[k]} ${k}`)
                .join(', ')}`
            : 'No documents in the build yet'}
        </span>
      </div>
      {expanded ? grip : null}
    </aside>
  );
}

function FolderRow({
  depth,
  label,
  meta,
  open,
  onToggle,
  groups,
  have,
  onCheck,
}: {
  depth: 1 | 2;
  label: string;
  meta: string;
  open: boolean;
  onToggle: () => void;
  groups: CloneGroup[];
  have: Set<string>;
  onCheck: (on: boolean) => void;
}) {
  const names = groups.flatMap((g) => g.items);
  const allIn = names.length > 0 && names.every((v) => have.has(v.name));
  const some = !allIn && names.some((v) => have.has(v.name));
  return (
    <div className={`vtree-row d${depth}`}>
      <button
        className="vtree-chev"
        type="button"
        aria-expanded={open}
        aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        onClick={onToggle}
      >
        {open ? '▾' : '▸'}
      </button>
      <FolderCheck checked={allIn} some={some} label={label} onChange={onCheck} />
      <button className="vtree-lab" type="button" onClick={onToggle}>
        <span className="nm">{label}</span>
      </button>
      <span className="n">{meta}</span>
    </div>
  );
}

function FolderCheck({
  checked,
  some,
  label,
  onChange,
}: {
  checked: boolean;
  some: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
