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
import { args } from "./spec-support.ts";

/// Packaging macOS requires an identity whatever the channel, so it is part of the baseline.
/// Named separately for the cases that vary the rest of the line around it.
const MAC_SIGNING = '--macos-signing-certificate "Developer ID Application: Bitwarden Inc"';

/// Command lines that pass validation, so individual cases only have to say what they change.
/// An option given later on the line replaces an earlier one.
const MAC = `--build-dir build-mac --architecture universal --distribution-channel dmg ${MAC_SIGNING}`;
const WINDOWS = "--build-dir build-win --architecture x64 --distribution-channel windows-installer";
const LINUX = "--build-dir build-lin --architecture x64 --distribution-channel deb";

function validateArgs(line: string): string[] {
  return validate(parseConfigureArgs(args(line)));
}

function toBuildConfigFromArgs(line: string, resolved = {}) {
  const raw = parseConfigureArgs(args(line));
  expect(validate(raw)).toEqual([]);
  return toBuildConfig(raw, resolved);
}

describe("parseConfigureArgs", () => {
  it("collects repeated architectures and distribution channels", () => {
    const raw = parseConfigureArgs(
      args(
        "--build-dir build --architecture x64 --architecture arm64 " +
          "--distribution-channel deb --distribution-channel rpm",
      ),
    );

    expect(raw.architectures).toEqual(["x64", "arm64"]);
    expect(raw.distributionChannels).toEqual(["deb", "rpm"]);
  });

  it("separates --with and --no target flags", () => {
    const raw = parseConfigureArgs(
      args(`${MAC} --with-macos-autofill-extension --no-desktop-proxy`),
    );

    expect(raw.enabledTargets).toEqual(["macos-autofill-extension"]);
    expect(raw.disabledTargets).toEqual(["desktop-proxy"]);
  });

  it("rejects unknown flags", () => {
    expect(() => parseConfigureArgs(args(`${MAC} --with-nothing`))).toThrow(BuildError);
  });

  it("exposes a --with/--no pair for every flagged target", () => {
    for (const target of TARGETS) {
      if (target.flag == null) {
        continue;
      }
      expect(() => parseConfigureArgs(args(`${MAC} --with-${target.flag}`))).not.toThrow();
      expect(() => parseConfigureArgs(args(`${MAC} --no-${target.flag}`))).not.toThrow();
    }
  });
});

describe("validate", () => {
  it("accepts a minimal configuration", () => {
    expect(validateArgs(MAC)).toEqual([]);
  });

  it("reports every problem at once", () => {
    const errors = validateArgs("--channel nightly --build-number beta1");

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

  /// Each of these is a single problem with the command line, so the whole error list is
  /// asserted: an extra error here would mean one option's mistake was reported as two.
  it.each([
    [
      "a glibc version that is not a version",
      `${LINUX} --glibc oldest`,
      "--glibc must look like 2.35",
    ],
    ["--glibc outside a Linux build", `${MAC} --glibc 2.35`, "--glibc is only available on linux"],
    [
      "an unknown profile",
      `${MAC} --profile fast`,
      "Unknown --profile 'fast'. Expected one of: debug, release.",
    ],
    [
      "an unknown distribution channel, naming the accepted values",
      "--build-dir build-mac --architecture universal --distribution-channel msi",
      "Unknown --distribution-channel 'msi'. Expected one of: dmg,",
    ],
    [
      "distribution channels from more than one platform",
      `${MAC} --distribution-channel deb`,
      "span multiple platforms",
    ],
    [
      "an App Store build combined with another channel",
      `${MAC} --distribution-channel mac-app-store ` +
        '--macos-signing-certificate "3rd Party Mac Developer Application: Bitwarden Inc"',
      "cannot be combined with dmg",
    ],
    [
      "an architecture the platform cannot produce",
      `${WINDOWS} --architecture universal`,
      "--architecture universal is not available",
    ],
    [
      "a target flag for another platform",
      `${MAC} --with-windows-passkey-plugin`,
      "--with-windows-passkey-plugin is not available on macos",
    ],
    [
      "enabling and disabling the same target",
      `${MAC} --with-desktop-proxy --no-desktop-proxy`,
      "--with-desktop-proxy and --no-desktop-proxy are mutually exclusive",
    ],
    [
      "--notarize where Apple would do it on submission",
      "--build-dir b --architecture universal --distribution-channel mac-app-store " +
        "--macos-signing-certificate x --notarize",
      "Apple does it on submission",
    ],
    [
      "--notarize with nothing to notarize",
      "--build-dir b --architecture universal --distribution-channel dmg " +
        "--macos-signing-certificate none --notarize",
      "--notarize needs a signed app",
    ],
    ["--notarize off macOS", `${LINUX} --notarize`, "--notarize is only available on macos"],
    [
      "an unsigned App Store build",
      "--build-dir b --architecture universal --distribution-channel mac-app-store " +
        "--macos-signing-certificate none",
      "mac-app-store cannot be built unsigned",
    ],
  ])("rejects %s", (_case, line, expected) => {
    expect(validateArgs(line)).toEqual([expect.stringContaining(expected)]);
  });

  it.each([
    ["the unpacked directory alongside any channel", `${MAC} --distribution-channel directory`],
    ["a --no flag for a target on another platform", `${MAC} --no-windows-passkey-plugin`],
    ["a build with no signing certificate off macOS", LINUX],
    [
      "an unsigned App Store development build",
      "--build-dir b --architecture universal " +
        "--distribution-channel mac-app-store-development --macos-signing-certificate none",
    ],
    ["--notarize for a signed, directly distributed build", `${MAC} --notarize`],
    [
      "a beta App Store build",
      "--build-dir b --architecture universal --channel beta " +
        "--distribution-channel mac-app-store " +
        '--macos-signing-certificate "3rd Party Mac Developer Application: Bitwarden Inc"',
    ],
  ])("accepts %s", (_case, line) => {
    expect(validateArgs(line)).toEqual([]);
  });

  /// The proxy is signed separately from the app, before electron-builder runs, so an identity
  /// has to be named rather than discovered -- whatever the channel.
  it.each(["dmg", "mac-zip", "mac-app-store", "mac-app-store-development"])(
    "requires a signing certificate for a %s build",
    (channel) => {
      expect(
        validateArgs(`--build-dir b --architecture universal --distribution-channel ${channel}`),
      ).toEqual([expect.stringContaining("Packaging macos requires --macos-signing-certificate")]);
    },
  );

  it("rejects macOS-only options on other platforms", () => {
    const errors = validateArgs(
      `${WINDOWS} --safari-extension safari.appex --macos-signing-certificate none ` +
        "--provisioning-profile profile.provisionprofile",
    );

    expect(errors).toEqual([
      expect.stringContaining("--safari-extension is only available on macos"),
      expect.stringContaining("--macos-signing-certificate is only available on macos"),
      expect.stringContaining("--provisioning-profile is only available on macos"),
    ]);
  });
});

describe("toBuildConfig", () => {
  /// An App Store line, which signs and provisions differently from a directly distributed one.
  const APP_STORE =
    "--build-dir build-mas --architecture universal --distribution-channel mac-app-store " +
    '--macos-signing-certificate "3rd Party Mac Developer Application: Bitwarden Inc" ' +
    "--with-macos-autofill-extension";

  it("applies target defaults for the selected platform", () => {
    const config = toBuildConfigFromArgs(MAC);

    expect(config.targets).toEqual({ desktopProxy: true, napi: true });
  });

  it("enables the Windows-only targets on a Windows build", () => {
    const config = toBuildConfigFromArgs(WINDOWS);

    expect(config.targets).toEqual({
      desktopProxy: true,
      windowsPasskeyPlugin: true,
      chromiumImportHelper: true,
      napi: true,
    });
  });

  it("enables the Linux-only targets on a Linux build", () => {
    const config = toBuildConfigFromArgs(LINUX);

    expect(config.targets).toEqual({
      desktopProxy: true,
      processIsolation: true,
      napi: true,
    });
  });

  it("adds an opt-in target and drops an opted-out one", () => {
    const config = toBuildConfigFromArgs(
      `${MAC} --with-macos-autofill-extension --no-desktop-proxy`,
    );

    expect(config.targets).toEqual({ macosAutofillExtension: true, napi: true });
    expect(config.intermediates).not.toHaveProperty("desktopProxy");
  });

  it("places each intermediate at the path mirroring its source", () => {
    const config = toBuildConfigFromArgs(`${MAC} --with-macos-autofill-extension`);

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

  it("signs the autofill extension according to the distribution channel", () => {
    const developerId = toBuildConfigFromArgs(`${MAC} --with-macos-autofill-extension`);
    const appStore = toBuildConfigFromArgs(APP_STORE);

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
    const configurationFor = (line: string) =>
      toBuildConfigFromArgs(line).derived.macosAutofillExtension?.xcodeConfiguration;

    expect(configurationFor(`${MAC} --with-macos-autofill-extension`)).toBe("Debug");
    expect(configurationFor(APP_STORE)).toBe("Debug");
    expect(configurationFor(`${MAC} --with-macos-autofill-extension --profile release`)).toBe(
      "Release",
    );
    expect(configurationFor(`${APP_STORE} --profile release`)).toBe("Release");
  });

  it("signs a debug App Store build the App Store way, which the old naming could not express", () => {
    expect(
      toBuildConfigFromArgs(`${APP_STORE} --profile debug`).derived.macosAutofillExtension,
    ).toEqual({
      xcodeConfiguration: "Debug",
      signed: true,
      codeSignIdentity: "3rd Party Mac Developer Application",
      provisioningProfileSpecifier: "Bitwarden Desktop Autofill App Store 2024",
    });
  });

  it("does not sign the extension when the build asked for no signing", () => {
    const unsigned = toBuildConfigFromArgs(
      `${MAC} --with-macos-autofill-extension --macos-signing-certificate none`,
    );

    expect(unsigned.derived.macosAutofillExtension?.signed).toBe(false);
    expect(
      toBuildConfigFromArgs(`${MAC} --with-macos-autofill-extension`).derived.macosAutofillExtension
        ?.signed,
    ).toBe(true);
  });

  it("omits the autofill extension build when the target is off", () => {
    const derived = toBuildConfigFromArgs(MAC).derived;

    expect(derived.macosAutofillExtension).toBeUndefined();
    expect(derived.macos?.entitlements.autofillExtension).toBeUndefined();
  });

  it("names an entitlements file for everything a directly distributed build signs", () => {
    const entitlements = (file: string) => `build-mac/intermediates/entitlements/${file}`;

    expect(toBuildConfigFromArgs(MAC).derived.macos).toEqual({
      entitlements: {
        app: entitlements("app.plist"),
        appInherit: entitlements("app-inherit.plist"),
        desktopProxy: entitlements("desktop-proxy.plist"),
        desktopProxyInherit: entitlements("desktop-proxy-inherit.plist"),
      },
    });
  });

  it("adds the login helper's for the App Store, and the extension's when it is built", () => {
    const appStore = toBuildConfigFromArgs(APP_STORE).derived.macos?.entitlements;
    const withExtension = toBuildConfigFromArgs(`${MAC} --with-macos-autofill-extension`).derived
      .macos?.entitlements;

    expect(appStore?.loginHelper).toBe("build-mas/intermediates/entitlements/login-helper.plist");
    expect(withExtension?.loginHelper).toBeUndefined();
    expect(withExtension?.autofillExtension).toBe(
      "build-mac/intermediates/entitlements/autofill-extension.plist",
    );
  });

  it("gives a beta build its own identifier and name", () => {
    const beta = toBuildConfigFromArgs(`${MAC} --channel beta`).derived;
    const stable = toBuildConfigFromArgs(MAC).derived;

    expect(beta.appId).toBe("com.bitwarden.beta.desktop");
    expect(beta.productName).toBe("Bitwarden Beta");
    expect(stable.appId).toBe("com.bitwarden.desktop");
    expect(stable.productName).toBe("Bitwarden");
  });

  it("has no macOS identity on another platform", () => {
    expect(toBuildConfigFromArgs(WINDOWS).derived.macos).toBeUndefined();
  });

  it("records the provisioning profile alongside where it was copied", () => {
    const config = toBuildConfigFromArgs(
      `${MAC} --provisioning-profile "Bitwarden Desktop Developer ID"`,
      { provisioningProfileName: "Bitwarden Desktop Developer ID" },
    );

    expect(config.macos?.provisioningProfile).toEqual({
      requested: "Bitwarden Desktop Developer ID",
      name: "Bitwarden Desktop Developer ID",
      path: "build-mac/intermediates/provisioning/app.provisionprofile",
    });
  });

  it("keeps a dependency outside the build directory", () => {
    const config = toBuildConfigFromArgs(`${MAC} --safari-extension ../../out/safari.appex`, {
      safariExtensionPath: "../../out/safari.appex",
    });

    expect(config.dependencies).toEqual({ safariExtension: { path: "../../out/safari.appex" } });
    expect(config.intermediates).not.toHaveProperty("safariExtension");
  });

  it("gives Linux builds a glibc floor, and no one else one", () => {
    expect(toBuildConfigFromArgs(LINUX).linux).toEqual({ glibc: "2.35" });
    expect(toBuildConfigFromArgs(MAC)).not.toHaveProperty("linux");
  });

  it("takes a glibc floor from the caller", () => {
    expect(toBuildConfigFromArgs(`${LINUX} --glibc 2.31`).linux).toEqual({ glibc: "2.31" });
  });

  it("builds with the debug profile unless asked otherwise", () => {
    expect(toBuildConfigFromArgs(MAC).profile).toBe("debug");
    expect(toBuildConfigFromArgs(`${MAC} --profile release`).profile).toBe("release");
  });

  it("defaults the channel and omits an unset build number", () => {
    const config = toBuildConfigFromArgs(MAC);

    expect(config.channel).toBe("stable");
    expect(config).not.toHaveProperty("buildNumber");
    expect(config.configVersion).toBe(CONFIG_VERSION);
  });

  it("normalizes a trailing separator on the build directory", () => {
    const config = toBuildConfigFromArgs(
      `--build-dir build-mac/ --architecture universal --distribution-channel dmg ${MAC_SIGNING}`,
    );

    expect(config.buildDir).toBe("build-mac");
    expect(config.directories.dist).toBe("build-mac/dist");
  });

  it("serializes the same regardless of the order options were given", () => {
    const first = toBuildConfigFromArgs(
      "--build-dir build-lin --architecture arm64 --architecture x64 " +
        "--distribution-channel rpm --distribution-channel deb",
    );
    const second = toBuildConfigFromArgs(
      "--distribution-channel deb --architecture x64 --distribution-channel rpm " +
        "--build-dir build-lin --architecture arm64",
    );

    expect(serializeBuildConfig(first)).toEqual(serializeBuildConfig(second));
    expect(serializeBuildConfig(first).endsWith("\n")).toBe(true);
  });

  it("covers every distribution channel with a platform or the unpacked output", () => {
    for (const [channel, platform] of Object.entries(DISTRIBUTION_CHANNELS)) {
      if (platform == null) {
        continue;
      }
      const architecture = platform === "windows" ? "x64" : ARCHITECTURES[1];
      const signing =
        platform === "macos"
          ? '--macos-signing-certificate "3rd Party Mac Developer Application"'
          : "";

      const config = toBuildConfigFromArgs(
        `--build-dir b --architecture ${architecture} --distribution-channel ${channel} ${signing}`,
      );

      expect(config.derived.platform).toBe(platform);
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
    const before = toBuildConfigFromArgs(MAC);
    const after = toBuildConfigFromArgs(`${MAC} --no-desktop-proxy --build-number 42`);

    expect(diffKeys(before, after)).toEqual([
      "buildNumber",
      "intermediates.desktopProxy",
      "targets.desktopProxy",
    ]);
  });

  it("reports nothing for an unchanged configuration", () => {
    expect(diffKeys(toBuildConfigFromArgs(MAC), toBuildConfigFromArgs(MAC))).toEqual([]);
  });
});
