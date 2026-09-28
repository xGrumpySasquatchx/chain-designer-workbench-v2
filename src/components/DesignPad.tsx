import { useState, type DragEvent } from 'react';
import { BB_LIBRARY, bbDef, isFcScaffold, needsLight } from '../model/blocks';
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
  PAD_VIEW,
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
  const [overArm, setOverArm] = useState<ArmId | null>(null);
  const [overFc, setOverFc] = useState(false);
  const [zoom, setZoom] = useState(1);
  const slots = targetSlots(design.targets);
  const pairFor = (arm: ArmId): ColorPair => {
    const target = design.targets[arm === 'left' ? 0 : 1];
    return slotColors(target ? slots.get(target) : undefined);
  };
  const needLight = (['left', 'right'] as ArmId[]).filter((arm) => needsLight(design[arm]));

  function applyKind(kind: BbKind, arm: ArmId | 'fc') {
    if (isFcScaffold(kind) || arm === 'fc') {
      if (!isFcScaffold(kind)) return;
      onChange({ ...design, fc: kind });
      return;
    }
    if (bbDef(kind).fusesOnly) {
      if (design[arm] === 'empty') return;
      const key = arm === 'left' ? 'fusedLeft' : 'fusedRight';
      if (!design[key].includes(kind)) onChange({ ...design, [key]: [...design[key], kind] });
      return;
    }
    const next = { ...design, [arm]: kind };
    const stillNeeds = (['left', 'right'] as ArmId[]).some((a) => needsLight(next[a]));
    if (!stillNeeds) next.light = 'unset';
    onChange(next);
  }

  function placeFromPalette(kind: BbKind) {
    if (isFcScaffold(kind)) {
      onChange({ ...design, fc: kind });
      return;
    }
    if (bbDef(kind).fusesOnly) {
      const arm: ArmId = design.left !== 'empty' ? 'left' : 'right';
      applyKind(kind, arm);
      return;
    }
    const arm: ArmId = design.left === 'empty' ? 'left' : 'right';
    applyKind(kind, arm);
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
    onChange({ ...design, fc: kind });
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
    const bb = design[arm];
    const anchor = armAnchor(arm);
    const empty = bb === 'empty';
    const l: Lattice = lattice(empty ? 'fab' : bb);
    const box = latticeBox(l);
    const fused = arm === 'left' ? design.fusedLeft : design.fusedRight;
    return (
      <g
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
          {!empty && <Block bb={bb} pair={pairFor(arm)} />}
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

  function FcScaffold() {
    const placed = design.fc !== 'none';
    const homodimer = design.fc !== 'heterofc';
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
          <g transform={`translate(${FC.cx - COL_PITCH / 2} ${FC_BOTTOM})`}>
            <Block bb={design.fc === 'heterofc' ? 'heterofc' : 'homofc'} pair={NEUTRAL} homodimer={homodimer} />
          </g>
        )}
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

  const view = { w: PAD_VIEW.w / zoom, h: PAD_VIEW.h / zoom };
  const viewBox = `${(PAD_VIEW.w - view.w) / 2} ${(PAD_VIEW.h - view.h) / 2} ${view.w} ${view.h}`;
  const chips = [...slots.entries()].sort((a, b) => a[1] - b[1]);

  return (
    <div className="dpad-wrap">
      <div className="bb-rail" aria-label="Building blocks">
        {BB_LIBRARY.filter((def) => def.kind !== 'empty').map((def) => (
          <button
            key={def.kind}
            type="button"
            className={`bb-card${design.fc === def.kind || design.left === def.kind || design.right === def.kind ? ' placed' : ''}`}
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
              className={design.light === 'common' ? 'active' : ''}
              onClick={() => onChange({ ...design, light: 'common' })}
            >
              Common
            </button>
            <button
              type="button"
              className={design.light === 'per-arm' ? 'active' : ''}
              onClick={() => onChange({ ...design, light: 'per-arm' })}
            >
              One per arm
            </button>
          </div>
          <span className="sm">
            Common keeps one light chain for the whole panel. One per arm gives each arm its own.
          </span>
        </div>
      )}
      <p className="pair-note">
        Drag a building block onto an arm. Homo-Fc and Hetero-Fc drop on the scaffold. Arms splay {ARM_TILT}° with the
        N-terminus at the top. Shape is the block; colour is the target.
      </p>
    </div>
  );
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
