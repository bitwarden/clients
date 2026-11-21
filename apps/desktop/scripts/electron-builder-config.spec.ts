import { readFileSync } from "fs";
import { resolve } from "path";

import { type BuildConfig, parseConfigureArgs, toBuildConfig, validate } from "./build-config.mts";
import {
  type ExtraFile,
  ELECTRON_BUILDER_TARGETS,
  applyBuildConfig,
  electronBuilderTargets,
  unsupportedChannels,
} from "./electron-builder-config.mts";

/// The real base configuration, so a change to it that breaks an assumption here shows up as a
/// failing test rather than a failing release build.
const base = JSON.parse(
  readFileSync(resolve(__dirname, "../electron-builder.json"), "utf8"),
) as Record<string, unknown>;

function configFor(args: string[]): BuildConfig {
  const raw = parseConfigureArgs(args);
  expect(validate(raw)).toEqual([]);
  return toBuildConfig(raw);
}

const MAC = ["--build-dir", "build-mac", "--architecture", "universal"];
const WINDOWS = ["--build-dir", "build-win", "--architecture", "x64"];
const LINUX = ["--build-dir", "build-lin", "--architecture", "x64"];

describe("electronBuilderTargets", () => {
  it("maps distribution channels to electron-builder targets", () => {
    const config = configFor([
      ...MAC,
      "--distribution-channel",
      "dmg",
      "--distribution-channel",
      "mac-zip",
    ]);

    expect(electronBuilderTargets(config)).toEqual(["dmg", "zip"]);
  });

  it("reports the channels nothing produces yet", () => {
    const config = configFor([...LINUX, "--distribution-channel", "linux-tarball"]);

    expect(unsupportedChannels(config)).toEqual(["linux-tarball"]);
    expect(electronBuilderTargets(config)).toEqual([]);
  });

  it("has a verdict for every channel the configuration can name", () => {
    for (const target of Object.values(ELECTRON_BUILDER_TARGETS)) {
      expect(target === null || target.length > 0).toBe(true);
    }
  });
});

describe("applyBuildConfig", () => {
  it("points the app source and output at the build directory", () => {
    const result = applyBuildConfig(base, configFor([...MAC, "--distribution-channel", "dmg"]));

    expect(result.directories).toMatchObject({
      app: "build-mac/intermediates/src",
      output: "build-mac/dist",
      // Untouched from the base.
      buildResources: "resources",
    });
  });

  it("packages the binaries this build staged, from where it staged them", () => {
    const result = applyBuildConfig(base, configFor([...MAC, "--distribution-channel", "dmg"]));

    expect((result.mac as Record<string, unknown>).extraFiles).toEqual([
      {
        from: "build-mac/intermediates/desktop_native/proxy/desktop_proxy.${platform}-${arch}",
        to: "MacOS/desktop_proxy",
      },
      {
        from: "build-mac/intermediates/desktop_native/proxy/desktop_proxy.${platform}-${arch}",
        to: "MacOS/desktop_proxy.inherit",
      },
    ]);
  });

  it("leaves out a binary the configuration turned off", () => {
    const result = applyBuildConfig(
      base,
      configFor([...MAC, "--distribution-channel", "dmg", "--no-desktop-proxy"]),
    );

    expect((result.mac as Record<string, unknown>).extraFiles).toEqual([]);
  });

  it("replaces the base's extraFiles rather than adding to them", () => {
    const result = applyBuildConfig(base, configFor([...LINUX, "--distribution-channel", "deb"]));
    const extraFiles = (result.linux as Record<string, unknown>).extraFiles as ExtraFile[];

    expect(extraFiles.every((file) => file.from.startsWith("build-lin/"))).toBe(true);
    expect(extraFiles.map((file) => file.to)).toEqual(["desktop_proxy", "libprocess_isolation.so"]);
  });

  it("packages the Windows helpers each under its own staged path", () => {
    const result = applyBuildConfig(
      base,
      configFor([...WINDOWS, "--distribution-channel", "windows-installer"]),
    );

    expect((result.win as Record<string, unknown>).extraFiles).toEqual([
      {
        from: "build-win/intermediates/desktop_native/proxy/desktop_proxy.win32-${arch}.exe",
        to: "desktop_proxy.exe",
      },
      {
        from: "build-win/intermediates/desktop_native/bitwarden_chromium_import_helper/bitwarden_chromium_import_helper.win32-${arch}.exe",
        to: "bitwarden_chromium_import_helper.exe",
      },
      {
        from: "build-win/intermediates/desktop_native/windows_plugin_authenticator/windows_plugin_authenticator.win32-${arch}.exe",
        to: "bitwarden_plugin_authenticator.exe",
      },
    ]);
  });

  it("keeps the base's static settings", () => {
    const result = applyBuildConfig(
      base,
      configFor([...WINDOWS, "--distribution-channel", "windows-installer"]),
    );

    expect((result.win as Record<string, unknown>).extraResources).toEqual(
      (base.win as Record<string, unknown>).extraResources,
    );
    expect(result.appId).toBe(base.appId);
    expect(result.electronVersion).toBe(base.electronVersion);
  });

  it("does not modify the base it was given", () => {
    const before = JSON.stringify(base);
    applyBuildConfig(base, configFor([...MAC, "--distribution-channel", "dmg"]));

    expect(JSON.stringify(base)).toBe(before);
  });

  it("stamps the build number as the build version", () => {
    const result = applyBuildConfig(
      base,
      configFor([...MAC, "--distribution-channel", "dmg", "--build-number", "1234"]),
    );

    expect(result.buildVersion).toBe("1234");
    expect(
      applyBuildConfig(base, configFor([...MAC, "--distribution-channel", "dmg"])),
    ).not.toHaveProperty("buildVersion");
  });

  it("signs a directly distributed build with the configured certificate", () => {
    const result = applyBuildConfig(
      base,
      configFor([
        ...MAC,
        "--distribution-channel",
        "dmg",
        "--macos-signing-certificate",
        "Developer ID Application: Bitwarden Inc",
      ]),
    );

    expect((result.mac as Record<string, unknown>).identity).toBe(
      "Developer ID Application: Bitwarden Inc",
    );
  });

  it("turns signing off for 'none'", () => {
    const result = applyBuildConfig(
      base,
      configFor([...MAC, "--distribution-channel", "dmg", "--macos-signing-certificate", "none"]),
    );

    expect((result.mac as Record<string, unknown>).identity).toBeNull();
  });

  it("disables the outer identity for an App Store build and signs with the mas one", () => {
    const result = applyBuildConfig(
      base,
      configFor([
        ...MAC,
        "--distribution-channel",
        "mac-app-store",
        "--macos-signing-certificate",
        "3rd Party Mac Developer Application: Bitwarden Inc",
      ]),
    );

    expect((result.mac as Record<string, unknown>).identity).toBeNull();
    expect((result.mas as Record<string, unknown>).identity).toBe(
      "3rd Party Mac Developer Application: Bitwarden Inc",
    );
  });
});
