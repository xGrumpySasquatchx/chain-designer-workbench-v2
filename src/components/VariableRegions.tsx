import { cellValue, libForType, parseLibrary, variantRows } from '../model/library';
import type { BuildSlot } from '../model/types';

export function VariableRegions({
  slots,
  variants,
  library,
  assign,
  onVariants,
  onAssign,
}: {
  slots: BuildSlot[];
  variants: string;
  library: string;
  assign: Record<string, Record<string, string>>;
  onVariants: (text: string) => void;
  onAssign: (variant: string, key: string, value: string) => void;
}) {
  if (!slots.length) {
    return (
      <main className="panel list">
        <div className="panel-h">
          <h2>Variable regions</h2>
          <span className="count">0 slots</span>
        </div>
        <div style={{ padding: '18px 13px', color: 'var(--ink-3)', fontSize: 13 }}>
          No variable domains needed yet. Include a format on Level 1 and its V slots appear here.
        </div>
      </main>
    );
  }

  const lib = parseLibrary(library);
  const rows = variantRows(variants);
  const types = ['VH', 'VL', 'VHH', 'ORF'] as const;

  return (
    <main className="panel list">
      <div className="panel-h">
        <h2>Variable regions</h2>
        <span className="count">{slots.length} slots</span>
      </div>
      <div className="sec" style={{ borderBottom: '1px solid var(--rule)' }}>
        <h3>Slots this build needs</h3>
        <div className="rows">
          <table>
            <thead>
              <tr>
                <th>Slot</th>
                <th>Domain</th>
                <th>Arm</th>
                <th>Goes into</th>
                <th>Produces</th>
                <th>Watch for</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.key}>
                  <td className="idc">{s.label}</td>
                  <td>
                    {s.t}
                    {s.pos ? <span className="sm">{s.pos}</span> : null}
                  </td>
                  <td>{s.arm ? s.arm : <span className="pill">single</span>}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {s.vec}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {s.product}
                  </td>
                  <td>{s.note ? <span className="pill blk">{s.note}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="sec" style={{ borderBottom: '1px solid var(--rule)' }}>
        <h3>Builds to make</h3>
        <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--ink-2)' }}>
          One name per line. Every one gets the same backbone, so only these V regions change.
        </p>
        <textarea
          className="search"
          style={{ maxWidth: 420 }}
          placeholder={'aTfR1-01\naTfR1-02\naTfR1-03'}
          value={variants}
          onChange={(e) => onVariants(e.target.value)}
        />
      </div>
      <div className="sec" style={{ borderBottom: 0 }}>
        <h3>Assign a V region to every slot</h3>
        {types.map((t) => (
          <datalist id={`lib${t}`} key={t}>
            {libForType(lib, t).map((e) => (
              <option key={e.name} value={e.name} />
            ))}
          </datalist>
        ))}
        <datalist id="libAll">
          {lib.map((e) => (
            <option key={e.name} value={e.name} />
          ))}
        </datalist>
        <div className="rows">
          <table>
            <thead>
              <tr>
                <th>Build</th>
                {slots.map((s) => (
                  <th key={s.key}>
                    {s.label}
                    <span className="sm mono" style={{ fontWeight: 400 }}>
                      {s.vec}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((vr) => (
                <tr key={vr}>
                  <td className="nm">{vr}</td>
                  {slots.map((s) => (
                    <td key={s.key}>
                      <input
                        className="search"
                        style={{ minWidth: 150 }}
                        list={lib.length ? (types.includes(s.t) ? `lib${s.t}` : 'libAll') : undefined}
                        value={cellValue(assign, vr, s.key, s.label)}
                        onChange={(e) => onAssign(vr, s.key, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
