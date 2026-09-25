import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

const KEY = 'protein-chain-workbench-v2-sides';
const LEFT_MIN = 180;
const LEFT_MAX = 520;
const RIGHT_MIN = 220;
const RIGHT_MAX = 640;
const FOLDED = 40;

export interface SideLayout {
  leftOpen: boolean;
  rightOpen: boolean;
  leftW: number;
  rightW: number;
}

const DEFAULT: SideLayout = { leftOpen: true, rightOpen: true, leftW: 260, rightW: 320 };

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function loadSides(): SideLayout {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const r = JSON.parse(raw) as Partial<SideLayout>;
    return {
      leftOpen: r.leftOpen !== false,
      rightOpen: r.rightOpen !== false,
      leftW: clamp(Number(r.leftW) || DEFAULT.leftW, LEFT_MIN, LEFT_MAX),
      rightW: clamp(Number(r.rightW) || DEFAULT.rightW, RIGHT_MIN, RIGHT_MAX),
    };
  } catch {
    return DEFAULT;
  }
}

export function useSidePanels() {
  const [layout, setLayout] = useState(loadSides);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      /* private mode or quota */
    }
  }, [layout]);

  const toggle = useCallback((side: 'left' | 'right') => {
    setLayout((l) =>
      side === 'left' ? { ...l, leftOpen: !l.leftOpen } : { ...l, rightOpen: !l.rightOpen },
    );
  }, []);

  const startResize = useCallback((side: 'left' | 'right', e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === 'left' ? layout.leftW : layout.rightW;
    const prev = document.body.style.cursor;
    const prevSel = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      setLayout((l) =>
        side === 'left'
          ? { ...l, leftW: clamp(startW + dx, LEFT_MIN, LEFT_MAX) }
          : { ...l, rightW: clamp(startW - dx, RIGHT_MIN, RIGHT_MAX) },
      );
    };
    const up = () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = prevSel;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [layout.leftW, layout.rightW]);

  const resetWidth = useCallback((side: 'left' | 'right') => {
    setLayout((l) =>
      side === 'left' ? { ...l, leftW: DEFAULT.leftW } : { ...l, rightW: DEFAULT.rightW },
    );
  }, []);

  const expandView = useCallback(() => {
    setLayout((l) => {
      const restored = !l.leftOpen && !l.rightOpen;
      return { ...l, leftOpen: restored, rightOpen: restored };
    });
  }, []);

  const wrapStyle = {
    '--rail-w': `${layout.leftOpen ? layout.leftW : FOLDED}px`,
    '--basket-w': `${layout.rightOpen ? layout.rightW : FOLDED}px`,
  } as CSSProperties;

  return { layout, toggle, startResize, resetWidth, expandView, wrapStyle };
}

export function FoldBtn({
  side,
  open,
  onClick,
}: {
  side: 'left' | 'right';
  open: boolean;
  onClick: () => void;
}) {
  const label = open
    ? side === 'left'
      ? 'Collapse left panel'
      : 'Collapse right panel'
    : side === 'left'
      ? 'Expand left panel'
      : 'Expand right panel';
  const mark = side === 'left' ? (open ? '‹' : '›') : open ? '›' : '‹';
  return (
    <button
      className="btn sm fold"
      type="button"
      aria-expanded={open}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {mark}
    </button>
  );
}

export function ResizeGrip({
  side,
  onDrag,
  onReset,
}: {
  side: 'left' | 'right';
  onDrag: (e: ReactPointerEvent<HTMLElement>) => void;
  onReset: () => void;
}) {
  return (
    <div
      className={`grip grip-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize left panel' : 'Resize right panel'}
      title="Drag to expand. Double-click to reset."
      onPointerDown={onDrag}
      onDoubleClick={onReset}
    />
  );
}
