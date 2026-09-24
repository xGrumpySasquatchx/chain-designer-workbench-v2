export type Tier = 1 | 2 | 3 | 4 | 5 | 6;
export type Grain = 'fmt' | 'chn' | 'var' | 'con';
export type Mark = 'in' | 'out';

export interface Format {
  id: string;
  name: string;
  cls: string;
  target: string;
  spec: 'Monospecific' | 'Bispecific' | 'Trispecific';
  val: string;
  half: number;
  full: number;
  trans: number;
  cis: number;
  lcreq: string;
  lcid: string;
  hcreq: string;
  hcid: string;
  mutreq: 'Yes' | 'No';
  mutset: string;
  kih: 'Present' | 'Absent';
  kihass: string;
  chg: 'Present' | 'Absent' | 'Optional';
  chgdet: string;
  k447: string;
  vectors: string[];
  alt: string[];
  chains: string[];
  plasmids: number;
  ratio: string;
  mispair: string;
  capture: string;
  polish: string;
  notes: string;
  fc: 'Yes' | 'No';
  conj: 'Yes' | 'No';
  score: number;
  tierN: Tier;
  tier: string;
  rank: number;
  drivers: string;
}

export interface Chain {
  id: string;
  name: string;
  fam: 'Heavy' | 'Light' | 'Single chain' | 'Single-chain Fc' | 'Fc only';
  half: string;
  cis: string;
  fvmode: string;
  partner: string;
  slots: string;
  module: string;
  crossover: string;
  vectors: string[];
  formats: string[];
  note: string;
  rank: number;
}

export interface VSlot {
  t: 'VH' | 'VL' | 'VHH' | 'ORF';
  pos: string;
  note: string;
}

export interface Vector {
  id: string;
  role: string;
  fam: 'Heavy' | 'Light' | 'Single chain' | 'Fc only';
  insert: string;
  module: string;
  eng: string;
  cat: string;
  numbering: string;
  sp: string;
  method: string;
  o5: string;
  o3: string;
  promoter: string;
  sel: string;
  prota: string;
  protaFull: string;
  iso: string;
  needsInsert: 'Yes' | 'No';
  slots: VSlot[];
  usedby: string[];
  note: string;
  rank: number;
}

export interface Seed {
  formats: Format[];
  chains: Chain[];
  vectors: Vector[];
  partners: [string, string][];
  tiers: Record<string, string>;
}

export type Marks = Record<string, Mark>;

export interface Sel {
  fmt: Marks;
  chn: Marks;
  con: Marks;
}

export interface Preset {
  name: string;
  n: number;
  sel: Sel;
}

export interface State {
  sel: Sel;
  variants: string;
  library: string;
  assign: Record<string, Record<string, string>>;
  presets: Preset[];
  grain: Grain;
  hideOut: boolean;
}

export interface Model {
  inF: Set<string>;
  outF: Set<string>;
  inC: Set<string>;
  outC: Set<string>;
  inV: Set<string>;
  outV: Set<string>;
  reachF: Set<string>;
  reachC: Set<string>;
  reachV: Set<string>;
  claimC: Set<string>;
  claimV: Set<string>;
  buildC: Set<string>;
  buildV: Set<string>;
  blocked: Set<string>;
  conflicts: string[];
}

export interface BuildSlot {
  key: string;
  vec: string;
  i: number;
  t: VSlot['t'];
  pos: string;
  note: string;
  arm: string;
  prod: string;
  product: string;
  label: string;
}

export interface GaalInsert {
  slot: string;
  domain: string;
  part: string;
}

export interface GaalJob {
  job: 'golden_gate_assembly';
  library: 'GaaL';
  backbone: string;
  enzyme: string;
  overhang5: string;
  overhang3: string;
  selection: string;
  inserts: GaalInsert[];
  product: string;
  annotate: string[];
}
