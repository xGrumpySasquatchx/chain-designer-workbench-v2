import type { Chain, Marks, Vector } from './types';

/** The library group a construct belongs to. */
export function constructCollection(vector: Vector): string {
  return vector.role;
}

function plain(value: string): string {
  return value.replace(/,\s*/g, ' · ').replace(/\s+/g, ' ').trim();
}

function keep(value: string | undefined, drop?: RegExp): string | null {
  const text = plain(value ?? '');
  if (!text || drop?.test(text)) return null;
  return text;
}

/** Parts of a construct, in the order a comma-separated search lists them. */
export function constructElements(vector: Vector): string[] {
  return [
    keep(vector.iso, /^none$/i),
    keep(vector.eng),
    keep(vector.insert),
    keep(vector.module, /^none\b/i),
    keep(vector.cat, /^none$/i),
    keep(vector.sel),
    keep(vector.promoter),
    keep(vector.sp),
    keep(vector.method),
  ].filter((item): item is string => Boolean(item));
}

export function constructElementString(vector: Vector): string {
  return constructElements(vector).join(', ');
}

/**
 * Match a Construct ID, a Construct Collection, or a comma-separated list of elements.
 * Every comma-separated token has to match one of those.
 */
export function searchConstructs(vectors: Vector[], query: string): Vector[] {
  const parts = query
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return [];
  return vectors.filter((vector) => {
    const hay = [vector.id, constructCollection(vector), ...constructElements(vector)].map((item) =>
      item.toLowerCase(),
    );
    return parts.every((part) => hay.some((item) => item.includes(part)));
  });
}

/** Constructs already in the build that share a chain with the one being chosen. */
export function replacedConstructs(
  chains: Pick<Chain, 'vectors'>[],
  constructId: string,
  inBuild: ReadonlySet<string>,
): string[] {
  const siblings = new Set(
    chains.filter((chain) => chain.vectors.includes(constructId)).flatMap((chain) => chain.vectors),
  );
  siblings.delete(constructId);
  return [...siblings].filter((id) => inBuild.has(id));
}

/** Put the chosen construct in the build and rule out the one it replaces on the same chain. */
export function chooseConstruct(
  marks: Marks,
  chains: Pick<Chain, 'vectors'>[],
  constructId: string,
  inBuild: ReadonlySet<string>,
): Marks {
  const next: Marks = { ...marks };
  for (const id of replacedConstructs(chains, constructId, inBuild)) next[id] = 'out';
  next[constructId] = 'in';
  return next;
}
