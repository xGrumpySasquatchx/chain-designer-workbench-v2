import type {
  CodonMethod,
  ExpressionMode,
  ExpressionPlan,
  ExpressionRegistration,
  HostId,
  TargetClass,
} from './types';

export type FitRate = 'good' | 'moderate' | 'poor';

export interface CodonTable {
  id: string;
  name: string;
}

export interface HostSystem {
  id: HostId;
  name: string;
  detail: string;
  promoter: string;
  start: string;
  termination: string;
  secretion: string;
  selection: string;
  soluble: { rate: FitRate; note: string };
  membrane: { rate: FitRate; note: string };
  scale: string;
  scaleRate?: FitRate;
  best: string;
  tables: CodonTable[];
}

export const EMPTY_EXPRESSION: ExpressionPlan = {
  targetClass: null,
  host: null,
  codonTable: null,
  codon: null,
  mode: null,
};

export interface ProductionScenario {
  id: ExpressionMode;
  name: string;
  posture: string;
  mechanism: string;
  iteration: string;
  volume: string;
  output: string;
  selection: string;
  best: string;
}

export const SCENARIOS: ProductionScenario[] = [
  {
    id: 'transient',
    name: 'Transient',
    posture: 'Many constructs, small to moderate scale, fast turnaround.',
    mechanism:
      'Plasmid DNA or mRNA is introduced into HEK293 or CHO with PEI, a lipid reagent, or electroporation. The DNA stays episomal and is diluted or degraded as cells divide, so expression peaks around days 3 to 10 and then declines.',
    iteration:
      'About 1 to 3 weeks from plasmid to purified protein, and highly parallel. Discovery groups run hundreds to thousands of constructs per campaign in 96-well deep-well blocks or 24-well plates, and can redesign and rerun within the same month. A sequence change is a new plasmid.',
    volume:
      'About 1 mL in a screening well, up to 1 to 10 L for a larger batch, and occasionally 100 L or more in a wave or stirred-tank system.',
    output: 'Titers of 0.1 to 3 g/L. A well yields micrograms; a larger batch yields grams.',
    selection: 'None. The DNA is not maintained, so every batch is a new transfection.',
    best: 'Candidate selection, bispecific chain pairings and ratios, and early characterization.',
  },
  {
    id: 'stable',
    name: 'Stable',
    posture: 'Few constructs, large scale, slow turnaround.',
    mechanism:
      'The gene cassette integrates into the host chromosome, so every daughter cell carries it. Cells are selected, pools are expanded, and clones are screened for titer, growth, product quality, and long-term stability. Integration is random, or targeted to a landing pad with Cre/lox, Flp/FRT, Bxb1, or CRISPR.',
    iteration:
      '3 to 6 months per construct with random integration, or about 6 to 10 weeks with a targeted landing pad. Programs usually take 1 to 3 leads into stable development, sometimes up to about 5 on a landing-pad platform. A sequence change after that point restarts the line.',
    volume: 'Shake flasks through 2,000 to 20,000 L stirred-tank bioreactors.',
    output: 'Titers of 3 to 10 g/L in fed-batch CHO. A single batch can yield tens of kilograms.',
    selection: 'Glutamine synthetase or DHFR with MSX or methotrexate, or an antibiotic marker.',
    best: 'Clinical and commercial supply, where a clonal line and documented genetic stability are expected.',
  },
];

export const STABLE_POOL =
  'A stable pool is selected but not cloned. It yields more material than a transient run within a few weeks, typically 10 to 200 L at 1 to 5 g/L, and is often used for preclinical or toxicology material while clonal lines are still in development. The pool is heterogeneous and can drift over passages.';

export const SCENARIO_HANDOFF =
  'Transient work is wide and shallow: many sequences, a small amount of each, and rapid redesign. Stable work is narrow and deep: a handful of sequences, very large amounts, and a costly change. The handoff is where iteration freezes, so chain format, pairing, and liability removal carry into a less flexible process. Glycosylation, charge variants, and bispecific mispairing can also shift between transient HEK material and stable CHO material, so developability data should be checked again at that point.';

export function scenarioById(id: ExpressionMode): ProductionScenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0];
}

export const TARGET_CLASSES: { id: TargetClass; label: string }[] = [
  { id: 'secreted', label: 'Soluble, secreted' },
  { id: 'intracellular', label: 'Soluble, intracellular' },
  { id: 'membrane', label: 'Membrane' },
];

export const CODON_METHODS: { id: CodonMethod; label: string; note: string }[] = [
  {
    id: 'adapt',
    label: 'Host codon adaptation',
    note: 'Recode each insert toward the codons this host uses most often.',
  },
  {
    id: 'harmonize',
    label: 'Codon harmonization',
    note: 'Keep the source organism’s rare-codon rhythm, mapped onto this host.',
  },
  {
    id: 'rare',
    label: 'Rare-codon replacement',
    note: 'Change only codons that are rare in this host. Leave the rest of the insert as it is.',
  },
  {
    id: 'keep',
    label: 'Keep the current coding sequence',
    note: 'Leave each insert’s coding sequence as written. The host still sets the vector elements around it.',
  },
];

export const HOSTS: HostSystem[] = [
  {
    id: 'ecoli',
    name: 'E. coli',
    detail: 'prokaryotic',
    promoter: 'T7 / lac',
    start: 'Ribosome binding site',
    termination: 'Transcription terminator',
    secretion: 'pelB / OmpA (periplasm)',
    selection: 'Antibiotic (Amp / Kan)',
    soluble: { rate: 'good', note: 'Inclusion bodies for hard targets' },
    membrane: { rate: 'poor', note: 'Toxicity, low yield' },
    scale: 'High yield, low cost',
    best: 'Simple soluble proteins',
    tables: [{ id: 'ecoli-k12', name: 'Escherichia coli K-12' }],
  },
  {
    id: 'yeast',
    name: 'Yeast',
    detail: 'Pichia / S. cerevisiae',
    promoter: 'AOX1 / GAP',
    start: 'Kozak',
    termination: 'Terminator / polyA',
    secretion: 'α-factor',
    selection: 'Auxotrophy / Zeocin',
    soluble: { rate: 'good', note: 'Secreted' },
    membrane: { rate: 'moderate', note: 'Usable, lower yield than insect or mammalian' },
    scale: 'High (fermentation)',
    best: 'Secreted proteins, basic glycosylation',
    tables: [
      { id: 'pichia', name: 'Komagataella phaffii (Pichia)' },
      { id: 'scerevisiae', name: 'Saccharomyces cerevisiae' },
    ],
  },
  {
    id: 'insect',
    name: 'Insect',
    detail: 'baculovirus, Sf9',
    promoter: 'Polyhedrin / p10',
    start: 'Kozak',
    termination: 'PolyA',
    secretion: 'gp67 / melittin',
    selection: 'Bacmid / transfer vector',
    soluble: { rate: 'good', note: 'Complex eukaryotic proteins' },
    membrane: { rate: 'good', note: 'GPCRs, complexes' },
    scale: 'Moderate to high',
    best: 'Complex eukaryotic proteins and membrane proteins',
    tables: [{ id: 'sf9', name: 'Spodoptera frugiperda (Sf9)' }],
  },
  {
    id: 'mammalian',
    name: 'Mammalian',
    detail: 'CHO / HEK293',
    promoter: 'CMV / EF-1α',
    start: 'Kozak',
    termination: 'PolyA (BGH / SV40)',
    secretion: 'Native / Ig signal',
    selection: 'G418 / puro / GS / DHFR',
    soluble: { rate: 'good', note: 'Native-like folding' },
    membrane: { rate: 'good', note: 'Native-like' },
    scale: 'Moderate, higher cost',
    best: 'Therapeutics, human glycosylation',
    tables: [
      { id: 'human', name: 'Homo sapiens (HEK293 / human codon table)' },
      { id: 'cho', name: 'Cricetulus griseus (CHO)' },
    ],
  },
  {
    id: 'cellfree',
    name: 'Cell-free',
    detail: 'lysate-based IVT',
    promoter: 'T7 (lysate-set)',
    start: 'RBS or Kozak (lysate-set)',
    termination: 'T7 terminator / linear',
    secretion: 'N/A (add nanodiscs)',
    selection: 'None (linear or plasmid)',
    soluble: { rate: 'good', note: 'Fast' },
    membrane: { rate: 'good', note: 'With nanodiscs / liposomes' },
    scale: 'Screening only',
    scaleRate: 'poor',
    best: 'Rapid screening, toxic proteins, membrane proteins',
    tables: [
      { id: 'cf-ecoli', name: 'E. coli lysate' },
      { id: 'cf-wheat', name: 'Wheat-germ lysate' },
      { id: 'cf-insect', name: 'Insect lysate' },
      { id: 'cf-mamm', name: 'Mammalian lysate' },
    ],
  },
];

export function hostById(id: HostId): HostSystem {
  return HOSTS.find((host) => host.id === id) ?? HOSTS[0];
}

export function codonTableName(host: HostId, tableId: string | null): string {
  const tables = hostById(host).tables;
  return tables.find((table) => table.id === tableId)?.name ?? tables[0].name;
}

export function targetFit(host: HostSystem, target: TargetClass | null): { rate: FitRate; note: string } | null {
  if (!target) return null;
  if (target === 'membrane') return host.membrane;
  return host.soluble;
}

export function planReady(plan: ExpressionPlan): boolean {
  return Boolean(plan.targetClass && plan.host && plan.codonTable && plan.codon && plan.mode);
}

export function withHost(plan: ExpressionPlan, host: HostId): ExpressionPlan {
  const tables = hostById(host).tables;
  const codonTable = tables.some((table) => table.id === plan.codonTable) ? plan.codonTable : tables[0].id;
  return { ...plan, host, codonTable };
}

export function registrationMatches(
  record: ExpressionRegistration,
  plan: ExpressionPlan,
  vectorIds: string[],
): boolean {
  if (!planReady(plan)) return false;
  const sameVectors =
    record.vectorIds.length === vectorIds.length && record.vectorIds.every((id, i) => id === vectorIds[i]);
  return (
    sameVectors &&
    record.targetClass === plan.targetClass &&
    record.host === plan.host &&
    record.codonTable === plan.codonTable &&
    record.codon === plan.codon &&
    record.mode === plan.mode
  );
}

export function registerExpression(
  existing: ExpressionRegistration[],
  plan: ExpressionPlan,
  vectorIds: string[],
  inserts: string[],
): ExpressionRegistration | null {
  if (!planReady(plan) || !plan.targetClass || !plan.host || !plan.codonTable || !plan.codon || !plan.mode) return null;
  if (!vectorIds.length) return null;
  const sorted = [...vectorIds].sort();
  if (existing.some((record) => registrationMatches(record, plan, sorted))) return null;
  const n = existing.reduce((max, record) => {
    const match = /^EXP-(\d+)$/.exec(record.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return {
    id: `EXP-${String(n + 1).padStart(3, '0')}`,
    targetClass: plan.targetClass,
    host: plan.host,
    codonTable: plan.codonTable,
    codon: plan.codon,
    mode: plan.mode,
    vectorIds: sorted,
    inserts,
    registeredAt: new Date().toISOString().slice(0, 10),
  };
}
