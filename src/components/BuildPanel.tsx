import { useState, type ReactNode } from 'react';
import { buildListText, gaalCsv, gaalJobs } from '../model/gaal';
import { variantList } from '../model/library';
import { backboneIds, buildSlots, slotChip } from '../model/slots';
import type { Grain, Model, Preset, Seed, Sel } from '../model/types';

function copy(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  return Promise.reject();
}

export function BuildPanel({
  seed,
  model,
  sel,
  variants,
  assign,
  presets,
  onReset,
  onRuleOut,
  onRestore,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  expanded = true,
  onFold,
  fold,
  grip,
}: {
  seed: Seed;
  model: Model;
  sel: Sel;
  variants: string;
  assign: Record<string, Record<string, string>>;
  presets: Preset[];
  onReset: () => void;
  onRuleOut: (id: string) => void;
  onRestore: (grain: Grain, id: string) => void;
  onSavePreset: (name: string) => void;
  onApplyPreset: (i: number) => void;
  onDeletePreset: (i: number) => void;
  expanded?: boolean;
  onFold?: () => void;
  fold?: ReactNode;
  grip?: ReactNode;
}) {
  const [presetName, setPresetName] = useState('');
  const [copied, setCopied] = useState('');
  const [view, setView] = useState<'info' | 'backbone' | 'handoff' | 'saved'>('info');
  const V = Object.fromEntries(seed.vectors.map((v) => [v.id, v]));
  const back = backboneIds(seed, model.buildV);
  const slots = buildSlots(seed, model.buildV);
  const n = variantList(variants).length;
  const nv = n || 1;
  const plas = back.filter((id) => V[id]?.needsInsert === 'Yes').length;
  const outs: ['fmt' | 'chn' | 'con' | 'mut', string][] = [];
  (['fmt', 'chn', 'con', 'mut'] as const).forEach((g) =>
    Object.keys(sel[g]).forEach((id) => {
      if (sel[g][id] === 'out') outs.push([g, id]);
    }),
  );

  const flash = (label: string, text: string) => {
    copy(text).catch(() => console.log(text));
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1600);
  };

  return (
    <aside className={`panel basket${expanded ? '' : ' is-folded'}`} aria-label="Document viewer">
      <div className="panel-h" onClick={expanded ? undefined : onFold}>
        <h2>Viewer</h2>
        <div className="panel-h-act">
          <button className="btn sm" type="button" onClick={onReset}>
            Clear
          </button>
          {fold}
        </div>
      </div>
      <div className="viewer-tabs" role="tablist" aria-label="Viewer">
        {(
          [
            ['info', 'Info'],
            ['backbone', 'Backbone'],
            ['handoff', 'Text'],
            ['saved', 'Saved'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className="viewer-tab"
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="viewer-body">
      {view === 'info' ? (
        <>
          {(
            [
              ['Formats included', model.inF.size],
              ['Chains in the build', model.buildC.size],
              ['Mutation sets', model.buildM.size],
              ['Plasmids in the backbone', model.buildV.size],
              ['V regions to supply', slots.length * nv],
            ] as [string, number][]
          ).map(([k, v]) => (
            <div className="metric" key={k}>
              <span className="k">{k}</span>
              <span className={`v ${v === 0 ? 'z' : ''}`}>{v}</span>
            </div>
          ))}
          {model.conflicts.slice(0, 4).map((c) => (
            <div className="note" key={c}>
              <strong>Check</strong> {c}
            </div>
          ))}
          {outs.length > 0 ? (
            <div className="sec">
              <h3>Ruled out</h3>
              <div className="chips">
                {outs.map(([g, id]) => (
                  <span className="chip o" key={`${g}-${id}`}>
                    {id}
                    <button type="button" title="Restore" onClick={() => onRestore(g, id)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="sec" style={{ borderBottom: 0 }}>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                flash(
                  'Copy build list',
                  buildListText(
                    seed,
                    model.inF,
                    model.buildV,
                    variants,
                    outs.map(([, id]) => id),
                    model.conflicts,
                  ),
                )
              }
            >
              {copied === 'Copy build list' ? 'Copied' : 'Copy build list'}
            </button>
          </div>
        </>
      ) : null}
      {view === 'backbone' ? (
        <div className="sec" style={{ borderBottom: 0 }}>
          <h3>Backbone</h3>
          {back.length ? (
            <div className="chips">
              {back.map((id) => {
                const sl = slotChip(V[id]);
                return (
                  <span className="chip" key={id}>
                    {id}
                    {sl ? <span style={{ opacity: 0.7 }}>{sl}</span> : null}
                    <button type="button" title="Rule out" onClick={() => onRuleOut(id)}>
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="empty">Include a format on Level 1 and its plasmids land here.</div>
          )}
        </div>
      ) : null}
      {view === 'handoff' ? (
        <div className="sec" style={{ borderBottom: 0 }}>
          <h3>Text view</h3>
          <p style={{ margin: '0 0 7px', fontSize: 12, color: 'var(--ink-2)' }}>
            {slots.length
              ? `${n ? `${n} build${n > 1 ? 's' : ''}` : '1 build'} x ${slots.length} V region${
                  slots.length > 1 ? 's' : ''
                } = ${nv * slots.length} parts into ${nv * plas} assemblies.`
              : 'Include a format first.'}
          </p>
          <div className="row">
            <button
              className="btn sm"
              type="button"
              onClick={() =>
                flash('Copy GaaL job', JSON.stringify(gaalJobs(seed, model.buildV, variants, assign), null, 2))
              }
            >
              {copied === 'Copy GaaL job' ? 'Copied' : 'Copy GaaL job'}
            </button>
            <button
              className="btn sm"
              type="button"
              onClick={() => flash('Copy as CSV', gaalCsv(seed, model.buildV, variants, assign))}
            >
              {copied === 'Copy as CSV' ? 'Copied' : 'Copy as CSV'}
            </button>
          </div>
          <p style={{ margin: '7px 0 0', fontSize: 11.5, color: 'var(--ink-3)' }}>
            Emits the assembly spec. Point it at your Geneious Prime library to run the builds.
          </p>
        </div>
      ) : null}
      {view === 'saved' ? (
        <div className="sec" style={{ borderBottom: 0 }}>
          <h3>Saved backbones</h3>
          <div className="row">
            <input
              className="search"
              placeholder="Name this setup"
              style={{ flex: 1, minWidth: 110 }}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <button
              className="btn sm"
              type="button"
              onClick={() => {
                if (!presetName.trim()) return;
                onSavePreset(presetName.trim());
                setPresetName('');
              }}
            >
              Save
            </button>
          </div>
          <div style={{ marginTop: 6 }}>
            {presets.length ? (
              presets.map((p, i) => (
                <div className="preset" key={`${p.name}-${i}`}>
                  <span className="pn">{p.name}</span>
                  <span className="pm">{p.n}p</span>
                  <button className="btn sm" type="button" onClick={() => onApplyPreset(i)}>
                    Apply
                  </button>
                  <button className="btn sm" type="button" title="Delete" onClick={() => onDeletePreset(i)}>
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="empty">Save a setup once, reapply it on every run.</div>
            )}
          </div>
        </div>
      ) : null}
      </div>
      {expanded ? grip : null}
    </aside>
  );
}

