import type { Model, Mutation, Seed, Sel } from './types';

function uniq(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Explicit plasmid IDs named in the reference, not the "all IgG1" wildcards. */
export function specificVectorIds(mutation: Mutation, seed: Seed): string[] {
  const ids = new Set(seed.vectors.map((v) => v.id));
  const found: string[] = [];
  const chunks = mutation.carried.split(/\s*\+\s*|,(?=\s)/).map((s) => s.trim()).filter(Boolean);
  let last = '';
  for (const chunk of chunks) {
    if (chunk.startsWith('pDM-')) {
      last = chunk;
      if (ids.has(chunk)) found.push(chunk);
    } else if (chunk.startsWith('-') && last) {
      const stem = last.replace(/-[^-]+$/, '');
      const id = stem + chunk;
      if (ids.has(id)) found.push(id);
    }
  }
  return uniq(found);
}

export function carriedVectorIds(mutation: Mutation, seed: Seed): string[] {
  const text = mutation.carried;
  if (/Both KiH/i.test(text)) {
    return seed.vectors.filter((v) => /KNOB|HOLE/.test(v.id)).map((v) => v.id);
  }
  if (/All IgG4/i.test(text)) {
    return seed.vectors.filter((v) => v.iso === 'IgG4').map((v) => v.id);
  }
  if (/All IgG1 vectors except/i.test(text)) {
    return seed.vectors.filter((v) => v.iso === 'IgG1').map((v) => v.id);
  }
  if (/All scFv/i.test(text)) {
    return seed.vectors
      .filter((v) => /scFv/i.test(`${v.id} ${v.role} ${v.insert}`))
      .map((v) => v.id);
  }
  return specificVectorIds(mutation, seed);
}

function formatBlob(seed: Seed, model: Model): string {
  const formats = seed.formats.filter((f) =>
    model.inF.size ? model.inF.has(f.id) : model.reachF.has(f.id),
  );
  return formats
    .map((f) => `${f.name} ${f.mutset} ${f.notes} ${f.kih} ${f.chg} ${f.conj}`)
    .join(' ')
    .toUpperCase();
}

function formatMentions(mutation: Mutation, seed: Seed, model: Model): boolean {
  const blob = formatBlob(seed, model);
  const name = mutation.name.replace(/\s*\(.*\)\s*/g, '').trim().toUpperCase();
  if (name.length > 2 && blob.includes(name)) return true;
  return mutation.positions
    .split(/[/;,]/)
    .map((p) => p.replace(/\(.*?\)/g, '').trim().toUpperCase())
    .filter((p) => p.length >= 4 && !['NONE', 'N/A', 'WHOLE-DOMAIN SWAP'].includes(p))
    .some((p) => blob.includes(p));
}

export function mutationRelevant(mutation: Mutation, seed: Seed, model: Model): boolean {
  if (!model.inF.size && !model.inC.size && !model.inV.size && !model.buildV.size && !model.focused) return true;
  const vecs = carriedVectorIds(mutation, seed);
  if (vecs.some((v) => model.reachV.has(v) || model.buildV.has(v))) return true;
  if (formatMentions(mutation, seed, model)) return true;

  const play = seed.formats.filter((f) => (model.inF.size ? model.inF.has(f.id) : model.reachF.has(f.id)));
  if (
    play.some((f) => f.kih === 'Present') &&
    /heterodimerization \(steric\)|Locks the CH3/i.test(mutation.purpose)
  ) {
    return true;
  }
  if (
    play.some((f) => f.chg === 'Present' || f.chg === 'Optional') &&
    /electrostatic|packing|repacked/i.test(mutation.purpose)
  ) {
    return true;
  }
  if (play.some((f) => f.conj === 'Yes') && /conjugation/i.test(mutation.purpose)) return true;
  if (
    /scFv/i.test(`${mutation.domain} ${mutation.name}`) &&
    [...model.buildV, ...model.reachV].some((id) => /scFv/i.test(id))
  ) {
    return true;
  }
  return false;
}

export function applyMutations(model: Model, seed: Seed, sel: Sel, mutations: Mutation[]): Model {
  const inM = new Set(Object.keys(sel.mut).filter((id) => sel.mut[id] === 'in'));
  const outM = new Set(Object.keys(sel.mut).filter((id) => sel.mut[id] === 'out'));
  const reachM = new Set<string>();
  const claimM = new Set<string>();

  mutations.forEach((m) => {
    if (outM.has(m.id)) return;
    if (!mutationRelevant(m, seed, model)) return;
    reachM.add(m.id);
    const specific = specificVectorIds(m, seed);
    const mentioned = model.inF.size > 0 && formatMentions(m, seed, model);
    const onBackbone = specific.length
      ? specific.some((v) => model.buildV.has(v))
      : /Both KiH/i.test(m.carried) &&
        [...model.buildV].some((v) => /KNOB/.test(v)) &&
        [...model.buildV].some((v) => /HOLE/.test(v));
    if (mentioned || onBackbone) claimM.add(m.id);
  });

  const buildM = new Set([...claimM, ...inM]);
  inM.forEach((id) => reachM.add(id));

  const buildV = new Set(model.buildV);
  const claimV = new Set(model.claimV);
  const reachV = new Set(model.reachV);
  inM.forEach((id) => {
    const m = mutations.find((x) => x.id === id);
    if (!m) return;
    specificVectorIds(m, seed).forEach((v) => {
      if (model.outV.has(v)) return;
      if (reachV.has(v) || !model.inF.size) {
        buildV.add(v);
        claimV.add(v);
        reachV.add(v);
      }
    });
  });

  return { ...model, inM, outM, reachM, claimM, buildM, buildV, claimV, reachV };
}
