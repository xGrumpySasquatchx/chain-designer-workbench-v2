import { useEffect, useMemo, useState } from 'react';
import inventoryJson from './data/inventory.json';
import mutationsJson from './data/mutations.json';
import panelsJson from './data/panels.json';
import seedJson from './data/seed.json';
import vregionsJson from './data/vregions.json';
import { BuildPanel } from './components/BuildPanel';
import { ChainRatios } from './components/ChainRatios';
import { ConstructCombinations } from './components/ConstructCombinations';
import { ExpressionBench, ExpressionRail } from './components/ExpressionBench';
import { FacetRail, type FacetDef } from './components/FacetRail';
import { InventoryCell } from './components/InventoryCell';
import { LevelTabs } from './components/LevelTabs';
import { RowTable, type Col, type Row } from './components/RowTable';
import { FoldBtn, ResizeGrip, useSidePanels } from './components/SidePanels';
import { PanelPick, RequestBench, RequestRail } from './components/RequestBench';
import { VariableRegions } from './components/VariableRegions';
import { VLibraryRail } from './components/VLibraryRail';
import {
  combinationText,
  groupConstructs,
  planCombinations,
  ungroupConstructs,
} from './model/combinations';
import { downloadPdf, textPdf } from './model/pdf';
import { recipeLines, type RecipePanel } from './model/recipe';
import { EMPTY_DESIGN, matchFormat } from './model/design';
import {
  CODON_METHODS,
  TARGET_CLASSES,
  codonTableName,
  hostById,
  planReady,
  scenarioById,
  registerExpression,
  registrationMatches,
  withHost,
} from './model/expression';
import { stockStatus } from './model/inventory';
import {
  archetypeIdsOf,
  assembleBook,
  chainByArchetype,
  formatIdsOf,
  newRequest,
  panelById,
  panelConstructIds,
  panelMutationIds,
  registerRequest,
} from './model/luma';
import { rowHasFacet } from './model/facets';
import {
  addToLibrary,
  applyClones,
  applyPanels,
  assignedInserts,
  clonesOf,
  fillAssignFromCatalog,
  insertsByVector,
  mergeStandaloneBuilds,
  parseLibrary,
  variantList,
} from './model/library';
import { applyMutations } from './model/mutations';
import { planChainRatios, ratioSummary } from './model/ratio';
import { emptySel, facetsActive, matchingIds, resolve } from './model/selection';
import { buildSlots } from './model/slots';
import type {
  Chain,
  DraftMolecule,
  Grain,
  InventoryBook,
  Mark,
  Mutation,
  PadDesign,
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

const CHN_COLS: Col[] = [
  {
    h: 'ID',
    cls: 'idc',
    cell: (r) => (
      <>
        <span className="mono">{String(r.luma || r.id)}</span>
        {r.luma ? <span className="sm">{String(r.id)}</span> : null}
      </>
    ),
    sort: (r) => String(r.luma || r.id),
  },
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
    cell: (r) => (
      <InventoryCell
        record={r.constructId ? inventory.constructs[String(r.constructId)] : undefined}
        note={r.constructNote ? String(r.constructNote) : undefined}
      />
    ),
    sort: (r) => String(r.constructNote ?? r.stock ?? ''),
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
    h: 'Combination',
    cell: (r) => (r.combo ? <span className="nm">{String(r.combo)}</span> : <span className="sm">—</span>),
    sort: (r) => String(r.combo ?? ''),
  },
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
    h: 'Chain ratio',
    cell: (r) =>
      r.chainRatio ? <span className="nm">{String(r.chainRatio)}</span> : <span className="sm">—</span>,
    sort: (r) => String(r.chainRatio ?? ''),
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
    cell: (r) => (
      <InventoryCell
        record={inventory.constructs[String(r.id)]}
        note={r.reuseNote ? String(r.reuseNote) : undefined}
      />
    ),
    sort: (r) => String(r.reuseNote ?? r.stock ?? ''),
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
    exp: '',
  });
  const [facetSel, setFacetSel] = useState<Record<Grain, Record<string, Set<string>>>>({
    fmt: {},
    chn: {},
    var: {},
    mut: {},
    con: {},
    exp: {},
  });
  const [pad, setPad] = useState<PadDesign>(EMPTY_DESIGN);
  const [panelQuery, setPanelQuery] = useState('');

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const hue = { fmt: '--fmt', chn: '--chn', var: '--vr', mut: '--mut', con: '--con', exp: '--exp' }[state.grain];
    const bg = { fmt: '--fmt-bg', chn: '--chn-bg', var: '--vr-bg', mut: '--mut-bg', con: '--con-bg', exp: '--exp-bg' }[
      state.grain
    ];
    document.documentElement.style.setProperty('--grain', `var(${hue})`);
    document.documentElement.style.setProperty('--grain-bg', `var(${bg})`);
  }, [state.grain]);

  const book = useMemo(
    () =>
      assembleBook(seed, inventory, mutations, panelBook, {
        requests: state.requests,
        panels: state.userPanels,
        molecules: state.userMolecules,
      }),
    [state.requests, state.userPanels, state.userMolecules],
  );
  const activePanel = panelById(book, state.activePanelId);
  const panelFormats = formatIdsOf(book, state.activePanelId);

  const fmtFocus = useMemo(() => {
    if (panelFormats) return panelFormats;
    if (!facetsActive(facetSel.fmt, query.fmt ?? '')) return undefined;
    return matchingIds(seed.formats, facetSel.fmt, query.fmt ?? '', (f) =>
      [f.id, f.name, f.target, f.mutset, f.notes, f.mispair, f.tier].join(' '),
    );
  }, [facetSel.fmt, query.fmt, panelFormats]);

  const panelChains = archetypeIdsOf(book, state.activePanelId);
  const panelConstructs = panelConstructIds(book, state.activePanelId);
  const panelMutations = panelMutationIds(book, state.activePanelId);
  const model = useMemo(() => {
    const next = applyMutations(
      resolve(seed, state.sel, fmtFocus != null ? { formats: fmtFocus } : undefined),
      seed,
      state.sel,
      mutations,
    );
    const keep = (set: Set<string>, allowed: Set<string> | undefined) => {
      if (!allowed) return;
      for (const id of [...set]) if (!allowed.has(id)) set.delete(id);
    };
    keep(next.reachC, panelChains);
    keep(next.buildC, panelChains);
    keep(next.claimC, panelChains);
    keep(next.reachV, panelConstructs);
    keep(next.buildV, panelConstructs);
    keep(next.claimV, panelConstructs);
    keep(next.reachM, panelMutations);
    keep(next.buildM, panelMutations);
    keep(next.claimM, panelMutations);
    return next;
  }, [state.sel, fmtFocus, panelChains, panelConstructs, panelMutations]);
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
  const isReq = grain === 'fmt';
  const isExp = grain === 'exp';
  const openRequest = book.requests.find((r) => r.id === state.activeRequestId) ?? null;
  const facets =
    grain === 'fmt' ? FMT_FACETS : grain === 'chn' ? CHN_FACETS : grain === 'mut' ? MUT_FACETS : CON_FACETS;
  const chainRows: Row[] = withStock(seed.chains as Chain[], inventory.chains).map((r) => {
    const link = chainByArchetype(book, r.id);
    const role = link?.role === 'reagent' ? 'Reagent' : 'Campaign';
    return {
      ...r,
      luma: link?.id ?? '',
      constructId: link?.constructId ?? '',
      constructNote: link
        ? `${link.constructId ?? 'No construct'} · ${role} · ${link.moleculeIds.length} molecules`
        : '',
    };
  });
  const ratioPlan = planChainRatios(
    seed,
    model.buildC,
    model.buildV,
    state.chainRatios,
    panelFormats,
  );
  const buildVectors = seed.vectors.map((vector) => vector.id).filter((id) => model.buildV.has(id));
  const combinations = planCombinations(buildVectors, state.constructGroups, ratioPlan.separate);
  const comboByVector: Record<string, string> = {};
  combinations.forEach((combo) => {
    combo.vectorIds.forEach((id) => {
      comboByVector[id] = combo.label;
    });
  });
  const ratioByVector: Record<string, string> = {};
  ratioPlan.rows.forEach((row) => {
    const bit = `${row.chainId} ${row.parts}`;
    row.vectors.forEach((id) => {
      ratioByVector[id] = ratioByVector[id] ? `${ratioByVector[id]} · ${bit}` : bit;
    });
  });
  const vectorRows: Row[] = withStock(seed.vectors as Vector[], inventory.constructs).map((r) => {
    const link = book.constructs.find((c) => c.id === r.id);
    const role = link?.role === 'reagent' ? 'Reagent' : 'Campaign';
    return {
      ...r,
      vnames: (vByVec[r.id] ?? []).join(' · '),
      reuseNote: link ? `${role} · ${link.moleculeIds.length} molecules · ${link.chainIds.length} chains` : '',
      chainRatio: ratioByVector[r.id] ?? '',
      combo: comboByVector[r.id] ?? '',
    };
  });
  const waiting = !activePanel && (grain === 'chn' || grain === 'mut' || grain === 'con');
  const rows: Row[] = waiting
    ? []
    : grain === 'chn'
      ? chainRows.filter((r) => !panelChains || panelChains.has(r.id))
      : grain === 'mut'
        ? (mutations as unknown as Row[]).filter((r) => !panelMutations || panelMutations.has(r.id))
        : vectorRows.filter((r) => !panelConstructs || panelConstructs.has(r.id));
  const cols = grain === 'chn' ? CHN_COLS : grain === 'mut' ? MUT_COLS : CON_COLS;
  const title = !activePanel
    ? 'Select a panel'
    : grain === 'chn'
      ? `${activePanel.name} · ${activePanel.id}`
      : grain === 'mut'
        ? 'Mutation sets'
        : 'Constructs';
  const notice = waiting
    ? 'Select a panel registered in Luma. The molecules in that panel decide which chains, mutations, and constructs you can use.'
    : undefined;

  const openPanel = (id: string) => {
    const archetypes = archetypeIdsOf(book, id);
    const constructs = panelConstructIds(book, id);
    const muts = panelMutationIds(book, id);
    setState((s) => {
      const chn = { ...s.sel.chn };
      const con = { ...s.sel.con };
      const mut = { ...s.sel.mut };
      if (archetypes) for (const key of Object.keys(chn)) if (!archetypes.has(key)) delete chn[key];
      if (constructs) for (const key of Object.keys(con)) if (!constructs.has(key)) delete con[key];
      if (muts) for (const key of Object.keys(mut)) if (!muts.has(key)) delete mut[key];
      return { ...s, activePanelId: id, sel: { ...s.sel, fmt: {}, chn, con, mut } };
    });
  };
  const deleteDraft = (id: string) => {
    const target = state.requests.find((r) => r.id === id);
    if (!target || target.status !== 'draft') return;
    if (state.activeRequestId === id) setPad(EMPTY_DESIGN);
    setState((s) => ({
      ...s,
      requests: s.requests.filter((r) => r.id !== id || r.status !== 'draft'),
      activeRequestId: s.activeRequestId === id ? null : s.activeRequestId,
    }));
  };
  const openRequestById = (id: string) => {
    const req = book.requests.find((r) => r.id === id);
    setPad(req?.drafts[0]?.design ?? EMPTY_DESIGN);
    setState((s) => ({
      ...s,
      activeRequestId: id,
      activePanelId: req?.panelId ?? s.activePanelId,
    }));
    if (req?.panelId) openPanel(req.panelId);
  };
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
        ? [r.id, r.luma, r.name, r.note, r.module, r.partner, r.slots, r.constructNote].join(' ')
        : grain === 'mut'
          ? [r.id, r.name, r.purpose, r.positions, r.numbering, r.domain, r.carried, r.notes, r.partner].join(' ')
          : [r.id, r.role, r.insert, r.module, r.eng, r.note, r.sel, r.stock, r.vnames].join(' ');
  const liveFacets = grain === 'fmt' ? facetSel.fmt : pruneFacetSel(facetSel[grain] ?? {}, railRows);
  const expressionRows = slots.flatMap((slot) => {
    const named = assignedInserts([slot], state.variants, state.assign);
    if (named.length) {
      return named.map((item) => ({
        key: item.id,
        insert: item.label,
        label: item.note,
        domain: slot.t,
        vector: slot.vec,
      }));
    }
    return [
      {
        key: slot.key,
        insert: slot.label || slot.t,
        label: slot.note,
        domain: slot.t,
        vector: slot.vec,
      },
    ];
  });
  const expressionVectors = [...model.buildV].sort();
  const expressionRegistered = state.expressionRegistrations.some((record) =>
    registrationMatches(record, state.expression, expressionVectors),
  );
  const canRegister = planReady(state.expression) && expressionVectors.length > 0 && !expressionRegistered;
  const registerTitle = !planReady(state.expression)
    ? 'Choose a production scenario, an expression system, and a codon optimization method on Level 5.'
    : expressionVectors.length === 0
      ? 'Include a chain on Level 1 so its constructs can be registered.'
      : expressionRegistered
        ? 'These constructs are already registered with this expression choice.'
        : 'Register the current constructs with this expression system and codon method.';
  const expressionItems = [
    ...(state.expression.host
      ? [
          {
            id: 'plan',
            label: hostById(state.expression.host).name,
            note: [
              state.expression.mode ? scenarioById(state.expression.mode).name : 'Choose transient or stable',
              TARGET_CLASSES.find((target) => target.id === state.expression.targetClass)?.label ?? '',
              state.expression.codon
                ? (CODON_METHODS.find((method) => method.id === state.expression.codon)?.label ?? '')
                : 'Choose a codon method',
              state.expression.codonTable
                ? codonTableName(state.expression.host, state.expression.codonTable)
                : '',
            ]
              .filter(Boolean)
              .join(' · '),
          },
        ]
      : []),
    ...state.expressionRegistrations.map((record) => ({
      id: record.id,
      label: record.id,
      note: `${scenarioById(record.mode).name} · ${hostById(record.host).name} · ${
        CODON_METHODS.find((method) => method.id === record.codon)?.label ?? ''
      } · ${record.vectorIds.length} construct${record.vectorIds.length === 1 ? '' : 's'}`,
    })),
  ];

  return (
    <>
      <header className="toolbar">
        <div className="tool-brand" title="Design a molecule, register the panel, then build its chains.">
          Protein Chain Workbench
        </div>
        <LevelTabs
          grain={grain}
          model={model}
          seed={seed}
          builds={variantList(state.variants).length}
          requestCount={`${state.requests.filter((r) => r.status === 'draft').length} drafts · ${book.panels.length} panels`}
          expressionCount={
            state.expression.mode || state.expression.host
              ? [
                  state.expression.mode ? scenarioById(state.expression.mode).name : null,
                  state.expression.host ? hostById(state.expression.host).name : null,
                  state.expressionRegistrations.length ? String(state.expressionRegistrations.length) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'choose'
          }
          onGrain={(g) => setState((s) => ({ ...s, grain: g }))}
        />
        <input
          className={`tool-filter${isVar || isReq || isExp ? ' is-idle' : ''}`}
          type="search"
          placeholder="Filter documents"
          aria-label="Filter documents"
          aria-hidden={isVar || isReq || isExp}
          tabIndex={isVar || isReq || isExp ? -1 : 0}
          value={isVar || isReq || isExp ? '' : (query[grain] ?? '')}
          onChange={(e) => {
            if (isVar || isReq || isExp) return;
            setQuery((qs) => ({ ...qs, [grain]: e.target.value }));
          }}
        />
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
            ? `${book.panels.length} panels registered in Luma`
            : grain === 'chn'
              ? activePanel
                ? `${activePanel.name}: ${model.buildC.size} in build, ${model.reachC.size} available`
                : 'Select a registered panel'

              : grain === 'var'
                ? `${slots.length} slots, ${variantList(state.variants).length || 1} builds`
                : grain === 'mut'
                  ? `${model.buildM.size} in build, ${model.reachM.size} available`
                  : grain === 'exp'
                    ? [
                        state.expression.mode ? scenarioById(state.expression.mode).name : 'Choose transient or stable',
                        state.expression.host
                          ? hostById(state.expression.host).name
                          : 'choose an expression system',
                        state.expression.codon
                          ? CODON_METHODS.find((method) => method.id === state.expression.codon)?.label
                          : 'choose a codon method',
                      ]
                        .filter(Boolean)
                        .join(' · ')
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
        ) : isReq ? (
          <RequestRail
            requests={book.requests}
            activeId={state.activeRequestId}
            query={query.fmt}
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
            onQuery={(q) => setQuery((qs) => ({ ...qs, fmt: q }))}
            onNew={() => {
              const req = newRequest(state.requests);
              setPad(EMPTY_DESIGN);
              setState((s) => ({ ...s, requests: [req, ...s.requests], activeRequestId: req.id }));
            }}
            onOpen={openRequestById}
            onDeleteDraft={deleteDraft}
          />
        ) : isExp ? (
          <ExpressionRail
            plan={state.expression}
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
            onTarget={(targetClass) =>
              setState((s) => ({ ...s, expression: { ...s.expression, targetClass } }))
            }
            onHost={(host) => setState((s) => ({ ...s, expression: withHost(s.expression, host) }))}
            onMode={(mode) => setState((s) => ({ ...s, expression: { ...s.expression, mode } }))}
          />
        ) : (
          <FacetRail
            title="Sources"
            facets={facets}
            rows={railRows}
            facetSel={liveFacets}
            lead={
              grain === 'chn' ? (
                <PanelPick
                  panels={book.panels}
                  activeId={state.activePanelId}
                  query={panelQuery}
                  onQuery={setPanelQuery}
                  onOpen={openPanel}
                />
              ) : null
            }
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

        {isReq ? (
          <RequestBench
            seed={seed}
            book={book}
            request={openRequest}
            design={pad}
            onDesign={setPad}
            onRename={(name) =>
              setState((s) => ({
                ...s,
                requests: s.requests.map((r) =>
                  r.id === s.activeRequestId && r.status === 'draft' ? { ...r, name } : r,
                ),
              }))
            }
            onTarget={(index, value) =>
              setPad((d) => {
                const targets: [string, string] = [d.targets[0], d.targets[1]];
                targets[index] = value;
                return { ...d, targets };
              })
            }
            onAdd={() => {
              const format = matchFormat(seed, pad);
              if (!format || !openRequest || openRequest.status === 'registered') return;
              const draft: DraftMolecule = {
                id: `draft-${crypto.randomUUID()}`,
                name: format.name,
                design: pad,
                formatId: format.id,
              };
              setState((s) => ({
                ...s,
                requests: s.requests.map((r) =>
                  r.id === openRequest.id ? { ...r, drafts: [...r.drafts, draft] } : r,
                ),
              }));
            }}
            onRegister={(draftIds) => {
              if (!openRequest) return;
              const minted = registerRequest(book, openRequest, seed, draftIds);
              if (!minted) return;
              setState((s) => {
                const kept = minted.remaining.length
                  ? s.requests.map((r) =>
                      r.id === openRequest.id ? { ...r, status: 'draft' as const, panelId: null, drafts: minted.remaining } : r,
                    )
                  : s.requests.map((r) => (r.id === openRequest.id ? minted.request : r));
                return {
                  ...s,
                  requests: minted.remaining.length ? [minted.request, ...kept] : kept,
                  userPanels: [...s.userPanels, minted.panel],
                  userMolecules: [...s.userMolecules, ...minted.molecules],
                  activePanelId: minted.panel.id,
                  activeRequestId: minted.request.id,
                };
              });
            }}
            onOpenMolecule={(draft) => setPad(draft.design)}
            onOpenRequest={(id, design) => {
              openRequestById(id);
              if (design) setPad(design);
            }}
            onDeleteDraft={deleteDraft}
          />
        ) : isExp ? (
          <ExpressionBench
            plan={state.expression}
            slots={expressionRows}
            registrations={state.expressionRegistrations}
            onTarget={(targetClass) =>
              setState((s) => ({ ...s, expression: { ...s.expression, targetClass } }))
            }
            onHost={(host) => setState((s) => ({ ...s, expression: withHost(s.expression, host) }))}
            onCodonTable={(codonTable) =>
              setState((s) => ({ ...s, expression: { ...s.expression, codonTable } }))
            }
            onCodon={(codon) => setState((s) => ({ ...s, expression: { ...s.expression, codon } }))}
            onMode={(mode) => setState((s) => ({ ...s, expression: { ...s.expression, mode } }))}
          />
        ) : isVar ? (
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
            marks={grain === 'mut' ? state.sel.mut : state.sel[grain]}
            query={query[grain] ?? ''}
            facetSel={liveFacets}
            hideOut={state.hideOut}
            text={text}
            notice={notice}
            lead={
              grain === 'con' ? (
                <>
                  <ConstructCombinations
                    combinations={combinations}
                    inserts={Object.fromEntries(seed.vectors.map((vector) => [vector.id, vector.insert]))}
                    separate={ratioPlan.separate}
                    customized={Object.keys(state.constructGroups).length > 0}
                    onGroup={(ids) =>
                      setState((s) => ({
                        ...s,
                        constructGroups: groupConstructs(s.constructGroups, buildVectors, ids, ratioPlan.separate),
                      }))
                    }
                    onUngroup={(ids) =>
                      setState((s) => ({
                        ...s,
                        constructGroups: ungroupConstructs(s.constructGroups, buildVectors, ids, ratioPlan.separate),
                      }))
                    }
                    onReset={() => setState((s) => ({ ...s, constructGroups: {} }))}
                  />
                  <ChainRatios
                    plan={ratioPlan}
                    split={combinations.length > 1}
                    onChange={(chainId, parts) =>
                      setState((s) => ({ ...s, chainRatios: { ...s.chainRatios, [chainId]: parts } }))
                    }
                    onReset={() =>
                      setState((s) => {
                        const chainRatios = { ...s.chainRatios };
                        ratioPlan.rows.forEach((row) => delete chainRatios[row.chainId]);
                        return { ...s, chainRatios };
                      })
                    }
                  />
                </>
              ) : undefined
            }
            onMark={(id, v) => setMark(grain, id, v)}
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
          requestItems={
            activePanel
              ? book.molecules
                  .filter((m) => m.panelId === activePanel.id)
                  .map((m) => ({ id: m.id, label: m.name, note: `${m.id} · ${m.formatId}` }))
              : undefined
          }
          expressionItems={expressionItems}
          canRegister={canRegister}
          registered={expressionRegistered}
          registerTitle={registerTitle}
          ratioText={ratioSummary(ratioPlan)}
          combinationText={combinationText(combinations)}
          ratioByVector={ratioByVector}
          comboByVector={comboByVector}
          onPublish={() => {
            const chapter = (panel: (typeof book.panels)[number]): RecipePanel => ({
              id: panel.id,
              name: panel.name,
              requestId: panel.requestId,
              project: panel.project,
              molecules: book.molecules
                .filter((molecule) => molecule.panelId === panel.id)
                .map((molecule) => ({ id: molecule.id, name: molecule.name, formatId: molecule.formatId })),
              chains: panel.chainIds.map((uid) => {
                const archetype = uid.replace(/^LCH-/, '');
                return { id: uid, name: seed.chains.find((chain) => chain.id === archetype)?.name ?? archetype };
              }),
            });
            const extras = book.panels.filter((panel) => panel.id.startsWith('PN-R') && panel.id !== activePanel?.id);
            const panels = [...(activePanel ? [chapter(activePanel)] : []), ...extras.map(chapter)];
            const bytes = textPdf(
              recipeLines({
                generatedOn: new Date().toISOString().slice(0, 10),
                activePanelId: activePanel?.id ?? null,
                panels,
                buildChains: seed.chains
                  .filter((chain) => model.buildC.has(chain.id))
                  .map((chain) => ({ id: chain.id, name: chain.name })),
                regions: expressionRows.map((row) => ({
                  vector: row.vector,
                  domain: row.domain,
                  insert: row.insert,
                })),
                mutations: mutations
                  .filter((mutation) => model.buildM.has(mutation.id))
                  .map((mutation) => ({ id: mutation.id, name: mutation.name })),
                combinations: combinations.map((combo) => ({
                  label: combo.label,
                  members: combo.vectorIds.join(' + '),
                })),
                ratioLines: ratioSummary(ratioPlan).split('\n').filter(Boolean),
                expressionLines: [
                  state.expression.mode ? scenarioById(state.expression.mode).name : '',
                  state.expression.host ? hostById(state.expression.host).name : '',
                  state.expression.codon
                    ? (CODON_METHODS.find((method) => method.id === state.expression.codon)?.label ?? '')
                    : '',
                  state.expression.host && state.expression.codonTable
                    ? codonTableName(state.expression.host, state.expression.codonTable)
                    : '',
                  ...state.expressionRegistrations.map(
                    (record) =>
                      `${record.id}  ${scenarioById(record.mode).name}  ${hostById(record.host).name}  ${record.registeredAt}`,
                  ),
                ].filter(Boolean),
              }),
            );
            const fileId = panels.length === 1 ? panels[0].id : 'panels';
            downloadPdf(`protein-recipe-${fileId}.pdf`, bytes);
          }}
          onRegister={() => {
            const inserts = expressionRows.map((row) => row.insert);
            setState((s) => {
              const record = registerExpression(
                s.expressionRegistrations,
                s.expression,
                expressionVectors,
                inserts,
              );
              if (!record) return s;
              return { ...s, expressionRegistrations: [record, ...s.expressionRegistrations] };
            });
          }}
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
              if (g !== 'fmt' && g !== 'chn' && g !== 'con' && g !== 'mut') return s;
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
