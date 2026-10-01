import type { Chain, Format, Seed } from './types';

export interface ChainRatioRow {
  chainId: string;
  name: string;
  parts: number;
  suggested: number;
  overridden: boolean;
  vectors: string[];
}

export interface ChainRatioPlan {
  formatId: string | null;
  formatName: string | null;
  catalog: string | null;
  separate: boolean;
  note: string;
  rows: ChainRatioRow[];
}

interface RatioSlot {
  label: string;
  parts: number;
  kind: 'H' | 'L' | 'A' | 'note';
}

function slotKind(label: string): RatioSlot['kind'] {
  const text = label.toLowerCase();
  if (text.includes('suppress')) return 'note';
  if (text.startsWith('lc') || text === 'light') return 'L';
  if (text.startsWith('hc') || text.startsWith('fd') || text === 'heavy') return 'H';
  return 'A';
}

function chainKind(chain: Chain): 'H' | 'L' | 'A' {
  if (chain.fam === 'Light' || /light chain/i.test(chain.name)) return 'L';
  if (chain.fam === 'Heavy' || /\b(heavy|fd)\b/i.test(chain.name)) return 'H';
  return 'A';
}

function parseSlots(ratio: string): { slots: RatioSlot[]; separate: boolean; note: string } {
  if (/single plasmid/i.test(ratio)) return { slots: [], separate: false, note: '' };
  if (/separate transfection/i.test(ratio)) return { slots: [], separate: true, note: ratio };
  const match = ratio.match(/^(.+?)\s+((?:\d+(?:\.\d+)?)(?:\s*:\s*\d+(?:\.\d+)?)+)(.*)$/);
  if (!match) return { slots: [], separate: false, note: ratio };
  const labels = match[1].split(':').map((part) => part.trim()).filter(Boolean);
  const numbers = match[2].split(':').map((part) => Number(part.trim()));
  const slots = labels.map((label, i) => ({
    label,
    parts: numbers[i] ?? 1,
    kind: slotKind(label),
  }));
  const note = match[3].replace(/^[\s,.-]+/, '').trim();
  return { slots, separate: false, note };
}

function chooseFormat(build: Set<string>, pool: Format[]): Format | null {
  let best: Format | null = null;
  let bestScore = -1;
  for (const format of pool) {
    const covered = format.chains.filter((id) => build.has(id)).length;
    if (!covered) continue;
    const missing = [...build].filter((id) => !format.chains.includes(id)).length;
    const extra = format.chains.filter((id) => !build.has(id)).length;
    const score = covered * 100 - missing * 40 - extra * 5;
    if (
      score > bestScore ||
      (score === bestScore && best && (format.rank < best.rank || (format.rank === best.rank && format.id < best.id)))
    ) {
      best = format;
      bestScore = score;
    }
  }
  return best;
}

function assignParts(chains: Chain[], slots: RatioSlot[]): Map<string, number> {
  const out = new Map<string, number>();
  const usable = slots.filter((slot) => slot.kind !== 'note');
  const leftover: RatioSlot[] = [];

  const give = (group: RatioSlot[], targets: Chain[]) => {
    if (!targets.length) {
      leftover.push(...group);
      return;
    }
    if (group.length === 0) return;
    if (group.length === 1) {
      targets.forEach((chain) => out.set(chain.id, group[0].parts));
      return;
    }
    targets.forEach((chain, i) => {
      if (i < group.length) out.set(chain.id, group[i].parts);
    });
    if (group.length > targets.length) leftover.push(...group.slice(targets.length));
  };

  give(
    usable.filter((slot) => slot.kind === 'H'),
    chains.filter((chain) => chainKind(chain) === 'H'),
  );
  give(
    usable.filter((slot) => slot.kind === 'L'),
    chains.filter((chain) => chainKind(chain) === 'L'),
  );
  give(
    usable.filter((slot) => slot.kind === 'A'),
    chains.filter((chain) => chainKind(chain) === 'A'),
  );

  const open = chains.filter((chain) => !out.has(chain.id));
  open.forEach((chain, i) => out.set(chain.id, leftover[i]?.parts ?? 1));
  return out;
}

export function formatParts(parts: number): string {
  const rounded = Math.round(parts * 1000) / 1000;
  return String(rounded);
}

export function planChainRatios(
  seed: Seed,
  buildC: Iterable<string>,
  buildV: Set<string>,
  overrides: Record<string, number>,
  formatIds?: Set<string>,
): ChainRatioPlan {
  const build = new Set(buildC);
  const byId = Object.fromEntries(seed.chains.map((chain) => [chain.id, chain]));
  const pool = seed.formats.filter((format) => !formatIds || formatIds.has(format.id));
  const format = chooseFormat(build, pool.length ? pool : seed.formats);
  const parsed = format ? parseSlots(format.ratio) : { slots: [], separate: false, note: '' };
  const ordered = [
    ...(format ? format.chains.filter((id) => build.has(id)) : []),
    ...[...build].filter((id) => !format?.chains.includes(id)).sort(),
  ]
    .map((id) => byId[id])
    .filter((chain): chain is Chain => Boolean(chain));
  const suggested = assignParts(ordered, parsed.slots);
  const noteParts = [
    parsed.note,
    parsed.slots
      .filter((slot) => slot.kind === 'note')
      .map((slot) => `${slot.label} ${formatParts(slot.parts)} parts`)
      .join(' · '),
  ].filter(Boolean);

  return {
    formatId: format?.id ?? null,
    formatName: format?.name ?? null,
    catalog: format?.ratio ?? null,
    separate: parsed.separate,
    note: noteParts.join(' · '),
    rows: ordered.map((chain) => {
      const base = suggested.get(chain.id) ?? 1;
      const override = overrides[chain.id];
      const overridden = typeof override === 'number' && Number.isFinite(override);
      return {
        chainId: chain.id,
        name: chain.name,
        parts: overridden ? override : base,
        suggested: base,
        overridden,
        vectors: chain.vectors.filter((id) => buildV.has(id)),
      };
    }),
  };
}

export function ratioShare(parts: number, total: number): string {
  if (total <= 0) return '0%';
  const pct = (parts / total) * 100;
  const shown = Math.round(pct * 10) / 10;
  return `${shown}%`;
}

export function ratioSummary(plan: ChainRatioPlan): string {
  if (!plan.rows.length) return '';
  const mix = plan.rows.map((row) => `${row.chainId} ${formatParts(row.parts)}`).join(' · ');
  const catalog = plan.catalog ? `Catalog ${plan.formatId}: ${plan.catalog}` : 'No catalog ratio for this set of chains';
  return [catalog, plan.separate ? plan.note : '', mix].filter(Boolean).join('\n');
}
