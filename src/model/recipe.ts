export interface RecipeMolecule {
  id: string;
  name: string;
  formatId: string;
}

export interface RecipeChain {
  id: string;
  name: string;
}

export interface RecipeRegion {
  vector: string;
  domain: string;
  insert: string;
}

export interface RecipeMutation {
  id: string;
  name: string;
}

export interface RecipeCombination {
  label: string;
  members: string;
}

export interface RecipePanel {
  id: string;
  name: string;
  requestId: string;
  project: string;
  molecules: RecipeMolecule[];
  /** Chains registered on the panel, used when this panel is not the open build. */
  chains: RecipeChain[];
}

export interface RecipeDoc {
  generatedOn: string;
  activePanelId: string | null;
  panels: RecipePanel[];
  buildChains: RecipeChain[];
  regions: RecipeRegion[];
  mutations: RecipeMutation[];
  combinations: RecipeCombination[];
  ratioLines: string[];
  expressionLines: string[];
}

function pushSection(lines: string[], title: string, rows: string[]) {
  lines.push(title);
  if (!rows.length) lines.push('  Not defined yet.');
  else rows.forEach((row) => lines.push(`  ${row}`));
  lines.push('');
}

function buildRecipe(doc: RecipeDoc): string[] {
  const lines: string[] = [];
  pushSection(
    lines,
    'Chains',
    doc.buildChains.map((chain) => `${chain.id}  ${chain.name}`),
  );
  pushSection(
    lines,
    'Variable regions',
    doc.regions.map((region) => `${region.insert}  ${region.domain}  into ${region.vector}`),
  );
  pushSection(
    lines,
    'Mutations',
    doc.mutations.map((mutation) => `${mutation.id}  ${mutation.name}`),
  );
  pushSection(
    lines,
    'Construct combinations',
    doc.combinations.map((combo) => `${combo.label}: ${combo.members}`),
  );
  pushSection(lines, 'Chain ratio', doc.ratioLines);
  pushSection(lines, 'Expression', doc.expressionLines);
  return lines;
}

/** One chapter per panel. The open panel carries the defined build. */
export function recipeLines(doc: RecipeDoc): string[] {
  const lines = [
    'Protein Recipe Report',
    doc.generatedOn,
    '',
    'The recipe used for each panel: the molecules on the panel, then the chains, variable regions, mutations, construct combination, ratio, and expression defined for it.',
    '',
  ];
  if (!doc.panels.length) {
    lines.push('No panel is open.', '');
    lines.push(...buildRecipe(doc));
    return lines;
  }
  doc.panels.forEach((panel, index) => {
    if (index) lines.push('');
    lines.push(`Panel  ${panel.name}`, `UID  ${panel.id}`, `Request  ${panel.requestId}`);
    if (panel.project) lines.push(`Project  ${panel.project}`);
    lines.push('');
    pushSection(
      lines,
      `Molecules  ${panel.molecules.length}`,
      panel.molecules.map((molecule) => `${molecule.id}  ${molecule.name}  ${molecule.formatId}`),
    );
    if (panel.id === doc.activePanelId) {
      lines.push(...buildRecipe(doc));
    } else {
      pushSection(
        lines,
        'Chains on this panel',
        panel.chains.map((chain) => `${chain.id}  ${chain.name}`),
      );
    }
  });
  return lines;
}
