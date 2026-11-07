import {
  ARCHITECTURES,
  CONFIG_VERSION,
  ConfigureError,
  DISTRIBUTION_CHANNELS,
  TARGETS,
  diffKeys,
  parseConfigureArgs,
  serializeBuildConfig,
  targetByKey,
  toBuildConfig,
  validate,
} from "./build-config.mts";

/// A macOS configuration that passes validation, so individual cases only have to say what
/// they change about it.
const MAC_ARGS = [
  "--build-dir",
  "build-mac",
  "--architecture",
  "universal",
  "--distribution-channel",
  "dmg",
];

const WINDOWS_ARGS = [
  "--build-dir",
  "build-win",
  "--architecture",
  "x64",
  "--distribution-channel",
  "windows-installer",
];

function validateArgs(args: string[]): string[] {
  return validate(parseConfigureArgs(args));
}

function toBuildConfigFromArgs(args: string[], resolved = {}) {
  const raw = parseConfigureArgs(args);
  expect(validate(raw)).toEqual([]);
  return toBuildConfig(raw, resolved);
}

describe("parseConfigureArgs", () => {
  it("collects repeated architectures and distribution channels", () => {
    const raw = parseConfigureArgs([
      "--build-dir",
      "build",
      "--architecture",
      "x64",
      "--architecture",
      "arm64",
      "--distribution-channel",
      "deb",
      "--distribution-channel",
      "rpm",
    ]);

    expect(raw.architectures).toEqual(["x64", "arm64"]);
    expect(raw.distributionChannels).toEqual(["deb", "rpm"]);
  });

  it("separates --with and --no target flags", () => {
    const raw = parseConfigureArgs([
      ...MAC_ARGS,
      "--with-macos-autofill-extension",
      "--no-desktop-proxy",
    ]);

    expect(raw.enabledTargets).toEqual(["macos-autofill-extension"]);
    expect(raw.disabledTargets).toEqual(["desktop-proxy"]);
  });

  it("rejects unknown flags", () => {
    expect(() => parseConfigureArgs([...MAC_ARGS, "--with-nothing"])).toThrow(ConfigureError);
  });

  it("exposes a --with/--no pair for every flagged target", () => {
    for (const target of TARGETS) {
      if (target.flag == null) {
        continue;
      }
      expect(() => parseConfigureArgs([...MAC_ARGS, `--with-${target.flag}`])).not.toThrow();
      expect(() => parseConfigureArgs([...MAC_ARGS, `--no-${target.flag}`])).not.toThrow();
    }
  });
});

describe("validate", () => {
  it("accepts a minimal configuration", () => {
    expect(validateArgs(MAC_ARGS)).toEqual([]);
  });

  it("reports every problem at once", () => {
    const errors = validateArgs(["--channel", "nightly", "--build-number", "beta1"]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("--build-dir is required"),
        expect.stringContaining("Unknown --channel 'nightly'"),
        expect.stringContaining("--build-number must be digits"),
        expect.stringContaining("At least one --architecture"),
        expect.stringContaining("At least one --distribution-channel"),
      ]),
    );
  });

  it("rejects an absolute build directory", () => {
    const errors = validateArgs(["--build-dir", "/tmp/build", ...MAC_ARGS.slice(2)]);

    expect(errors).toEqual([expect.stringContaining("must be relative to apps/desktop")]);
  });

  it("names the accepted values for an unknown distribution channel", () => {
    const errors = validateArgs([...MAC_ARGS.slice(0, 4), "--distribution-channel", "msi"]);

    expect(errors).toEqual([
      expect.stringContaining("Unknown --distribution-channel 'msi'. Expected one of: dmg,"),
    ]);
  });

  it("rejects distribution channels from more than one platform", () => {
    const errors = validateArgs([...MAC_ARGS, "--distribution-channel", "deb"]);

    expect(errors).toEqual([expect.stringContaining("span multiple platforms")]);
  });

  it("rejects an App Store build combined with another channel", () => {
    const errors = validateArgs([
      ...MAC_ARGS,
      "--distribution-channel",
      "mac-app-store",
      "--macos-signing-certificate",
      "3rd Party Mac Developer Application: Bitwarden Inc",
    ]);

    expect(errors).toEqual([expect.stringContaining("cannot be combined with dmg")]);
  });

  it("allows the unpacked directory alongside any channel", () => {
    expect(validateArgs([...MAC_ARGS, "--distribution-channel", "directory"])).toEqual([]);
  });

  it("rejects an architecture the platform cannot produce", () => {
    const errors = validateArgs([...WINDOWS_ARGS, "--architecture", "universal"]);

    expect(errors).toEqual([expect.stringContaining("--architecture universal is not available")]);
  });

  it("rejects a target flag for another platform", () => {
    const errors = validateArgs([...MAC_ARGS, "--with-windows-passkey-plugin"]);

    expect(errors).toEqual([
      expect.stringContaining("--with-windows-passkey-plugin is not available on macos"),
    ]);
  });

  it("ignores a --no flag for another platform", () => {
    expect(validateArgs([...MAC_ARGS, "--no-windows-passkey-plugin"])).toEqual([]);
  });

  it("rejects enabling and disabling the same target", () => {
    const errors = validateArgs([...MAC_ARGS, "--with-desktop-proxy", "--no-desktop-proxy"]);

    expect(errors).toEqual([
      expect.stringContaining("--with-desktop-proxy and --no-desktop-proxy are mutually exclusive"),
    ]);
  });

  it("rejects macOS-only options on other platforms", () => {
    const errors = validateArgs([
      ...WINDOWS_ARGS,
      "--safari-extension",
      "safari.appex",
      "--macos-signing-certificate",
      "none",
      "--provisioning-profile",
      "profile.provisionprofile",
    ]);

    expect(errors).toEqual([
      expect.stringContaining("--safari-extension is only available on macos"),
      expect.stringContaining("--macos-signing-certificate is only available on macos"),
      expect.stringContaining("--provisioning-profile is only available on macos"),
    ]);
  });

  it("requires a signing certificate for the App Store", () => {
    const args = ["--build-dir", "b", "--architecture", "universal"];

    expect(validateArgs([...args, "--distribution-channel", "mac-app-store"])).toEqual([
      expect.stringContaining("mac-app-store requires --macos-signing-certificate"),
    ]);
    expect(
      validateArgs([
        ...args,
        "--distribution-channel",
        "mac-app-store",
        "--macos-signing-certificate",
        "none",
      ]),
    ).toEqual([expect.stringContaining("mac-app-store requires --macos-signing-certificate")]);
  });

  it("allows a beta App Store build", () => {
    expect(
      validateArgs([
        "--build-dir",
        "b",
        "--architecture",
        "universal",
        "--channel",
        "beta",
        "--distribution-channel",
        "mac-app-store",
        "--macos-signing-certificate",
        "3rd Party Mac Developer Application: Bitwarden Inc",
      ]),
    ).toEqual([]);
  });
});

describe("toBuildConfig", () => {
  it("applies target defaults for the selected platform", () => {
    const config = toBuildConfigFromArgs(MAC_ARGS);

    expect(config.targets).toEqual({ desktopProxy: true, napi: true });
  });

  it("enables the Windows-only targets on a Windows build", () => {
    const config = toBuildConfigFromArgs(WINDOWS_ARGS);

    expect(config.targets).toEqual({
      desktopProxy: true,
      windowsPasskeyPlugin: true,
      chromiumImportHelper: true,
      napi: true,
    });
  });

  it("enables the Linux-only targets on a Linux build", () => {
    const config = toBuildConfigFromArgs([
      "--build-dir",
      "build-lin",
      "--architecture",
      "x64",
      "--distribution-channel",
      "deb",
    ]);

    expect(config.targets).toEqual({
      desktopProxy: true,
      processIsolation: true,
      napi: true,
    });
  });

  it("adds an opt-in target and drops an opted-out one", () => {
    const config = toBuildConfigFromArgs([
      ...MAC_ARGS,
      "--with-macos-autofill-extension",
      "--no-desktop-proxy",
    ]);

    expect(config.targets).toEqual({ macosAutofillExtension: true, napi: true });
    expect(config.intermediates).not.toHaveProperty("desktopProxy");
  });

  it("places each intermediate at the path mirroring its source", () => {
    const config = toBuildConfigFromArgs([...MAC_ARGS, "--with-macos-autofill-extension"]);

    expect(config.intermediates).toEqual({
      macosAutofillExtension: "build-mac/intermediates/macos/autofill-extension.appex",
      desktopProxy: "build-mac/intermediates/desktop_native/proxy",
      napi: "build-mac/intermediates/desktop_native/napi",
    });
    expect(config.directories).toEqual({
      intermediates: "build-mac/intermediates",
      appSource: "build-mac/intermediates/src",
      dist: "build-mac/dist",
    });
  });

  it("derives the autofill extension build from the distribution channel", () => {
    const developerId = toBuildConfigFromArgs([...MAC_ARGS, "--with-macos-autofill-extension"]);
    const appStore = toBuildConfigFromArgs([
      "--build-dir",
      "build-mas",
      "--architecture",
      "universal",
      "--distribution-channel",
      "mac-app-store",
      "--macos-signing-certificate",
      "3rd Party Mac Developer Application: Bitwarden Inc",
      "--with-macos-autofill-extension",
    ]);

    expect(developerId.derived.macosAutofillExtension).toEqual({
      xcodeConfiguration: "ReleaseDeveloper",
      codeSignIdentity: "Developer ID Application",
      provisioningProfileSpecifier: "Bitwarden Desktop Autofill Extension Developer Dis",
    });
    expect(appStore.derived.macosAutofillExtension).toEqual({
      xcodeConfiguration: "ReleaseAppStore",
      codeSignIdentity: "3rd Party Mac Developer Application",
      provisioningProfileSpecifier: "Bitwarden Desktop Autofill App Store 2024",
    });
  });

  it("omits the autofill extension build when the target is off", () => {
    expect(toBuildConfigFromArgs(MAC_ARGS).derived).toEqual({ platform: "macos" });
  });

  it("records the provisioning profile alongside where it was copied", () => {
    const config = toBuildConfigFromArgs(
      [...MAC_ARGS, "--provisioning-profile", "Bitwarden Desktop Developer ID"],
      { provisioningProfileName: "Bitwarden Desktop Developer ID" },
    );

    expect(config.macos?.provisioningProfile).toEqual({
      requested: "Bitwarden Desktop Developer ID",
      name: "Bitwarden Desktop Developer ID",
      path: "build-mac/intermediates/provisioning/app.provisionprofile",
    });
  });

  it("keeps a dependency outside the build directory", () => {
    const config = toBuildConfigFromArgs(
      [...MAC_ARGS, "--safari-extension", "../../out/safari.appex"],
      {
        safariExtensionPath: "../../out/safari.appex",
      },
    );

    expect(config.dependencies).toEqual({ safariExtension: { path: "../../out/safari.appex" } });
    expect(config.intermediates).not.toHaveProperty("safariExtension");
  });

  it("defaults the channel and omits an unset build number", () => {
    const config = toBuildConfigFromArgs(MAC_ARGS);

    expect(config.channel).toBe("stable");
    expect(config).not.toHaveProperty("buildNumber");
    expect(config.configVersion).toBe(CONFIG_VERSION);
  });

  it("normalizes a trailing separator on the build directory", () => {
    const config = toBuildConfigFromArgs(["--build-dir", "build-mac/", ...MAC_ARGS.slice(2)]);

    expect(config.buildDir).toBe("build-mac");
    expect(config.directories.dist).toBe("build-mac/dist");
  });

  it("serializes the same regardless of the order options were given", () => {
    const first = toBuildConfigFromArgs([
      "--build-dir",
      "build-lin",
      "--architecture",
      "arm64",
      "--architecture",
      "x64",
      "--distribution-channel",
      "rpm",
      "--distribution-channel",
      "deb",
    ]);
    const second = toBuildConfigFromArgs([
      "--distribution-channel",
      "deb",
      "--architecture",
      "x64",
      "--distribution-channel",
      "rpm",
      "--build-dir",
      "build-lin",
      "--architecture",
      "arm64",
    ]);

    expect(serializeBuildConfig(first)).toEqual(serializeBuildConfig(second));
    expect(serializeBuildConfig(first).endsWith("\n")).toBe(true);
  });

  it("covers every distribution channel with a platform or the unpacked output", () => {
    for (const [channel, platform] of Object.entries(DISTRIBUTION_CHANNELS)) {
      if (platform == null) {
        continue;
      }
      const architecture = platform === "windows" ? "x64" : ARCHITECTURES[1];
      const args = [
        "--build-dir",
        "b",
        "--architecture",
        architecture,
        "--distribution-channel",
        channel,
      ];
      if (channel === "mac-app-store") {
        args.push("--macos-signing-certificate", "3rd Party Mac Developer Application");
      }

      expect(toBuildConfigFromArgs(args).derived.platform).toBe(platform);
    }
  });
});

describe("targetByKey", () => {
  it("finds a definition, and returns nothing for a key that is not a target", () => {
    expect(targetByKey("desktopProxy")).toMatchObject({
      toolchain: "rust",
      intermediate: "desktop_native/proxy",
    });
    expect(targetByKey("desktop_proxy")).toBeUndefined();
  });
});

describe("diffKeys", () => {
  it("names the leaves that changed", () => {
    const before = toBuildConfigFromArgs(MAC_ARGS);
    const after = toBuildConfigFromArgs([
      ...MAC_ARGS,
      "--no-desktop-proxy",
      "--build-number",
      "42",
    ]);

    expect(diffKeys(before, after)).toEqual([
      "buildNumber",
      "intermediates.desktopProxy",
      "targets.desktopProxy",
    ]);
  });

  it("reports nothing for an unchanged configuration", () => {
    expect(diffKeys(toBuildConfigFromArgs(MAC_ARGS), toBuildConfigFromArgs(MAC_ARGS))).toEqual([]);
  });
});
