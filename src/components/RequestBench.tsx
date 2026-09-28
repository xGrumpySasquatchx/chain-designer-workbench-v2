import type { ReactNode } from 'react';
import { bbDef } from '../model/blocks';
import { designPlaced, matchFormat } from '../model/design';
import { chainByArchetype, chainUid } from '../model/luma';
import type { LumaBook } from '../model/luma';
import type { DraftMolecule, LumaPanel, PadDesign, RequestDoc, Seed } from '../model/types';
import { DesignPad } from './DesignPad';

export function RequestRail({
  requests,
  activeId,
  query,
  expanded,
  onFold,
  fold,
  grip,
  onQuery,
  onNew,
  onOpen,
}: {
  requests: RequestDoc[];
  activeId: string | null;
  query: string;
  expanded: boolean;
  onFold: () => void;
  fold: ReactNode;
  grip: ReactNode;
  onQuery: (q: string) => void;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const shown = requests.filter((r) => {
    if (!q) return true;
    return [r.id, r.name, r.panelId ?? '', r.status].join(' ').toLowerCase().includes(q);
  });
  const drafts = shown.filter((r) => r.status === 'draft');
  const registered = shown.filter((r) => r.status === 'registered');

  return (
    <aside className={`panel rail${expanded ? '' : ' is-folded'}`} aria-label="Requests">
      <div className="panel-h" onClick={expanded ? undefined : onFold}>
        <h2>Requests</h2>
        <div className="panel-h-act">
          <button className="btn sm primary" type="button" onClick={onNew}>
            New
          </button>
          {fold}
        </div>
      </div>
      {expanded ? (
        <div className="rail-body">
          <div className="facet">
            <input
              className="search"
              type="search"
              placeholder="Search requests or panel UIDs"
              aria-label="Search requests"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
          </div>
          <RequestGroup title="Drafts" rows={drafts} activeId={activeId} onOpen={onOpen} />
          <RequestGroup title="Registered in Luma" rows={registered} activeId={activeId} onOpen={onOpen} />
        </div>
      ) : null}
      {expanded ? grip : null}
    </aside>
  );
}

function RequestGroup({
  title,
  rows,
  activeId,
  onOpen,
}: {
  title: string;
  rows: RequestDoc[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="src-folder">
      <div className="src-head" style={{ cursor: 'default' }}>
        <span className="src-name">{title}</span>
        <span className="src-n">{rows.length}</span>
      </div>
      {rows.length ? (
        rows.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`req-row${r.id === activeId ? ' on' : ''}`}
            onClick={() => onOpen(r.id)}
          >
            <span className="nm">{r.name}</span>
            <span className="sm">
              {r.panelId
                ? `${r.panelId} · ${r.drafts.length} molecule${r.drafts.length === 1 ? '' : 's'}`
                : `${r.drafts.length} molecule${r.drafts.length === 1 ? '' : 's'} · not registered`}
            </span>
          </button>
        ))
      ) : (
        <div className="src-empty">None</div>
      )}
    </div>
  );
}

export function PanelPick({
  panels,
  activeId,
  query,
  onQuery,
  onOpen,
}: {
  panels: LumaPanel[];
  activeId: string | null;
  query: string;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const shown = panels.filter((p) => {
    if (!q) return true;
    return [p.id, p.name, p.project, p.requestId].join(' ').toLowerCase().includes(q);
  });
  return (
    <div className="facet panel-pick">
      <h3>Registered panels</h3>
      <input
        className="search"
        type="search"
        placeholder="Search panels"
        aria-label="Search registered panels"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <div className="panel-pick-list">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`req-row${p.id === activeId ? ' on' : ''}`}
            onClick={() => onOpen(p.id)}
          >
            <span className="nm">{p.name}</span>
            <span className="sm">
              {p.id} · {p.moleculeIds.length} molecule{p.moleculeIds.length === 1 ? '' : 's'} · {p.chainIds.length}{' '}
              chain{p.chainIds.length === 1 ? '' : 's'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RequestBench({
  seed,
  book,
  request,
  design,
  onDesign,
  onRename,
  onTarget,
  onAdd,
  onRegister,
  onOpenMolecule,
}: {
  seed: Seed;
  book: LumaBook;
  request: RequestDoc | null;
  design: PadDesign;
  onDesign: (next: PadDesign) => void;
  onRename: (name: string) => void;
  onTarget: (index: 0 | 1, value: string) => void;
  onAdd: () => void;
  onRegister: () => void;
  onOpenMolecule: (draft: DraftMolecule) => void;
}) {
  const matched = matchFormat(seed, design);
  const chainIds = matched
    ? (design.light === 'common'
        ? matched.chains.filter((id) => {
            const fam = seed.chains.find((c) => c.id === id)?.fam;
            if (fam !== 'Light') return true;
            const lights = matched.chains.filter((x) => seed.chains.find((c) => c.id === x)?.fam === 'Light');
            const keep = lights.includes('CH-18') ? 'CH-18' : lights[0];
            return id === keep;
          })
        : matched.chains
      ).map((id) => ({ archetype: id, uid: chainUid(id), chain: chainByArchetype(book, id) }))
    : [];
  const locked = request?.status === 'registered';
  const sameShape = design.left !== 'empty' && design.left === design.right && design.targets[0] === design.targets[1];

  return (
    <main className="panel list req-bench">
      <div className="panel-h">
        <h2>Request</h2>
        {request ? (
          <div className="panel-h-act">
            <span className="mono">{request.id}</span>
            {request.panelId ? <span className="pill on">{request.panelId}</span> : <span className="pill">Draft</span>}
          </div>
        ) : null}
      </div>
      {!request ? (
        <div className="req-empty">
          <p>Create a request, design a molecule on the pad, then register the panel in Luma.</p>
          <p className="sm">Each panel, molecule, and chain receives a UID, and the chains constrain Level 1.</p>
        </div>
      ) : (
        <div className="req-body">
          <label className="req-name">
            Name
            <input
              className="search"
              value={request.name}
              disabled={locked}
              onChange={(e) => onRename(e.target.value)}
            />
          </label>
          <div className="req-stage">
            <DesignPad design={design} onChange={locked ? () => undefined : onDesign} />
            <aside className="fmt-card">
              <h3>Format</h3>
              <p className="nm">{matched ? matched.name : 'No catalog format yet'}</p>
              <p className="sm">{matched ? matched.id : 'Place a building block to match a format.'}</p>
              <div className={`status-banner ${matched && (design.fc !== 'none' || matched.fc === 'No') ? 'pass' : 'warn'}`}>
                {!designPlaced(design)
                  ? 'The canvas is empty.'
                  : sameShape
                    ? 'Symmetric arms call for a homodimeric Fc.'
                    : 'Asymmetric arms call for a heterodimeric Fc.'}
              </div>
              <div className="req-targets">
                <label>
                  Left target
                  <input
                    className="search"
                    value={design.targets[0]}
                    disabled={locked}
                    onChange={(e) => onTarget(0, e.target.value)}
                  />
                </label>
                <label>
                  Right target
                  <input
                    className="search"
                    value={design.targets[1]}
                    disabled={locked}
                    onChange={(e) => onTarget(1, e.target.value)}
                  />
                </label>
              </div>
              <h3>Chains this molecule will carry</h3>
              {chainIds.length ? (
                <ul className="uid-list">
                  {chainIds.map((c) => (
                    <li key={c.uid}>
                      <span className="mono">{c.uid}</span>
                      <span className="sm">
                        {c.archetype}
                        {c.chain?.constructId ? ` · ${c.chain.constructId}` : ''}
                        {c.chain ? ` · ${c.chain.role === 'reagent' ? 'reagent' : 'campaign'}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sm">Chain UIDs appear once the format matches.</p>
              )}
              <div className="req-actions">
                <button className="btn" type="button" disabled={locked || !matched} onClick={onAdd}>
                  Add molecule
                </button>
                <button
                  className="btn primary"
                  type="button"
                  disabled={locked || !request.drafts.some((d) => d.formatId)}
                  onClick={onRegister}
                >
                  {locked ? 'Registered' : 'Register panel in Luma'}
                </button>
              </div>
            </aside>
          </div>
          <section className="mol-list">
            <h3>
              Molecules <span className="src-n">{request.drafts.length}</span>
            </h3>
            {request.drafts.length ? (
              request.drafts.map((draft) => (
                <button key={draft.id} type="button" className="mol-row" onClick={() => onOpenMolecule(draft)}>
                  <PaletteMini design={draft.design} />
                  <span>
                    <span className="nm">{draft.name}</span>
                    <span className="sm">
                      {draft.id.startsWith('MOL-') ? draft.id : 'UID on registration'}
                      {draft.formatId ? ` · ${draft.formatId}` : ' · unmatched'}
                      {' · '}
                      {bbDef(draft.design.left).label}/{bbDef(draft.design.right).label}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="sm">No molecules yet. Design one and add it to this request.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function PaletteMini({ design }: { design: PadDesign }) {
  const bb = design.left !== 'empty' ? design.left : design.right !== 'empty' ? design.right : design.fc === 'none' ? 'empty' : design.fc;
  if (bb === 'empty') return <span className="mol-glyph" />;
  return (
    <span className="mol-glyph" aria-hidden="true">
      {bbDef(design.left).label.slice(0, 1)}
      {design.fc === 'heterofc' ? '≠' : design.fc === 'homofc' ? '=' : '·'}
      {bbDef(design.right).label.slice(0, 1)}
    </span>
  );
}
