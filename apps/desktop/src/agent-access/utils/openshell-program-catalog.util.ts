import { BitwardenIcon } from "@bitwarden/components";

import { AgentId } from "../models/agent-id";

/**
 * Well-known programs a permission can be limited to. The paths are inside the sandbox (a Linux
 * container), not on this computer, so they are listed here rather than picked from a file dialog.
 * Everything here is a plain absolute path, so it satisfies `isOpenShellBinaryPath`.
 */
export interface OpenShellProgram {
  id: string;
  /** Product name. Not translated: these are names of tools. */
  name: string;
  /** Where the program usually lives in a container. All of them are kept when it is selected. */
  paths: readonly string[];
  /** Shows that agent's logo instead of `icon`. */
  agent?: AgentId;
  icon: BitwardenIcon;
}

export const OPENSHELL_PROGRAMS: readonly OpenShellProgram[] = Object.freeze([
  { id: "curl", name: "curl", paths: ["/usr/bin/curl", "/usr/local/bin/curl"], icon: "bwi-cli" },
  {
    id: "wget",
    name: "wget",
    paths: ["/usr/bin/wget", "/usr/local/bin/wget"],
    icon: "bwi-download",
  },
  { id: "git", name: "Git", paths: ["/usr/bin/git", "/usr/local/bin/git"], icon: "bwi-folder" },
  {
    id: "gh",
    name: "GitHub CLI",
    paths: ["/usr/bin/gh", "/usr/local/bin/gh"],
    icon: "bwi-terminal",
  },
  {
    id: "node",
    name: "Node.js",
    paths: ["/usr/bin/node", "/usr/local/bin/node"],
    icon: "bwi-cog",
  },
  { id: "npm", name: "npm", paths: ["/usr/bin/npm", "/usr/local/bin/npm"], icon: "bwi-puzzle" },
  {
    id: "python",
    name: "Python",
    paths: ["/usr/bin/python3", "/usr/local/bin/python3"],
    icon: "bwi-file-text",
  },
  {
    id: "pip",
    name: "pip",
    paths: ["/usr/bin/pip3", "/usr/local/bin/pip3"],
    icon: "bwi-wrench",
  },
  {
    id: "claude",
    name: "Claude Code",
    paths: ["/usr/local/bin/claude", "/usr/bin/claude"],
    agent: AgentId.Claude,
    icon: "bwi-terminal",
  },
  {
    id: "codex",
    name: "Codex",
    paths: ["/usr/local/bin/codex", "/usr/bin/codex"],
    agent: AgentId.Codex,
    icon: "bwi-terminal",
  },
]);

export function findOpenShellProgram(id: string): OpenShellProgram | undefined {
  return OPENSHELL_PROGRAMS.find((program) => program.id === id);
}

/**
 * The paths to save for a selection: every path of each selected program (in catalog order, so both
 * locations work), then the custom ones. No duplicates.
 */
export function programsToPaths(
  selectedIds: readonly string[],
  customPaths: readonly string[],
): string[] {
  const paths: string[] = [];
  for (const program of OPENSHELL_PROGRAMS) {
    if (selectedIds.includes(program.id)) {
      paths.push(...program.paths);
    }
  }
  paths.push(...customPaths);
  return [...new Set(paths)];
}

/**
 * Reads saved paths back as a selection. A program counts as selected when ANY of its paths is
 * present; a path that belongs to no catalog entry is a custom one.
 */
export function pathsToSelection(paths: readonly string[]): { ids: string[]; custom: string[] } {
  const ids = OPENSHELL_PROGRAMS.filter((program) =>
    program.paths.some((path) => paths.includes(path)),
  ).map((program) => program.id);
  const known = new Set(OPENSHELL_PROGRAMS.flatMap((program) => program.paths));
  return { ids, custom: [...new Set(paths.filter((path) => !known.has(path)))] };
}

/** One entry to show for a saved path list: a catalog program, or a custom path. */
export interface OpenShellProgramDisplay {
  key: string;
  program?: OpenShellProgram;
  path?: string;
}

/** Catalog programs by name first (catalog order), then custom paths as they are. */
export function describeOpenShellPrograms(paths: readonly string[]): OpenShellProgramDisplay[] {
  const { ids, custom } = pathsToSelection(paths);
  return [
    ...ids.map((id) => ({ key: id, program: findOpenShellProgram(id) })),
    ...custom.map((path) => ({ key: path, path })),
  ];
}
