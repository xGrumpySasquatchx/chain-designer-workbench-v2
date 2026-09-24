import type { VSlot } from './types';

export interface LibEntry {
  name: string;
  t: string;
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
