import inventoryJson from '../src/data/inventory.json';
import mutationsJson from '../src/data/mutations.json';
import seedJson from '../src/data/seed.json';
import vregionsJson from '../src/data/vregions.json';
import panelsJson from '../src/data/panels.json';
import { addToLibrary, applyPanels, filterCatalog, permuteCount, removeFromLibrary, variantList, vregionText } from '../src/model/library';
import { locationLine, stockLine, stockStatus } from '../src/model/inventory';
import { applyMutations, mutationRelevant, specificVectorIds } from '../src/model/mutations';
import { emptySel, resolve, sortedIds } from '../src/model/selection';
import { slotsFor } from '../src/model/slots';
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

console.log('\nAll selection checks passed.');
