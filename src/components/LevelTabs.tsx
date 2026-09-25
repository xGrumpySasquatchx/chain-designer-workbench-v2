import { buildSlots } from '../model/slots';
import type { Grain, Model, Seed } from '../model/types';

const STEPS: { g: Grain; lvl: string; name: string }[] = [
  { g: 'fmt', lvl: '1', name: 'Format' },
  { g: 'chn', lvl: '2', name: 'Chain' },
  { g: 'var', lvl: '3', name: 'Variable regions' },
  { g: 'mut', lvl: '4', name: 'Mutations' },
  { g: 'con', lvl: '5', name: 'Construct' },
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
  const counts: Record<Grain, string> = {
    fmt: `${model.reachF.size} of ${seed.formats.length}`,
    chn: `${model.buildC.size} / ${model.reachC.size}`,
    var: `${slots} slot${slots === 1 ? '' : 's'}${builds ? ` · ${builds}` : ''}`,
    mut: `${model.buildM.size} / ${model.reachM.size}`,
    con: `${model.buildV.size} / ${model.reachV.size}`,
  };

  return (
    <div className="tool-tabs" role="tablist" aria-label="Level">
      {STEPS.map((s) => (
        <button
          key={s.g}
          className="tool"
          data-g={s.g}
          role="tab"
          aria-selected={grain === s.g}
          title={`${s.name} · ${counts[s.g]}`}
          onClick={() => onGrain(s.g)}
        >
          <span className="tool-head">
            <span className="tool-lvl">{s.lvl}</span>
            <span className="tool-nm">{s.name}</span>
          </span>
          <span className="tool-ct">{counts[s.g]}</span>
        </button>
      ))}
    </div>
  );
}
