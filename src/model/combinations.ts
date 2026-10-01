export interface ConstructCombination {
  id: string;
  label: string;
  vectorIds: string[];
}

const TOGETHER = 'together';

function defaultKey(id: string, separate: boolean): string {
  return separate ? `solo:${id}` : TOGETHER;
}

function materialize(
  membership: Record<string, string>,
  vectorIds: string[],
  separate: boolean,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const id of vectorIds) next[id] = membership[id] || defaultKey(id, separate);
  return next;
}

/** Drop a custom assignment once it matches the catalog grouping again. */
export function normalizeGroups(
  membership: Record<string, string>,
  vectorIds: string[],
  separate: boolean,
): Record<string, string> {
  const next = materialize(membership, vectorIds, separate);
  const distinct = new Set(vectorIds.map((id) => next[id]));
  const allSolo = vectorIds.every((id) => vectorIds.filter((other) => next[other] === next[id]).length === 1);
  if (!separate && distinct.size <= 1) return {};
  if (separate && allSolo) return {};
  return next;
}

export function planCombinations(
  vectorIds: string[],
  membership: Record<string, string>,
  separate: boolean,
): ConstructCombination[] {
  const placed = materialize(membership, vectorIds, separate);
  const order: string[] = [];
  const buckets = new Map<string, string[]>();
  for (const id of vectorIds) {
    const key = placed[id];
    const list = buckets.get(key);
    if (list) list.push(id);
    else {
      buckets.set(key, [id]);
      order.push(key);
    }
  }
  return order.map((key, index) => ({
    id: key,
    label: order.length === 1 ? 'One co-transfection' : `Combination ${index + 1}`,
    vectorIds: buckets.get(key) ?? [],
  }));
}

/** Put the chosen constructs into one co-transfection. The rest stay where they are. */
export function groupConstructs(
  membership: Record<string, string>,
  vectorIds: string[],
  picked: string[],
  separate: boolean,
): Record<string, string> {
  const chosen = picked.filter((id) => vectorIds.includes(id));
  if (chosen.length < 2) return normalizeGroups(membership, vectorIds, separate);
  const next = materialize(membership, vectorIds, separate);
  const key = `group:${[...chosen].sort().join('+')}`;
  for (const id of chosen) next[id] = key;
  return normalizeGroups(next, vectorIds, separate);
}

/** Give each chosen construct its own transfection. */
export function ungroupConstructs(
  membership: Record<string, string>,
  vectorIds: string[],
  picked: string[],
  separate: boolean,
): Record<string, string> {
  const next = materialize(membership, vectorIds, separate);
  for (const id of picked) {
    if (vectorIds.includes(id)) next[id] = `solo:${id}`;
  }
  return normalizeGroups(next, vectorIds, separate);
}

export function combinationText(combinations: ConstructCombination[]): string {
  return combinations.map((combo) => `${combo.label}: ${combo.vectorIds.join(' + ')}`).join('\n');
}
