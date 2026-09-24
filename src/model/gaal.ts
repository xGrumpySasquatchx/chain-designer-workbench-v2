import { cellValue, variantRows } from './library';
import { backboneIds, buildSlots } from './slots';
import type { GaalJob, Seed } from './types';

export function gaalJobs(
  seed: Seed,
  buildV: Set<string>,
  variants: string,
  assign: Record<string, Record<string, string>>,
): GaalJob[] {
  const byId = Object.fromEntries(seed.vectors.map((v) => [v.id, v]));
  const slots = buildSlots(seed, buildV);
  const jobs: GaalJob[] = [];
  variantRows(variants).forEach((vr) => {
    backboneIds(seed, buildV).forEach((id) => {
      const v = byId[id];
      const mine = slots.filter((s) => s.vec === id);
      if (!mine.length) return;
      const productSlot = slots.find((s) => s.vec === id);
      jobs.push({
        job: 'golden_gate_assembly',
        library: 'GaaL',
        backbone: id,
        enzyme: 'BsmBI',
        overhang5: v.o5,
        overhang3: v.o3,
        selection: v.sel,
        inserts: mine.map((s) => ({
          slot: s.label,
          domain: s.t,
          part: cellValue(assign, vr, s.key, s.label),
        })),
        product: (vr === '(unnamed build)' ? '' : `${vr}_`) + (productSlot?.product ?? ''),
        annotate: ['signal peptide', 'V region', 'CDR1', 'CDR2', 'CDR3'].concat(
          String(v.module).split('-'),
        ),
      });
    });
  });
  return jobs;
}

export function gaalCsv(
  seed: Seed,
  buildV: Set<string>,
  variants: string,
  assign: Record<string, Record<string, string>>,
): string {
  const rows: string[][] = [
    ['build', 'slot', 'domain', 'part', 'backbone', 'enzyme', 'overhang_5', 'overhang_3', 'product', 'selection'],
  ];
  gaalJobs(seed, buildV, variants, assign).forEach((j) =>
    j.inserts.forEach((i) =>
      rows.push([
        j.product.split('_')[0] ?? '',
        i.slot,
        i.domain,
        i.part,
        j.backbone,
        j.enzyme,
        j.overhang5,
        j.overhang3,
        j.product,
        j.selection,
      ]),
    ),
  );
  return rows
    .map((r) => r.map((c) => (/[,"]/.test(String(c)) ? `"${c}"` : String(c))).join(','))
    .join('\n');
}

export function buildListText(
  seed: Seed,
  inF: Iterable<string>,
  buildV: Set<string>,
  variants: string,
  outs: string[],
  conflicts: string[],
): string {
  const F = Object.fromEntries(seed.formats.map((f) => [f.id, f]));
  const V = Object.fromEntries(seed.vectors.map((v) => [v.id, v]));
  const names = variants
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const back = backboneIds(seed, buildV);
  const L = ['BUILD LIST', '', 'Formats'];
  const inf = [...inF];
  (inf.length ? inf : ['(none)']).forEach((id) => {
    const f = F[id];
    L.push(f ? `  ${id}  ${f.name}  [${f.plasmids} plasmids, ${f.ratio}]` : `  ${id}`);
  });
  L.push('', 'Backbone, constant across every variant');
  (back.length ? back : ['(none)']).forEach((id) => {
    const v = V[id];
    L.push(v ? `  ${id}  supply: ${v.insert}  [${v.sel}]` : `  ${id}`);
  });
  if (names.length) {
    const slots = back.filter((id) => V[id]?.needsInsert === 'Yes');
    L.push('', `Variants (${names.length}), only the variable regions change`);
    names.forEach((n) =>
      L.push(
        `  ${n}: ${slots
          .map((id) => `${V[id].insert}-${n} into ${id}`)
          .join('   ')}`,
      ),
    );
    L.push('', `  ${names.length} x ${slots.length} = ${names.length * slots.length} cloning reactions`);
  }
  if (outs.length) {
    L.push('', 'Ruled out');
    outs.forEach((x) => L.push(`  ${x}`));
  }
  if (conflicts.length) {
    L.push('', 'Check');
    conflicts.forEach((c) => L.push(`  ${c}`));
  }
  return L.join('\n');
}
