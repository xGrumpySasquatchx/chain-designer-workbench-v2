import type { Pairing, VRegion, VSlot } from './types';

export interface LibEntry {
  name: string;
  t: string;
}

export function libraryNames(library: string): Set<string> {
  return new Set(parseLibrary(library).map((e) => e.name));
}

export function addToLibrary(library: string, names: string[]): string {
  const have = libraryNames(library);
  const extra = names.filter((n) => n && !have.has(n));
  if (!extra.length) return library;
  const body = library.trimEnd();
  return (body ? `${body}\n` : '') + extra.join('\n') + '\n';
}

export function vregionText(v: VRegion): string {
  return [v.name, v.clone, v.t, v.target, v.pairing, v.partner, v.source, v.notes].join(' ');
}

export function filterCatalog(
  catalog: VRegion[],
  query: string,
  pairing: Pairing | 'all',
): VRegion[] {
  const q = query.trim().toLowerCase();
  return catalog.filter((v) => {
    if (pairing !== 'all' && v.pairing !== pairing) return false;
    if (q && !vregionText(v).toLowerCase().includes(q)) return false;
    return true;
  });
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

export function libForType(lib: LibEntry[], t: VSlot['t']): LibEntry[] {
  return lib.filter((e) => !e.t || e.t === t);
}
