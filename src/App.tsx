import { useEffect, useMemo, useState } from 'react';
import inventoryJson from './data/inventory.json';
import mutationsJson from './data/mutations.json';
import panelsJson from './data/panels.json';
import seedJson from './data/seed.json';
import vregionsJson from './data/vregions.json';
import { BuildPanel } from './components/BuildPanel';
import { FacetRail, type FacetDef } from './components/FacetRail';
import { InventoryCell } from './components/InventoryCell';
import { LevelTabs } from './components/LevelTabs';
import { RowTable, type Col, type Row } from './components/RowTable';
import { FoldBtn, ResizeGrip, useSidePanels } from './components/SidePanels';
import { VariableRegions } from './components/VariableRegions';
import { VLibraryRail } from './components/VLibraryRail';
import { stockStatus } from './model/inventory';
import { rowHasFacet } from './model/facets';
import {
  addToLibrary,
  applyClones,
  applyPanels,
  clonesOf,
  fillAssignFromCatalog,
  insertsByVector,
  mergeStandaloneBuilds,
  parseLibrary,
  variantList,
} from './model/library';
import { applyMutations } from './model/mutations';
import { emptySel, facetsActive, matchingIds, resolve } from './model/selection';
import { buildSlots } from './model/slots';
import type {
  Chain,
  Format,
  Grain,
  InventoryBook,
  Mark,
  Mutation,
  Seed,
  Sel,
  Vector,
  VPanel,
  VRegion,
} from './model/types';
import { defaultState, loadState, saveState } from './state/persist';

const seed = seedJson as unknown as Seed;
const inventory = inventoryJson as InventoryBook;
const mutations = mutationsJson as Mutation[];
const catalog = vregionsJson as VRegion[];
const panelBook = panelsJson as VPanel[];

const FMT_FACETS: FacetDef[] = [
  { k: 'cls', h: 'Modality' },
  { k: 'spec', h: 'Specificity' },
  { k: 'kih', h: 'Knob-in-hole' },
  { k: 'chg', h: 'Fc charge variant' },
  { k: 'mutreq', h: 'Mutation required' },
  { k: 'fc', h: 'Fc present' },
  { k: 'conj', h: 'Carries a payload' },
  { k: 'plasmids', h: 'Plasmids to co-transfect' },
];
const CHN_FACETS: FacetDef[] = [
  { k: 'fam', h: 'Chain family' },
  { k: 'fvmode', h: 'Fv contribution' },
  { k: 'crossover', h: 'Crossover' },
  { k: 'stock', h: 'Inventory' },
];
const MUT_FACETS: FacetDef[] = [
  { k: 'cls', h: 'Purpose' },
  { k: 'domain', h: 'Chain / domain' },
  { k: 'numbering', h: 'Numbering', split: true },
  { k: 'prota', h: 'Protein A' },
];
const CON_FACETS: FacetDef[] = [
  { k: 'fam', h: 'Chain family' },
  { k: 'cat', h: 'Engineering' },
  { k: 'iso', h: 'Isotype or class' },
  { k: 'prota', h: 'Protein A capture' },
  { k: 'sel', h: 'Selection marker' },
  { k: 'needsInsert', h: 'Takes an insert' },
  { k: 'stock', h: 'Inventory' },
];

const FMT_COLS: Col[] = [
  { h: 'ID', cls: 'idc', cell: (r) => String(r.id), sort: (r) => String(r.id) },
  {
    h: 'Format',
    cell: (r) => (
      <>
        <span className="nm">{String(r.name)}</span>
        <span className="sm">{String(r.target)}</span>
      </>
    ),
    sort: (r) => String(r.name),
  },
  {
    h: 'Fv content',
    cell: (r) => (
      <>
        {String(r.half)} half-Fv, {String(r.full)} Fv
        <span className="sm">
          {String(r.trans)} in trans, {String(r.cis)} in cis
        </span>
      </>
    ),
    sort: (r) => Number(r.full) * 10 + Number(r.half),
  },
  {
    h: 'Heterodimer',
    cell: (r) =>
      r.kih === 'Present' ? (
        <span className="pill on">Knob-in-hole</span>
      ) : r.chg === 'Present' ? (
        <span className="pill on">Charge-steered</span>
      ) : (
        <span className="pill">Symmetric</span>
      ),
    sort: (r) => (r.kih === 'Present' ? 'Knob-in-hole' : r.chg === 'Present' ? 'Charge-steered' : 'Symmetric'),
  },
  { h: 'Plasmids', cell: (r) => <span className="mono">{String(r.plasmids)}</span>, sort: (r) => Number(r.plasmids) },
  {
    h: 'Build load',
    cell: (r) => (
      <>
        <span className="mono">{String(r.score)}</span>
        <span className="sm">{String(r.drivers)}</span>
      </>
    ),
    sort: (r) => Number(r.score),
  },
];
const CHN_COLS: Col[] = [
  { h: 'ID', cls: 'idc', cell: (r) => String(r.id), sort: (r) => String(r.id) },
  {
    h: 'Chain',
    cell: (r) => (
      <>
        <span className="nm">{String(r.name)}</span>
        <span className="sm">{String(r.note)}</span>
      </>
    ),
    sort: (r) => String(r.name),
  },
  {
    h: 'Fv contribution',
    cell: (r) => (
      <>
        {String(r.fvmode)}
        <span className="sm">{String(r.slots)}</span>
      </>
    ),
    sort: (r) => String(r.fvmode),
  },
  { h: 'Pairs with', cell: (r) => String(r.partner), sort: (r) => String(r.partner) },
  {
    h: 'Crossover',
    cell: (r) =>
      r.crossover === 'None' ? (
        <span className="pill">None</span>
      ) : (
        <span className="pill on">{String(r.crossover)}</span>
      ),
    sort: (r) => String(r.crossover),
  },
  {
    h: 'Vectors',
    cell: (r) => <span className="mono">{(r.vectors as string[]).length}</span>,
    sort: (r) => (r.vectors as string[]).length,
  },
  {
    h: 'Inventory',
    cell: (r) => <InventoryCell record={inventory.chains[String(r.id)]} />,
    sort: (r) => String(r.stock ?? ''),
  },
];
const MUT_COLS: Col[] = [
  { h: 'Set', cls: 'idc', cell: (r) => String(r.name), sort: (r) => String(r.name) },
  {
    h: 'Purpose',
    cell: (r) => (
      <>
        <span className="nm">{String(r.purpose)}</span>
        <span className="sm">{String(r.domain)}</span>
      </>
    ),
    sort: (r) => String(r.purpose),
  },
  {
    h: 'Positions',
    cell: (r) => (
      <>
        {String(r.positions)}
        <span className="sm">{String(r.numbering)}</span>
      </>
    ),
    sort: (r) => String(r.positions),
  },
  { h: 'Partner', cell: (r) => String(r.partner), sort: (r) => String(r.partner) },
  {
    h: 'Carried by',
    cell: (r) => (
      <>
        <span className="mono" style={{ fontSize: 12 }}>
          {String(r.carried)}
        </span>
        <span className="sm">{String(r.assay)}</span>
      </>
    ),
    sort: (r) => String(r.carried),
  },
  {
    h: 'Notes',
    cell: (r) => <span className="sm" style={{ marginTop: 0 }}>{String(r.notes)}</span>,
    sort: (r) => String(r.notes),
  },
];
const CON_COLS: Col[] = [
  { h: 'Vector', cls: 'idc', cell: (r) => String(r.id), sort: (r) => String(r.id) },
  {
    h: 'You supply',
    cell: (r) => (
      <>
        <span className="nm">{String(r.insert)}</span>
        <span className="sm">{String(r.module)}</span>
      </>
    ),
    sort: (r) => String(r.insert),
  },
  {
    h: 'Variable regions',
    cell: (r) => {
      const names = String(r.vnames ?? '')
        .split(' · ')
        .map((n) => n.trim())
        .filter(Boolean);
      return names.length ? (
        <div className="vhit-dom" style={{ marginTop: 0 }}>
          {names.map((n) => (
            <span className="pill on" key={n}>
              {n}
            </span>
          ))}
        </div>
      ) : (
        <span className="sm" style={{ marginTop: 0 }}>
          None assigned
        </span>
      );
    },
    sort: (r) => String(r.vnames ?? ''),
  },
  {
    h: 'Engineering in the vector',
    cell: (r) => (
      <>
        {String(r.eng)}
        <span className="sm">{String(r.note)}</span>
      </>
    ),
    sort: (r) => String(r.eng),
  },
  {
    h: 'Category',
    cell: (r) =>
      r.cat === 'None' ? <span className="pill">None</span> : <span className="pill on">{String(r.cat)}</span>,
    sort: (r) => String(r.cat),
  },
  { h: 'Marker', cell: (r) => String(r.sel), sort: (r) => String(r.sel) },
  { h: 'Protein A', cell: (r) => String(r.prota), sort: (r) => String(r.prota) },
  {
    h: 'Inventory',
    cell: (r) => <InventoryCell record={inventory.constructs[String(r.id)]} />,
    sort: (r) => String(r.stock ?? ''),
  },
];

function cloneSel(sel: Sel): Sel {
  return {
    fmt: { ...sel.fmt },
    chn: { ...sel.chn },
    con: { ...sel.con },
    mut: { ...sel.mut },
  };
}

function withStock<T extends { id: string }>(rows: T[], book: InventoryBook['chains']): Row[] {
  return rows.map((r) => ({ ...r, stock: stockStatus(book[r.id]) })) as unknown as Row[];
}

function cycleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute(
    'data-theme',
    cur === 'dark'
      ? 'light'
      : cur === 'light'
        ? 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches
          ? 'light'
          : 'dark',
  );
}

function pruneFacetSel(facetSel: Record<string, Set<string>>, rows: Row[]): Record<string, Set<string>> {
  const next: Record<string, Set<string>> = {};
  for (const [k, set] of Object.entries(facetSel)) {
    if (!set?.size) continue;
    const keep = new Set([...set].filter((v) => rows.some((r) => rowHasFacet(r, k, new Set([v])))));
    if (keep.size) next[k] = keep;
  }
  return next;
}

export default function App() {
  const sides = useSidePanels();
  const [state, setState] = useState(defaultState);
  const [query, setQuery] = useState<Record<Grain, string>>({
    fmt: '',
    chn: '',
    var: '',
    mut: '',
    con: '',
  });
  const [facetSel, setFacetSel] = useState<Record<Grain, Record<string, Set<string>>>>({
    fmt: {},
    chn: {},
    var: {},
    mut: {},
    con: {},
  });

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const hue = { fmt: '--fmt', chn: '--chn', var: '--vr', mut: '--mut', con: '--con' }[state.grain];
    const bg = { fmt: '--fmt-bg', chn: '--chn-bg', var: '--vr-bg', mut: '--mut-bg', con: '--con-bg' }[state.grain];
    document.documentElement.style.setProperty('--grain', `var(${hue})`);
    document.documentElement.style.setProperty('--grain-bg', `var(${bg})`);
  }, [state.grain]);

  const fmtFocus = useMemo(() => {
    if (!facetsActive(facetSel.fmt, query.fmt ?? '')) return undefined;
    return matchingIds(seed.formats, facetSel.fmt, query.fmt ?? '', (f) =>
      [f.id, f.name, f.target, f.mutset, f.notes, f.mispair, f.tier].join(' '),
    );
  }, [facetSel.fmt, query.fmt]);

  const model = useMemo(
    () =>
      applyMutations(
        resolve(seed, state.sel, fmtFocus != null ? { formats: fmtFocus } : undefined),
        seed,
        state.sel,
        mutations,
      ),
    [state.sel, fmtFocus],
  );
  const slots = useMemo(() => buildSlots(seed, model.buildV), [model.buildV]);
  const vByVec = useMemo(
    () => insertsByVector(slots, state.variants, state.assign),
    [slots, state.variants, state.assign],
  );
  const slotSig = [...model.buildV].sort().join(',');
  useEffect(() => {
    setState((s) => {
      const assign = fillAssignFromCatalog(catalog, s.variants, slots, s.assign);
      return assign === s.assign ? s : { ...s, assign };
    });
  }, [slotSig, slots]);

  const setMark = (grain: 'fmt' | 'chn' | 'con' | 'mut', id: string, v: Mark) => {
    setState((s) => {
      const next = cloneSel(s.sel);
      if (next[grain][id] === v) delete next[grain][id];
      else next[grain][id] = v;
      return { ...s, sel: next };
    });
  };

  const grain = state.grain;
  const isVar = grain === 'var';
  const facets =
    grain === 'fmt' ? FMT_FACETS : grain === 'chn' ? CHN_FACETS : grain === 'mut' ? MUT_FACETS : CON_FACETS;
  const rows: Row[] =
    grain === 'fmt'
      ? (seed.formats as Format[] as unknown as Row[])
      : grain === 'chn'
        ? withStock(seed.chains as Chain[], inventory.chains)
        : grain === 'mut'
          ? (mutations as unknown as Row[])
          : withStock(seed.vectors as Vector[], inventory.constructs).map((r) => ({
              ...r,
              vnames: (vByVec[r.id] ?? []).join(' · '),
            }));
  const cols = grain === 'fmt' ? FMT_COLS : grain === 'chn' ? CHN_COLS : grain === 'mut' ? MUT_COLS : CON_COLS;
  const title =
    grain === 'fmt'
      ? 'Formats'
      : grain === 'chn'
        ? 'Chain archetypes'
        : grain === 'mut'
          ? 'Mutation sets'
          : 'Destination vectors';
  const railRows =
    grain === 'fmt'
      ? rows
      : grain === 'chn'
        ? rows.filter((r) => model.reachC.has(r.id) || model.buildC.has(r.id))
        : grain === 'mut'
          ? rows
          : rows.filter((r) => model.reachV.has(r.id) || model.buildV.has(r.id));
  const text = (r: Row) =>
    grain === 'fmt'
      ? [r.id, r.name, r.target, r.mutset, r.notes, r.mispair, r.tier].join(' ')
      : grain === 'chn'
        ? [r.id, r.name, r.note, r.module, r.partner, r.slots, r.stock].join(' ')
        : grain === 'mut'
          ? [r.id, r.name, r.purpose, r.positions, r.numbering, r.domain, r.carried, r.notes, r.partner].join(' ')
          : [r.id, r.role, r.insert, r.module, r.eng, r.note, r.sel, r.stock, r.vnames].join(' ');
  const liveFacets = grain === 'fmt' ? facetSel.fmt : pruneFacetSel(facetSel[grain] ?? {}, railRows);

  return (
    <>
      <header className="toolbar">
        <div className="tool-brand" title="Pick a format and its chains and plasmids come with it.">
          Protein Chain Workbench
        </div>
        <LevelTabs
          grain={grain}
          model={model}
          seed={seed}
          builds={variantList(state.variants).length}
          onGrain={(g) => setState((s) => ({ ...s, grain: g }))}
        />
        {isVar ? null : (
          <input
            className="tool-filter"
            type="search"
            placeholder="Filter documents"
            aria-label="Filter documents"
            value={query[grain] ?? ''}
            onChange={(e) => setQuery((qs) => ({ ...qs, [grain]: e.target.value }))}
          />
        )}
        <button
          className="btn sm"
          type="button"
          title="Hide Sources and Viewer so the document table fills the window."
          onClick={sides.expandView}
        >
          {sides.layout.leftOpen || sides.layout.rightOpen ? 'Expand View' : 'Restore View'}
        </button>
        <button className="btn sm" type="button" onClick={cycleTheme}>
          Theme
        </button>
      </header>
      <div className="statusbar" role="status">
        <span>
          {grain === 'fmt'
            ? `${model.reachF.size} of ${seed.formats.length} documents in play`
            : grain === 'chn'
              ? `${model.buildC.size} in build, ${model.reachC.size} available`
              : grain === 'var'
                ? `${slots.length} slots, ${variantList(state.variants).length || 1} builds`
                : grain === 'mut'
                  ? `${model.buildM.size} in build, ${model.reachM.size} available`
                  : `${model.buildV.size} in build, ${model.reachV.size} available`}
        </span>
        <span className="stat-grow" />
        <span>EU for Fc and CH1 · Kabat / IMGT for V domains · selections stay in this browser</span>
      </div>

      <div className="wrap" style={sides.wrapStyle}>
        {isVar ? (
          <VLibraryRail
            catalog={catalog}
            panels={panelBook}
            selected={state.panels}
            library={state.library}
            expanded={sides.layout.leftOpen}
            onFold={() => sides.toggle('left')}
            fold={<FoldBtn side="left" open={sides.layout.leftOpen} onClick={() => sides.toggle('left')} />}
            grip={
              <ResizeGrip
                side="left"
                onDrag={(e) => sides.startResize('left', e)}
                onReset={() => sides.resetWidth('left')}
              />
            }
            onLibrary={(library) => setState((s) => ({ ...s, library }))}
            onClones={(items, on) =>
              setState((s) => ({
                ...s,
                ...applyClones(items, slots, s.library, s.variants, s.assign, on),
              }))
            }
            onPanels={(ids) =>
              setState((s) => {
                const applied = applyPanels(catalog, panelBook, ids, slots);
                const panelNames = new Set(
                  ids.flatMap((id) => {
                    const p = panelBook.find((x) => x.id === id);
                    return p ? clonesOf(catalog, p.clones).flatMap((c) => c.items.map((v) => v.name)) : [];
                  }),
                );
                const extras = parseLibrary(s.library)
                  .filter((e) => !panelNames.has(e.name))
                  .map((e) => (e.t ? `${e.name}, ${e.t}` : e.name));
                const library = addToLibrary(applied.library, extras);
                return {
                  ...s,
                  panels: ids,
                  library,
                  variants: mergeStandaloneBuilds(applied.variants, s.variants, library),
                  assign: { ...s.assign, ...applied.assign },
                };
              })
            }
          />
        ) : (
          <FacetRail
            key={grain}
            title="Sources"
            facets={facets}
            rows={railRows}
            facetSel={liveFacets}
            expanded={sides.layout.leftOpen}
            onFold={() => sides.toggle('left')}
            fold={<FoldBtn side="left" open={sides.layout.leftOpen} onClick={() => sides.toggle('left')} />}
            grip={
              <ResizeGrip
                side="left"
                onDrag={(e) => sides.startResize('left', e)}
                onReset={() => sides.resetWidth('left')}
              />
            }
            onToggle={(key, value, on) => {
              setFacetSel((fs) => {
                const cur = new Set(fs[grain][key] ?? []);
                if (on) cur.add(value);
                else cur.delete(value);
                return { ...fs, [grain]: { ...fs[grain], [key]: cur } };
              });
            }}
            onClear={() => {
              setFacetSel((fs) => ({ ...fs, [grain]: {} }));
            }}
          />
        )}

        {isVar ? (
          <VariableRegions
            slots={slots}
            variants={state.variants}
            library={state.library}
            assign={state.assign}
            onVariants={(variants) => setState((s) => ({ ...s, variants }))}
            onAssign={(variant, key, value) =>
              setState((s) => {
                const row = { ...(s.assign[variant] ?? {}) };
                if (value.trim()) row[key] = value.trim();
                else delete row[key];
                return { ...s, assign: { ...s.assign, [variant]: row } };
              })
            }
          />
        ) : (
          <RowTable
            key={grain}
            grain={grain}
            title={title}
            rows={rows}
            cols={cols}
            model={model}
            marks={grain === 'mut' ? state.sel.mut : grain === 'fmt' || grain === 'chn' || grain === 'con' ? state.sel[grain] : {}}
            query={query[grain] ?? ''}
            facetSel={liveFacets}
            hideOut={state.hideOut}
            text={text}
            onMark={(id, v) => {
              if (grain === 'fmt' || grain === 'chn' || grain === 'con' || grain === 'mut') setMark(grain, id, v);
            }}
            onHideOut={() => setState((s) => ({ ...s, hideOut: !s.hideOut }))}
          />
        )}

        <BuildPanel
          seed={seed}
          model={model}
          sel={state.sel}
          variants={state.variants}
          assign={state.assign}
          library={state.library}
          mutations={mutations}
          presets={state.presets}
          expanded={sides.layout.rightOpen}
          onFold={() => sides.toggle('right')}
          fold={<FoldBtn side="right" open={sides.layout.rightOpen} onClick={() => sides.toggle('right')} />}
          grip={
            <ResizeGrip
              side="right"
              onDrag={(e) => sides.startResize('right', e)}
              onReset={() => sides.resetWidth('right')}
            />
          }
          onReset={() => setState((s) => ({ ...s, sel: emptySel() }))}
          onRuleOut={(id) => setMark('con', id, 'out')}
          onRestore={(g, id) =>
            setState((s) => {
              if (g === 'var') return s;
              const next = cloneSel(s.sel);
              delete next[g][id];
              return { ...s, sel: next };
            })
          }
          onSavePreset={(name) =>
            setState((s) => ({
              ...s,
              presets: [...s.presets, { name, n: model.buildV.size, sel: cloneSel(s.sel) }],
            }))
          }
          onApplyPreset={(i) =>
            setState((s) => ({
              ...s,
              sel: cloneSel(s.presets[i]?.sel ?? emptySel()),
            }))
          }
          onDeletePreset={(i) =>
            setState((s) => ({ ...s, presets: s.presets.filter((_, j) => j !== i) }))
          }
        />
      </div>
    </>
  );
}
