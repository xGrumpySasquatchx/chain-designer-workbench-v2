import type { BuildSlot, Pairing, VPanel, VRegion, VSlot } from './types';
import { compileSearch, searchCatalog } from './vsearch';

export interface LibEntry {
  name: string;
  t: string;
}

export function libraryNames(library: string): Set<string> {
  return new Set(parseLibrary(library).map((e) => e.name));
}

function nameOf(raw: string): string {
  return parseLibrary(raw)[0]?.name ?? raw.trim();
}

export function addToLibrary(library: string, names: string[]): string {
  const have = libraryNames(library);
  const extra = names.filter((n) => {
    const name = nameOf(n);
    return name && !have.has(name);
  });
  if (!extra.length) return library;
  const body = library.trimEnd();
  return (body ? `${body}\n` : '') + extra.join('\n') + '\n';
}

export function removeFromLibrary(library: string, names: string[]): string {
  const drop = new Set(names.map(nameOf).filter(Boolean));
  const keep = parseLibrary(library).filter((e) => !drop.has(e.name));
  if (!keep.length) return '';
  return keep.map((e) => (e.t ? `${e.name}, ${e.t}` : e.name)).join('\n') + '\n';
}

export function taggedName(v: VRegion): string {
  const u = v.name.toUpperCase();
  const tagged =
    v.t === 'VHH' ? u.includes('VHH') : new RegExp(`(^|[^A-Z])${v.t}([^A-Z]|$)`).test(u);
  return tagged ? v.name : `${v.name}, ${v.t}`;
}

export function vregionText(v: VRegion): string {
  return [v.id, v.name, v.clone, v.t, v.target, v.pairing, v.partner, v.notes, v.date, v.project].join(
    ' ',
  );
}

export function clonesOf(catalog: VRegion[], clones: string[]): { clone: string; items: VRegion[] }[] {
  const want = new Set(clones);
  return groupCatalog(catalog.filter((v) => want.has(v.clone)));
}

export function cartesian<T>(sets: T[][]): T[][] {
  return sets.reduce<T[][]>((acc, set) => acc.flatMap((head) => set.map((item) => [...head, item])), [[]]);
}

export function permuteCount(sizes: number[]): number {
  if (!sizes.length) return 0;
  return sizes.reduce((n, s) => n * Math.max(s, 0), 1);
}

export function applyPanels(
  catalog: VRegion[],
  panels: VPanel[],
  selected: string[],
  slots: BuildSlot[],
): { library: string; variants: string; assign: Record<string, Record<string, string>> } {
  const picked = selected.map((id) => panels.find((p) => p.id === id)).filter((p): p is VPanel => !!p);
  const groups = picked.map((p) => clonesOf(catalog, p.clones)).filter((g) => g.length);
  const names = groups.flatMap((g) => g.flatMap((c) => c.items.map(taggedName)));
  const library = addToLibrary('', names);
  if (!groups.length) return { library, variants: '', assign: {} };

  const combos = cartesian(groups);
  const arms = [...new Set(slots.map((s) => s.arm).filter(Boolean))];
  const variants: string[] = [];
  const assign: Record<string, Record<string, string>> = {};

  combos.forEach((combo) => {
    const build = combo.map((c) => c.clone).join(' × ');
    variants.push(build);
    if (!slots.length) return;
    const row: Record<string, string> = {};
    slots.forEach((s) => {
      const ai = s.arm && arms.length ? Math.max(0, arms.indexOf(s.arm)) : 0;
      const pack = combo[Math.min(ai, combo.length - 1)] ?? combo[0];
      const hit = pack.items.find((v) => v.t === s.t) ?? pack.items[0];
      if (hit) row[s.key] = hit.name;
    });
    assign[build] = row;
  });

  return { library, variants: variants.join('\n') + '\n', assign };
}

function fillCloneSlots(
  items: VRegion[],
  slots: BuildSlot[],
  existing?: Record<string, string>,
): Record<string, string> {
  const row = { ...(existing ?? {}) };
  slots.forEach((s) => {
    if (row[s.key]) return;
    const hit = items.find((v) => v.t === s.t);
    if (hit) row[s.key] = hit.name;
  });
  return row;
}

export function applyClones(
  items: VRegion[],
  slots: BuildSlot[],
  library: string,
  variants: string,
  assign: Record<string, Record<string, string>>,
  on: boolean,
): { library: string; variants: string; assign: Record<string, Record<string, string>> } {
  const nextLib = on ? addToLibrary(library, items.map(taggedName)) : removeFromLibrary(library, items.map(taggedName));
  const list = variantList(variants);
  const nextAssign = { ...assign };
  const nextList = [...list];
  groupCatalog(items).forEach((g) => {
    if (on) {
      if (!nextList.includes(g.clone)) nextList.push(g.clone);
      nextAssign[g.clone] = fillCloneSlots(g.items, slots, nextAssign[g.clone]);
    } else {
      const i = nextList.indexOf(g.clone);
      if (i >= 0) nextList.splice(i, 1);
      delete nextAssign[g.clone];
    }
  });
  return {
    library: nextLib,
    variants: nextList.length ? `${nextList.join('\n')}\n` : '',
    assign: nextAssign,
  };
}

export function mergeStandaloneBuilds(panelVariants: string, prevVariants: string, library: string): string {
  const panel = variantList(panelVariants);
  const have = libraryNames(library);
  const keep = variantList(prevVariants).filter((v) => {
    if (v.includes(' × ') || panel.includes(v)) return false;
    return [...have].some((name) => name === v || name.startsWith(`${v}-`));
  });
  const all = [...panel, ...keep];
  return all.length ? `${all.join('\n')}\n` : '';
}

export function fillAssignFromCatalog(
  catalog: VRegion[],
  variants: string,
  slots: BuildSlot[],
  assign: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  if (!slots.length) return assign;
  let changed = false;
  const next = { ...assign };
  variantList(variants).forEach((vr) => {
    if (vr.includes(' × ')) return;
    const items = catalog.filter((v) => v.clone === vr);
    if (!items.length) return;
    const filled = fillCloneSlots(items, slots, next[vr]);
    const prev = next[vr] ?? {};
    const keys = Object.keys(filled);
    if (keys.length !== Object.keys(prev).length || keys.some((k) => filled[k] !== prev[k])) {
      next[vr] = filled;
      changed = true;
    }
  });
  return changed ? next : assign;
}

export function filterCatalog(
  catalog: VRegion[],
  query: string,
  pairing: Pairing | 'all',
): VRegion[] {
  return searchCatalog(catalog, compileSearch(query, [], 'all'), pairing);
}

export function groupCatalog(rows: VRegion[]): { clone: string; items: VRegion[] }[] {
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

export function parseLibrary(library: string): LibEntry[] {
  return library
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => {
      let line = raw.startsWith('>') ? raw.slice(1).trim() : raw;
      const parts = line.split(',').map((x) => x.trim());
      const name = parts[0] ?? '';
      let t = (parts[1] || '').toUpperCase();
      if (!t) {
        const u = name.toUpperCase();
        t = u.includes('VHH')
          ? 'VHH'
          : /(^|[^A-Z])VH([^A-Z]|$)/.test(u)
            ? 'VH'
            : /(^|[^A-Z])VL([^A-Z]|$)/.test(u)
              ? 'VL'
              : '';
      }
      return { name, t };
    })
    .filter((e) => e.name);
}

export function variantList(variants: string): string[] {
  return variants
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function variantRows(variants: string): string[] {
  const v = variantList(variants);
  return v.length ? v : ['(unnamed build)'];
}

export function cellValue(
  assign: Record<string, Record<string, string>>,
  variant: string,
  key: string,
  fallback: string,
): string {
  const edited = assign[variant]?.[key];
  if (edited) return edited;
  return variant === '(unnamed build)' ? fallback : `${variant}-${fallback}`;
}

export function insertsByVector(
  slots: BuildSlot[],
  variants: string,
  assign: Record<string, Record<string, string>>,
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  variantRows(variants).forEach((vr) => {
    slots.forEach((s) => {
      const part = assign[vr]?.[s.key]?.trim();
      if (!part) return;
      const list = map[s.vec] ?? (map[s.vec] = []);
      if (!list.includes(part)) list.push(part);
    });
  });
  return map;
}

export function assignedInserts(
  slots: BuildSlot[],
  variants: string,
  assign: Record<string, Record<string, string>>,
): { id: string; label: string; note: string }[] {
  const out: { id: string; label: string; note: string }[] = [];
  variantRows(variants).forEach((vr) => {
    slots.forEach((s) => {
      const part = assign[vr]?.[s.key]?.trim();
      if (!part) return;
      const note = vr === '(unnamed build)' ? s.label : `${s.label} · ${vr}`;
      out.push({ id: `${vr}::${s.key}`, label: part, note });
    });
  });
  return out;
}

export function libForType(lib: LibEntry[], t: VSlot['t']): LibEntry[] {
  return lib.filter((e) => !e.t || e.t === t);
}
