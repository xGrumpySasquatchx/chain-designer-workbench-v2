import { EMPTY_EXPRESSION } from '../model/expression';
import { emptySel } from '../model/selection';
import type {
  CodonMethod,
  ExpressionMode,
  ExpressionPlan,
  ExpressionRegistration,
  Grain,
  HostId,
  LumaMolecule,
  LumaPanel,
  RequestDoc,
  State,
  TargetClass,
} from '../model/types';

const TARGETS: TargetClass[] = ['secreted', 'intracellular', 'membrane'];
const HOST_IDS: HostId[] = ['ecoli', 'yeast', 'insect', 'mammalian', 'cellfree'];
const CODONS: CodonMethod[] = ['adapt', 'harmonize', 'rare', 'keep'];
const MODES: ExpressionMode[] = ['transient', 'stable'];

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
    expression: EMPTY_EXPRESSION,
    expressionRegistrations: [],
    chainRatios: {},
    constructGroups: {},
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
    if (
      r.grain === 'fmt' ||
      r.grain === 'chn' ||
      r.grain === 'var' ||
      r.grain === 'mut' ||
      r.grain === 'con' ||
      r.grain === 'exp'
    ) {
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
    if (isPlan(r.expression)) base.expression = { ...EMPTY_EXPRESSION, ...r.expression, mode: r.expression.mode ?? null };
    if (Array.isArray(r.expressionRegistrations)) {
      base.expressionRegistrations = r.expressionRegistrations.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const record = value as ExpressionRegistration;
        const mode = oneOf(record.mode, MODES) ?? (record.mode == null ? 'transient' : null);
        if (!mode) return [];
        const next = { ...record, mode };
        return isRegistration(next) ? [next] : [];
      });
    }
    if (isRatioMap(r.chainRatios)) base.chainRatios = r.chainRatios;
    if (isGroupMap(r.constructGroups)) base.constructGroups = r.constructGroups;
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

function oneOf<T extends string>(value: unknown, list: readonly T[]): T | null {
  return typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null;
}

function isPlan(value: unknown): value is ExpressionPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as ExpressionPlan;
  const targetOk = plan.targetClass === null || oneOf(plan.targetClass, TARGETS) !== null;
  const hostOk = plan.host === null || oneOf(plan.host, HOST_IDS) !== null;
  const codonOk = plan.codon === null || oneOf(plan.codon, CODONS) !== null;
  const tableOk = plan.codonTable === null || typeof plan.codonTable === 'string';
  const modeOk = plan.mode == null || oneOf(plan.mode, MODES) !== null;
  return targetOk && hostOk && codonOk && tableOk && modeOk;
}

function isRegistration(value: unknown): value is ExpressionRegistration {
  if (!value || typeof value !== 'object') return false;
  const record = value as ExpressionRegistration;
  return (
    typeof record.id === 'string' &&
    oneOf(record.targetClass, TARGETS) !== null &&
    oneOf(record.host, HOST_IDS) !== null &&
    typeof record.codonTable === 'string' &&
    oneOf(record.codon, CODONS) !== null &&
    oneOf(record.mode, MODES) !== null &&
    Array.isArray(record.vectorIds) &&
    record.vectorIds.every((id) => typeof id === 'string') &&
    Array.isArray(record.inserts) &&
    record.inserts.every((id) => typeof id === 'string') &&
    typeof record.registeredAt === 'string'
  );
}

function isGroupMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, group]) => typeof key === 'string' && typeof group === 'string' && group.length > 0);
}

function isRatioMap(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, parts]) => typeof key === 'string' && typeof parts === 'number' && Number.isFinite(parts) && parts >= 0,
  );
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
