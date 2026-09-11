/// Rust target triples for the desktop's native binaries, and what building them requires.
///
/// The build configuration names a platform and a set of architectures; cargo wants target
/// triples. This module translates between the two and says what a given host needs installed
/// before it can produce them, so `configure.mts` can refuse a build it cannot complete
/// instead of failing partway through cargo.
///
/// Pure, like `build-config.mts`: the host is passed in rather than read from `process`.

import type { Architecture, Platform } from "./build-config.mts";

/// Platforms we can build on. Narrower than NodeJS.Platform, which is why callers pass their
/// own `process.platform` through `asHostPlatform`.
export const HOST_PLATFORMS = ["darwin", "win32", "linux"] as const;
export type HostPlatform = (typeof HOST_PLATFORMS)[number];

export type NodeArch = "ia32" | "x64" | "arm64";

export interface RustTargetDefinition {
  readonly platform: Platform;
  readonly architecture: Exclude<Architecture, "universal">;
  /// Node's names for the same thing, which is what the built files are named after.
  readonly nodePlatform: HostPlatform;
  readonly nodeArch: NodeArch;
}

/// The same triples desktop_native/build.js maps, so files built here are named identically to
/// the ones the electron-builder `extraFiles` templates already expect.
export const RUST_TARGETS = {
  "i686-pc-windows-msvc": {
    platform: "windows",
    architecture: "ia32",
    nodePlatform: "win32",
    nodeArch: "ia32",
  },
  "x86_64-pc-windows-msvc": {
    platform: "windows",
    architecture: "x64",
    nodePlatform: "win32",
    nodeArch: "x64",
  },
  "aarch64-pc-windows-msvc": {
    platform: "windows",
    architecture: "arm64",
    nodePlatform: "win32",
    nodeArch: "arm64",
  },
  "x86_64-apple-darwin": {
    platform: "macos",
    architecture: "x64",
    nodePlatform: "darwin",
    nodeArch: "x64",
  },
  "aarch64-apple-darwin": {
    platform: "macos",
    architecture: "arm64",
    nodePlatform: "darwin",
    nodeArch: "arm64",
  },
  "x86_64-unknown-linux-gnu": {
    platform: "linux",
    architecture: "x64",
    nodePlatform: "linux",
    nodeArch: "x64",
  },
  "aarch64-unknown-linux-gnu": {
    platform: "linux",
    architecture: "arm64",
    nodePlatform: "linux",
    nodeArch: "arm64",
  },
} as const satisfies Record<string, RustTargetDefinition>;

export type RustTarget = keyof typeof RUST_TARGETS;

export interface ToolRequirement {
  readonly tool: string;
  /// Command that both proves the tool exists and reports its version.
  readonly probe: readonly string[];
  /// Key under [workspace.metadata.bin] in desktop_native/Cargo.toml, when the version is
  /// pinned there. `install` then carries a {version} placeholder for it.
  readonly pinnedAs?: string;
  readonly install: string;
}

const CARGO_XWIN: ToolRequirement = {
  tool: "cargo-xwin",
  probe: ["cargo", "xwin", "--version"],
  pinnedAs: "cargo-xwin",
  install: "cargo install --version {version} --locked cargo-xwin",
};

const CLANG: ToolRequirement = {
  tool: "clang",
  // cargo-xwin drives clang rather than clang-cl so that the ring crate compiles; see the
  // XWIN_CROSS_COMPILER export in buildEnv.
  probe: ["clang", "--version"],
  install: "install clang and make sure it is on PATH",
};

export interface CrossCompilationRule {
  readonly hosts: readonly HostPlatform[];
  readonly target: Platform;
  readonly tools: readonly ToolRequirement[];
  /// Set when the combination is not supported. Adding support means replacing this with the
  /// tools it needs.
  readonly unsupported?: string;
}

/// Cross-compilation support, one entry per host/target platform pair. Building for the host's
/// own platform needs nothing beyond the rust target and so has no entry.
///
/// A new combination is a new entry here, not a new branch somewhere else.
const CROSS_COMPILATION_RULES: readonly CrossCompilationRule[] = [
  { hosts: ["darwin", "linux"], target: "windows", tools: [CARGO_XWIN, CLANG] },
  {
    hosts: ["darwin", "win32"],
    target: "linux",
    tools: [],
    unsupported:
      "cross-compiling to Linux is not supported yet; it needs a cross linker, and the rule " +
      "for it goes in CROSS_COMPILATION_RULES in scripts/rust-targets.mts",
  },
  {
    hosts: ["linux", "win32"],
    target: "macos",
    tools: [],
    unsupported: "cross-compiling to macOS is not supported; Apple's SDK cannot be redistributed",
  },
];

export interface CrossCompilationPlan {
  /// Every triple the build needs, whether or not it is a cross build. All of them have to be
  /// installed with `rustup target add`.
  readonly targets: RustTarget[];
  /// Tools required on top of the rust targets, deduplicated across triples.
  readonly tools: ToolRequirement[];
  /// Reasons this host cannot produce some of the triples at all.
  readonly unsupported: string[];
}

export function asHostPlatform(platform: string): HostPlatform | undefined {
  return (HOST_PLATFORMS as readonly string[]).includes(platform)
    ? (platform as HostPlatform)
    : undefined;
}

export function asNodeArch(arch: string): NodeArch | undefined {
  return arch === "ia32" || arch === "x64" || arch === "arm64" ? arch : undefined;
}

/// Triples needed to cover `architectures` on `platform`. A universal macOS build is two
/// separate compilations that @electron/universal merges later, so it expands to two triples.
export function rustTargetsFor(platform: Platform, architectures: Architecture[]): RustTarget[] {
  const wanted = new Set<Exclude<Architecture, "universal">>();
  for (const architecture of architectures) {
    if (architecture === "universal") {
      wanted.add("x64");
      wanted.add("arm64");
    } else {
      wanted.add(architecture);
    }
  }

  return rustTargetEntries().flatMap(([triple, definition]) =>
    definition.platform === platform && wanted.has(definition.architecture) ? [triple] : [],
  );
}

/// What a built binary is called once staged, e.g. `desktop_proxy.win32-x64.exe`.
export function binaryFileName(bin: string, target: RustTarget): string {
  const { nodePlatform, nodeArch } = RUST_TARGETS[target];
  const extension = nodePlatform === "win32" ? ".exe" : "";
  return `${bin}.${nodePlatform}-${nodeArch}${extension}`;
}

export function crossCompilationPlan(
  host: HostPlatform,
  targets: RustTarget[],
): CrossCompilationPlan {
  const tools = new Map<string, ToolRequirement>();
  const unsupported = new Set<string>();

  for (const target of targets) {
    const { platform, nodePlatform } = RUST_TARGETS[target];
    if (nodePlatform === host) {
      continue;
    }

    const rule = CROSS_COMPILATION_RULES.find(
      (candidate) => candidate.target === platform && candidate.hosts.includes(host),
    );
    if (rule == null) {
      unsupported.add(`cross-compiling to ${platform} from ${host} is not supported`);
      continue;
    }
    if (rule.unsupported != null) {
      unsupported.add(rule.unsupported);
      continue;
    }
    for (const tool of rule.tools) {
      tools.set(tool.tool, tool);
    }
  }

  return { targets, tools: [...tools.values()], unsupported: [...unsupported] };
}

/// Environment cargo needs for a given triple. Inherited by everything the build spawns, the
/// way desktop_native/build.js sets these on `process.env`.
export function buildEnv(
  host: HostPlatform,
  hostArch: NodeArch,
  target: RustTarget,
): Record<string, string> {
  const { platform, nodePlatform, nodeArch } = RUST_TARGETS[target];
  const isCross = nodePlatform !== host || nodeArch !== hostArch;

  if (platform === "windows" && host !== "win32") {
    // The ring crate does not compile under clang-cl, so point cargo-xwin at clang.
    return { XWIN_CROSS_COMPILER: "clang" };
  }
  if (platform === "linux" && isCross) {
    return { PKG_CONFIG_ALLOW_CROSS: "1", PKG_CONFIG_ALL_STATIC: "1" };
  }
  return {};
}

/// True when cargo has to be dispatched as `cargo xwin build` rather than `cargo build`.
export function usesXwin(host: HostPlatform, target: RustTarget): boolean {
  return RUST_TARGETS[target].platform === "windows" && host !== "win32";
}

function rustTargetEntries(): [RustTarget, RustTargetDefinition][] {
  return Object.entries(RUST_TARGETS) as [RustTarget, RustTargetDefinition][];
}
