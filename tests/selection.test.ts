import seedJson from '../src/data/seed.json';
import { emptySel, resolve, sortedIds } from '../src/model/selection';
import { slotsFor } from '../src/model/slots';
import type { Seed, Sel } from '../src/model/types';

const seed = seedJson as unknown as Seed;

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

console.log('\nAll selection checks passed.');
