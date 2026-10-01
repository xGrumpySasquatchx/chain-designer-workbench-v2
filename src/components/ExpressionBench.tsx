import type { ReactNode } from 'react';
import {
  CODON_METHODS,
  HOSTS,
  SCENARIO_HANDOFF,
  SCENARIOS,
  STABLE_POOL,
  TARGET_CLASSES,
  codonTableName,
  hostById,
  targetFit,
  type FitRate,
} from '../model/expression';
import type {
  CodonMethod,
  ExpressionMode,
  ExpressionPlan,
  ExpressionRegistration,
  HostId,
  TargetClass,
} from '../model/types';

function Rate({ rate, note }: { rate: FitRate; note?: string }) {
  const label = rate === 'good' ? 'Good' : rate === 'moderate' ? 'Moderate' : 'Poor';
  return (
    <span className={`fit fit-${rate}`}>
      {label}
      {note ? <span className="fit-note">{note}</span> : null}
    </span>
  );
}

export function ExpressionRail({
  plan,
  expanded,
  onFold,
  fold,
  grip,
  onTarget,
  onHost,
  onMode,
}: {
  plan: ExpressionPlan;
  expanded: boolean;
  onFold: () => void;
  fold: ReactNode;
  grip: ReactNode;
  onTarget: (target: TargetClass) => void;
  onHost: (host: HostId) => void;
  onMode: (mode: ExpressionMode) => void;
}) {
  return (
    <aside className={`panel rail${expanded ? '' : ' is-folded'}`} aria-label="Expression">
      <div className="panel-h" onClick={expanded ? undefined : onFold}>
        <h2>Expression</h2>
        <div className="panel-h-act">{fold}</div>
      </div>
      {expanded ? (
        <div className="rail-body">
          <div className="facet">
            <h3>Target class</h3>
            {TARGET_CLASSES.map((target) => (
              <label key={target.id} className="preset">
                <input
                  type="radio"
                  name="target-class"
                  checked={plan.targetClass === target.id}
                  onChange={() => onTarget(target.id)}
                />
                <span className="pn">{target.label}</span>
              </label>
            ))}
          </div>
          <div className="facet">
            <h3>Production scenario</h3>
            {SCENARIOS.map((scenario) => (
              <label key={scenario.id} className="preset">
                <input
                  type="radio"
                  name="expression-mode"
                  checked={plan.mode === scenario.id}
                  onChange={() => onMode(scenario.id)}
                />
                <span className="pn">{scenario.name}</span>
              </label>
            ))}
          </div>
          <div className="src-folder">
            <div className="src-head" style={{ cursor: 'default' }}>
              <span className="src-name">Expression system</span>
              <span className="src-n">{HOSTS.length}</span>
            </div>
            {HOSTS.map((host) => (
              <button
                key={host.id}
                type="button"
                className={`req-row${plan.host === host.id ? ' on' : ''}`}
                onClick={() => onHost(host.id)}
              >
                <span className="nm">{host.name}</span>
                <span className="sm">{host.detail}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {expanded ? grip : null}
    </aside>
  );
}

export function ExpressionBench({
  plan,
  slots,
  registrations,
  onTarget,
  onHost,
  onCodonTable,
  onCodon,
  onMode,
}: {
  plan: ExpressionPlan;
  slots: { key: string; label: string; domain: string; vector: string; insert: string }[];
  registrations: ExpressionRegistration[];
  onTarget: (target: TargetClass) => void;
  onHost: (host: HostId) => void;
  onCodonTable: (id: string) => void;
  onCodon: (method: CodonMethod) => void;
  onMode: (mode: ExpressionMode) => void;
}) {
  const host = plan.host ? hostById(plan.host) : null;
  const fit = host ? targetFit(host, plan.targetClass) : null;
  const tableName = host && plan.codonTable ? codonTableName(host.id, plan.codonTable) : '';
  const latest = registrations[0];

  return (
    <main className="panel list req-bench">
      <div className="panel-h">
        <h2>Expression</h2>
        <span className="sm">Level 5</span>
      </div>
      <div className="req-body">
        <p className="exp-lead">
          Choose the protein class first. That fit narrows the expression system, and the system fixes the vector
          elements and the codon table used to optimize each insert.
        </p>

        <section className="glyph-panel">
          <h3>1. Target protein class</h3>
          <div className="exp-seg" role="radiogroup" aria-label="Target protein class">
            {TARGET_CLASSES.map((target) => (
              <button
                key={target.id}
                type="button"
                className={plan.targetClass === target.id ? 'on' : ''}
                aria-pressed={plan.targetClass === target.id}
                onClick={() => onTarget(target.id)}
              >
                {target.label}
              </button>
            ))}
          </div>
          <p className="sm">
            Solubility and topology belong to the target. A membrane protein downgrades E. coli before any cassette
            is chosen.
          </p>
        </section>

        <section className="glyph-panel">
          <h3>2. Expression system</h3>
          <div className="exp-table-wrap">
            <table className="exp-table">
              <thead>
                <tr>
                  <th>Element</th>
                  {HOSTS.map((item) => (
                    <th key={item.id} className={plan.host === item.id ? 'on' : ''}>
                      <button type="button" onClick={() => onHost(item.id)}>
                        {item.name}
                        <span>{item.detail}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="exp-sect">
                  <td colSpan={6}>Vector elements</td>
                </tr>
                {(
                  [
                    ['Promoter', 'promoter'],
                    ['Translation start', 'start'],
                    ['Termination', 'termination'],
                    ['Secretion signal', 'secretion'],
                    ['Selection', 'selection'],
                  ] as const
                ).map(([label, key]) => (
                  <tr key={key}>
                    <th>{label}</th>
                    {HOSTS.map((item) => (
                      <td key={item.id} className={plan.host === item.id ? 'on' : ''}>
                        {item[key]}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="exp-sect">
                  <td colSpan={6}>Target class fit</td>
                </tr>
                {(
                  [
                    ['Soluble protein', 'soluble', plan.targetClass !== 'membrane'],
                    ['Membrane protein', 'membrane', plan.targetClass === 'membrane'],
                  ] as const
                ).map(([label, key, active]) => (
                  <tr key={key} className={active && plan.targetClass ? 'exp-active' : ''}>
                    <th>{label}</th>
                    {HOSTS.map((item) => {
                      const cell = item[key];
                      return (
                        <td key={item.id} className={plan.host === item.id ? 'on' : ''}>
                          <Rate rate={cell.rate} note={cell.note} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="exp-sect">
                  <td colSpan={6}>Practical</td>
                </tr>
                <tr>
                  <th>Scale / throughput</th>
                  {HOSTS.map((item) => (
                    <td key={item.id} className={plan.host === item.id ? 'on' : ''}>
                      {item.scaleRate ? <Rate rate={item.scaleRate} note={item.scale} /> : item.scale}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>Best used for</th>
                  {HOSTS.map((item) => (
                    <td key={item.id} className={plan.host === item.id ? 'on' : ''}>
                      {item.best}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {host && fit ? (
            <p className="sm">
              {host.name} for this target: {fit.rate === 'good' ? 'a good fit' : fit.rate === 'moderate' ? 'a moderate fit' : 'a poor fit'}.{' '}
              {fit.note}. {plan.targetClass === 'intracellular' ? 'Cytosolic expression leaves the secretion signal off the cassette.' : ''}
            </p>
          ) : (
            <p className="sm">Select a target class and a system. The highlighted column is the one that will be registered.</p>
          )}
          {plan.host === 'cellfree' ? (
            <p className="sm">
              Cell-free expression uses a lysate, so there is no host to transform and no selection marker. It suits a
              screening panel, including toxic and membrane proteins in nanodiscs, and usually comes before a cellular
              production system.
            </p>
          ) : null}
        </section>

        <section className="glyph-panel">
          <h3>3. Production scenario</h3>
          <p className="sm">
            Transient expression is the discovery default. Stable clonal lines are the manufacturing path. The figures
            below are for mammalian antibody production in HEK293 and CHO.
          </p>
          <div className="exp-scenarios" role="radiogroup" aria-label="Production scenario">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className={plan.mode === scenario.id ? 'on' : ''}
                aria-pressed={plan.mode === scenario.id}
                onClick={() => onMode(scenario.id)}
              >
                <span className="nm">{scenario.name} expression</span>
                <span className="sm">{scenario.posture}</span>
              </button>
            ))}
          </div>
          <div className="exp-table-wrap">
            <table className="exp-compare">
              <thead>
                <tr>
                  <th> </th>
                  {SCENARIOS.map((scenario) => (
                    <th key={scenario.id} className={plan.mode === scenario.id ? 'on' : ''}>
                      {scenario.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Iteration', 'iteration'],
                    ['Volume', 'volume'],
                    ['Output', 'output'],
                    ['Selection', 'selection'],
                    ['Best used for', 'best'],
                  ] as const
                ).map(([label, key]) => (
                  <tr key={key}>
                    <th>{label}</th>
                    {SCENARIOS.map((scenario) => (
                      <td key={scenario.id} className={plan.mode === scenario.id ? 'on' : ''}>
                        {scenario[key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.mode ? <p className="sm">{SCENARIOS.find((scenario) => scenario.id === plan.mode)?.mechanism}</p> : null}
          <p className="sm">{STABLE_POOL}</p>
          <p className="sm">{SCENARIO_HANDOFF}</p>
        </section>

        <section className="glyph-panel">
          <h3>4. Codon optimization</h3>
          {host ? (
            <>
              <label className="req-name">
                Codon table for {host.name}
                {host.tables.length > 1 ? (
                  <select className="search" value={plan.codonTable ?? host.tables[0].id} onChange={(e) => onCodonTable(e.target.value)}>
                    {host.tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="nm">{host.tables[0].name}</span>
                )}
              </label>
              <div className="exp-methods">
                {CODON_METHODS.map((method) => (
                  <label key={method.id} className={`exp-method${plan.codon === method.id ? ' on' : ''}`}>
                    <input
                      type="radio"
                      name="codon-method"
                      checked={plan.codon === method.id}
                      onChange={() => onCodon(method.id)}
                    />
                    <span>
                      <span className="nm">{method.label}</span>
                      <span className="sm">{method.note}</span>
                    </span>
                  </label>
                ))}
              </div>
              <h3>Inserts this choice applies to</h3>
              {slots.length ? (
                <ul className="uid-list">
                  {slots.map((slot) => (
                    <li key={slot.key}>
                      <span className="nm">{slot.insert}</span>
                      <span className="sm">
                        {slot.domain}
                        {slot.label ? ` · ${slot.label}` : ''} · {slot.vector}
                        {tableName ? ` · optimized for ${tableName}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sm">Include a chain on Level 1. Its inserts are what this codon table recodes.</p>
              )}
              <p className="sm">
                Vector elements stay on the construct. {host.name} sets the promoter, translation start, termination,
                secretion signal, and selection around the recoded insert.
              </p>
            </>
          ) : (
            <p className="sm">Choose an expression system. The codon table and the optimization method follow that host.</p>
          )}
        </section>

        {latest ? (
          <section className="glyph-panel">
            <h3>Registered</h3>
            <ul className="uid-list">
              {registrations.map((record) => (
                <li key={record.id}>
                  <span className="nm">{record.id}</span>
                  <span className="sm">
                    {SCENARIOS.find((scenario) => scenario.id === record.mode)?.name} · {hostById(record.host).name} ·{' '}
                    {CODON_METHODS.find((method) => method.id === record.codon)?.label} ·{' '}
                    {record.vectorIds.length} construct{record.vectorIds.length === 1 ? '' : 's'} · {record.registeredAt}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
