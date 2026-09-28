import { emptySel } from '../model/selection';
import type { Grain, LumaMolecule, LumaPanel, RequestDoc, State } from '../model/types';

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
    panels: [],
    activePanelId: null,
    activeRequestId: null,
    requests: [],
    userPanels: [],
    userMolecules: [],
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
    if (Array.isArray(r.panels)) base.panels = r.panels.filter((id) => typeof id === 'string');
    if (typeof r.activePanelId === 'string') base.activePanelId = r.activePanelId;
    if (typeof r.activeRequestId === 'string') base.activeRequestId = r.activeRequestId;
    if (Array.isArray(r.requests)) base.requests = r.requests.filter(isRequest);
    if (Array.isArray(r.userPanels)) base.userPanels = r.userPanels.filter(isPanel);
    if (Array.isArray(r.userMolecules)) base.userMolecules = r.userMolecules.filter(isMolecule);
  } catch {
    return defaultState();
  }
  return base;
}

function isRequest(value: unknown): value is RequestDoc {
  if (!value || typeof value !== 'object') return false;
  const r = value as RequestDoc;
  return typeof r.id === 'string' && typeof r.name === 'string' && Array.isArray(r.drafts);
}

function isPanel(value: unknown): value is LumaPanel {
  if (!value || typeof value !== 'object') return false;
  const p = value as LumaPanel;
  return typeof p.id === 'string' && Array.isArray(p.formatIds) && Array.isArray(p.chainIds);
}

function isMolecule(value: unknown): value is LumaMolecule {
  if (!value || typeof value !== 'object') return false;
  const m = value as LumaMolecule;
  return typeof m.id === 'string' && typeof m.formatId === 'string' && Array.isArray(m.chainIds);
}

export function saveState(state: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota */
  }
}
