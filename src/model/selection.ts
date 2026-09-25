import type { Mark, Marks, Model, Seed, Sel } from './types';

function marked(rec: Marks, value: Mark): Set<string> {
  return new Set(Object.keys(rec).filter((id) => rec[id] === value));
}

export function emptySel(): Sel {
  return { fmt: {}, chn: {}, con: {}, mut: {} };
}

/** Pure cascade over `sel` and the seed. Including something never hides its siblings. */
export function resolve(seed: Seed, sel: Sel): Model {
  const inF = marked(sel.fmt, 'in');
  const outF = marked(sel.fmt, 'out');
  const inC = marked(sel.chn, 'in');
  const outC = marked(sel.chn, 'out');
  const inV = marked(sel.con, 'in');
  const outV = marked(sel.con, 'out');

  const byChain = Object.fromEntries(seed.chains.map((c) => [c.id, c]));
  const byVec = Object.fromEntries(seed.vectors.map((v) => [v.id, v]));

  let pf = seed.formats.filter((f) => !outF.has(f.id));
  if (inF.size) pf = pf.filter((f) => inF.has(f.id));

  const chainPool = new Set<string>();
  pf.forEach((f) => f.chains.forEach((c) => chainPool.add(c)));
  const reachC = new Set([...chainPool].filter((c) => !outC.has(c)));
  inC.forEach((c) => reachC.add(c));

  const claimC = new Set<string>();
  seed.formats
    .filter((f) => inF.has(f.id))
    .forEach((f) => {
      const fv = new Set(f.vectors);
      f.chains.forEach((c) => {
        if (outC.has(c)) return;
        const listed = byChain[c]?.vectors ?? [];
        if (listed.some((v) => fv.has(v))) claimC.add(c);
      });
    });
  const buildC = new Set([...claimC, ...inC]);

  const VC: Record<string, string[]> = {};
  seed.chains.forEach((c) =>
    c.vectors.forEach((v) => {
      (VC[v] ??= []).push(c.id);
    }),
  );
  const chainOk = (v: string) => !VC[v] || VC[v].some((c) => !outC.has(c));

  const fvec = new Set<string>();
  pf.forEach((f) => {
    f.vectors.forEach((v) => fvec.add(v));
    (f.alt ?? []).forEach((v) => fvec.add(v));
  });
  inC.forEach((c) => (byChain[c]?.vectors ?? []).forEach((v) => { if (byVec[v]) fvec.add(v); }));

  const cvec = new Set<string>();
  [...reachC].forEach((c) => (byChain[c]?.vectors ?? []).forEach((v) => cvec.add(v)));

  const reachV = new Set(
    seed.vectors.map((v) => v.id).filter((v) => fvec.has(v) && cvec.has(v) && !outV.has(v)),
  );
  inV.forEach((v) => reachV.add(v));

  const claimV = new Set<string>();
  seed.formats
    .filter((f) => inF.has(f.id))
    .forEach((f) =>
      f.vectors.forEach((v) => {
        if (!outV.has(v) && chainOk(v)) claimV.add(v);
      }),
    );
  inC.forEach((c) => {
    const opts = (byChain[c]?.vectors ?? []).filter((v) => byVec[v] && !outV.has(v));
    if (opts.length === 1) claimV.add(opts[0]);
  });
  const buildV = new Set([...claimV, ...inV]);

  const conflicts: string[] = [];
  seed.partners.forEach(([a, b]) => {
    const A = buildV.has(a);
    const B = buildV.has(b);
    if (A && outV.has(b)) conflicts.push(`${a} needs ${b}, which you ruled out.`);
    else if (B && outV.has(a)) conflicts.push(`${b} needs ${a}, which you ruled out.`);
    else if (A && !B) conflicts.push(`${a} has no partner yet. Add ${b}.`);
    else if (B && !A) conflicts.push(`${b} has no partner yet. Add ${a}.`);
  });

  const blocked = new Set<string>();
  seed.formats.forEach((f) => {
    if (outF.has(f.id)) return;
    if (f.vectors.some((v) => outV.has(v)) || f.chains.some((c) => outC.has(c))) blocked.add(f.id);
  });
  const reachF = new Set(pf.filter((f) => !blocked.has(f.id)).map((f) => f.id));

  return {
    inF,
    outF,
    inC,
    outC,
    inV,
    outV,
    reachF,
    reachC,
    reachV,
    claimC,
    claimV,
    buildC,
    buildV,
    inM: new Set(),
    outM: new Set(),
    reachM: new Set(),
    claimM: new Set(),
    buildM: new Set(),
    blocked,
    conflicts,
  };
}

export function sortedIds(ids: Iterable<string>): string[] {
  return [...ids].sort();
}
