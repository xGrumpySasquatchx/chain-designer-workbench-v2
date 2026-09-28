import type { BbKind } from './types';

export interface BbDef {
  kind: BbKind;
  label: string;
  arm: boolean;
  needsLightChain: boolean;
  fusesOnly: boolean;
  scaffold?: boolean;
  description: string;
}

export const BB_LIBRARY: BbDef[] = [
  {
    kind: 'fab',
    label: 'Fab',
    arm: true,
    needsLightChain: true,
    fusesOnly: false,
    description: 'VH–CH1 paired with a separate VL–CL light chain',
  },
  {
    kind: 'scfab',
    label: 'scFab',
    arm: true,
    needsLightChain: false,
    fusesOnly: false,
    description: 'Single-chain Fab: VL–CL fused through a linker to VH–CH1',
  },
  {
    kind: 'xfab',
    label: 'xFab',
    arm: true,
    needsLightChain: true,
    fusesOnly: false,
    description: 'Crossover Fab: VH–CL on the heavy chain, VL–CH1 on the light',
  },
  {
    kind: 'scfv',
    label: 'scFv',
    arm: true,
    needsLightChain: false,
    fusesOnly: false,
    description: 'VH and VL on one chain, joined by a linker',
  },
  {
    kind: 'vhh',
    label: 'VHH',
    arm: true,
    needsLightChain: false,
    fusesOnly: false,
    description: 'Single variable domain, no light chain',
  },
  {
    kind: 'homofc',
    label: 'Homo-Fc',
    arm: false,
    needsLightChain: false,
    fusesOnly: false,
    scaffold: true,
    description: 'Homodimeric Fc: identical CH3 on both heavy chains',
  },
  {
    kind: 'heterofc',
    label: 'Hetero-Fc',
    arm: false,
    needsLightChain: false,
    fusesOnly: false,
    scaffold: true,
    description: 'Heterodimeric Fc: knob-into-hole CH3 pairing',
  },
  {
    kind: 'mutein',
    label: 'Mutein',
    arm: true,
    needsLightChain: false,
    fusesOnly: false,
    description: 'Engineered cytokine or ligand fused to the Fc',
  },
  {
    kind: 'miniprotein',
    label: 'Mini-protein',
    arm: true,
    needsLightChain: false,
    fusesOnly: false,
    description: 'Small scaffold binder fused to the Fc',
  },
  {
    kind: 'denovo',
    label: 'De novo',
    arm: true,
    needsLightChain: false,
    fusesOnly: false,
    description: 'Computationally designed binder',
  },
  {
    kind: 'reagent',
    label: 'Reagent',
    arm: true,
    needsLightChain: false,
    fusesOnly: false,
    description: 'Non-therapeutic partner used for assay or purification',
  },
  {
    kind: 'tag',
    label: 'Tag',
    arm: false,
    needsLightChain: false,
    fusesOnly: true,
    description: 'Purification or detection tag, fused onto a block',
  },
  {
    kind: 'empty',
    label: 'Empty',
    arm: true,
    needsLightChain: false,
    fusesOnly: false,
    description: 'No block in this arm position',
  },
];

export function bbDef(kind: BbKind): BbDef {
  return BB_LIBRARY.find((b) => b.kind === kind) ?? BB_LIBRARY[BB_LIBRARY.length - 1];
}

export function isFcScaffold(kind: BbKind): kind is 'homofc' | 'heterofc' {
  return kind === 'homofc' || kind === 'heterofc';
}

export function needsLight(kind: BbKind): boolean {
  return bbDef(kind).needsLightChain;
}
