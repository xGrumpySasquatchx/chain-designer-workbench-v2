import { buildSlots } from '../model/slots';
import type { Grain, Model, Seed } from '../model/types';

const STEPS: { g: Grain; lvl: string; name: string }[] = [
  { g: 'fmt', lvl: 'Level 1', name: 'Format' },
  { g: 'chn', lvl: 'Level 2', name: 'Chain' },
  { g: 'var', lvl: 'Level 3', name: 'Variable regions' },
  { g: 'con', lvl: 'Level 4', name: 'Construct' },
];

export function LevelTabs({
  grain,
  model,
  seed,
  builds,
  onGrain,
}: {
  grain: Grain;
  model: Model;
  seed: Seed;
  builds: number;
  onGrain: (g: Grain) => void;
}) {
  const slots = buildSlots(seed, model.buildV).length;
  const n = builds || 1;
  const counts: Record<Grain, string> = {
    fmt: `${model.reachF.size} of ${seed.formats.length} in play`,
    chn: `${model.buildC.size} in build, ${model.reachC.size} available`,
    var: `${slots} slot${slots === 1 ? '' : 's'}, ${n} build${n === 1 ? '' : 's'}`,
    con: `${model.buildV.size} in build, ${model.reachV.size} available`,
  };

  return (
    <div className="cascade" role="tablist" aria-label="Level">
      {STEPS.map((s) => (
        <button
          key={s.g}
          className="step"
          data-g={s.g}
          role="tab"
          aria-selected={grain === s.g}
          onClick={() => onGrain(s.g)}
        >
          <span className="lvl">{s.lvl}</span>
          <span className="nm">{s.name}</span>
          <span className="ct">{counts[s.g]}</span>
        </button>
      ))}
    </div>
  );
}
