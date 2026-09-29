import { buildSlots } from '../model/slots';
import type { Grain, Model, Seed } from '../model/types';

const STEPS: { g: Grain; lvl: string; name: string }[] = [
  { g: 'fmt', lvl: '', name: 'Request' },
  { g: 'chn', lvl: '1', name: 'Chain' },
  { g: 'var', lvl: '2', name: 'Variable regions' },
  { g: 'mut', lvl: '3', name: 'Mutations' },
  { g: 'con', lvl: '4', name: 'Construct' },
  { g: 'exp', lvl: '5', name: 'Expression' },
];

export function LevelTabs({
  grain,
  model,
  seed,
  builds,
  requestCount,
  expressionCount,
  onGrain,
}: {
  grain: Grain;
  model: Model;
  seed: Seed;
  builds: number;
  requestCount: string;
  expressionCount: string;
  onGrain: (g: Grain) => void;
}) {
  const slots = buildSlots(seed, model.buildV).length;
  const counts: Record<Grain, string> = {
    fmt: requestCount,
    chn: `${model.buildC.size} / ${model.reachC.size}`,
    var: `${slots} slot${slots === 1 ? '' : 's'}${builds ? ` · ${builds}` : ''}`,
    mut: `${model.buildM.size} / ${model.reachM.size}`,
    con: `${model.buildV.size} / ${model.reachV.size}`,
    exp: expressionCount,
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
            {s.lvl ? <span className="tool-lvl">{s.lvl}</span> : null}
            <span className="tool-nm">{s.name}</span>
          </span>
          <span className={`tool-ct${s.lvl ? '' : ' plain'}`}>{counts[s.g]}</span>
        </button>
      ))}
    </div>
  );
}
