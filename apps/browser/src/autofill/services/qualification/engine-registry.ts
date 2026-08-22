import { devFlagEnabled, devFlagValue } from "../../../platform/flags";
import { QualificationEngine } from "../../qualification/abstractions/qualification-engine";
import { ScoringQualificationEngine } from "../../qualification/engine";
import { AutocompleteQualificationEngine } from "../../qualification/engines/autocomplete.engine";
import {
  QualificationEngineId,
  toQualificationEngineId,
} from "../../qualification/types/engine-id";
import { InlineMenuFieldQualificationService } from "../abstractions/inline-menu-field-qualifications.service";
import { LegacyInlineMenuFieldQualificationService } from "../inline-menu-field-qualification.service";

import { LegacyBridgeEngine } from "./engines/legacy-bridge.engine";
import { info, warn } from "./qualification-log";

/**
 * What an engine factory is allowed to depend on.
 *
 * Only the legacy service today. It's a bag rather than a positional argument
 * so adding a dependency for one engine doesn't churn the signature of all of
 * them.
 */
export type EngineDeps = {
  legacy: InlineMenuFieldQualificationService;
};

export type EngineFactory = (deps: EngineDeps) => QualificationEngine;

/**
 * The engine bay. Every {@link QualificationEngineId} maps to the factory that
 * builds it.
 *
 * Typed as a total `Record`, so adding an id without registering a factory is
 * a compile error rather than a runtime lookup miss.
 *
 * **Every engine here ships in every overlay content script.** These imports
 * are static, and the workspace declares no `sideEffects: false`, so webpack
 * keeps each module whether or not its exports are reachable. Wrapping a
 * factory body in a `process.env.ENV` check does not help: measured against a
 * real production build, terser folds the branch and the module stays. Getting
 * an engine out of the default-path bundle needs a genuine `await import()`
 * seam, which arrives with the swappable engine — see
 * `qualification/engine-selection.design.md`.
 */
export const ENGINE_REGISTRY: Readonly<Record<QualificationEngineId, EngineFactory>> =
  Object.freeze({
    [QualificationEngineId.Legacy]: ({ legacy }) => new LegacyBridgeEngine(legacy),
    [QualificationEngineId.Scoring]: () => new ScoringQualificationEngine(),
    [QualificationEngineId.Autocomplete]: () => new AutocompleteQualificationEngine(),
  });

export const DEFAULT_ENGINE_ID: QualificationEngineId = QualificationEngineId.Legacy;

export type EngineDescription = {
  readonly id: QualificationEngineId;
  readonly name: string;
  readonly version: string;
};

/**
 * Every registered engine's self-reported identity, for the popup picker's
 * option list.
 *
 * Labels come from the engines rather than i18n on purpose: an engine name is
 * an identifier, translating it would be wrong, and sourcing it here keeps the
 * picker and the dev-build log line from drifting apart. Constructing each
 * engine to ask is cheap — the constructors only store references, and no
 * engine classifies anything until `classify` is called.
 */
export function describeEngines(): ReadonlyArray<EngineDescription> {
  const legacy = new LegacyInlineMenuFieldQualificationService();

  return Object.values(QualificationEngineId).map((id) => {
    const { name, version } = ENGINE_REGISTRY[id]({ legacy });
    return { id, name, version };
  });
}

/**
 * Picks the engine to build. Precedence, highest first:
 *
 * 1. The `qualificationEngine` dev flag from `apps/browser/config/local.json`
 * 2. The `autofill-qualification-engine` feature flag value passed in
 * 3. {@link DEFAULT_ENGINE_ID}
 *
 * Never throws. Both inputs are untrusted — feature flag values are cast from
 * whatever the server sent without any runtime check, and the dev flag is
 * hand-typed — so an unrecognized value degrades to the default rather than
 * breaking autofill for everyone the flag is rolled out to.
 *
 * Content scripts and the background pass no `flagValue`; they can't await the
 * feature flag, so for them this resolves to the dev flag or the default.
 */
export function resolveEngineId(flagValue?: unknown): QualificationEngineId {
  const fromDevFlag = readDevFlagEngineId();
  if (fromDevFlag !== undefined) {
    return fromDevFlag;
  }

  const fromFeatureFlag = toQualificationEngineId(flagValue);
  if (fromFeatureFlag !== undefined) {
    return fromFeatureFlag;
  }

  if (flagValue !== undefined && flagValue !== null) {
    warn(`Ignoring unrecognized engine id ${JSON.stringify(flagValue)}.`);
  }

  return DEFAULT_ENGINE_ID;
}

function readDevFlagEngineId(): QualificationEngineId | undefined {
  // devFlagValue throws when the flag is off, so the guard is required rather
  // than defensive.
  if (!devFlagEnabled("qualificationEngine")) {
    return undefined;
  }

  const raw = devFlagValue("qualificationEngine");
  const id = toQualificationEngineId(raw);
  if (id === undefined) {
    warn(`Ignoring unrecognized qualificationEngine dev flag ${JSON.stringify(raw)}.`);
  }
  return id;
}

/**
 * Announces which engine a construction site built, on development builds only.
 * Gating lives in {@link info} — see `qualification-log.ts` for why it is a
 * build-time constant rather than a runtime toggle.
 */
export function logEngineSelection(engine: QualificationEngine, context: string): void {
  info(`${engine.name} v${engine.version} (id=${engine.id}, context=${context})`);
}
