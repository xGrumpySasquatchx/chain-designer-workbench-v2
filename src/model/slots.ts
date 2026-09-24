import type { BuildSlot, Seed, Sel, Vector } from './types';
import { resolve } from './selection';

const ARM_A = /KNOB|DuoA|ChgA|-DE\b|-HA\b|ZWa|SEED-AG|chgA/;
const ARM_B = /HOLE|DuoB|ChgB|-KK\b|-TF\b|ZWb|SEED-GA|chgB/;

export function armOf(vid: string): string {
  if (ARM_A.test(vid)) return 'arm A';
  if (ARM_B.test(vid)) return 'arm B';
  return '';
}

export function prodShort(v: Vector): string {
  const r = v.role || '';
  if (r.startsWith('Fd')) return 'Fd';
  if (r.startsWith('scFv-Fc')) return 'scFvFc';
  if (r.startsWith('VHH-Fc')) return 'VHHFc';
  if (r.startsWith('scFv')) return 'scFv';
  if (r.startsWith('Fc')) return 'Fc';
  if (v.fam === 'Light') return 'LC';
  return 'HC';
}

export function backboneIds(seed: Seed, buildV: Set<string>): string[] {
  const byId = Object.fromEntries(seed.vectors.map((v) => [v.id, v]));
  return [...buildV]
    .filter((id) => byId[id])
    .sort((a, b) => (byId[a].rank || 999) - (byId[b].rank || 999) || a.localeCompare(b));
}

export function buildSlots(seed: Seed, buildV: Set<string>): BuildSlot[] {
  const byId = Object.fromEntries(seed.vectors.map((v) => [v.id, v]));
  const out: BuildSlot[] = [];
  backboneIds(seed, buildV).forEach((id) => {
    const v = byId[id];
    (v.slots || []).forEach((s, i) => {
      out.push({
        key: `${id}#${i}`,
        vec: id,
        i,
        t: s.t,
        pos: s.pos || '',
        note: s.note || '',
        arm: armOf(id),
        prod: prodShort(v),
        product: '',
        label: '',
      });
    });
  });

  const groups = new Map<string, BuildSlot[]>();
  out.forEach((s) => {
    const k = `${s.t}|${s.pos}`;
    const g = groups.get(k) ?? [];
    g.push(s);
    groups.set(k, g);
  });
  groups.forEach((g) => {
    const multi = g.length > 1;
    g.forEach((s, n) => {
      s.label = s.t + (s.pos ? `(${s.pos})` : '') + (multi ? String(n + 1) : '');
    });
  });

  const byProd = new Map<string, string[]>();
  out.forEach((s) => {
    const list = byProd.get(s.prod) ?? [];
    if (!list.includes(s.vec)) list.push(s.vec);
    byProd.set(s.prod, list);
  });
  out.forEach((s) => {
    const vs = byProd.get(s.prod) ?? [s.vec];
    s.product = vs.length > 1 ? `${s.prod}-${String.fromCharCode(65 + vs.indexOf(s.vec))}` : s.prod;
  });
  return out;
}

export function slotsFor(seed: Seed, formatId: string): BuildSlot[] {
  const sel: Sel = { fmt: { [formatId]: 'in' }, chn: {}, con: {} };
  return buildSlots(seed, resolve(seed, sel).buildV);
}

export function slotChip(v: Vector): string | null {
  const i = (v.insert || '').toUpperCase();
  if (i.includes('NONE')) return null;
  if (i.includes('VHH')) return 'VHH';
  if (i.includes('CASSETTE')) return 'VH+VL';
  if (i.includes('OUTER')) return i.indexOf('VH') === 0 ? 'VH x2' : 'VL x2';
  if (i.indexOf('VH') === 0) return 'VH';
  if (i.indexOf('VL') === 0) return 'VL';
  return v.insert;
}
