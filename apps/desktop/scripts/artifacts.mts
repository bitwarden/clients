/// What a build produces, and when what it produced stops matching the configuration.
///
/// Reconfiguring a build directory used to print the keys that changed and leave everything
/// where it was, so a directory configured for arm64 and then reconfigured for x64 still held
/// arm64 binaries -- and the next pack would package them without complaint, because a staged
/// artifact carries no record of what it was built from.
///
/// It does not need one. The build directory already holds the configuration the last build
/// ran under, so comparing that file against the new one says exactly which artifacts no longer
/// match. What each artifact depends on is declared below, and only those parts are compared:
/// a changed `--build-number` is packaging metadata and must not throw away twenty minutes of
/// Rust, while a changed `--profile` invalidates everything that was compiled.
///
/// Pure: both configurations are passed in, and the caller does the deleting.

import {
  type BuildConfig,
  type TargetDefinition,
  type Toolchain,
  TARGETS,
  diffKeys,
  targetName,
} from "./build-config.mts";

/// Parts of the configuration an artifact's contents depend on, as dotted paths. Anything not
/// named here cannot change what the artifact holds.
///
/// The list is deliberately about *contents*, not about whether the artifact would be used.
/// Signing certificates, provisioning profiles and build numbers are applied while packaging,
/// so changing one leaves every built artifact still correct.
type Inputs = readonly string[];

/// Anything cargo compiles. `linux.glibc` is absent outside Linux, which compares equal to
/// absent and so never invalidates on its own.
const CARGO_INPUTS: Inputs = ["profile", "architectures", "derived.platform", "linux.glibc"];

/// The Xcode build takes its configuration from the profile and its signing from the channel,
/// and the entitlements it is signed with are generated from the bundle identifier. It does not
/// depend on `architectures`: the extension links a universal static library either way.
const XCODE_INPUTS: Inputs = [
  "profile",
  "derived.platform",
  "derived.macosAutofillExtension",
  "derived.appId",
];

/// Exhaustive over `Toolchain`, so a target built by something new has to say what its output
/// depends on rather than quietly inheriting cargo's answer.
const INPUTS_BY_TOOLCHAIN: Record<Toolchain, Inputs> = {
  rust: CARGO_INPUTS,
  xcode: XCODE_INPUTS,
};

export interface ArtifactDefinition {
  /// The name the artifact answers to on the command line, so that a message about it names
  /// something the reader can rebuild.
  name: string;
  /// Where it is, relative to apps/desktop, or undefined when the configuration does not
  /// contain this artifact at all.
  path: (config: BuildConfig) => string | undefined;
  inputs: Inputs;
}

/// webpack's output. Not a target -- every configuration contains it -- so it is declared here
/// rather than coming from TARGETS. The bundle is the same whatever it will run on, so the
/// architectures are not among its inputs; the channel is, because it is compiled in.
const APP_SOURCE: ArtifactDefinition = {
  name: "app",
  path: (config) => config.directories.appSource,
  inputs: ["channel", "profile"],
};

function targetArtifact(target: TargetDefinition): ArtifactDefinition {
  return {
    name: targetName(target),
    path: (config) =>
      config.targets[target.key] === true ? config.intermediates[target.key] : undefined,
    inputs: INPUTS_BY_TOOLCHAIN[target.toolchain],
  };
}

export const ARTIFACTS: readonly ArtifactDefinition[] = [
  APP_SOURCE,
  ...TARGETS.map(targetArtifact),
];

export interface StaleArtifact {
  name: string;
  /// Relative to apps/desktop, taken from the configuration that built it.
  path: string;
  /// Why it no longer matches, for the caller to report before deleting it.
  reason: string;
}

/// Artifacts that `previous` may have produced and `next` would not accept.
///
/// Only what the previous configuration named is considered: an artifact the old build never
/// contained cannot be stale, whether or not the new one wants it.
export function staleArtifacts(previous: BuildConfig, next: BuildConfig): StaleArtifact[] {
  const stale: StaleArtifact[] = [];

  for (const artifact of ARTIFACTS) {
    const path = artifact.path(previous);
    if (path == null) {
      continue;
    }

    const destination = artifact.path(next);
    if (destination == null) {
      stale.push({
        name: artifact.name,
        path,
        reason: "no longer part of the build",
      });
      continue;
    }
    if (destination !== path) {
      stale.push({ name: artifact.name, path, reason: `now built at ${destination}` });
      continue;
    }

    const changed = diffKeys(inputsOf(previous, artifact), inputsOf(next, artifact));
    if (changed.length > 0) {
      stale.push({ name: artifact.name, path, reason: `${changed.join(", ")} changed` });
    }
  }

  return stale;
}

/// The named parts of a configuration, keyed by the dotted path they came from, so that
/// comparing two of them reports the path a reader can look up.
function inputsOf(config: BuildConfig, artifact: ArtifactDefinition): Record<string, unknown> {
  return Object.fromEntries(artifact.inputs.map((input) => [input, valueAt(config, input)]));
}

function valueAt(config: BuildConfig, dotted: string): unknown {
  let value: unknown = config;
  for (const segment of dotted.split(".")) {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}
