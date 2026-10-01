import { useId, useState } from 'react';
import {
  constructCollection,
  constructElementString,
  replacedConstructs,
  searchConstructs,
} from '../model/constructs';
import type { Chain, Vector } from '../model/types';

export function ConstructLibrary({
  vectors,
  chains,
  buildIds,
  recommendedIds,
  onPick,
}: {
  vectors: Vector[];
  chains: Chain[];
  buildIds: Set<string>;
  recommendedIds: Set<string>;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const box = useId();
  const hits = searchConstructs(vectors, query);
  const typed = query.trim().length > 0;

  return (
    <div className="facet con-lib">
      <label className="vsearch-lab" htmlFor={box}>
        Search Construct Library
      </label>
      <input
        id={box}
        className="search"
        type="search"
        placeholder="Construct ID, IgG1, Puromycin, or Heavy chain"
        aria-label="Search Construct Library"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {typed && hits.length ? (
        <div className="con-lib-list">
          {hits.map((vector) => {
            const inBuild = buildIds.has(vector.id);
            const recommended = recommendedIds.has(vector.id) && inBuild;
            const replaced = replacedConstructs(chains, vector.id, buildIds);
            const hosts = chains.filter((chain) => chain.vectors.includes(vector.id));
            return (
              <div className={`con-lib-hit${inBuild ? ' on' : ''}`} key={vector.id}>
                <span className="nm mono">{vector.id}</span>
                <span className="sm">
                  {constructCollection(vector)}
                  {hosts.length ? ` · ${hosts.map((chain) => chain.name).join(', ')}` : ''}
                </span>
                <span className="sm">{constructElementString(vector)}</span>
                {inBuild ? (
                  <span className="pill on">{recommended ? 'Recommended' : 'In the build'}</span>
                ) : (
                  <>
                    {replaced.length ? <span className="sm">Replaces {replaced.join(', ')}</span> : null}
                    <button className="btn sm" type="button" onClick={() => onPick(vector.id)}>
                      Use this construct
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty" style={{ margin: '8px 0 0' }}>
          {typed
            ? 'Nothing matches that search.'
            : 'Search a Construct ID, elements separated by commas, or a Construct Collection.'}
        </p>
      )}
    </div>
  );
}
