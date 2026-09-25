import inventoryJson from '../src/data/inventory.json';
import mutationsJson from '../src/data/mutations.json';
import seedJson from '../src/data/seed.json';
import vregionsJson from '../src/data/vregions.json';
import panelsJson from '../src/data/panels.json';
import { addToLibrary, applyClones, applyPanels, filterCatalog, insertsByVector, permuteCount, removeFromLibrary, variantList, vregionText } from '../src/model/library';
import { compileSearch, panelMatches, searchCatalog, treeCatalog } from '../src/model/vsearch';
import { locationLine, stockLine, stockStatus } from '../src/model/inventory';
import { applyMutations, mutationRelevant, specificVectorIds } from '../src/model/mutations';
import { emptySel, matchingIds, resolve, sortedIds } from '../src/model/selection';
import { slotsFor } from '../src/model/slots';
import { facetTokens, rowHasFacet } from '../src/model/facets';
import type { InventoryBook, Mutation, Seed, Sel, VPanel, VRegion } from '../src/model/types';

const seed = seedJson as unknown as Seed;
const mutations = mutationsJson as Mutation[];
const inventory = inventoryJson as InventoryBook;
const catalog = vregionsJson as VRegion[];
const panels = panelsJson as VPanel[];

function modelOf(patch: (s: Sel) => void) {
  const s = selWith(patch);
  return applyMutations(resolve(seed, s), seed, s, mutations);
}

function check(name: string, ok: boolean, detail?: string) {
  if (!ok) throw new Error(`fail  ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`pass  ${name}${detail ? ` — ${detail}` : ''}`);
}

function selWith(patch: (s: Sel) => void): Sel {
  const s = emptySel();
  patch(s);
  return s;
}

const m1 = resolve(seed, selWith((s) => { s.fmt['F-001'] = 'in'; }));
check(
  'a format claims both chains and both plasmids',
  sortedIds(m1.buildC).join(',') === 'CH-01,CH-18' &&
    sortedIds(m1.buildV).join(',') === 'pDM-HC-IgG1-WT,pDM-LC-kappa-WT',
  `${sortedIds(m1.buildC).join(',')} · ${sortedIds(m1.buildV).join(',')}`,
);

const m2 = resolve(
  seed,
  selWith((s) => {
    s.fmt['F-001'] = 'in';
    s.chn['CH-19'] = 'in';
  }),
);
check(
  'including a chain does not hide its siblings',
  sortedIds(m2.buildC).join(',') === 'CH-01,CH-18,CH-19' &&
    m2.buildV.has('pDM-HC-IgG1-WT') &&
    m2.buildV.has('pDM-LC-kappa-WT') &&
    m2.buildV.has('pDM-LC-lambda-WT'),
  sortedIds(m2.buildC).join(', '),
);

const m3 = resolve(
  seed,
  selWith((s) => {
    s.fmt['F-001'] = 'in';
    s.chn['CH-19'] = 'in';
    s.chn['CH-18'] = 'out';
  }),
);
check(
  'ruling out a chain drops its plasmid',
  sortedIds(m3.buildC).join(',') === 'CH-01,CH-19' &&
    sortedIds(m3.buildV).join(',') === 'pDM-HC-IgG1-WT,pDM-LC-lambda-WT',
  `${sortedIds(m3.buildC).join(',')} · ${sortedIds(m3.buildV).join(',')}`,
);

const m4 = resolve(
  seed,
  selWith((s) => {
    s.fmt['F-001'] = 'in';
    s.chn['CH-02'] = 'in';
  }),
);
const knob = ['pDM-HC-IgG1-KNOB', 'pDM-HC-IgG1-KNOB-LALAPG', 'pDM-HC-IgG1-KNOB-chgA', 'pDM-HC-IgG1-KNOB-THIOMAB'];
check(
  'an ambiguous chain add claims nothing',
  sortedIds(m4.buildV).join(',') === 'pDM-HC-IgG1-WT,pDM-LC-kappa-WT' &&
    knob.every((id) => m4.reachV.has(id)),
);
const m4b = resolve(
  seed,
  selWith((s) => {
    s.fmt['F-001'] = 'in';
    s.chn['CH-02'] = 'in';
    s.con['pDM-HC-IgG1-KNOB'] = 'in';
  }),
);
check(
  'the chosen knob plasmid then joins the build',
  m4b.buildV.has('pDM-HC-IgG1-KNOB') && m4b.buildV.has('pDM-HC-IgG1-WT') && m4b.buildV.has('pDM-LC-kappa-WT'),
);

const m5 = resolve(seed, selWith((s) => { s.fmt['F-001'] = 'in'; }));
check(
  'cascade narrows downstream',
  m5.reachC.size === 3 && m5.reachV.size === 3,
  `${m5.reachC.size} of ${seed.chains.length} chains, ${m5.reachV.size} of ${seed.vectors.length} vectors`,
);

const m6 = resolve(seed, selWith((s) => { s.fmt['F-017'] = 'in'; }));
check('four-plasmid format pulls four plasmids', m6.buildV.size === 4, String(m6.buildV.size));

const formatChains = new Set(seed.formats.flatMap((f) => f.chains));
check(
  'every chain id appears in some format',
  seed.chains.every((c) => formatChains.has(c.id)),
);
const formatVecs = new Set(seed.formats.flatMap((f) => [...f.vectors, ...(f.alt ?? [])]));
check(
  'every vector id is reachable from some format',
  seed.vectors.every((v) => formatVecs.has(v.id)),
);

const s18 = slotsFor(seed, 'F-018');
check(
  'slot inversion is flagged on the CrossMab heavy vector',
  s18.some((s) => s.vec === 'pDM-HC-IgG1-HOLE-VHcross' && s.t === 'VL' && /supply the VL/i.test(s.note)),
);
check(
  'slot inversion is flagged on the CrossMab light vector',
  s18.some((s) => s.vec === 'pDM-LC-VHcross' && s.t === 'VH' && /supply the VH/i.test(s.note)),
);

const s35 = slotsFor(seed, 'F-035');
check('trispecific expands to six slots', s35.length === 6, String(s35.length));
check(
  'three of those slots sit on HC-B',
  s35.filter((s) => s.product === 'HC-B').length === 3,
  s35.map((s) => `${s.label}:${s.product}`).join(', '),
);

const lalapg = mutations.find((m) => m.name === 'LALA-PG');
const knobSet = mutations.find((m) => m.name === 'Knob');
const holeSet = mutations.find((m) => m.name === 'Hole');
check('mutation reference loaded 31 sets', mutations.length === 31, String(mutations.length));
check('LALA-PG maps onto its IgG1 vector', !!lalapg && specificVectorIds(lalapg, seed).includes('pDM-HC-IgG1-LALAPG'));

const silenced = modelOf((s) => {
  s.fmt['F-002'] = 'in';
});
check(
  'silenced IgG1 claims LALA-PG and leaves Knob out of reach',
  !!lalapg && silenced.claimM.has(lalapg.id) && !!knobSet && !silenced.reachM.has(knobSet.id),
);

const kih = modelOf((s) => {
  s.fmt['F-016'] = 'in';
});
check(
  'KiH format puts Knob and Hole in the build',
  !!knobSet && !!holeSet && kih.buildM.has(knobSet.id) && kih.buildM.has(holeSet.id),
);

const picked = modelOf((s) => {
  s.fmt['F-001'] = 'in';
  if (lalapg) s.mut[lalapg.id] = 'in';
});
check(
  'including LALA-PG on a WT format does not force an unavailable plasmid',
  picked.buildV.has('pDM-HC-IgG1-WT') && !picked.buildV.has('pDM-HC-IgG1-LALAPG'),
);

check('kappa WT is on the shelf', stockStatus(inventory.constructs['pDM-LC-kappa-WT']) === 'In stock');
check('hole plasmid is used up', stockStatus(inventory.constructs['pDM-HC-IgG1-HOLE']) === 'Used up');
check(
  'used-up stock line tells you to make more',
  stockLine(inventory.constructs['pDM-HC-IgG1-HOLE']) === 'Used up — make more',
);
check(
  'in-stock location names the box',
  locationLine(inventory.constructs['pDM-LC-kappa-WT']) === 'Freezer B / rack 4 / box 12 / D6',
);
check('untracked chain is not made yet', stockStatus(inventory.chains['CH-15']) === 'Not made');

const paired = filterCatalog(catalog, 'TfR1', 'paired');
const unpaired = filterCatalog(catalog, '', 'unpaired');
check(
  'paired TfR1 search returns VH and VL together',
  paired.some((v) => v.name === 'aTfR1-01-VH') && paired.some((v) => v.name === 'aTfR1-01-VL'),
);
check('unpaired filter keeps VHH and drops paired VH', unpaired.some((v) => v.t === 'VHH') && unpaired.every((v) => v.pairing === 'unpaired'));
check(
  'adding a pair is idempotent',
  addToLibrary(addToLibrary('', ['aTfR1-01-VH', 'aTfR1-01-VL']), ['aTfR1-01-VH']) === 'aTfR1-01-VH\naTfR1-01-VL\n',
);
check(
  'unticking a clone drops it from the library',
  removeFromLibrary('aTfR1-01-VH\naTfR1-01-VL\n', ['aTfR1-01-VH']) === 'aTfR1-01-VL, VL\n',
);
check(
  'catalog search text does not carry a library source tag',
  catalog.every((v) => !vregionText(v).includes('Geneious')),
);
check('every V region has a project and a date', catalog.every((v) => !!v.project && /^\d{4}-\d{2}-\d{2}$/.test(v.date)));
check('every panel has a project and a date', panels.every((p) => !!p.project && /^\d{4}-\d{2}-\d{2}$/.test(p.date)));

const byId = searchCatalog(catalog, compileSearch('id:VR-001', [], 'all'));
check(
  'id search keeps the paired partner with the hit',
  byId.some((v) => v.name === 'aTfR1-01-VH') && byId.some((v) => v.name === 'aTfR1-01-VL') && byId.length === 2,
);
check(
  'target field search finds CD3ε',
  searchCatalog(catalog, compileSearch('target:CD3', [], 'all')).some((v) => v.target === 'CD3ε'),
);
check(
  'project field search finds the TCE CD3 set',
  searchCatalog(catalog, compileSearch('project:TCE', [], 'all')).every((v) => v.project === 'TCE CD3') &&
    searchCatalog(catalog, compileSearch('project:TCE', [], 'all')).length === 61,
);
const after = searchCatalog(catalog, compileSearch('date:>=2025-03-01', [], 'all'));
check(
  'date after March 2025 is the later CD20 set',
  after.length > 0 && after.every((v) => v.date >= '2025-03-01' && v.project === 'CD20 campaign'),
);
const anyQ = compileSearch('', [
  { id: 'a', field: 'target', op: 'contains', value: 'HER2' },
  { id: 'b', field: 'project', op: 'contains', value: 'TfR1' },
], 'any');
check(
  'match-any combines target HER2 or project TfR1',
  searchCatalog(catalog, anyQ).some((v) => v.target === 'HER2') &&
    searchCatalog(catalog, anyQ).some((v) => v.project === 'TfR1 campaign'),
);
check(
  'panel search by id and project',
  panelMatches(panels[0]!, compileSearch('id:PN-BG-CD3', [], 'all')) &&
    panelMatches(panels.find((p) => p.id === 'PN-LU-TFR1')!, compileSearch('project:TfR1', [], 'all')),
);
const tree = treeCatalog(catalog);
check(
  'tree splits paired and unpaired and groups by target',
  tree[0]?.pairing === 'paired' &&
    tree[1]?.pairing === 'unpaired' &&
    (tree[0]?.targets[0]?.groups.length ?? 0) >= 10 &&
    tree[1]?.targets.some((t) => t.groups.some((g) => g.items[0]?.t === 'VHH')),
);

const cd3cd20 = applyPanels(catalog, panels, ['PN-BG-CD3', 'PN-LU-CD20'], []);
check('30 CD3 × 10 CD20 is 300 builds', permuteCount([30, 10]) === 300);
check(
  'ticking the Luma CD3 and CD20 panels enumerates every pair',
  variantList(cd3cd20.variants).length === 300 &&
    cd3cd20.variants.includes('aCD3-01 × aCD20-01') &&
    cd3cd20.variants.includes('aCD3-30 × aCD20-10'),
);
check(
  'panel apply loads both arms into the library',
  cd3cd20.library.includes('aCD3-01-VH') && cd3cd20.library.includes('aCD20-10-VL'),
);

const mabSlots = slotsFor(seed, 'F-001');
const mabVh = mabSlots.find((s) => s.t === 'VH');
const mabVl = mabSlots.find((s) => s.t === 'VL');
const pd1Pair = catalog.filter((v) => v.clone === 'aPD1-01');
const pd1On = applyClones(pd1Pair, mabSlots, '', '', {}, true);
check(
  'ticking paired PD-1 on a mAb names the build',
  pd1On.variants.includes('aPD1-01') && pd1On.library.includes('aPD1-01-VH') && pd1On.library.includes('aPD1-01-VL'),
);
check(
  'that PD-1 pair fills the mAb VH and VL slots',
  !!mabVh &&
    !!mabVl &&
    pd1On.assign['aPD1-01']?.[mabVh.key] === 'aPD1-01-VH' &&
    pd1On.assign['aPD1-01']?.[mabVl.key] === 'aPD1-01-VL',
  JSON.stringify(pd1On.assign['aPD1-01']),
);
const pd1Inserts = insertsByVector(mabSlots, pd1On.variants, pd1On.assign);
check(
  'those PD-1 names land on the mAb plasmids',
  (pd1Inserts['pDM-HC-IgG1-WT'] ?? []).includes('aPD1-01-VH') &&
    (pd1Inserts['pDM-LC-kappa-WT'] ?? []).includes('aPD1-01-VL'),
  JSON.stringify(pd1Inserts),
);
const pd1Off = applyClones(pd1Pair, mabSlots, pd1On.library, pd1On.variants, pd1On.assign, false);
check(
  'unticking PD-1 drops it from the build',
  !pd1Off.library.includes('aPD1-01') && pd1Off.variants === '' && !pd1Off.assign['aPD1-01'],
);
const pd1Panel = applyPanels(catalog, panels, ['PN-LU-PD1'], mabSlots);
check(
  'the PD-1 Luma panel assigns the pair onto a mAb',
  variantList(pd1Panel.variants).join() === 'aPD1-01' &&
    !!mabVh &&
    !!mabVl &&
    pd1Panel.assign['aPD1-01']?.[mabVh.key] === 'aPD1-01-VH' &&
    pd1Panel.assign['aPD1-01']?.[mabVl.key] === 'aPD1-01-VL',
);

const open = resolve(seed, emptySel());
check(
  'with nothing picked every mutation is available',
  mutations.every((m) => mutationRelevant(m, seed, open)),
);

const msabIds = new Set(seed.formats.filter((f) => f.cls === 'MsAb' || f.cls === 'ADC / MsAb').map((f) => f.id));
const msab = resolve(seed, emptySel(), { formats: msabIds });
check(
  'MsAb focus does not offer a conventional heavy as a pick',
  !msab.reachC.has('CH-01'),
);
check(
  'MsAb focus keeps knob, hole, and common light chain in play',
  msab.reachC.has('CH-02') && msab.reachC.has('CH-03') && msab.reachC.has('CH-20'),
);
const kihClc = resolve(seed, selWith((s) => { s.fmt['F-016'] = 'in'; }));
check(
  'KiH common-LC format claims knob and hole, not a stray mAb heavy',
  kihClc.buildC.has('CH-02') && kihClc.buildC.has('CH-03') && !kihClc.reachC.has('CH-01'),
);

const twoPlasmidKih = matchingIds(
  seed.formats,
  {
    cls: new Set(['MsAb']),
    spec: new Set(['Bispecific']),
    kih: new Set(['Present']),
    fc: new Set(['Yes']),
    plasmids: new Set(['2']),
  },
  '',
  (f) => f.id,
);
check(
  'MsAb KiH Fc two-plasmid focus includes scFv-Fc plus Fab, VHH, Cross Fab, mutein, and de novo',
  ['F-036', 'F-047', 'F-048', 'F-049', 'F-050', 'F-051'].every((id) => twoPlasmidKih.has(id)) &&
    twoPlasmidKih.size === 6,
  [...twoPlasmidKih].sort().join(','),
);
const two = resolve(seed, emptySel(), { formats: twoPlasmidKih });
const twoChainIds = ['CH-31', 'CH-32', 'CH-33', 'CH-34', 'CH-35', 'CH-36', 'CH-37', 'CH-38', 'CH-39', 'CH-40', 'CH-41', 'CH-42'];
check(
  'that focus offers scFv-Fc, Fab, VHH, Cross Fab, mutein, and de novo chain picks',
  twoChainIds.every((id) => two.reachC.has(id)) && two.reachC.size === 12,
  [...two.reachC].sort().join(','),
);
const twoFams = new Set(seed.chains.filter((c) => two.reachC.has(c.id)).map((c) => c.fam));
check(
  'those chains are labeled as the requested building blocks',
  twoFams.has('Fab') &&
    twoFams.has('VHH') &&
    twoFams.has('Cross Fab') &&
    twoFams.has('Mutein') &&
    twoFams.has('De novo') &&
    seed.chains.some((c) => two.reachC.has(c.id) && c.name.includes('scFv-Fc')),
);
check(
  'that focus offers both scFv-Fc plasmids',
  two.reachV.has('pDM-scFvFc-IgG1-KNOB-LALAPG') && two.reachV.has('pDM-scFvFc-IgG1-HOLE-LALAPG'),
);
const scfvFc = resolve(seed, selWith((s) => { s.fmt['F-036'] = 'in'; }));
check(
  'including the two-plasmid KiH scFv-Fc claims both arms and both plasmids',
  scfvFc.buildC.has('CH-31') && scfvFc.buildC.has('CH-32') && scfvFc.buildV.size === 2,
);
check('that format has V slots to assign', slotsFor(seed, 'F-036').length === 4, String(slotsFor(seed, 'F-036').length));
for (const [fid, c1, c2, nSlots] of [
  ['F-047', 'CH-33', 'CH-34', 4],
  ['F-048', 'CH-35', 'CH-36', 2],
  ['F-049', 'CH-37', 'CH-38', 4],
  ['F-050', 'CH-39', 'CH-40', 2],
  ['F-051', 'CH-41', 'CH-42', 2],
] as const) {
  const m = resolve(seed, selWith((s) => { s.fmt[fid] = 'in'; }));
  check(
    `including ${fid} claims both building-block arms`,
    m.buildC.has(c1) && m.buildC.has(c2) && m.buildV.size === 2 && slotsFor(seed, fid).length === nSlots,
    `chains ${[...m.buildC].join(',')} plasmids ${m.buildV.size} slots ${slotsFor(seed, fid).length}`,
  );
}

const dart = resolve(seed, selWith((s) => { s.fmt['F-033'] = 'in'; }));
check(
  'DART demo claims both chains and both plasmids',
  dart.buildC.has('CH-29') && dart.buildC.has('CH-30') && dart.buildV.has('pDM-DART-A') && dart.buildV.has('pDM-DART-B'),
);

for (const cls of [...new Set(seed.formats.map((f) => f.cls))].sort()) {
  const f = seed.formats.find((x) => x.cls === cls);
  if (!f) continue;
  const m = resolve(seed, selWith((s) => { s.fmt[f.id] = 'in'; }));
  const nSlots = slotsFor(seed, f.id).length;
  check(
    `${cls} demo (${f.id}) walks chains, plasmids, and V slots`,
    m.buildC.size > 0 && m.buildV.size > 0 && nSlots > 0,
    `chains ${[...m.buildC].join(',')} plasmids ${m.buildV.size} slots ${nSlots}`,
  );
}

check(
  'numbering facet exposes IMGT as its own token',
  mutations.some((m) => facetTokens(m.numbering).includes('IMGT')) &&
    mutations.some((m) => m.numbering === 'Kabat / IMGT'),
);
check(
  'an IMGT numbering filter matches Kabat / IMGT rows',
  rowHasFacet({ numbering: 'Kabat / IMGT' }, 'numbering', new Set(['IMGT'])),
);
check(
  'n/a numbering stays one token',
  facetTokens('n/a').join() === 'n/a' && !facetTokens('n/a').includes('n'),
);
check(
  'slash-space numbering splits IMGT without breaking n/a',
  facetTokens('Kabat / IMGT').join() === 'Kabat,IMGT',
);

console.log('\nAll selection checks passed.');
