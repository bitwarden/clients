import { staleArtifacts } from "./artifacts.mts";
import { parseConfigureArgs, toBuildConfig, validate } from "./build-config.mts";
import { args } from "./spec-support.ts";

/// The macOS line these cases compare against, with the parts individual cases vary pulled out
/// as parameters -- `--architecture` is repeatable, so varying it means writing the whole line.
function mac(options: { architecture?: string; extension?: boolean } = {}): string {
  const { architecture = "arm64", extension = true } = options;
  return [
    `--build-dir build-mac --architecture ${architecture} --distribution-channel dmg`,
    '--macos-signing-certificate "Developer ID Application: Bitwarden Inc"',
    extension ? "--with-macos-autofill-extension" : "",
  ].join(" ");
}

const MAC = mac();
const LINUX = "--build-dir build-lin --architecture x64 --distribution-channel deb";

function config(line: string) {
  const raw = parseConfigureArgs(args(line));
  expect(validate(raw)).toEqual([]);
  return toBuildConfig(raw);
}

/// Names of what would be deleted, which is what the caller is really asking about.
function staleNames(before: string, after: string): string[] {
  return staleArtifacts(config(before), config(after))
    .map((artifact) => artifact.name)
    .sort();
}

const EVERY_MAC_ARTIFACT = ["app", "desktop-proxy", "macos-autofill-extension", "napi"];

describe("staleArtifacts", () => {
  it("finds nothing when the configuration did not change", () => {
    expect(staleNames(MAC, MAC)).toEqual([]);
  });

  it("keeps everything when only the build number changed", () => {
    expect(staleNames(MAC, `${MAC} --build-number 42`)).toEqual([]);
  });

  it("keeps everything when only the signing certificate or provisioning profile changed", () => {
    expect(
      staleNames(MAC, `${MAC} --macos-signing-certificate "Developer ID Application: X"`),
    ).toEqual([]);
  });

  it("invalidates everything compiled when the profile changed", () => {
    expect(staleNames(MAC, `${MAC} --profile release`)).toEqual(EVERY_MAC_ARTIFACT);
  });

  it("invalidates the native artifacts, but not the app, when the architecture changed", () => {
    // The extension is absent: it links a universal library whatever the app was configured for.
    expect(staleNames(MAC, mac({ architecture: "universal" }))).toEqual(["desktop-proxy", "napi"]);
  });

  it("invalidates the app, and the extension it is signed alongside, when the channel changed", () => {
    // The channel is compiled into the app source, and it decides the bundle identifier the
    // extension's entitlements are generated from. It does not reach the Rust binaries.
    expect(staleNames(MAC, `${MAC} --channel beta`)).toEqual(["app", "macos-autofill-extension"]);
  });

  it("invalidates only the extension when the distribution channel changed how it is signed", () => {
    const appStore =
      "--build-dir build-mac --architecture arm64 --distribution-channel mac-app-store " +
      '--macos-signing-certificate "3rd Party Mac Developer Application: Bitwarden Inc" ' +
      "--with-macos-autofill-extension";

    expect(staleNames(MAC, appStore)).toEqual(["macos-autofill-extension"]);
  });

  it("invalidates a target that was turned off", () => {
    const stale = staleArtifacts(config(MAC), config(`${MAC} --no-desktop-proxy`));

    expect(stale).toEqual([
      {
        name: "desktop-proxy",
        path: "build-mac/intermediates/desktop_native/proxy",
        reason: "no longer part of the build",
      },
    ]);
  });

  it("says nothing about a target that was turned on, because it was never built", () => {
    expect(staleNames(mac({ extension: false }), MAC)).toEqual([]);
  });

  it("invalidates the Linux binaries when the glibc floor changed", () => {
    expect(staleNames(LINUX, `${LINUX} --glibc 2.31`)).toEqual([
      "desktop-proxy",
      "napi",
      "process-isolation",
    ]);
  });

  it("reports the input that changed, so the reason survives into the message", () => {
    const stale = staleArtifacts(config(MAC), config(`${MAC} --profile release`));

    expect(stale.find((artifact) => artifact.name === "desktop-proxy")).toEqual({
      name: "desktop-proxy",
      path: "build-mac/intermediates/desktop_native/proxy",
      reason: "profile changed",
    });
  });
});
