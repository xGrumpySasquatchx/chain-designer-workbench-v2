import { useState, type ReactNode } from 'react';
import { designPlaced, matchFormat } from '../model/design';
import { chainByArchetype, chainUid, wellLabel } from '../model/luma';
import type { LumaBook } from '../model/luma';
import type { DraftMolecule, LumaPanel, PadDesign, RequestDoc, Seed } from '../model/types';
import { DesignPad } from './DesignPad';
import { MoleculeGlyph } from './MoleculeGlyph';

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
  onDeleteDraft,
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
  onDeleteDraft: (id: string) => void;
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
          <RequestGroup title="Drafts" rows={drafts} activeId={activeId} onOpen={onOpen} onDelete={onDeleteDraft} />
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
  onDelete,
}: {
  title: string;
  rows: RequestDoc[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="src-folder">
      <div className="src-head" style={{ cursor: 'default' }}>
        <span className="src-name">{title}</span>
        <span className="src-n">{rows.length}</span>
      </div>
      {rows.length ? (
        rows.map((r) => (
          <div key={r.id} className={`req-line${r.id === activeId ? ' on' : ''}`}>
            <button type="button" className="req-row" onClick={() => onOpen(r.id)}>
              <span className="nm">{r.name}</span>
              <span className="sm">
                {r.panelId
                  ? `${r.panelId} · ${r.drafts.length} molecule${r.drafts.length === 1 ? '' : 's'}`
                  : `${r.drafts.length} molecule${r.drafts.length === 1 ? '' : 's'} · not registered`}
              </span>
            </button>
            {onDelete ? (
              <button
                type="button"
                className="req-del"
                aria-label={`Delete ${r.name}`}
                onClick={() => onDelete(r.id)}
              >
                Delete
              </button>
            ) : null}
          </div>
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
  onOpenRequest,
  onDeleteDraft,
}: {
  seed: Seed;
  book: LumaBook;
  request: RequestDoc | null;
  design: PadDesign;
  onDesign: (next: PadDesign) => void;
  onRename: (name: string) => void;
  onTarget: (index: 0 | 1, value: string) => void;
  onAdd: () => void;
  onRegister: (draftIds: string[]) => void;
  onOpenMolecule: (draft: DraftMolecule) => void;
  onOpenRequest: (id: string, design?: PadDesign) => void;
  onDeleteDraft: (id: string) => void;
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
  const [grouped, setGrouped] = useState<string[]>([]);
  const groupKey = request?.id ?? '';
  const [forRequest, setForRequest] = useState(groupKey);
  if (forRequest !== groupKey) {
    setForRequest(groupKey);
    setGrouped([]);
  }
  const toggleGroup = (id: string) =>
    setGrouped((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const catalog = book.panels.filter((p) => p.id !== request?.panelId);

  return (
    <main className="panel list req-bench">
      <div className="panel-h">
        <h2>Request</h2>
        {request ? (
          <div className="panel-h-act">
            <span className="mono">{request.id}</span>
            {request.panelId ? <span className="pill on">{request.panelId}</span> : <span className="pill">Draft</span>}
            {!locked ? (
              <button className="btn sm" type="button" onClick={() => onDeleteDraft(request.id)}>
                Delete draft
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="req-body">
        {!request ? (
          <div className="req-empty">
            <p>These are the BioGlyph panels already in Luma. Open one, or create a request and design molecules to group into a new panel.</p>
            <p className="sm">Each panel, molecule, and chain has a UID. A grouped set of molecules is what receives the panel UID.</p>
          </div>
        ) : (
          <>
            <label className="req-name">
              Name
              <input
                className="search"
                value={request.name}
                disabled={locked}
                onChange={(e) => onRename(e.target.value)}
              />
            </label>
            <section className="glyph-panel working">
              <div className="glyph-head">
                <h3>
                  {request.name}{' '}
                  <span className="src-n">{request.drafts.length}</span>
                </h3>
                <span className="sm">{request.panelId ?? 'Panel UID assigned when this group is registered'}</span>
              </div>
              {request.drafts.length ? (
                locked && request.drafts.length > 8 ? (
                  <WellPlate
                    molecules={request.drafts}
                    onOpen={(index) => {
                      const draft = request.drafts[index];
                      if (draft) onOpenMolecule(draft);
                    }}
                  />
                ) : (
                <div className="glyph-grid">
                  {request.drafts.map((draft) => (
                    <MoleculeCard
                      key={draft.id}
                      name={draft.name}
                      uid={draft.id.startsWith('MOL-') ? draft.id : 'UID on registration'}
                      note={draft.formatId ?? 'unmatched'}
                      design={draft.design}
                      selected={grouped.includes(draft.id)}
                      onOpen={() => onOpenMolecule(draft)}
                      onToggle={locked ? undefined : () => toggleGroup(draft.id)}
                    />
                  ))}
                </div>
                )
              ) : (
                <p className="sm">Design a molecule below, then add it to this panel.</p>
              )}
              {!locked ? (
                <div className="req-actions">
                  <button className="btn" type="button" disabled={!matched} onClick={onAdd}>
                    Add molecule
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={!grouped.some((id) => request.drafts.find((d) => d.id === id)?.formatId)}
                    onClick={() => onRegister(grouped)}
                  >
                    Assign panel UID{grouped.length ? ` · ${grouped.length}` : ''}
                  </button>
                </div>
              ) : null}
            </section>
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
              </aside>
            </div>
          </>
        )}
        <section className="glyph-board">
          <h3>Panels in Luma</h3>
          {catalog.map((panel) => {
            const molecules = book.molecules.filter((m) => m.panelId === panel.id);
            return (
              <article key={panel.id} className="glyph-panel">
                <div className="glyph-head">
                  <h3>
                    {panel.name} <span className="mono">{panel.id}</span>
                  </h3>
                  <span className="sm">
                    {molecules.length} unique molecule{molecules.length === 1 ? '' : 's'} on a 96-well plate · {panel.chainIds.length} chain
                    {panel.chainIds.length === 1 ? '' : 's'}
                  </span>
                </div>
                <WellPlate
                  molecules={molecules}
                  onOpen={(index) => onOpenRequest(panel.requestId, molecules[index]?.design)}
                />
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function WellPlate({
  molecules,
  onOpen,
}: {
  molecules: { id: string; name: string }[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="plate" role="grid" aria-label={`${molecules.length} unique molecules on a 96-well plate`}>
      {Array.from({ length: 96 }, (_, index) => {
        const molecule = molecules[index];
        const well = wellLabel(index);
        if (!molecule) {
          return (
            <span key={well} className="well empty">
              {well}
            </span>
          );
        }
        return (
          <button
            key={molecule.id}
            type="button"
            className="well filled"
            title={`${well} · ${molecule.name}`}
            aria-label={`${well} ${molecule.name}`}
            onClick={() => onOpen(index)}
          >
            {well}
          </button>
        );
      })}
    </div>
  );
}

function MoleculeCard({
  name,
  uid,
  note,
  design,
  selected,
  onOpen,
  onToggle,
}: {
  name: string;
  uid: string;
  note: string;
  design: PadDesign;
  selected?: boolean;
  onOpen: () => void;
  onToggle?: () => void;
}) {
  return (
    <div className={`glyph-card${selected ? ' on' : ''}`}>
      <button type="button" className="glyph-open" onClick={onOpen}>
        <MoleculeGlyph design={design} title={name} />
        <span className="nm">{name}</span>
        <span className="sm">
          {uid} · {note}
        </span>
      </button>
      {onToggle ? (
        <label className="glyph-pick">
          <input type="checkbox" checked={!!selected} onChange={onToggle} />
          Group
        </label>
      ) : null}
    </div>
  );
}
