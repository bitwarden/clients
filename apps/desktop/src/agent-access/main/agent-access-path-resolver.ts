import * as path from "path";

/** Structural shape shared by `FileMergeConfigPathSpec` (`models/agent-registration.ts`) and
 *  `AgentPathProbe` (`models/agent-detection.ts`) — both are plain-data path descriptions with the
 *  same `base`/`segments`/`platforms` shape, resolved the same way. Declared independently here
 *  (rather than imported) so this module doesn't need to pick one of the two models files to depend
 *  on; either one satisfies this structurally. */
export interface ResolvablePathSpec {
  base: "home" | "appData";
  segments: string[];
  platforms?: NodeJS.Platform[];
}

/** Real filesystem roots the two `base` discriminants resolve against. Callers inject both (see
 *  each service's `homedir`/`appDataPath` constructor params) so tests never call into Electron. */
export interface AgentAccessPathRoots {
  homedir: string;
  appDataPath: string;
}

/**
 * Resolves a renderer-safe path spec against real filesystem roots. This is the ONLY place
 * `base: "appData"` is turned into a real path — models/ stays plain data so it's safe to import
 * from the renderer (see `apps/desktop/CLAUDE.md`), and every main-process consumer
 * (`AgentDetectionService`, `AgentAccessRegistrationService`, `AgentAccessRegistrationStatusService`)
 * shares this one implementation instead of re-deriving it.
 *
 * Returns `null` if the spec is platform-restricted and doesn't match `process.platform` — the
 * caller decides what that means (e.g. "this probe doesn't apply here" vs. "this agent isn't
 * supported on this platform").
 */
export function resolvePathSpec(
  spec: ResolvablePathSpec,
  roots: AgentAccessPathRoots,
): string | null {
  if (spec.platforms != null && !spec.platforms.includes(process.platform)) {
    return null;
  }
  const root = spec.base === "home" ? roots.homedir : roots.appDataPath;
  return path.join(root, ...spec.segments);
}

/** Picks the first candidate whose `platforms` (if any) includes `process.platform`, mirroring how
 *  `FileMergeRegistrationStrategy.configPaths` and status probes select among per-platform
 *  candidates. Returns `null` if no candidate matches. */
export function findMatchingPathSpec<T extends ResolvablePathSpec>(candidates: T[]): T | null {
  return (
    candidates.find(
      (candidate) => candidate.platforms == null || candidate.platforms.includes(process.platform),
    ) ?? null
  );
}
