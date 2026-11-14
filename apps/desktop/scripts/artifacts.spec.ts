import { staleArtifacts } from "./artifacts.mts";
import { parseConfigureArgs, toBuildConfig, validate } from "./build-config.mts";

const MAC_ARGS = [
  "--build-dir",
  "build-mac",
  "--architecture",
  "arm64",
  "--distribution-channel",
  "dmg",
  "--with-macos-autofill-extension",
  "--macos-signing-certificate",
  "Developer ID Application: Bitwarden Inc",
];

const LINUX_ARGS = [
  "--build-dir",
  "build-lin",
  "--architecture",
  "x64",
  "--distribution-channel",
  "deb",
];

function config(args: string[]) {
  const raw = parseConfigureArgs(args);
  expect(validate(raw)).toEqual([]);
  return toBuildConfig(raw);
}

/// Names of what would be deleted, which is what the caller is really asking about.
function staleNames(before: string[], after: string[]): string[] {
  return staleArtifacts(config(before), config(after))
    .map((artifact) => artifact.name)
    .sort();
}

const EVERY_MAC_ARTIFACT = ["app", "desktop-proxy", "macos-autofill-extension", "napi"];

describe("staleArtifacts", () => {
  it("finds nothing when the configuration did not change", () => {
    expect(staleNames(MAC_ARGS, MAC_ARGS)).toEqual([]);
  });

  it("keeps everything when only the build number changed", () => {
    expect(staleNames(MAC_ARGS, [...MAC_ARGS, "--build-number", "42"])).toEqual([]);
  });

  it("keeps everything when only the signing certificate or provisioning profile changed", () => {
    const signed = [...MAC_ARGS, "--macos-signing-certificate", "Developer ID Application: X"];

    expect(staleNames(MAC_ARGS, signed)).toEqual([]);
  });

  it("invalidates everything compiled when the profile changed", () => {
    expect(staleNames(MAC_ARGS, [...MAC_ARGS, "--profile", "release"])).toEqual(EVERY_MAC_ARTIFACT);
  });

  it("invalidates the native artifacts, but not the app, when the architecture changed", () => {
    const universal = [
      ...MAC_ARGS.slice(0, 2),
      "--architecture",
      "universal",
      ...MAC_ARGS.slice(4),
    ];

    // The extension is absent: it links a universal library whatever the app was configured for.
    expect(staleNames(MAC_ARGS, universal)).toEqual(["desktop-proxy", "napi"]);
  });

  it("invalidates the app, and the extension it is signed alongside, when the channel changed", () => {
    // The channel is compiled into the app source, and it decides the bundle identifier the
    // extension's entitlements are generated from. It does not reach the Rust binaries.
    expect(staleNames(MAC_ARGS, [...MAC_ARGS, "--channel", "beta"])).toEqual([
      "app",
      "macos-autofill-extension",
    ]);
  });

  it("invalidates only the extension when the distribution channel changed how it is signed", () => {
    const appStore = [
      "--build-dir",
      "build-mac",
      "--architecture",
      "arm64",
      "--distribution-channel",
      "mac-app-store",
      "--macos-signing-certificate",
      "3rd Party Mac Developer Application: Bitwarden Inc",
      "--with-macos-autofill-extension",
    ];

    expect(staleNames(MAC_ARGS, appStore)).toEqual(["macos-autofill-extension"]);
  });

  it("invalidates a target that was turned off", () => {
    const stale = staleArtifacts(config(MAC_ARGS), config([...MAC_ARGS, "--no-desktop-proxy"]));

    expect(stale).toEqual([
      {
        name: "desktop-proxy",
        path: "build-mac/intermediates/desktop_native/proxy",
        reason: "no longer part of the build",
      },
    ]);
  });

  it("says nothing about a target that was turned on, because it was never built", () => {
    const off = [...MAC_ARGS.filter((arg) => arg !== "--with-macos-autofill-extension")];

    expect(staleNames(off, MAC_ARGS)).toEqual([]);
  });

  it("invalidates the Linux binaries when the glibc floor changed", () => {
    expect(staleNames(LINUX_ARGS, [...LINUX_ARGS, "--glibc", "2.31"])).toEqual([
      "desktop-proxy",
      "napi",
      "process-isolation",
    ]);
  });

  it("reports the input that changed, so the reason survives into the message", () => {
    const stale = staleArtifacts(config(MAC_ARGS), config([...MAC_ARGS, "--profile", "release"]));

    expect(stale.find((artifact) => artifact.name === "desktop-proxy")).toEqual({
      name: "desktop-proxy",
      path: "build-mac/intermediates/desktop_native/proxy",
      reason: "profile changed",
    });
  });
});
