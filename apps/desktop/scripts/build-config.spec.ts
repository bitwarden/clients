import {
  ARCHITECTURES,
  CONFIG_VERSION,
  BuildError,
  DISTRIBUTION_CHANNELS,
  TARGETS,
  diffKeys,
  parseConfigureArgs,
  resolveBuildDir,
  serializeBuildConfig,
  targetByKey,
  targetName,
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
  // Packaging macOS requires one. Appended, so `MAC_ARGS.slice(n)` still means what it did and
  // a case passing its own certificate later on the line overrides this.
  "--macos-signing-certificate",
  "Developer ID Application: Bitwarden Inc",
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
    expect(() => parseConfigureArgs([...MAC_ARGS, "--with-nothing"])).toThrow(BuildError);
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

  it("rejects a glibc version that is not a version", () => {
    expect(
      validateArgs([
        "--build-dir",
        "b",
        "--architecture",
        "x64",
        "--distribution-channel",
        "deb",
        "--glibc",
        "oldest",
      ]),
    ).toEqual([expect.stringContaining("--glibc must look like 2.35")]);
  });

  it("rejects --glibc outside a Linux build", () => {
    expect(validateArgs([...MAC_ARGS, "--glibc", "2.35"])).toEqual([
      expect.stringContaining("--glibc is only available on linux"),
    ]);
  });

  it("rejects an unknown profile", () => {
    expect(validateArgs([...MAC_ARGS, "--profile", "fast"])).toEqual([
      expect.stringContaining("Unknown --profile 'fast'. Expected one of: debug, release."),
    ]);
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

  /// The proxy is signed separately from the app, before electron-builder runs, so an identity
  /// has to be named rather than discovered -- whatever the channel.
  it("requires a signing certificate for any macOS build", () => {
    const args = ["--build-dir", "b", "--architecture", "universal"];

    for (const channel of ["dmg", "mac-zip", "mac-app-store", "mac-app-store-development"]) {
      expect(validateArgs([...args, "--distribution-channel", channel])).toEqual([
        expect.stringContaining("Packaging macos requires --macos-signing-certificate"),
      ]);
    }
  });

  it("does not ask for one on another platform", () => {
    expect(
      validateArgs(["--build-dir", "b", "--architecture", "x64", "--distribution-channel", "deb"]),
    ).toEqual([]);
  });

  it("refuses an unsigned App Store build, but allows an unsigned development one", () => {
    const args = ["--build-dir", "b", "--architecture", "universal"];
    const unsigned = (channel: string) =>
      validateArgs([
        ...args,
        "--distribution-channel",
        channel,
        "--macos-signing-certificate",
        "none",
      ]);

    expect(unsigned("mac-app-store")).toEqual([
      expect.stringContaining("mac-app-store cannot be built unsigned"),
    ]);
    expect(unsigned("mac-app-store-development")).toEqual([]);
  });

  it("rejects --notarize where Apple would do it, or where there is nothing to notarize", () => {
    const mac = ["--build-dir", "b", "--architecture", "universal"];

    expect(
      validateArgs([
        ...mac,
        "--distribution-channel",
        "mac-app-store",
        "--macos-signing-certificate",
        "x",
        "--notarize",
      ]),
    ).toEqual([expect.stringContaining("Apple does it on submission")]);

    expect(
      validateArgs([
        ...mac,
        "--distribution-channel",
        "dmg",
        "--macos-signing-certificate",
        "none",
        "--notarize",
      ]),
    ).toEqual([expect.stringContaining("--notarize needs a signed app")]);

    expect(
      validateArgs([
        "--build-dir",
        "b",
        "--architecture",
        "x64",
        "--distribution-channel",
        "deb",
        "--notarize",
      ]),
    ).toEqual([expect.stringContaining("--notarize is only available on macos")]);
  });

  it("accepts --notarize for a signed, directly distributed build", () => {
    expect(
      validateArgs([
        "--build-dir",
        "b",
        "--architecture",
        "universal",
        "--distribution-channel",
        "dmg",
        "--macos-signing-certificate",
        "Developer ID Application: Bitwarden Inc",
        "--notarize",
      ]),
    ).toEqual([]);
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

  const APP_STORE_ARGS = [
    "--build-dir",
    "build-mas",
    "--architecture",
    "universal",
    "--distribution-channel",
    "mac-app-store",
    "--macos-signing-certificate",
    "3rd Party Mac Developer Application: Bitwarden Inc",
    "--with-macos-autofill-extension",
  ];

  it("signs the autofill extension according to the distribution channel", () => {
    const developerId = toBuildConfigFromArgs([...MAC_ARGS, "--with-macos-autofill-extension"]);
    const appStore = toBuildConfigFromArgs(APP_STORE_ARGS);

    expect(developerId.derived.macosAutofillExtension).toMatchObject({
      codeSignIdentity: "Developer ID Application",
      provisioningProfileSpecifier: "Bitwarden Desktop Autofill Extension Developer Dis",
    });
    expect(appStore.derived.macosAutofillExtension).toMatchObject({
      codeSignIdentity: "3rd Party Mac Developer Application",
      provisioningProfileSpecifier: "Bitwarden Desktop Autofill App Store 2024",
    });
  });

  it("takes the autofill extension's Xcode configuration from the profile, not the channel", () => {
    const configurationFor = (args: string[]) =>
      toBuildConfigFromArgs(args).derived.macosAutofillExtension?.xcodeConfiguration;

    expect(configurationFor([...MAC_ARGS, "--with-macos-autofill-extension"])).toBe("Debug");
    expect(configurationFor(APP_STORE_ARGS)).toBe("Debug");
    expect(
      configurationFor([...MAC_ARGS, "--with-macos-autofill-extension", "--profile", "release"]),
    ).toBe("Release");
    expect(configurationFor([...APP_STORE_ARGS, "--profile", "release"])).toBe("Release");
  });

  it("signs a debug App Store build the App Store way, which the old naming could not express", () => {
    expect(
      toBuildConfigFromArgs([...APP_STORE_ARGS, "--profile", "debug"]).derived
        .macosAutofillExtension,
    ).toEqual({
      xcodeConfiguration: "Debug",
      signed: true,
      codeSignIdentity: "3rd Party Mac Developer Application",
      provisioningProfileSpecifier: "Bitwarden Desktop Autofill App Store 2024",
    });
  });

  it("does not sign the extension when the build asked for no signing", () => {
    const unsigned = toBuildConfigFromArgs([
      ...MAC_ARGS,
      "--with-macos-autofill-extension",
      "--macos-signing-certificate",
      "none",
    ]);

    expect(unsigned.derived.macosAutofillExtension?.signed).toBe(false);
    expect(
      toBuildConfigFromArgs([...MAC_ARGS, "--with-macos-autofill-extension"]).derived
        .macosAutofillExtension?.signed,
    ).toBe(true);
  });

  it("omits the autofill extension build when the target is off", () => {
    const derived = toBuildConfigFromArgs(MAC_ARGS).derived;

    expect(derived.macosAutofillExtension).toBeUndefined();
    expect(derived.macos?.entitlements.autofillExtension).toBeUndefined();
  });

  it("names an entitlements file for everything a directly distributed build signs", () => {
    const entitlements = (file: string) => `build-mac/intermediates/entitlements/${file}`;

    expect(toBuildConfigFromArgs(MAC_ARGS).derived.macos).toEqual({
      entitlements: {
        app: entitlements("app.plist"),
        appInherit: entitlements("app-inherit.plist"),
        desktopProxy: entitlements("desktop-proxy.plist"),
        desktopProxyInherit: entitlements("desktop-proxy-inherit.plist"),
      },
    });
  });

  it("adds the login helper's for the App Store, and the extension's when it is built", () => {
    const appStore = toBuildConfigFromArgs(APP_STORE_ARGS).derived.macos?.entitlements;
    const withExtension = toBuildConfigFromArgs([...MAC_ARGS, "--with-macos-autofill-extension"])
      .derived.macos?.entitlements;

    expect(appStore?.loginHelper).toBe("build-mas/intermediates/entitlements/login-helper.plist");
    expect(withExtension?.loginHelper).toBeUndefined();
    expect(withExtension?.autofillExtension).toBe(
      "build-mac/intermediates/entitlements/autofill-extension.plist",
    );
  });

  it("gives a beta build its own identifier and name", () => {
    const beta = toBuildConfigFromArgs([...MAC_ARGS, "--channel", "beta"]).derived;
    const stable = toBuildConfigFromArgs(MAC_ARGS).derived;

    expect(beta.appId).toBe("com.bitwarden.beta.desktop");
    expect(beta.productName).toBe("Bitwarden Beta");
    expect(stable.appId).toBe("com.bitwarden.desktop");
    expect(stable.productName).toBe("Bitwarden");
  });

  it("has no macOS identity on another platform", () => {
    expect(toBuildConfigFromArgs(WINDOWS_ARGS).derived.macos).toBeUndefined();
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

  it("gives Linux builds a glibc floor, and no one else one", () => {
    const linux = toBuildConfigFromArgs([
      "--build-dir",
      "build-lin",
      "--architecture",
      "x64",
      "--distribution-channel",
      "deb",
    ]);

    expect(linux.linux).toEqual({ glibc: "2.35" });
    expect(toBuildConfigFromArgs(MAC_ARGS)).not.toHaveProperty("linux");
  });

  it("takes a glibc floor from the caller", () => {
    const config = toBuildConfigFromArgs([
      "--build-dir",
      "build-lin",
      "--architecture",
      "x64",
      "--distribution-channel",
      "deb",
      "--glibc",
      "2.31",
    ]);

    expect(config.linux).toEqual({ glibc: "2.31" });
  });

  it("builds with the debug profile unless asked otherwise", () => {
    expect(toBuildConfigFromArgs(MAC_ARGS).profile).toBe("debug");
    expect(toBuildConfigFromArgs([...MAC_ARGS, "--profile", "release"]).profile).toBe("release");
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
      if (platform === "macos") {
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

describe("targetName", () => {
  it("agrees with the flag every flagged target already answers to", () => {
    for (const target of TARGETS.filter((candidate) => candidate.flag != null)) {
      expect(targetName(target)).toBe(target.flag);
    }
  });

  it("names the targets that have no flag", () => {
    expect(TARGETS.filter((target) => target.flag == null).map(targetName)).toEqual([
      "chromium-import-helper",
      "process-isolation",
      "napi",
    ]);
  });
});

describe("resolveBuildDir", () => {
  const repoRoot = "/repo";
  const projectDir = "/repo/apps/desktop";

  function resolve(argument: string, cwd: string) {
    return resolveBuildDir(argument, cwd, projectDir, repoRoot);
  }

  it("resolves a relative directory against the caller's working directory", () => {
    expect(resolve("out", "/repo/apps/desktop")).toEqual({
      ok: true,
      location: { absolute: "/repo/apps/desktop/out", recorded: "out" },
    });
  });

  it("means the caller's directory, not apps/desktop, when they are not the same", () => {
    expect(resolve("out", "/repo")).toEqual({
      ok: true,
      location: { absolute: "/repo/out", recorded: "../../out" },
    });
  });

  it("accepts an absolute directory inside the repository", () => {
    expect(resolve("/repo/apps/desktop/build-mac", "/anywhere")).toEqual({
      ok: true,
      location: { absolute: "/repo/apps/desktop/build-mac", recorded: "build-mac" },
    });
  });

  it("refuses a directory outside the repository", () => {
    const resolution = resolve("ctx", "/tmp");

    expect(resolution.ok).toBe(false);
    expect(resolution).toMatchObject({
      error: expect.stringContaining("/tmp/ctx, which is not inside the repository at /repo"),
    });
  });

  it("refuses the repository root itself", () => {
    expect(resolve(".", "/repo")).toMatchObject({
      ok: false,
      error: expect.stringContaining("not inside the repository"),
    });
  });

  it("refuses apps/desktop itself", () => {
    expect(resolve(".", "/repo/apps/desktop")).toMatchObject({
      ok: false,
      error: expect.stringContaining("is apps/desktop itself"),
    });
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
