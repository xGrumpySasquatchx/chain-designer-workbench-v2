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
import { VariableRegions } from './components/VariableRegions';
import { VLibraryRail } from './components/VLibraryRail';
import { stockStatus } from './model/inventory';
import { addToLibrary, applyPanels, clonesOf, parseLibrary, variantList } from './model/library';
import { applyMutations } from './model/mutations';
import { emptySel, resolve } from './model/selection';
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
  { k: 'numbering', h: 'Numbering' },
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
  { h: 'ID', cls: 'idc', cell: (r) => String(r.id) },
  {
    h: 'Format',
    cell: (r) => (
      <>
        <span className="nm">{String(r.name)}</span>
        <span className="sm">{String(r.target)}</span>
      </>
    ),
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
  },
  { h: 'Plasmids', cell: (r) => <span className="mono">{String(r.plasmids)}</span> },
  {
    h: 'Build load',
    cell: (r) => (
      <>
        <span className="mono">{String(r.score)}</span>
        <span className="sm">{String(r.drivers)}</span>
      </>
    ),
  },
];
const CHN_COLS: Col[] = [
  { h: 'ID', cls: 'idc', cell: (r) => String(r.id) },
  {
    h: 'Chain',
    cell: (r) => (
      <>
        <span className="nm">{String(r.name)}</span>
        <span className="sm">{String(r.note)}</span>
      </>
    ),
  },
  {
    h: 'Fv contribution',
    cell: (r) => (
      <>
        {String(r.fvmode)}
        <span className="sm">{String(r.slots)}</span>
      </>
    ),
  },
  { h: 'Pairs with', cell: (r) => String(r.partner) },
  {
    h: 'Crossover',
    cell: (r) =>
      r.crossover === 'None' ? (
        <span className="pill">None</span>
      ) : (
        <span className="pill on">{String(r.crossover)}</span>
      ),
  },
  { h: 'Vectors', cell: (r) => <span className="mono">{(r.vectors as string[]).length}</span> },
  {
    h: 'Inventory',
    cell: (r) => <InventoryCell record={inventory.chains[String(r.id)]} />,
  },
];
const MUT_COLS: Col[] = [
  { h: 'Set', cls: 'idc', cell: (r) => String(r.name) },
  {
    h: 'Purpose',
    cell: (r) => (
      <>
        <span className="nm">{String(r.purpose)}</span>
        <span className="sm">{String(r.domain)}</span>
      </>
    ),
  },
  {
    h: 'Positions',
    cell: (r) => (
      <>
        {String(r.positions)}
        <span className="sm">{String(r.numbering)}</span>
      </>
    ),
  },
  { h: 'Partner', cell: (r) => String(r.partner) },
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
  },
  {
    h: 'Notes',
    cell: (r) => <span className="sm" style={{ marginTop: 0 }}>{String(r.notes)}</span>,
  },
];
const CON_COLS: Col[] = [
  { h: 'Vector', cls: 'idc', cell: (r) => String(r.id) },
  {
    h: 'You supply',
    cell: (r) => (
      <>
        <span className="nm">{String(r.insert)}</span>
        <span className="sm">{String(r.module)}</span>
      </>
    ),
  },
  {
    h: 'Engineering in the vector',
    cell: (r) => (
      <>
        {String(r.eng)}
        <span className="sm">{String(r.note)}</span>
      </>
    ),
  },
  {
    h: 'Category',
    cell: (r) =>
      r.cat === 'None' ? <span className="pill">None</span> : <span className="pill on">{String(r.cat)}</span>,
  },
  { h: 'Marker', cell: (r) => String(r.sel) },
  { h: 'Protein A', cell: (r) => String(r.prota) },
  {
    h: 'Inventory',
    cell: (r) => <InventoryCell record={inventory.constructs[String(r.id)]} />,
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

export default function App() {
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

  const model = useMemo(
    () => applyMutations(resolve(seed, state.sel), seed, state.sel, mutations),
    [state.sel],
  );
  const slots = useMemo(() => buildSlots(seed, model.buildV), [model.buildV]);

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
          : withStock(seed.vectors as Vector[], inventory.constructs);
  const cols = grain === 'fmt' ? FMT_COLS : grain === 'chn' ? CHN_COLS : grain === 'mut' ? MUT_COLS : CON_COLS;
  const title =
    grain === 'fmt'
      ? 'Formats'
      : grain === 'chn'
        ? 'Chain archetypes'
        : grain === 'mut'
          ? 'Mutation sets'
          : 'Destination vectors';
  const text = (r: Row) =>
    grain === 'fmt'
      ? [r.id, r.name, r.target, r.mutset, r.notes, r.mispair, r.tier].join(' ')
      : grain === 'chn'
        ? [r.id, r.name, r.note, r.module, r.partner, r.slots, r.stock].join(' ')
        : grain === 'mut'
          ? [r.id, r.name, r.purpose, r.positions, r.domain, r.carried, r.notes, r.partner].join(' ')
          : [r.id, r.role, r.insert, r.module, r.eng, r.note, r.sel, r.stock].join(' ');

  return (
    <>
      <header>
        <div className="head-in">
          <h1>Protein Chain Workbench</h1>
          <p className="sub">
            Pick a format and its chains and plasmids come with it. Add or drop individual ones without
            disturbing the rest. Anything ruled out sinks to the bottom.
          </p>
          <LevelTabs
            grain={grain}
            model={model}
            seed={seed}
            builds={variantList(state.variants).length}
            onGrain={(g) => setState((s) => ({ ...s, grain: g }))}
          />
        </div>
      </header>

      <div className="wrap">
        {isVar ? (
          <VLibraryRail
            catalog={catalog}
            panels={panelBook}
            selected={state.panels}
            library={state.library}
            onLibrary={(library) => setState((s) => ({ ...s, library }))}
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
                return {
                  ...s,
                  panels: ids,
                  library: addToLibrary(applied.library, extras),
                  variants: applied.variants,
                  assign: applied.assign,
                };
              })
            }
          />
        ) : (
          <FacetRail
            title="Narrow the list"
            facets={facets}
            rows={rows}
            facetSel={facetSel[grain]}
            query={query[grain] ?? ''}
            onQuery={(q) => setQuery((qs) => ({ ...qs, [grain]: q }))}
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
              setQuery((qs) => ({ ...qs, [grain]: '' }));
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
            grain={grain}
            title={title}
            rows={rows}
            cols={cols}
            model={model}
            marks={grain === 'mut' ? state.sel.mut : grain === 'fmt' || grain === 'chn' || grain === 'con' ? state.sel[grain] : {}}
            query={query[grain] ?? ''}
            facetSel={facetSel[grain]}
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
          presets={state.presets}
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
      <p className="foot">
        Vector IDs are placeholders until mapped onto your plasmid registry. Positions are EU for Fc and
        CH1, Kabat for V domains and flagged CL positions. Selections and saved backbones live in this
        browser.
      </p>
    </>
  );
}
