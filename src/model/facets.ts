export function facetTokens(raw: unknown): string[] {
  const s = String(raw ?? '').trim();
  if (!s) return [''];
  const parts = s.split(' / ').map((p) => p.trim()).filter(Boolean);
  return parts.length ? [...new Set(parts)] : [s];
}

export function rowHasFacet(row: Record<string, unknown>, key: string, selected: Set<string>): boolean {
  const raw = String(row[key] ?? '');
  if (selected.has(raw)) return true;
  return facetTokens(raw).some((t) => selected.has(t));
}
