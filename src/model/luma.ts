import { chainsForDesign, designForFormat } from './design';
import type {
  ChainUse,
  InventoryBook,
  LumaMolecule,
  LumaPanel,
  Mutation,
  RequestDoc,
  Seed,
  VPanel,
} from './types';

export interface LumaChain {
  id: string;
  archetypeId: string;
  /** Vectors that can store this chain. The construct is the record of the chain. */
  constructIds: string[];
  /** Construct to show in inventory: one already made, else the first vector. */
  constructId: string | null;
  role: ChainUse;
  moleculeIds: string[];
  panelIds: string[];
}

export interface LumaConstruct {
  id: string;
  chainIds: string[];
  moleculeIds: string[];
  mutationIds: string[];
  role: ChainUse;
}

export interface LumaBook {
  panels: LumaPanel[];
  molecules: LumaMolecule[];
  chains: LumaChain[];
  constructs: LumaConstruct[];
  requests: RequestDoc[];
}

const PANEL_TITLES: Record<string, string> = {
  'CH-27+CH-28': 'scFv',
  'CH-01+CH-18+CH-19': 'IgG mAb',
  'CH-02+CH-03+CH-18+CH-19': 'KiH IgG, common light chain',
  'CH-04+CH-18+CH-19': 'Charge-steered IgG',
  'CH-02+CH-09+CH-18+CH-19+CH-23': 'Orthogonal Fab IgG',
};

export function chainUid(archetypeId: string): string {
  return `LCH-${archetypeId}`;
}

function mutationVectors(mutation: Mutation, vectorIds: string[]): string[] {
  const direct = vectorIds.filter((id) => mutation.carried.includes(id));
  if (direct.length) return direct;
  if (/all igg1/i.test(mutation.carried)) {
    return vectorIds.filter((id) => id.includes('IgG1') && !id.includes('IgG2'));
  }
  if (/all igg4/i.test(mutation.carried)) return vectorIds.filter((id) => id.includes('IgG4'));
  if (/kih/i.test(mutation.carried)) return vectorIds.filter((id) => /KNOB|HOLE/.test(id));
  if (/scfv/i.test(mutation.carried)) return vectorIds.filter((id) => /scFv/i.test(id));
  return [];
}

function panelTitle(chainKey: string, names: string[]): string {
  return PANEL_TITLES[chainKey] ?? names[0];
}

export interface UserRegistry {
  requests: RequestDoc[];
  panels: LumaPanel[];
  molecules: LumaMolecule[];
}

/**
 * Every seed format is one molecule, grouped into a Luma panel by the chains it
 * uses. Chain UIDs are shared, so a light chain registered once is the same
 * chain on every molecule that pairs with it.
 */
export function assembleBook(
  seed: Seed,
  inventory: InventoryBook,
  mutations: Mutation[],
  libraries: VPanel[],
  user: UserRegistry,
): LumaBook {
  const vectorIds = seed.vectors.map((v) => v.id);
  const libraryIds = libraries.map((p) => p.id);
  const groups = new Map<string, typeof seed.formats>();
  for (const format of seed.formats) {
    const key = [...format.chains].sort().join('+');
    const list = groups.get(key) ?? [];
    list.push(format);
    groups.set(key, list);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    const ar = Math.min(...a[1].map((f) => f.rank));
    const br = Math.min(...b[1].map((f) => f.rank));
    return ar - br || a[0].localeCompare(b[0]);
  });

  const molecules: LumaMolecule[] = [];
  const panels: LumaPanel[] = [];
  ordered.forEach(([key, formats], index) => {
    const panelId = `PN-${String(index + 1).padStart(3, '0')}`;
    const requestId = `REQ-${String(index + 1).padStart(3, '0')}`;
    const formatIds = formats.map((f) => f.id);
    const chainIds = [...new Set(formats.flatMap((f) => f.chains))].map(chainUid);
    const needsV = formats.some((f) => f.half + f.full > 0);
    const molIds: string[] = [];
    formats.forEach((format) => {
      const id = `MOL-${format.id}`;
      molIds.push(id);
      molecules.push({
        id,
        name: format.name,
        panelId,
        formatId: format.id,
        chainIds: format.chains.map(chainUid),
        design: designForFormat(format, seed.chains),
      });
    });
    panels.push({
      id: panelId,
      name: panelTitle(key, formats.map((f) => f.name)),
      requestId,
      project: formats[0].cls,
      registeredAt: '2026-01-15',
      moleculeIds: molIds,
      formatIds,
      chainIds,
      libraryIds: needsV ? libraryIds : [],
    });
  });

  panels.push(...user.panels);
  molecules.push(...user.molecules);

  const chainMolecules = new Map<string, Set<string>>();
  const chainPanels = new Map<string, Set<string>>();
  for (const molecule of molecules) {
    for (const id of molecule.chainIds) {
      const ms = chainMolecules.get(id) ?? new Set<string>();
      ms.add(molecule.id);
      chainMolecules.set(id, ms);
      const ps = chainPanels.get(id) ?? new Set<string>();
      ps.add(molecule.panelId);
      chainPanels.set(id, ps);
    }
  }

  const chains: LumaChain[] = seed.chains.map((chain) => {
    const id = chainUid(chain.id);
    const moleculeIds = [...(chainMolecules.get(id) ?? [])].sort();
    const constructIds = [...chain.vectors];
    const stocked = constructIds.find((vid) => inventory.constructs[vid]);
    return {
      id,
      archetypeId: chain.id,
      constructIds,
      constructId: stocked ?? constructIds[0] ?? null,
      role: moleculeIds.length >= 4 ? 'reagent' : 'campaign',
      moleculeIds,
      panelIds: [...(chainPanels.get(id) ?? [])].sort(),
    };
  });

  const constructChains = new Map<string, Set<string>>();
  for (const chain of chains) {
    for (const id of chain.constructIds) {
      const set = constructChains.get(id) ?? new Set<string>();
      set.add(chain.archetypeId);
      constructChains.set(id, set);
    }
  }
  const mutationByVector = new Map<string, string[]>();
  for (const mutation of mutations) {
    for (const vectorId of mutationVectors(mutation, vectorIds)) {
      const list = mutationByVector.get(vectorId) ?? [];
      list.push(mutation.id);
      mutationByVector.set(vectorId, list);
    }
  }
  const constructs: LumaConstruct[] = seed.vectors.map((vector) => {
    const chainIds = [...(constructChains.get(vector.id) ?? [])].sort();
    const moleculeIds = [
      ...new Set(chainIds.flatMap((id) => chains.find((c) => c.archetypeId === id)?.moleculeIds ?? [])),
    ].sort();
    return {
      id: vector.id,
      chainIds,
      moleculeIds,
      mutationIds: mutationByVector.get(vector.id) ?? [],
      role: moleculeIds.length >= 4 ? 'reagent' : 'campaign',
    };
  });

  const requests: RequestDoc[] = panels
    .filter((panel) => /^PN-\d+$/.test(panel.id))
    .map((panel) => ({
      id: panel.requestId,
      name: panel.name,
      createdAt: panel.registeredAt,
      status: 'registered' as const,
      panelId: panel.id,
      drafts: molecules
        .filter((m) => m.panelId === panel.id)
        .map((m) => ({ id: m.id, name: m.name, design: m.design, formatId: m.formatId })),
    }));

  return { panels, molecules, chains, constructs, requests: [...user.requests, ...requests] };
}

export function panelById(book: LumaBook, id: string | null): LumaPanel | undefined {
  if (!id) return undefined;
  return book.panels.find((p) => p.id === id);
}

export function chainByArchetype(book: LumaBook, archetypeId: string): LumaChain | undefined {
  return book.chains.find((c) => c.archetypeId === archetypeId);
}

export function formatIdsOf(book: LumaBook, panelId: string | null): Set<string> | undefined {
  const panel = panelById(book, panelId);
  if (!panel) return undefined;
  return new Set(panel.formatIds);
}

export function archetypeIdsOf(book: LumaBook, panelId: string | null): Set<string> | undefined {
  const panel = panelById(book, panelId);
  if (!panel) return undefined;
  const wanted = new Set(panel.chainIds);
  return new Set(book.chains.filter((c) => wanted.has(c.id)).map((c) => c.archetypeId));
}

/** Constructs that store a chain on the panel, plus mutations those constructs carry. */
export function panelConstructIds(book: LumaBook, panelId: string | null): Set<string> | undefined {
  const archetypes = archetypeIdsOf(book, panelId);
  if (!archetypes) return undefined;
  return new Set(
    book.chains.filter((c) => archetypes.has(c.archetypeId)).flatMap((c) => c.constructIds),
  );
}

export function panelMutationIds(book: LumaBook, panelId: string | null): Set<string> | undefined {
  const constructs = panelConstructIds(book, panelId);
  if (!constructs) return undefined;
  return new Set(
    book.constructs.filter((c) => constructs.has(c.id)).flatMap((c) => c.mutationIds),
  );
}

let mintSeq = 0;

export function newRequest(existing: RequestDoc[]): RequestDoc {
  mintSeq += 1;
  const n = existing.filter((r) => r.id.startsWith('REQ-R')).length + mintSeq;
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `REQ-R${String(n).padStart(3, '0')}`,
    name: `Request ${n}`,
    createdAt: today,
    status: 'draft',
    panelId: null,
    drafts: [],
  };
}

export interface Registration {
  request: RequestDoc;
  panel: LumaPanel;
  molecules: LumaMolecule[];
}

/** Mint a panel UID, a molecule UID per draft, and reuse the catalog chain UIDs. */
export function registerRequest(book: LumaBook, request: RequestDoc, seed: Seed): Registration | null {
  const ready = request.drafts.filter((d) => d.formatId);
  if (!ready.length) return null;
  const n = book.panels.filter((p) => p.id.startsWith('PN-R')).length + 1;
  const panelId = `PN-R${String(n).padStart(3, '0')}`;
  const molecules: LumaMolecule[] = ready.map((draft, i) => {
    const format = seed.formats.find((f) => f.id === draft.formatId)!;
    return {
      id: `MOL-R${n}-${i + 1}`,
      name: draft.name,
      panelId,
      formatId: format.id,
      chainIds: chainsForDesign(seed, format, draft.design).map(chainUid),
      design: draft.design,
    };
  });
  const panel: LumaPanel = {
    id: panelId,
    name: request.name,
    requestId: request.id,
    project: request.name,
    registeredAt: new Date().toISOString().slice(0, 10),
    moleculeIds: molecules.map((m) => m.id),
    formatIds: [...new Set(molecules.map((m) => m.formatId))],
    chainIds: [...new Set(molecules.flatMap((m) => m.chainIds))],
    libraryIds: [],
  };
  return {
    request: {
      ...request,
      status: 'registered',
      panelId,
      drafts: molecules.map((m) => ({
        id: m.id,
        name: m.name,
        design: m.design,
        formatId: m.formatId,
      })),
    },
    panel,
    molecules,
  };
}
