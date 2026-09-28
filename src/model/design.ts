import type { Chain, FcKind, Format, LightMode, PadDesign, Seed } from './types';
import type { BbKind } from './types';

export const EMPTY_DESIGN: PadDesign = {
  left: 'empty',
  right: 'empty',
  fc: 'none',
  light: 'unset',
  fusedLeft: [],
  fusedRight: [],
  cLeft: [],
  cRight: [],
  cTargetLeft: [],
  cTargetRight: [],
  targets: ['Antigen A', 'Antigen B'],
};

/** Older saved designs predate C-terminal joins. Fill those lists in. */
export function completeDesign(design: PadDesign): PadDesign {
  const cLeft = design.cLeft ?? [];
  const cRight = design.cRight ?? [];
  const cTargetLeft = design.cTargetLeft ?? [];
  const cTargetRight = design.cTargetRight ?? [];
  return {
    ...design,
    fusedLeft: design.fusedLeft ?? [],
    fusedRight: design.fusedRight ?? [],
    cLeft,
    cRight,
    cTargetLeft: cLeft.map((_, i) => cTargetLeft[i] || 'Antigen'),
    cTargetRight: cRight.map((_, i) => cTargetRight[i] || 'Antigen'),
    targets: design.targets ?? ['Antigen A', 'Antigen B'],
  };
}

export type CSide = 'left' | 'right';

/** Hang a block off one Fc chain, or off both. */
export function joinCTerm(design: PadDesign, sides: CSide[], kind: BbKind, target = 'Antigen'): PadDesign {
  let next = completeDesign(design);
  for (const side of sides) {
    if (side === 'left') next = { ...next, cLeft: [...next.cLeft, kind], cTargetLeft: [...next.cTargetLeft, target] };
    else next = { ...next, cRight: [...next.cRight, kind], cTargetRight: [...next.cTargetRight, target] };
  }
  return next;
}

export function replaceCTerm(design: PadDesign, side: CSide, index: number, kind: BbKind): PadDesign {
  const next = completeDesign(design);
  const blocks = side === 'left' ? [...next.cLeft] : [...next.cRight];
  if (!blocks[index]) return next;
  blocks[index] = kind;
  return side === 'left' ? { ...next, cLeft: blocks } : { ...next, cRight: blocks };
}

export function removeCTerm(design: PadDesign, side: CSide, index: number): PadDesign {
  const next = completeDesign(design);
  const blocks = (side === 'left' ? next.cLeft : next.cRight).filter((_, i) => i !== index);
  const targets = (side === 'left' ? next.cTargetLeft : next.cTargetRight).filter((_, i) => i !== index);
  return side === 'left' ? { ...next, cLeft: blocks, cTargetLeft: targets } : { ...next, cRight: blocks, cTargetRight: targets };
}

export function setBlockTarget(
  design: PadDesign,
  slot: 'left' | 'right' | 'cLeft' | 'cRight',
  index: number,
  value: string,
): PadDesign {
  const next = completeDesign(design);
  if (slot === 'left') return { ...next, targets: [value, next.targets[1]] };
  if (slot === 'right') return { ...next, targets: [next.targets[0], value] };
  const key = slot === 'cLeft' ? 'cTargetLeft' : 'cTargetRight';
  const list = next[key].slice();
  list[index] = value;
  return { ...next, [key]: list };
}

function norm(kind: BbKind): string {
  if (kind === 'reagent') return 'mutein';
  if (kind === 'miniprotein') return 'denovo';
  return kind;
}

function armKey(design: PadDesign): string {
  return [norm(design.left), norm(design.right)].sort().join('|');
}

/** Glyph a registered format should draw, so the pad and the catalog agree. */
export function designForFormat(format: Format, chains: Chain[]): PadDesign {
  const mine = format.chains
    .map((id) => chains.find((c) => c.id === id))
    .filter((c): c is Chain => !!c);
  const fams = new Set(mine.map((c) => c.fam));
  const lights = mine.filter((c) => c.fam === 'Light');
  const heavies = mine.filter((c) => c.fam === 'Heavy');
  const oneArmed = heavies.length === 1 && fams.has('Fc only');
  let bb: BbKind = 'fab';
  if (fams.has('VHH') || /vhh/i.test(format.name)) bb = 'vhh';
  else if (fams.has('Mutein')) bb = 'mutein';
  else if (fams.has('De novo')) bb = 'denovo';
  else if (fams.has('Cross Fab')) bb = 'xfab';
  else if (fams.has('Fab')) bb = 'scfab';
  else if (fams.has('Single chain') || fams.has('Single-chain Fc')) bb = 'scfv';
  else if (fams.has('Fc only') && heavies.length === 0) bb = 'mutein';
  const hetero = format.kih === 'Present' || heavies.length > 1 || oneArmed;
  const fc: FcKind = format.fc === 'No' ? 'none' : hetero ? 'heterofc' : 'homofc';
  const light: LightMode =
    bb === 'fab' || bb === 'xfab'
      ? lights.length > 1
        ? 'per-arm'
        : lights.length === 1
          ? 'common'
          : 'unset'
      : 'unset';
  const targets: [string, string] =
    format.spec === 'Monospecific' ? ['Antigen', 'Antigen'] : ['Antigen A', 'Antigen B'];
  return {
    left: bb,
    right: oneArmed ? 'empty' : bb,
    fc,
    light,
    fusedLeft: [],
    fusedRight: [],
    cLeft: /c-term/i.test(format.name) ? ['scfv'] : [],
    cRight: /c-term/i.test(format.name) ? ['scfv'] : [],
    cTargetLeft: /c-term/i.test(format.name) ? ['Antigen C'] : [],
    cTargetRight: /c-term/i.test(format.name) ? ['Antigen C'] : [],
    targets,
  };
}

/**
 * The pad resolves to a catalog format. Ties keep the lowest-rank format, so a
 * plain Fab / Homo-Fc design lands on wild-type IgG rather than an ADC.
 */
export function matchFormat(seed: Seed, design: PadDesign): Format | null {
  const placed = design.left !== 'empty' || design.right !== 'empty' || design.fc !== 'none';
  if (!placed) return null;
  const want = armKey(design);
  let best: Format | null = null;
  let bestScore = -1;
  for (const format of seed.formats) {
    const glyph = designForFormat(format, seed.chains);
    let score = 0;
    if (armKey(glyph) === want) score += 5;
    if (glyph.fc === design.fc) score += 3;
    if (score > bestScore || (score === bestScore && best && format.rank < best.rank)) {
      bestScore = score;
      best = format;
    }
  }
  return bestScore >= 5 ? best : null;
}

/** Archetype chain ids the design actually uses. A common light chain keeps one. */
export function chainsForDesign(seed: Seed, format: Format, design: PadDesign): string[] {
  const ids = [...format.chains];
  if (design.light !== 'common') return ids;
  const lights = ids.filter((id) => seed.chains.find((c) => c.id === id)?.fam === 'Light');
  if (lights.length < 2) return ids;
  const keep = lights.includes('CH-18') ? 'CH-18' : lights.includes('CH-20') ? 'CH-20' : lights[0];
  return ids.filter((id) => seed.chains.find((c) => c.id === id)?.fam !== 'Light' || id === keep);
}

export function designPlaced(design: PadDesign): boolean {
  return design.left !== 'empty' || design.right !== 'empty';
}
