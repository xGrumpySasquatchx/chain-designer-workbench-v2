import { useEffect, useState, type DragEvent, type MouseEvent } from 'react';
import { BB_LIBRARY, bbDef, isFcScaffold, needsLight } from '../model/blocks';
import { completeDesign, joinCTerm, removeCTerm, replaceCTerm, setBlockTarget, type CSide } from '../model/design';
import {
  ARM_TILT,
  BAR_T,
  COL_PITCH,
  CORNER_R,
  DOMAIN_H,
  DOMAIN_W,
  FC,
  GAP,
  GLYPH_STROKE,
  HINGE_ORANGE,
  LOZENGE_R,
  NEUTRAL,
  SELECTION,
  STAPLE_GRAY,
  STAPLE_W,
  STEM_GRAY,
  STEM_W,
  STROKE_W,
  TARGET_SLOTS,
  U,
  armAnchor,
  cellBox,
  colX,
  cTermDropY,
  cTermOrigin,
  padFrame,
  domainPath,
  lattice,
  latticeBox,
  rowTop,
  slotColors,
  staplePath,
  targetSlots,
  type ColorPair,
  type Lattice,
} from '../model/glyph';
import type { ArmId, BbKind, PadDesign } from '../model/types';

type SlotPick = { at: 'left' | 'right' | 'fc' } | { at: 'cLeft' | 'cRight'; index: number };

function sideOf(at: 'cLeft' | 'cRight'): CSide {
  return at === 'cLeft' ? 'left' : 'right';
}

export const BB_DRAG_TYPE = 'application/x-msab-bb';

/** Some browsers clear dataTransfer on drop, so the palette also remembers the block. */
let carried: BbKind | null = null;

const FC_BOTTOM = FC.top + 2 * DOMAIN_H + GAP;
const BAR_LEN = 7.3 * U;
const BAR_LOW = FC.top - 3 * U;
const BAR_HIGH = FC.top - 4 * U;

function readKind(e: DragEvent): BbKind | null {
  const kind = (e.dataTransfer.getData(BB_DRAG_TYPE) || e.dataTransfer.getData('text/plain') || carried) as BbKind;
  if (!kind || !BB_LIBRARY.some((b) => b.kind === kind)) return null;
  return kind;
}

export function DesignPad({
  design,
  onChange,
}: {
  design: PadDesign;
  onChange: (next: PadDesign) => void;
}) {
  const d = completeDesign(design);
  const [overArm, setOverArm] = useState<ArmId | null>(null);
  const [overFc, setOverFc] = useState(false);
  const [overC, setOverC] = useState<CSide | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pick, setPick] = useState<SlotPick | null>(null);
  const [join, setJoin] = useState<CSide | 'both' | null>(null);
  const named = [...d.targets, ...d.cTargetLeft, ...d.cTargetRight];
  const slots = targetSlots(named);
  const colorFor = (target: string): ColorPair => slotColors(target ? slots.get(target) : undefined);
  const pairFor = (arm: ArmId): ColorPair => colorFor(d.targets[arm === 'left' ? 0 : 1]);
  const needLight = (['left', 'right'] as ArmId[]).filter((arm) => needsLight(d[arm]));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!pick) return;
      e.preventDefault();
      removeSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function applyKind(kind: BbKind, arm: ArmId | 'fc') {
    if (isFcScaffold(kind) || arm === 'fc') {
      if (!isFcScaffold(kind)) return;
      onChange({ ...d, fc: kind });
      setPick({ at: 'fc' });
      setJoin(null);
      return;
    }
    if (bbDef(kind).fusesOnly) {
      if (d[arm] === 'empty') return;
      const key = arm === 'left' ? 'fusedLeft' : 'fusedRight';
      if (!d[key].includes(kind)) onChange({ ...d, [key]: [...d[key], kind] });
      return;
    }
    const next = { ...d, [arm]: kind };
    const stillNeeds = (['left', 'right'] as ArmId[]).some((a) => needsLight(next[a]));
    if (!stillNeeds) next.light = 'unset';
    onChange(next);
    setPick({ at: arm });
    setJoin(null);
  }

  function placeFromPalette(kind: BbKind) {
    if (isFcScaffold(kind)) {
      applyKind(kind, 'fc');
      return;
    }
    if (join && d.fc !== 'none' && !bbDef(kind).fusesOnly) {
      const sides: CSide[] = join === 'both' ? ['left', 'right'] : [join];
      const target = join === 'right' ? d.targets[1] : d.targets[0];
      const next = joinCTerm(d, sides, kind, target);
      onChange(next);
      setPick({ at: join === 'right' ? 'cRight' : 'cLeft', index: 0 });
      setJoin(null);
      return;
    }
    if (pick?.at === 'left' || pick?.at === 'right') {
      applyKind(kind, pick.at);
      return;
    }
    if (pick && (pick.at === 'cLeft' || pick.at === 'cRight') && !bbDef(kind).fusesOnly) {
      onChange(replaceCTerm(d, sideOf(pick.at), pick.index, kind));
      return;
    }
    if (bbDef(kind).fusesOnly) {
      const arm: ArmId = d.left !== 'empty' ? 'left' : 'right';
      applyKind(kind, arm);
      return;
    }
    const arm: ArmId = d.left === 'empty' ? 'left' : 'right';
    applyKind(kind, arm);
  }

  function removeSelected() {
    if (!pick) return;
    if (pick.at === 'left' || pick.at === 'right') {
      const key = pick.at === 'left' ? 'fusedLeft' : 'fusedRight';
      onChange({ ...d, [pick.at]: 'empty', [key]: [] });
      return;
    }
    if (pick.at === 'fc' || !('index' in pick)) {
      onChange({ ...d, fc: 'none' });
      setPick(null);
      return;
    }
    onChange(removeCTerm(d, sideOf(pick.at), pick.index));
    setPick(null);
    setJoin(sideOf(pick.at));
  }

  function dropOnCanvas(e: DragEvent<SVGSVGElement>) {
    const kind = readKind(e);
    carried = null;
    setOverArm(null);
    setOverFc(false);
    if (!kind) return;
    e.preventDefault();
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const fcBottom = FC.top + 2 * DOMAIN_H + GAP;
    if (p.y > fcBottom && d.fc !== 'none' && !isFcScaffold(kind) && !bbDef(kind).fusesOnly) {
      const side: CSide = p.x < FC.cx ? 'left' : 'right';
      const next = joinCTerm(d, [side], kind, side === 'left' ? d.targets[0] : d.targets[1]);
      onChange(next);
      setPick({ at: side === 'left' ? 'cLeft' : 'cRight', index: (side === 'left' ? next.cLeft : next.cRight).length - 1 });
      setJoin(null);
      return;
    }
    if (isFcScaffold(kind) || p.y > FC.top - GAP) {
      applyKind(kind, 'fc');
      return;
    }
    const left = armAnchor('left').origin;
    const right = armAnchor('right').origin;
    const nearer =
      (p.x - left.x) ** 2 + (p.y - left.y) ** 2 <= (p.x - right.x) ** 2 + (p.y - right.y) ** 2
        ? 'left'
        : 'right';
    applyKind(kind, nearer);
  }

  function dropOnArm(e: DragEvent, arm: ArmId) {
    setOverArm(null);
    const kind = readKind(e);
    carried = null;
    if (!kind) return;
    e.preventDefault();
    e.stopPropagation();
    applyKind(kind, arm);
  }

  function dropOnFc(e: DragEvent) {
    setOverFc(false);
    const kind = readKind(e);
    if (!kind || !isFcScaffold(kind)) return;
    e.preventDefault();
    onChange({ ...d, fc: kind });
    setPick({ at: 'fc' });
  }

  function Block({ bb, pair, homodimer }: { bb: BbKind; pair: ColorPair; homodimer?: boolean }) {
    const l = lattice(bb);
    return (
      <g>
        {l.rows > 1 &&
          Array.from({ length: l.cols }, (_, col) => (
            <line
              key={col}
              x1={colX(col)}
              y1={rowTop(0, l.rows) + DOMAIN_H}
              x2={colX(col)}
              y2={rowTop(1, l.rows)}
              stroke={STEM_GRAY}
              strokeWidth={STEM_W}
            />
          ))}
        {l.cells.map((cell) => {
          const box = cellBox(cell, l.rows);
          const fill = homodimer || cell.col === 0 ? pair.base : pair.tint;
          return (
            <path
              key={`${cell.type}-${cell.col}-${cell.row}`}
              d={domainPath(box, cell.lozenge ? LOZENGE_R : CORNER_R, cell.notch)}
              fill={fill}
              stroke={GLYPH_STROKE}
              strokeWidth={STROKE_W}
            />
          );
        })}
        {l.disulfide && (
          <rect x={DOMAIN_W / 2} y={-U - BAR_T / 2} width={COL_PITCH - DOMAIN_W} height={BAR_T} fill={HINGE_ORANGE} />
        )}
        {l.staple && (
          <path d={staplePath(l.rows)} fill="none" stroke={STAPLE_GRAY} strokeWidth={STAPLE_W} strokeLinecap="round" />
        )}
      </g>
    );
  }

  function Arm({ arm }: { arm: ArmId }) {
    const bb = d[arm];
    const anchor = armAnchor(arm);
    const empty = bb === 'empty';
    const l: Lattice = lattice(empty ? 'fab' : bb);
    const box = latticeBox(l);
    const fused = arm === 'left' ? d.fusedLeft : d.fusedRight;
    return (
      <g
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          setPick({ at: arm });
          setJoin(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOverArm(arm);
        }}
        onDragLeave={() => setOverArm(null)}
        onDrop={(e) => dropOnArm(e, arm)}
      >
        {!empty && (
          <path
            d={`M ${anchor.origin.x} ${anchor.origin.y} L ${anchor.elbow.x} ${anchor.elbow.y} L ${anchor.stem.x} ${anchor.stem.y}`}
            fill="none"
            stroke={STEM_GRAY}
            strokeWidth={STEM_W}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        <g
          transform={`translate(${anchor.origin.x} ${anchor.origin.y}) rotate(${anchor.tilt})${
            anchor.mirror ? ' scale(-1,1)' : ''
          }`}
        >
          {(overArm === arm || empty) && (
            <rect
              x={box.x - GAP / 2}
              y={box.y - GAP / 2}
              width={box.w + GAP}
              height={box.h + GAP}
              rx={CORNER_R * 2}
              fill={overArm === arm ? 'rgba(124, 221, 206, 0.12)' : 'none'}
              stroke={overArm === arm ? SELECTION : '#4B4B4B'}
              strokeWidth={STROKE_W * 1.5}
              strokeDasharray={overArm === arm ? undefined : `${GAP / 2} ${GAP / 2}`}
            />
          )}
          {!empty && (
          <g
            style={{ cursor: 'pointer' }}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              setPick({ at: arm });
              setJoin(null);
            }}
          >
            {pick?.at === arm && (
              <rect
                x={box.x - GAP / 2}
                y={box.y - GAP / 2}
                width={box.w + GAP}
                height={box.h + GAP}
                rx={CORNER_R * 2}
                fill="none"
                stroke={SELECTION}
                strokeWidth={STROKE_W * 2.4}
              />
            )}
            <Block bb={bb} pair={pairFor(arm)} />
          </g>
        )}
          {fused.map((kind, i) => {
            const fw = DOMAIN_W * 0.6;
            const fh = DOMAIN_H * 0.55;
            const rows = Math.max(l.rows, 1);
            const bottom = rowTop(0, rows) - GAP - i * (fh + GAP);
            return (
              <path
                key={`${kind}-${i}`}
                d={domainPath({ x: colX(1) - fw / 2, y: bottom - fh, w: fw, h: fh }, LOZENGE_R * 0.6, false)}
                fill={TARGET_SLOTS[2].base}
                stroke={GLYPH_STROKE}
                strokeWidth={STROKE_W}
              />
            );
          })}
        </g>
      </g>
    );
  }

  function hang(side: CSide) {
    const blocks = side === 'left' ? d.cLeft : d.cRight;
    const targets = side === 'left' ? d.cTargetLeft : d.cTargetRight;
    const at = side === 'left' ? 'cLeft' : 'cRight';
    const dropY = cTermDropY(blocks);
    return (
      <g>
        {blocks.map((kind, index) => {
          const origin = cTermOrigin(side, blocks.slice(0, index), kind);
          const l = lattice(kind);
          const box = latticeBox(l);
          const selected = pick?.at === at && pick.index === index;
          return (
            <g key={`${side}-${index}`} transform={`translate(${origin.x} ${origin.y})`}>
              <line x1={0} y1={box.y - GAP} x2={0} y2={box.y} stroke={STEM_GRAY} strokeWidth={STEM_W} />
              <g
                style={{ cursor: 'pointer' }}
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  setPick({ at, index });
                  setJoin(null);
                }}
              >
                {selected && (
                  <rect
                    x={box.x - GAP / 2}
                    y={box.y - GAP / 2}
                    width={box.w + GAP}
                    height={box.h + GAP}
                    rx={CORNER_R * 2}
                    fill="none"
                    stroke={SELECTION}
                    strokeWidth={STROKE_W * 2.4}
                  />
                )}
                <Block bb={kind} pair={colorFor(targets[index] ?? '')} />
              </g>
            </g>
          );
        })}
        {blocks.length === 0 && (
          <g
            role="button"
            aria-label={side === 'left' ? 'Left CH3' : 'Right CH3'}
            style={{ cursor: 'pointer' }}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              setJoin(join === side ? null : side);
              setPick(null);
            }}
          >
            <rect
              x={(side === 'left' ? FC.cx - COL_PITCH / 2 : FC.cx + COL_PITCH / 2) - DOMAIN_W / 2}
              y={dropY}
              width={DOMAIN_W}
              height={DOMAIN_H * 0.7}
              rx={CORNER_R * 2}
              fill={overC === side || join === side ? 'rgba(124, 221, 206, 0.12)' : 'none'}
              stroke={overC === side || join === side ? SELECTION : '#4B4B4B'}
              strokeWidth={STROKE_W * 1.5}
              strokeDasharray={`${GAP / 2} ${GAP / 2}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOverC(side);
              }}
              onDragLeave={() => setOverC(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOverC(null);
                const kind = readKind(e);
                carried = null;
                if (!kind || isFcScaffold(kind) || bbDef(kind).fusesOnly) return;
                const next = joinCTerm(d, [side], kind, side === 'left' ? d.targets[0] : d.targets[1]);
                onChange(next);
                setPick({ at, index: 0 });
                setJoin(null);
              }}
            />
            <text
              x={side === 'left' ? FC.cx - COL_PITCH / 2 : FC.cx + COL_PITCH / 2}
              y={dropY + DOMAIN_H * 0.42}
              textAnchor="middle"
              fill={join === side ? SELECTION : '#8F8F8F'}
              fontSize={14}
              fontFamily="IBM Plex Sans, sans-serif"
              pointerEvents="none"
            >
              CH3
            </text>
          </g>
        )}
      </g>
    );
  }

  function FcScaffold() {
    const placed = d.fc !== 'none';
    const homodimer = d.fc !== 'heterofc';
    return (
      <g
        onDragOver={(e) => {
          e.preventDefault();
          setOverFc(true);
        }}
        onDragLeave={() => setOverFc(false)}
        onDrop={dropOnFc}
      >
        {(overFc || !placed) && (
          <rect
            x={FC.cx - COL_PITCH - GAP}
            y={FC.top - GAP}
            width={COL_PITCH * 2 + GAP * 2}
            height={2 * DOMAIN_H + GAP * 3}
            rx={CORNER_R * 2}
            fill={overFc ? 'rgba(124, 221, 206, 0.12)' : 'none'}
            stroke={overFc ? SELECTION : '#4B4B4B'}
            strokeWidth={STROKE_W * 1.5}
            strokeDasharray={overFc ? undefined : `${GAP / 2} ${GAP / 2}`}
          />
        )}
        {placed && (
          <g
            transform={`translate(${FC.cx - COL_PITCH / 2} ${FC_BOTTOM})`}
            style={{ cursor: 'pointer' }}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              setPick({ at: 'fc' });
              setJoin(null);
            }}
          >
            {pick?.at === 'fc' && (
              <rect
                x={-GAP}
                y={rowTop(0, 2) - GAP / 2}
                width={COL_PITCH + DOMAIN_W + GAP}
                height={-rowTop(0, 2) + GAP}
                rx={CORNER_R * 2}
                fill="none"
                stroke={SELECTION}
                strokeWidth={STROKE_W * 2.4}
              />
            )}
            <Block bb={d.fc === 'heterofc' ? 'heterofc' : 'homofc'} pair={NEUTRAL} homodimer={homodimer} />
          </g>
        )}
        {placed && hang('left')}
        {placed && hang('right')}
        {[BAR_HIGH, BAR_LOW].map((y) => (
          <rect
            key={y}
            x={FC.cx - BAR_LEN / 2}
            y={y - BAR_T / 2}
            width={BAR_LEN}
            height={BAR_T}
            fill={HINGE_ORANGE}
            opacity={placed ? 1 : 0.35}
          />
        ))}
      </g>
    );
  }

  const frame = padFrame(d.fc, d.cLeft, d.cRight);
  const view = { w: frame.w / zoom, h: frame.h / zoom };
  const viewBox = `${(frame.w - view.w) / 2} ${(frame.h - view.h) / 2} ${view.w} ${view.h}`;
  const chips = [...slots.entries()].sort((a, b) => a[1] - b[1]);

  return (
    <div className="dpad-wrap">
      <div className="bb-rail" aria-label="Building blocks">
        {BB_LIBRARY.filter((def) => def.kind !== 'empty').map((def) => (
          <button
            key={def.kind}
            type="button"
            className={`bb-card${d.fc === def.kind || d.left === def.kind || d.right === def.kind || d.cLeft.includes(def.kind) || d.cRight.includes(def.kind) ? ' placed' : ''}`}
            draggable
            title={def.description}
            onClick={() => placeFromPalette(def.kind)}
            onDragStart={(e) => {
              carried = def.kind;
              e.dataTransfer.setData(BB_DRAG_TYPE, def.kind);
              e.dataTransfer.setData('text/plain', def.kind);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onDragEnd={() => {
              carried = null;
            }}
          >
            <PaletteGlyph bb={def.kind} />
            <span>{def.label}</span>
          </button>
        ))}
      </div>
      <div className="dpad">
        <svg
          className="dpad-canvas"
          viewBox={viewBox}
          role="img"
          aria-label="Molecule design pad"
          onDragOver={(e) => e.preventDefault()}
          onDrop={dropOnCanvas}
          onClick={() => {
            setPick(null);
            setJoin(null);
          }}
        >
          <FcScaffold />
          <Arm arm="left" />
          <Arm arm="right" />
        </svg>
        {chips.length > 0 && (
          <div className="dpad-chips">
            {chips.map(([target, slot]) => (
              <span key={target} className="dpad-chip" style={{ background: slotColors(slot).base }}>
                {target}
              </span>
            ))}
          </div>
        )}
        <div className="dpad-tools">
          <button type="button" className="dpad-tool" title="Zoom in" onClick={() => setZoom((z) => Math.min(z * 1.25, 3))}>
            +
          </button>
          <button type="button" className="dpad-tool" title="Zoom out" onClick={() => setZoom((z) => Math.max(z / 1.25, 0.6))}>
            −
          </button>
          <button type="button" className="dpad-tool" title="Fit the molecule" onClick={() => setZoom(1)}>
            ⤢
          </button>
        </div>
      </div>
      {needLight.length > 0 && (
        <div className="lc">
          <span className="lc-title">Light chain</span>
          <div className="seg">
            <button
              type="button"
              className={d.light === 'common' ? 'active' : ''}
              onClick={() => onChange({ ...d, light: 'common' })}
            >
              Common
            </button>
            <button
              type="button"
              className={d.light === 'per-arm' ? 'active' : ''}
              onClick={() => onChange({ ...d, light: 'per-arm' })}
            >
              One per arm
            </button>
          </div>
          <span className="sm">
            Common keeps one light chain for the whole panel. One per arm gives each arm its own.
          </span>
        </div>
      )}
      {d.fc !== 'none' && (
        <div className="cjoin">
          <span className="lc-title">Fc C-terminus</span>
          {(
            [
              ['left', 'Left CH3'],
              ['right', 'Right CH3'],
              ['both', 'Both CH3'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={join === id ? 'active' : ''}
              onClick={() => setJoin(join === id ? null : id)}
            >
              {label}
            </button>
          ))}
          <span className="sm">
            {join
              ? 'The next building block joins that CH3. Click the choice again to place on an arm instead.'
              : 'Each CH3 has one C-terminal connection. Choose a side, then a building block.'}
          </span>
        </div>
      )}
      {pick && (
        <div className="pad-inspector">
          <span className="lc-title">{pickLabel(pick, d)}</span>
          {pick.at !== 'fc' && (
            <label>
              Target
              <input
                className="search"
                value={pickTarget(pick, d)}
                onChange={(e) => {
                  const value = e.target.value;
                  if (pick.at === 'left' || pick.at === 'right') onChange(setBlockTarget(d, pick.at, 0, value));
                  else if (pick.at === 'cLeft' || pick.at === 'cRight') onChange(setBlockTarget(d, pick.at, pick.index, value));
                }}
              />
            </label>
          )}
          <button className="btn" type="button" onClick={removeSelected}>
            Delete
          </button>
        </div>
      )}
      <p className="pair-note">
        Click a block to select it, then delete it or give it a target. The next palette block replaces the selection.
        Each CH3 can take one building block on its C-terminus. Arms splay {ARM_TILT}° with the N-terminus at the top.
      </p>
    </div>
  );
}

function pickLabel(pick: SlotPick, design: PadDesign): string {
  if (pick.at === 'fc') return design.fc === 'heterofc' ? 'Hetero-Fc' : 'Homo-Fc';
  if (pick.at === 'left' || pick.at === 'right') return `${bbDef(design[pick.at]).label} · ${pick.at} arm`;
  const blocks = pick.at === 'cLeft' ? design.cLeft : design.cRight;
  const chain = pick.at === 'cLeft' ? 'left' : 'right';
  const index = 'index' in pick ? pick.index : 0;
  return `${bbDef(blocks[index] ?? 'empty').label} · ${chain} CH3`;
}

function pickTarget(pick: SlotPick, design: PadDesign): string {
  if (pick.at === 'left') return design.targets[0];
  if (pick.at === 'right') return design.targets[1];
  if (pick.at === 'fc' || !('index' in pick)) return '';
  return (pick.at === 'cLeft' ? design.cTargetLeft : design.cTargetRight)[pick.index] ?? '';
}

export function PaletteGlyph({ bb, width = 40, height = 30 }: { bb: BbKind; width?: number; height?: number }) {
  const l = lattice(bb);
  const box = latticeBox(l);
  const pad = GAP;
  const pair = isFcScaffold(bb) ? NEUTRAL : TARGET_SLOTS[0];
  const same = bb === 'homofc';
  if (!l.cells.length) return <svg width={width} height={height} aria-hidden="true" />;
  return (
    <svg
      viewBox={`${box.x - pad} ${box.y - pad} ${box.w + pad * 2} ${box.h + pad * 2}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {l.cells.map((cell) => (
        <path
          key={`${cell.type}-${cell.col}-${cell.row}`}
          d={domainPath(cellBox(cell, l.rows), cell.lozenge ? LOZENGE_R : CORNER_R, cell.notch)}
          fill={same || cell.col === 0 ? pair.base : pair.tint}
        />
      ))}
    </svg>
  );
}
