import {
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
  padFrame,
  STAPLE_GRAY,
  STAPLE_W,
  STEM_GRAY,
  STEM_W,
  STROKE_W,
  TARGET_SLOTS,
  U,
  armAnchor,
  cTermOrigin,
  cellBox,
  colX,
  domainPath,
  lattice,
  rowTop,
  slotColors,
  staplePath,
  targetSlots,
  type ColorPair,
  type Lattice,
} from '../model/glyph';
import { completeDesign } from '../model/design';
import type { ArmId, BbKind, PadDesign } from '../model/types';

const FC_BOTTOM = FC.top + 2 * DOMAIN_H + GAP;
const BAR_LEN = 7.3 * U;
const BAR_LOW = FC.top - 3 * U;
const BAR_HIGH = FC.top - 4 * U;

/**
 * A BioGlyph molecule, the same geometry as the design pad, drawn small enough
 * to sit on a panel with its neighbours.
 */
export function MoleculeGlyph({ design, title }: { design: PadDesign; title?: string }) {
  const d = completeDesign(design);
  const slots = targetSlots([...d.targets, ...d.cTargetLeft, ...d.cTargetRight]);
  const pairFor = (arm: ArmId): ColorPair => {
    const target = d.targets[arm === 'left' ? 0 : 1];
    return slotColors(target ? slots.get(target) : undefined);
  };

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
    if (bb === 'empty') return null;
    const anchor = armAnchor(arm);
    const l: Lattice = lattice(bb);
    const fused = arm === 'left' ? d.fusedLeft : d.fusedRight;
    return (
      <g>
        <path
          d={`M ${anchor.origin.x} ${anchor.origin.y} L ${anchor.elbow.x} ${anchor.elbow.y} L ${anchor.stem.x} ${anchor.stem.y}`}
          fill="none"
          stroke={STEM_GRAY}
          strokeWidth={STEM_W}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <g
          transform={`translate(${anchor.origin.x} ${anchor.origin.y}) rotate(${anchor.tilt})${
            anchor.mirror ? ' scale(-1,1)' : ''
          }`}
        >
          <Block bb={bb} pair={pairFor(arm)} />
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

  const placed = d.fc !== 'none';
  const homodimer = d.fc !== 'heterofc';
  const frame = padFrame(d.fc, d.cLeft, d.cRight);

  return (
    <svg className="mol-svg" viewBox={`0 0 ${frame.w} ${frame.h}`} role="img" aria-label={title ?? 'Molecule glyph'}>
      <rect width={frame.w} height={frame.h} fill="#212121" />
      {placed && (
        <g transform={`translate(${FC.cx - COL_PITCH / 2} ${FC_BOTTOM})`}>
          <Block bb={d.fc === 'heterofc' ? 'heterofc' : 'homofc'} pair={NEUTRAL} homodimer={homodimer} />
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
      <Arm arm="left" />
      <Arm arm="right" />
      {placed &&
        (['left', 'right'] as const).map((side) => {
          const blocks = side === 'left' ? d.cLeft : d.cRight;
          const targets = side === 'left' ? d.cTargetLeft : d.cTargetRight;
          return blocks.map((kind, index) => {
            const origin = cTermOrigin(side, blocks.slice(0, index), kind);
            return (
              <g key={`${side}-${index}`} transform={`translate(${origin.x} ${origin.y})`}>
                <Block bb={kind} pair={slotColors(targets[index] ? slots.get(targets[index]) : undefined)} />
              </g>
            );
          });
        })}
    </svg>
  );
}
