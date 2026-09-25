import { emptySel } from '../model/selection';
import type { Grain, State } from '../model/types';

const KEY = 'protein-chain-workbench-v2';

export function defaultState(): State {
  return {
    sel: emptySel(),
    variants: '',
    library: '',
    assign: {},
    presets: [],
    grain: 'fmt',
    hideOut: false,
  };
}

export function loadState(): State {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const r = JSON.parse(raw) as Partial<State>;
    if (r.sel && typeof r.sel === 'object') {
      base.sel = {
        fmt: { ...emptySel().fmt, ...r.sel.fmt },
        chn: { ...emptySel().chn, ...r.sel.chn },
        con: { ...emptySel().con, ...r.sel.con },
        mut: { ...emptySel().mut, ...r.sel.mut },
      };
    }
    if (r.grain === 'fmt' || r.grain === 'chn' || r.grain === 'var' || r.grain === 'mut' || r.grain === 'con') {
      base.grain = r.grain as Grain;
    }
    if (typeof r.variants === 'string') base.variants = r.variants;
    if (typeof r.library === 'string') base.library = r.library;
    if (Array.isArray(r.presets)) base.presets = r.presets;
    if (typeof r.hideOut === 'boolean') base.hideOut = r.hideOut;
    if (r.assign && typeof r.assign === 'object') base.assign = r.assign;
  } catch {
    return defaultState();
  }
  return base;
}

export function saveState(state: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota */
  }
}
