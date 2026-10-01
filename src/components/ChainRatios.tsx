import { useEffect, useState } from 'react';
import { formatParts, ratioShare, type ChainRatioPlan } from '../model/ratio';

function PartsField({
  parts,
  label,
  onChange,
}: {
  parts: number;
  label: string;
  onChange: (parts: number) => void;
}) {
  const [text, setText] = useState(formatParts(parts));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(formatParts(parts));
  }, [parts, focused]);
  return (
    <input
      className="ratio-input"
      type="text"
      inputMode="decimal"
      value={focused ? text : formatParts(parts)}
      aria-label={label}
      onFocus={() => {
        setFocused(true);
        setText(formatParts(parts));
      }}
      onBlur={() => {
        setFocused(false);
        const next = Number(text);
        if (text.trim() && Number.isFinite(next) && next >= 0) onChange(next);
        else setText(formatParts(parts));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const next = Number(raw);
        if (raw.trim() && Number.isFinite(next) && next >= 0) onChange(next);
      }}
    />
  );
}

export function ChainRatios({
  plan,
  split,
  onChange,
  onReset,
}: {
  plan: ChainRatioPlan;
  split?: boolean;
  onChange: (chainId: string, parts: number) => void;
  onReset: () => void;
}) {
  if (!plan.rows.length) {
    return (
      <section className="ratio-plan">
        <h3>Chain ratio</h3>
        <p className="sm">Include a chain on Level 1. Each chain in the build gets a part count in the transfection mix.</p>
      </section>
    );
  }
  const total = plan.rows.reduce((sum, row) => sum + row.parts, 0);
  const changed = plan.rows.some((row) => row.overridden);

  return (
    <section className="ratio-plan" aria-label="Chain ratio">
      <div className="ratio-head">
        <div>
          <h3>Chain ratio</h3>
          <p className="sm">
            {plan.catalog
              ? `Catalog ${plan.formatId}: ${plan.catalog}.`
              : 'This set of chains has no catalog ratio yet.'}{' '}
            {plan.separate || split
              ? 'These chains are split across transfections. Parts still record the planned mix for each chain.'
              : 'Parts are the share of each chain in one co-transfection.'}
            {plan.note && !plan.separate ? ` ${plan.note}.` : ''}
          </p>
        </div>
        {plan.catalog ? (
          <button className="btn sm" type="button" disabled={!changed} onClick={onReset}>
            Use catalog ratio
          </button>
        ) : null}
      </div>
      <div className="ratio-rows">
        {plan.rows.map((row) => (
          <div className="ratio-row" key={row.chainId}>
            <span>
              <span className="nm">{row.name}</span>
              <span className="sm">
                {row.chainId}
                {row.vectors.length ? ` · ${row.vectors.join(', ')}` : ' · no construct in the build yet'}
              </span>
            </span>
            <span className="sm">{plan.separate ? 'Separate mix' : ratioShare(row.parts, total)}</span>
            <PartsField
              parts={row.parts}
              label={`Parts for ${row.name}`}
              onChange={(parts) => onChange(row.chainId, parts)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
