import type { Pairing, VPanel, VRegion } from './types';

export type SearchField =
  | 'any'
  | 'id'
  | 'name'
  | 'clone'
  | 'target'
  | 'date'
  | 'project'
  | 'pairing'
  | 'domain';

export type SearchOp = 'contains' | 'is' | 'is_not' | 'starts' | 'before' | 'after' | 'between';

export interface SearchTerm {
  id: string;
  field: SearchField;
  op: SearchOp;
  value: string;
  value2?: string;
}

export interface SearchQuery {
  match: 'all' | 'any';
  terms: SearchTerm[];
  free: string[];
}

export interface CloneGroup {
  clone: string;
  pairing: Pairing;
  target: string;
  project: string;
  date: string;
  ids: string;
  items: VRegion[];
}

export interface TargetBranch {
  target: string;
  groups: CloneGroup[];
}

export interface PairingBranch {
  pairing: Pairing;
  targets: TargetBranch[];
}

export const SEARCH_FIELDS: { id: SearchField; label: string }[] = [
  { id: 'any', label: 'Any field' },
  { id: 'id', label: 'ID' },
  { id: 'name', label: 'Name' },
  { id: 'clone', label: 'Clone' },
  { id: 'target', label: 'Target' },
  { id: 'date', label: 'Date' },
  { id: 'project', label: 'Project' },
  { id: 'pairing', label: 'Pairing' },
  { id: 'domain', label: 'Domain' },
];

const TEXT_OPS: { id: SearchOp; label: string }[] = [
  { id: 'contains', label: 'contains' },
  { id: 'is', label: 'is' },
  { id: 'is_not', label: 'is not' },
  { id: 'starts', label: 'starts with' },
];

const DATE_OPS: { id: SearchOp; label: string }[] = [
  { id: 'contains', label: 'contains' },
  { id: 'is', label: 'is' },
  { id: 'before', label: 'is before or on' },
  { id: 'after', label: 'is after or on' },
  { id: 'between', label: 'is between' },
];

const FIELD_ALIASES: Record<string, SearchField> = {
  id: 'id',
  name: 'name',
  clone: 'clone',
  target: 'target',
  date: 'date',
  project: 'project',
  pairing: 'pairing',
  domain: 'domain',
  t: 'domain',
  type: 'domain',
};

export function opsFor(field: SearchField): { id: SearchOp; label: string }[] {
  return field === 'date' ? DATE_OPS : TEXT_OPS;
}

export function blankTerm(id = 't1'): SearchTerm {
  return { id, field: 'target', op: 'contains', value: '' };
}

export function parseSearchText(text: string): { terms: SearchTerm[]; free: string[] } {
  const terms: SearchTerm[] = [];
  const free: string[] = [];
  const re = /(?:([A-Za-z]+)\s*[:=]\s*)?(?:"([^"]*)"|(\S+))/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = (m[2] ?? m[3] ?? '').trim();
    if (!raw) continue;
    const key = (m[1] ?? '').toLowerCase();
    if (key === 'and') continue;
    if (!key && /^(and|or)$/i.test(raw)) continue;
    const field = FIELD_ALIASES[key];
    if (field) {
      i += 1;
      terms.push({ id: `q${i}`, field, op: field === 'date' ? dateOpFrom(raw) : 'contains', value: raw });
    } else {
      free.push(key ? `${key}:${raw}` : raw);
    }
  }
  return { terms, free };
}

function dateOpFrom(raw: string): SearchOp {
  if (raw.startsWith('>=') || raw.startsWith('>')) return 'after';
  if (raw.startsWith('<=') || raw.startsWith('<')) return 'before';
  return 'contains';
}

export function compileSearch(
  text: string,
  extra: SearchTerm[],
  match: 'all' | 'any',
): SearchQuery {
  const parsed = parseSearchText(text);
  const extras = extra.filter((t) => t.value.trim() || (t.op === 'between' && (t.value2 ?? '').trim()));
  return { match, terms: [...parsed.terms, ...extras], free: parsed.free };
}

export function searchActive(q: SearchQuery): boolean {
  return q.terms.length > 0 || q.free.length > 0;
}

function fieldsOf(v: VRegion): Record<SearchField, string> {
  return {
    any: haystack(v),
    id: v.id,
    name: v.name,
    clone: v.clone,
    target: v.target,
    date: v.date,
    project: v.project,
    pairing: v.pairing,
    domain: v.t,
  };
}

export function haystack(v: VRegion): string {
  return [v.id, v.name, v.clone, v.t, v.target, v.pairing, v.partner, v.notes, v.date, v.project].join(' ');
}

export function panelHaystack(p: VPanel): string {
  return [p.id, p.name, p.target, p.notes, p.date, p.project, ...p.clones].join(' ');
}

function panelFields(p: VPanel): Record<SearchField, string> {
  return {
    any: panelHaystack(p),
    id: p.id,
    name: p.name,
    clone: p.clones.join(' '),
    target: p.target,
    date: p.date,
    project: p.project,
    pairing: '',
    domain: '',
  };
}

function expandDate(raw: string, bound: 'start' | 'end'): string {
  const t = raw.trim().replace(/^[<>]=?/, '');
  if (/^\d{4}$/.test(t)) return bound === 'start' ? `${t}-01-01` : `${t}-12-31`;
  if (/^\d{4}-\d{2}$/.test(t)) return bound === 'start' ? `${t}-01` : `${t}-31`;
  return t;
}

function matchTerm(bag: Record<SearchField, string>, term: SearchTerm): boolean {
  const op = term.op;
  if (term.field === 'date' && (op === 'before' || op === 'after' || op === 'between' || op === 'is')) {
    const date = bag.date;
    if (!date) return false;
    if (op === 'is') return date === expandDate(term.value, 'start') || date === term.value.trim();
    if (op === 'before') return date <= expandDate(term.value, 'end');
    if (op === 'after') return date >= expandDate(term.value, 'start');
    const a = expandDate(term.value, 'start');
    const b = expandDate(term.value2 ?? term.value, 'end');
    return date >= a && date <= b;
  }
  const hay = (term.field === 'any' ? bag.any : bag[term.field] || '').toLowerCase();
  const needle = term.value.trim().toLowerCase();
  if (!needle && op !== 'is' && op !== 'is_not') return true;
  if (op === 'is') return hay === needle;
  if (op === 'is_not') return hay !== needle;
  if (op === 'starts') return hay.startsWith(needle);
  return hay.includes(needle);
}

function matchBag(bag: Record<SearchField, string>, q: SearchQuery): boolean {
  if (!searchActive(q)) return true;
  const termHits = q.terms.map((t) => matchTerm(bag, t));
  const freeHits = q.free.every((w) => bag.any.toLowerCase().includes(w.toLowerCase()));
  if (!q.terms.length) return freeHits;
  const termsOk = q.match === 'any' ? termHits.some(Boolean) : termHits.every(Boolean);
  return termsOk && freeHits;
}

export function regionMatches(v: VRegion, q: SearchQuery): boolean {
  return matchBag(fieldsOf(v), q);
}

export function panelMatches(p: VPanel, q: SearchQuery): boolean {
  return matchBag(panelFields(p), q);
}

function byClone(rows: VRegion[]): { clone: string; items: VRegion[] }[] {
  const order: string[] = [];
  const map = new Map<string, VRegion[]>();
  rows.forEach((v) => {
    if (!map.has(v.clone)) {
      map.set(v.clone, []);
      order.push(v.clone);
    }
    map.get(v.clone)!.push(v);
  });
  return order.map((clone) => ({ clone, items: map.get(clone)! }));
}

export function searchCatalog(
  catalog: VRegion[],
  q: SearchQuery,
  pairing: Pairing | 'all' = 'all',
): VRegion[] {
  return byClone(catalog)
    .filter((g) => {
      const items = pairing === 'all' ? g.items : g.items.filter((v) => v.pairing === pairing);
      if (!items.length) return false;
      if (!searchActive(q)) return true;
      return items.some((v) => regionMatches(v, q));
    })
    .flatMap((g) => (pairing === 'all' ? g.items : g.items.filter((v) => v.pairing === pairing)));
}

function groupMeta(items: VRegion[]): CloneGroup {
  const head = items[0];
  return {
    clone: head?.clone ?? '',
    pairing: head?.pairing ?? 'unpaired',
    target: head?.target ?? '',
    project: head?.project ?? '',
    date: head?.date ?? '',
    ids: items.map((v) => v.id).join(' / '),
    items,
  };
}

export function treeCatalog(rows: VRegion[]): PairingBranch[] {
  const byPair = new Map<Pairing, Map<string, CloneGroup[]>>();
  byClone(rows).forEach((g) => {
    const meta = groupMeta(g.items);
    if (!byPair.has(meta.pairing)) byPair.set(meta.pairing, new Map());
    const targets = byPair.get(meta.pairing)!;
    if (!targets.has(meta.target)) targets.set(meta.target, []);
    targets.get(meta.target)!.push(meta);
  });
  const order: Pairing[] = ['paired', 'unpaired'];
  return order
    .filter((p) => byPair.has(p))
    .map((pairing) => {
      const targets = [...(byPair.get(pairing)?.entries() ?? [])].map(([target, groups]) => ({
        target,
        groups: groups.sort((a, b) => a.clone.localeCompare(b.clone)),
      }));
      targets.sort((a, b) => b.groups.length - a.groups.length || a.target.localeCompare(b.target));
      return { pairing, targets };
    });
}

export function branchCount(branch: PairingBranch): number {
  return branch.targets.reduce((n, t) => n + t.groups.length, 0);
}
