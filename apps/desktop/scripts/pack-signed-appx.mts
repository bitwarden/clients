/* eslint-disable no-console */

/// Repackage an already-built Windows app directory as a signed Appx.
///
/// An Appx names its publisher in the package manifest, and signing fails unless that
/// publisher matches the subject of the signing certificate. Store packages therefore have
/// to keep the Microsoft-assigned publisher (a UUID) and stay unsigned, which leaves them
/// uninstallable by anyone outside the Store.
///
/// To offer a directly installable Appx as well, this repackages the Appx target from
/// the `dist/win*-unpacked` directories electron-builder already produced, overriding the
/// publisher with the certificate subject and signing the result. Nothing is recompiled and
/// the app binaries keep the signatures from the original pack, so this costs one Appx
/// compression pass per architecture instead of a second full build.
///
/// The signed Appx lands on the configured `appx.artifactName`, so move or rename the
/// unsigned Store package first if both are wanted. Cf .github/workflows/build-desktop.yml.
///
/// Signing is delegated to sign.js, which needs ELECTRON_BUILDER_SIGN=1 plus its Azure Key
/// Vault environment, and ELECTRON_BUILDER_SIGN_APPX=1 to sign Appx files.
///
/// Usage:
///   node scripts/pack-signed-appx.mts --publisher <certificate subject> \
///     [--config electron-builder.beta.json] [--arch x64 --arch arm64]

import { existsSync } from "fs";
import path from "path";
import { parseArgs } from "util";

import { Arch, build, Platform } from "electron-builder";

const ARCHITECTURES = ["ia32", "x64", "arm64"] as const;
type Architecture = (typeof ARCHITECTURES)[number];

const projectDir = path.resolve(import.meta.dirname, "..");

function isArchitecture(value: string): value is Architecture {
  return (ARCHITECTURES as readonly string[]).includes(value);
}

// electron-builder omits the arch suffix for the default architecture.
function unpackedDir(arch: Architecture): string {
  return path.join(projectDir, "dist", arch === "x64" ? "win-unpacked" : `win-${arch}-unpacked`);
}

async function packSignedAppx(
  publisher: string,
  configFile: string,
  architectures: Architecture[],
) {
  for (const arch of architectures) {
    const prepackaged = unpackedDir(arch);
    if (!existsSync(prepackaged)) {
      throw new Error(
        `${prepackaged} not found. Pack the ${arch} app before repackaging it as a signed Appx.`,
      );
    }

    console.log(`[*] Packaging signed ${arch} Appx from ${prepackaged} as '${publisher}'`);
    await build({
      projectDir,
      prepackaged,
      publish: "never",
      targets: Platform.WINDOWS.createTarget("appx", Arch[arch]),
      // `extends` names the config file to load; the rest is merged over it, the same way
      // `--config <file> -c.appx.publisher=<publisher>` combines on the command line.
      config: { extends: configFile, appx: { publisher } },
    });
  }
}

function parseArchitectures(values: string[] | undefined): Architecture[] {
  if (values == null || values.length === 0) {
    return [...ARCHITECTURES];
  }

  const unsupported = values.filter((value) => !isArchitecture(value));
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported architecture(s) ${unsupported.join(", ")}. Supported: ${ARCHITECTURES.join(", ")}.`,
    );
  }

  return values.filter(isArchitecture);
}

async function main() {
  const { values } = parseArgs({
    options: {
      publisher: { type: "string" },
      config: { type: "string", default: "electron-builder.json" },
      arch: { type: "string", multiple: true },
    },
  });

  if (!values.publisher) {
    throw new Error("--publisher is required: pass the subject of the signing certificate.");
  }

  await packSignedAppx(values.publisher, values.config, parseArchitectures(values.arch));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
