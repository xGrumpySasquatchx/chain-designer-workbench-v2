import { useState } from 'react';
import type { ConstructCombination } from '../model/combinations';

export function ConstructCombinations({
  combinations,
  inserts,
  separate,
  customized,
  onGroup,
  onUngroup,
  onReset,
}: {
  combinations: ConstructCombination[];
  inserts: Record<string, string>;
  separate: boolean;
  customized: boolean;
  onGroup: (ids: string[]) => void;
  onUngroup: (ids: string[]) => void;
  onReset: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const visible = picked.filter((id) => combinations.some((combo) => combo.vectorIds.includes(id)));
  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  const sameCombo =
    visible.length >= 2 &&
    combinations.some((combo) => visible.every((id) => combo.vectorIds.includes(id)));
  const canUngroup = visible.some((id) => {
    const combo = combinations.find((item) => item.vectorIds.includes(id));
    return (combo?.vectorIds.length ?? 0) > 1;
  });

  if (!combinations.length) {
    return (
      <section className="ratio-plan" aria-label="Construct combinations">
        <h3>Construct combinations</h3>
        <p className="sm">Include a construct. Related constructs are transfected together.</p>
      </section>
    );
  }

  return (
    <section className="ratio-plan" aria-label="Construct combinations">
      <div className="ratio-head">
        <div>
          <h3>Construct combinations</h3>
          <p className="sm">
            {combinations.length === 1
              ? 'These constructs are one co-transfection.'
              : `${combinations.length} transfections. Constructs in one combination go in together.`}{' '}
            {separate && !customized ? 'The catalog starts them as separate transfections.' : ''}
            Relate constructs to co-transfect them. Ungroup a construct to give it its own transfection.
          </p>
        </div>
        <div className="combo-actions">
          <button className="btn sm" type="button" disabled={visible.length < 2 || sameCombo} onClick={() => onGroup(visible)}>
            Relate
          </button>
          <button className="btn sm" type="button" disabled={!canUngroup} onClick={() => onUngroup(visible)}>
            Ungroup
          </button>
          <button className="btn sm" type="button" disabled={!customized} onClick={onReset}>
            Use catalog grouping
          </button>
        </div>
      </div>
      <div className="combo-list">
        {combinations.map((combo) => (
          <div className="combo" key={combo.id}>
            <div className="combo-head">
              <span className="nm">{combo.label}</span>
              {combo.vectorIds.length > 1 ? (
                <button className="btn sm" type="button" onClick={() => onUngroup(combo.vectorIds)}>
                  Ungroup
                </button>
              ) : combinations.length > 1 ? (
                <label className="sm">
                  Relate to
                  <select
                    className="search"
                    value=""
                    aria-label={`Relate ${combo.vectorIds[0]} to another combination`}
                    onChange={(e) => {
                      const other = combinations.find((item) => item.id === e.target.value);
                      if (other) onGroup([...combo.vectorIds, ...other.vectorIds]);
                    }}
                  >
                    <option value="">Choose</option>
                    {combinations
                      .filter((item) => item.id !== combo.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="combo-members">
              {combo.vectorIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`combo-member${visible.includes(id) ? ' on' : ''}`}
                  aria-pressed={visible.includes(id)}
                  onClick={() => toggle(id)}
                >
                  <span className="mono">{id}</span>
                  <span className="sm">{inserts[id] ?? ''}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
