import { readFileSync } from "fs";
import { resolve } from "path";

import { type BuildConfig, parseConfigureArgs, toBuildConfig, validate } from "./build-config.mts";
import {
  type ExtraFile,
  ELECTRON_BUILDER_TARGETS,
  applyBuildConfig,
  electronBuilderTargets,
  signedAppxConfig,
  unpackedDir,
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

const MAC = [
  "--build-dir",
  "build-mac",
  "--architecture",
  "universal",
  // Required for any macOS build; a case naming its own certificate later overrides it.
  "--macos-signing-certificate",
  "Developer ID Application: Bitwarden Inc",
];
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

/// The fork the overlay replaces. Kept as the reference for what a beta build is supposed to
/// look like, so the two cannot quietly disagree while both are on disk.
const betaFork = JSON.parse(
  readFileSync(resolve(__dirname, "../electron-builder.beta.json"), "utf8"),
) as Record<string, unknown>;

describe("the beta channel", () => {
  const betaOf = (args: string[]) =>
    applyBuildConfig(base, configFor([...args, "--channel", "beta"]));
  const stableOf = (args: string[]) => applyBuildConfig(base, configFor(args));

  const WINDOWS_STORE = [...WINDOWS, "--distribution-channel", "microsoft-store"];
  const MAC_DMG = [...MAC, "--distribution-channel", "dmg"];

  it("renames the application, matching the fork except for the identifier it never registered", () => {
    const beta = betaOf(MAC_DMG);

    expect(beta.productName).toBe(betaFork.productName);
    expect((beta.extraMetadata as Record<string, unknown>).name).toBe(
      (betaFork.extraMetadata as Record<string, unknown>).name,
    );
    expect(betaFork.appId).toBe("com.bitwarden.desktop.beta");
    expect(beta.appId).toBe("com.bitwarden.beta.desktop");
  });

  it("carries over the fork's icons and artifact names", () => {
    const mac = betaOf(MAC_DMG);
    const windows = betaOf(WINDOWS_STORE);

    expect((mac.mac as Record<string, unknown>).icon).toBe(
      (betaFork.mac as Record<string, unknown>).icon,
    );
    expect((mac.dmg as Record<string, unknown>).icon).toBe(
      (betaFork.dmg as Record<string, unknown>).icon,
    );
    expect((mac.mac as Record<string, unknown>).artifactName).toBe(
      (betaFork.mac as Record<string, unknown>).artifactName,
    );
    expect((windows.win as Record<string, unknown>).icon).toBe(
      (betaFork.win as Record<string, unknown>).icon,
    );
    expect((windows.nsisWeb as Record<string, unknown>).artifactName).toBe(
      (betaFork.nsisWeb as Record<string, unknown>).artifactName,
    );
    expect((windows.portable as Record<string, unknown>).artifactName).toBe(
      (betaFork.portable as Record<string, unknown>).artifactName,
    );
  });

  it("gives the Microsoft Store build the fork's separate identity", () => {
    const appx = betaOf(WINDOWS_STORE).appx as Record<string, unknown>;
    const forked = betaFork.appx as Record<string, unknown>;

    for (const key of [
      "applicationId",
      "identityName",
      "backgroundColor",
      "artifactName",
      "minVersion",
    ]) {
      expect([key, appx[key]]).toEqual([key, forked[key]]);
    }
  });

  /// The fork shipped a second copy of the extensions file for beta; there is now one template
  /// and configure fills it in per channel, so what the configuration names is generated.
  it("points the custom extensions at the file configure generated", () => {
    const config = configFor([...WINDOWS_STORE, "--channel", "beta"]);
    const appx = betaOf(WINDOWS_STORE).appx as Record<string, unknown>;

    expect(appx.customExtensionsPath).toBe(config.derived.windows?.appxExtensions);
    expect(appx.customExtensionsPath).toBe(
      "build-win/intermediates/appx/custom-appx-extensions.xml",
    );
  });

  it("declares no extensions on the stable channel, as before", () => {
    const stable = applyBuildConfig(base, configFor(WINDOWS_STORE)).appx as Record<string, unknown>;

    expect(stable.customExtensionsPath).toBeUndefined();
  });

  /// Deliberately *not* through `extraResources`, which the fork used. That is an array, and
  /// electron-builder concatenates the configuration it reads itself with the one we pass, so
  /// naming the beta files there appends to the base's stable ones instead of replacing them --
  /// both copy to the same destination and the survivor is neither channel's file. pack-hooks
  /// puts them in place after packing instead.
  it("does not try to swap the plugin authenticator resources through extraResources", () => {
    const win = betaOf(WINDOWS_STORE).win as Record<string, unknown>;

    expect(win.extraResources).toEqual((base.win as Record<string, unknown>).extraResources);
  });

  /// The drift the fork accumulated. A beta build now inherits these from the base instead of
  /// from a copy that stopped being updated.
  it("no longer trails the base build's Electron, or loses whole platforms", () => {
    expect(betaFork.electronVersion).toBe("41.7.2");
    expect(base.electronVersion).toBe("43.2.0");
    expect(betaOf(MAC_DMG).electronVersion).toBe(base.electronVersion);

    for (const section of ["mas", "linux", "deb", "rpm", "snap", "appImage"]) {
      expect([section, betaFork[section]]).toEqual([section, undefined]);
      expect([section, betaOf(MAC_DMG)[section]]).not.toEqual([section, undefined]);
    }
  });

  it("leaves a stable build alone", () => {
    const stable = stableOf(MAC_DMG);

    expect(stable.productName).toBe("Bitwarden");
    expect(stable.appId).toBe("com.bitwarden.desktop");
    expect((stable.mac as Record<string, unknown>).icon).toBeUndefined();
  });
});

describe("the native addon", () => {
  const MAC_DMG = [...MAC, "--distribution-channel", "dmg"];

  it("drops what was collected from the crate directory and adds what this build staged", () => {
    const files = applyBuildConfig(base, configFor(MAC_DMG)).files as unknown[];

    expect(files).toContain("!node_modules/@bitwarden/desktop-napi/*.node");
    expect(files).toContainEqual({
      from: "../desktop_native/napi",
      to: "node_modules/@bitwarden/desktop-napi",
      filter: ["*.node"],
    });
  });

  it("takes it from the staged path the build configuration names", () => {
    const config = configFor(MAC_DMG);
    const files = applyBuildConfig(base, config).files as ExtraFile[];
    const added = files.find(
      (file) => typeof file === "object" && file.to?.includes("desktop-napi"),
    );

    // The `from` is relative to the app directory, and has to arrive at the staged intermediate.
    expect(resolve(config.directories.appSource, added!.from)).toBe(
      resolve(config.intermediates.napi),
    );
  });

  it("leaves the destination alone, so the universal merge still recognises it", () => {
    const result = applyBuildConfig(base, configFor(MAC_DMG));

    expect((result.mac as Record<string, unknown>).singleArchFiles).toBe(
      (base.mac as Record<string, unknown>).singleArchFiles,
    );
    expect((result.mac as Record<string, unknown>).x64ArchFiles).toBe(
      (base.mac as Record<string, unknown>).x64ArchFiles,
    );
  });

  /// The addon is built for every platform -- it has no flag and no way to turn it off -- so
  /// every platform's package takes it from the same place.
  it("does the same on the other platforms", () => {
    for (const platform of [
      [...LINUX, "--distribution-channel", "deb"],
      [...WINDOWS, "--distribution-channel", "windows-installer"],
    ]) {
      const files = applyBuildConfig(base, configFor(platform)).files as unknown[];

      expect(files).toContain("!node_modules/@bitwarden/desktop-napi/*.node");
      expect(files).toContainEqual({
        from: "../desktop_native/napi",
        to: "node_modules/@bitwarden/desktop-napi",
        filter: ["*.node"],
      });
    }
  });
});

describe("the signed Appx", () => {
  const STORE = [...WINDOWS, "--distribution-channel", "microsoft-store"];
  const SIGNED = [...WINDOWS, "--distribution-channel", "windows-appx"];
  const BOTH = [...STORE, "--distribution-channel", "windows-appx"];

  const appxOf = (result: Record<string, unknown>) => result.appx as Record<string, unknown>;

  it("is no longer refused", () => {
    expect(unsupportedChannels(configFor(SIGNED))).toEqual([]);
    expect(unsupportedChannels(configFor(BOTH))).toEqual([]);
  });

  /// It repackages what electron-builder unpacked, so there has to be something unpacked --
  /// even when it is the only channel asked for and no target would otherwise run.
  it("still unpacks the app when nothing else would", () => {
    expect(electronBuilderTargets(configFor(SIGNED))).toEqual(["dir"]);
    expect(electronBuilderTargets(configFor(BOTH))).toEqual(["appx"]);
  });

  it("takes the plain artifact name and gives the Store package the suffix", () => {
    const store = appxOf(applyBuildConfig(base, configFor(BOTH)));
    const signed = appxOf(signedAppxConfig(base, configFor(BOTH), "CN=Bitwarden Inc"));

    expect(store.artifactName).toBe("${productName}-${version}-${arch}-store.${ext}");
    expect(signed.artifactName).toBe("${productName}-${version}-${arch}.${ext}");
  });

  it("leaves the Store name alone when no signed package is being built beside it", () => {
    expect(appxOf(applyBuildConfig(base, configFor(STORE))).artifactName).toBe(
      appxOf(base).artifactName,
    );
  });

  it("keeps the two publishers apart", () => {
    const store = appxOf(applyBuildConfig(base, configFor(BOTH)));
    const signed = appxOf(signedAppxConfig(base, configFor(BOTH), "CN=Bitwarden Inc"));

    // The Store package keeps whatever Microsoft assigned, which is the base configuration's.
    expect(store.publisher).toBe(appxOf(base).publisher);
    expect(signed.publisher).toBe("CN=Bitwarden Inc");
  });

  it("suffixes the beta name too, which the overlay had already changed", () => {
    const store = appxOf(applyBuildConfig(base, configFor([...BOTH, "--channel", "beta"])));
    const signed = appxOf(
      signedAppxConfig(base, configFor([...BOTH, "--channel", "beta"]), "CN=Bitwarden Inc"),
    );

    expect(store.artifactName).toBe("Bitwarden-Beta-${version}-${arch}-store.${ext}");
    expect(signed.artifactName).toBe("Bitwarden-Beta-${version}-${arch}.${ext}");
  });

  it("names the directory electron-builder unpacks each architecture into", () => {
    expect(unpackedDir("x64")).toBe("win-unpacked");
    expect(unpackedDir("arm64")).toBe("win-arm64-unpacked");
    expect(unpackedDir("ia32")).toBe("win-ia32-unpacked");
  });
});
