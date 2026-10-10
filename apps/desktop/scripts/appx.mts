/* eslint-disable no-console */

/// Packaging a Windows Appx from a machine that is not Windows.
///
/// electron-builder packs an Appx with Microsoft's `makeappx`, which only runs on Windows, so
/// on any other host the package is built with `makemsix` from the msix-packaging project and
/// signed with `osslsigncode`. Everything else about the package is the same: the same unpacked
/// app that electron-builder produced, the same assets, and a manifest saying the same things
/// as the one electron-builder would have generated.
///
/// This replaces scripts/appx-cross-build.ps1, which had to work out for itself what kind of
/// build it was in -- reading electron-builder.json and package.json, taking `-Beta` and
/// `-Release` switches, and rebuilding the native code and the renderer before packaging any of
/// it. All of that is settled by the time this runs: it reads the configuration and packages
/// what the earlier steps left behind.
///
/// The manifest rendering is pure and exported for testing; the packaging around it is not.

import { execFileSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";

import { type BuildConfig, type Architecture, BuildError } from "./build-config.mts";
import { projectDir } from "./build-support.mts";

/// Mirrors electron-builder's own Appx manifest, so both paths produce the same package.
const MANIFEST_TEMPLATE = "custom-appx-manifest.xml";
/// Tile and splash images, which electron-builder would take from the build resources.
const ASSETS_DIR = "resources/appx";
/// Where the plugin authenticator's COM class ID is written down, and read from at runtime.
const RESOURCES_DIR = "resources";

/// electron-builder's defaults when `appx.minVersion` is unset.
const DEFAULT_MIN_VERSION: Record<string, string> = {
  arm64: "10.0.16299.0",
  default: "10.0.14316.0",
};

/// `${clsid:<file>}` names the plugin config holding the COM class ID. The manifest cannot carry
/// the class ID literally: the app reads it from that same file at runtime, and a package
/// declaring one it never serves takes the registration from the app that does.
const CLSID_MACRO = /\$\{clsid:([\w.-]+)\}/g;

export interface AppxManifestValues {
  arch: string;
  applicationId: string;
  backgroundColor: string;
  customExtensions: string;
  displayName: string;
  executable: string;
  identityName: string;
  maxVersionTested: string;
  minVersion: string;
  publisher: string;
  publisherDisplayName: string;
  version: string;
}

/// Fills the template in, resolves the class ID macros, and drops the comments.
///
/// The comments explain the template and the extensions file to whoever edits them, and none of
/// that belongs in a shipped package. A regular expression is enough to remove them here
/// because the input is a file in this repository rather than arbitrary XML -- unlike
/// scripts/appx-manifest-created.js, which parses, because it is handed a manifest
/// electron-builder generated.
export function renderAppxManifest(
  template: string,
  values: AppxManifestValues,
  clsid: (configFile: string) => string,
): string {
  let manifest = template;

  for (const [key, value] of Object.entries(values)) {
    manifest = manifest.split(`\${${key}}`).join(value);
  }

  // Only the channels that declare custom extensions declare the COM server, and the class ID
  // lives in those extensions. A channel that has extensions but no macro has lost the
  // registration, which is worth failing over; one with no extensions never had it.
  const hasMacro = CLSID_MACRO.test(manifest);
  CLSID_MACRO.lastIndex = 0;
  if (values.customExtensions !== "" && !hasMacro) {
    throw new BuildError(
      "The Appx extensions declare no ${clsid:<file>} macro to resolve. Check that " +
        "appx.customExtensionsPath names an extensions file declaring the COM server.",
    );
  }
  manifest = manifest.replace(CLSID_MACRO, (_, configFile: string) => clsid(configFile));

  const remaining = /\$\{(\w+)\}/.exec(manifest);
  if (remaining != null) {
    throw new BuildError(`The Appx manifest still has an unfilled \${${remaining[1]}} in it.`);
  }

  return manifest.replace(/^\s*<!--[\s\S]*?-->\s*$/gm, "").replace(/\n{3,}/g, "\n\n");
}

/// The four-part version an Appx wants, from the three-part one everything else uses.
///
/// electron-builder builds the same thing from the app version and `buildVersion`, so a package
/// built here and one built on Windows from the same configuration carry the same version.
/// appx-cross-build.ps1 used the time of day instead, because it had no build number to use.
export function appxVersion(appVersion: string, buildNumber: string | undefined): string {
  const parts = appVersion.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new BuildError(`Cannot build an Appx version from '${appVersion}'; expected x.y.z.`);
  }
  return `${parts.join(".")}.${buildNumber ?? "0"}`;
}

export interface CrossPackageOptions {
  config: BuildConfig;
  /// The electron-builder configuration this build resolved to, which is where the Appx
  /// identity, the publisher and the tile colours are written down.
  resolved: Record<string, unknown>;
  architecture: Architecture;
  /// The app directory electron-builder unpacked, absolute.
  unpacked: string;
  appVersion: string;
}

/// Packages one architecture, returning the file it wrote.
export function crossPackageAppx(options: CrossPackageOptions): string {
  const { config, resolved, architecture, unpacked, appVersion } = options;
  const appx = (resolved.appx ?? {}) as Record<string, unknown>;

  const staging = path.resolve(projectDir, config.directories.intermediates, "appx", architecture);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  // makemsix packs a directory, so the package is assembled as one first: the app as
  // electron-builder unpacked it, the tile images beside it, and the manifest describing both.
  cpSync(unpacked, path.join(staging, "app"), { recursive: true, verbatimSymlinks: true });
  cpSync(path.join(projectDir, ASSETS_DIR), path.join(staging, "assets"), { recursive: true });

  const manifest = renderAppxManifest(
    readFileSync(path.join(projectDir, MANIFEST_TEMPLATE), "utf8"),
    manifestValues({ config, appx, architecture, appVersion }),
    (configFile) => readClsid(configFile),
  );
  writeFileSync(path.join(staging, "AppxManifest.xml"), manifest);

  const output = path.resolve(projectDir, config.directories.dist);
  mkdirSync(output, { recursive: true });

  const signing = config.windows?.signAppx === true ? signingCredentials() : undefined;
  const name = artifactName(appx, config, architecture, appVersion);
  // Signed in place would mean makemsix and osslsigncode writing the same file, so the
  // unsigned package is built beside it and consumed.
  const unsigned = path.join(output, signing == null ? name : `${name}.unsigned`);

  rmSync(unsigned, { force: true });
  run("makemsix", ["pack", "-d", staging, "-p", unsigned]);

  if (signing == null) {
    console.log(`Packaged ${path.relative(projectDir, unsigned)} (unsigned)`);
    return unsigned;
  }

  const signed = path.join(output, name);
  signAppx(unsigned, signed, signing);
  rmSync(unsigned, { force: true });
  console.log(`Packaged ${path.relative(projectDir, signed)}`);
  return signed;
}

export interface AppxSigningCredentials {
  certificate: string;
  password: string;
}

/// Read from the environment rather than the configuration.
///
/// The configuration is written at the start of a build and carried between machines; the
/// certificate is a secret, and on CI it is not available until the moment it is used, which is
/// long after configure ran. So the configuration records only that the package has to be
/// signed, and the certificate arrives here.
function signingCredentials(): AppxSigningCredentials {
  const certificate = process.env.APPX_CERTIFICATE;
  const password = process.env.CERTIFICATE_PASSWORD;

  if (certificate == null || certificate === "" || password == null || password === "") {
    throw new BuildError(
      "--sign-appx needs the signing certificate in the environment: APPX_CERTIFICATE with the " +
        "path to a PKCS#12 file, and CERTIFICATE_PASSWORD with its password.",
    );
  }
  if (!existsSync(certificate)) {
    throw new BuildError(`APPX_CERTIFICATE names ${certificate}, which is not there.`);
  }

  return { certificate, password };
}

function manifestValues(options: {
  config: BuildConfig;
  appx: Record<string, unknown>;
  architecture: Architecture;
  appVersion: string;
}): AppxManifestValues {
  const { config, appx, architecture, appVersion } = options;
  const minVersion =
    asString(appx.minVersion) ?? DEFAULT_MIN_VERSION[architecture] ?? DEFAULT_MIN_VERSION.default;

  return {
    arch: architecture,
    applicationId: required(appx, "applicationId"),
    backgroundColor: required(appx, "backgroundColor"),
    customExtensions: customExtensions(appx),
    displayName: config.derived.productName,
    // Relative to the package root, where the app was staged.
    executable: `app\\${config.derived.productName}.exe`,
    identityName: required(appx, "identityName"),
    maxVersionTested: asString(appx.maxVersionTested) ?? minVersion,
    minVersion,
    publisher: required(appx, "publisher"),
    publisherDisplayName: required(appx, "publisherDisplayName"),
    version: appxVersion(appVersion, config.buildNumber),
  };
}

/// The extensions file is inlined into the manifest verbatim, exactly as electron-builder
/// inlines it. Recorded relative to apps/desktop, like every other path in the configuration.
function customExtensions(appx: Record<string, unknown>): string {
  const configured = asString(appx.customExtensionsPath);
  if (configured == null) {
    return "";
  }

  const file = path.resolve(projectDir, configured);
  if (!existsSync(file)) {
    throw new BuildError(`appx.customExtensionsPath names ${file}, which is not there.`);
  }
  return readFileSync(file, "utf8");
}

function readClsid(configFile: string): string {
  const file = path.join(projectDir, RESOURCES_DIR, configFile);
  if (!existsSync(file)) {
    throw new BuildError(`The Appx manifest names ${file} for a class ID, but it is not there.`);
  }
  const { clsid } = JSON.parse(readFileSync(file, "utf8")) as { clsid?: string };
  if (clsid == null || clsid === "") {
    throw new BuildError(`${file} declares no plugin authenticator clsid.`);
  }
  return clsid;
}

/// `appx.artifactName` with electron-builder's macros filled in, so the package is named the
/// same whichever host built it.
function artifactName(
  appx: Record<string, unknown>,
  config: BuildConfig,
  architecture: Architecture,
  appVersion: string,
): string {
  const template = asString(appx.artifactName) ?? "${productName}-${version}-${arch}.${ext}";

  return template
    .split("${productName}")
    .join(config.derived.productName)
    .split("${version}")
    .join(appVersion)
    .split("${arch}")
    .join(architecture)
    .split("${ext}")
    .join("appx");
}

function signAppx(unsigned: string, signed: string, signing: AppxSigningCredentials): void {
  console.log(`Signing ${path.basename(signed)} with ${path.basename(signing.certificate)}`);
  run("osslsigncode", [
    "sign",
    "-pkcs12",
    signing.certificate,
    "-pass",
    signing.password,
    "-in",
    unsigned,
    "-out",
    signed,
  ]);
}

/// Not build-support's runCommand: that echoes the command, and one of these carries a
/// certificate password.
function run(bin: string, args: string[]): void {
  try {
    execFileSync(bin, args, { stdio: ["ignore", "inherit", "inherit"] });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BuildError(`${bin} was not found on PATH.`);
    }
    throw new BuildError(`${bin} failed.`);
  }
}

function required(appx: Record<string, unknown>, key: string): string {
  const value = asString(appx[key]);
  if (value == null) {
    throw new BuildError(`The Appx configuration is missing '${key}'.`);
  }
  return value;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
