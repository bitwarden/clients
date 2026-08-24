#!/usr/bin/env node
/* eslint-disable no-console */

/// Writes the entitlements documents for one build.
///
/// The shell around entitlements.mts: this is the only part that touches the filesystem, so the
/// composition itself stays testable without one. Every document is written from the same
/// application identifier, so an app signed with entitlements naming a different identifier --
/// which Apple rejects outright -- is not something this can produce.
///
/// Stable still signs with the checked-in resources/*.plist, which the spec pins to this module's
/// output byte for byte. Only beta generates at pack time. That asymmetry is deliberate and
/// temporary: it keeps the stable release's build path unchanged while beta takes a new identifier.
///
///   node scripts/generate-entitlements.mts --channel beta --target mac --autofill --app-group \
///     --out intermediates/entitlements

import { mkdirSync, writeFileSync } from "fs";
import { isAbsolute, join, resolve } from "path";
import { parseArgs } from "util";

import { APP_IDS, CHANNELS, type Channel } from "./channel.js";
import {
  autofillExtensionEntitlements,
  desktopProxyEntitlements,
  desktopProxyInheritEntitlements,
  macAppEntitlements,
  macAppInheritEntitlements,
  masAppEntitlements,
  masAppInheritEntitlements,
  masLoginHelperEntitlements,
  serializePlist,
  type Entitlements,
} from "./entitlements.mts";

/// electron-builder's own target names, because that is what the pack scripts already say.
/// `mas` and `mas-dev` are sandboxed App Store builds; `mac` is a directly distributed one.
const TARGETS = ["mac", "mas", "mas-dev"] as const;
type Target = (typeof TARGETS)[number];

const projectDir = resolve(import.meta.dirname, "..");

/// The file each document is written to. These names are what the electron-builder configuration
/// and after-pack.js look for, and they match where the new build system puts them.
const FILES = {
  app: "app.plist",
  appInherit: "app-inherit.plist",
  desktopProxy: "desktop-proxy.plist",
  desktopProxyInherit: "desktop-proxy-inherit.plist",
  loginHelper: "login-helper.plist",
  autofillExtension: "autofill-extension.plist",
} as const;

interface Options {
  channel: Channel;
  target: Target;
  autofill: boolean;
  /// Whether a directly distributed app claims the App Group. See EntitlementsOptions.appGroup:
  /// the sandboxed targets always have it, so this only affects `--target mac`.
  appGroup: boolean;
  out: string;
}

/// Which documents a build needs, and what goes in each.
///
/// The App Store build is sandboxed, so its app names every capability it needs, and it gets a
/// login helper plus an inherit document for the proxy copy the app itself spawns.
///
/// The proxy is sandboxed and scoped to the App Group on every build, App Store or not. The
/// browser launches it, not the app, so it inherits nothing, and the group container is the only
/// place where it and the app can both reach the socket.
function documents(options: Options): Partial<Record<keyof typeof FILES, Entitlements>> {
  const bundleId = APP_IDS[options.channel];
  const entitlements = { bundleId, autofill: options.autofill, appGroup: options.appGroup };
  const appStore = options.target !== "mac";

  return {
    app: appStore ? masAppEntitlements(entitlements) : macAppEntitlements(entitlements),
    appInherit: appStore ? masAppInheritEntitlements() : macAppInheritEntitlements(),
    desktopProxy: desktopProxyEntitlements(entitlements),
    ...(appStore
      ? {
          desktopProxyInherit: desktopProxyInheritEntitlements(),
          loginHelper: masLoginHelperEntitlements(),
        }
      : {}),
    ...(options.autofill ? { autofillExtension: autofillExtensionEntitlements(entitlements) } : {}),
  };
}

function parse(argv: string[]): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      channel: { type: "string" },
      target: { type: "string" },
      autofill: { type: "boolean", default: false },
      "app-group": { type: "boolean", default: false },
      out: { type: "string" },
    },
    strict: true,
  });

  const channel = values.channel;
  if (channel === undefined || !CHANNELS.includes(channel as Channel)) {
    throw new Error(`--channel must be one of ${CHANNELS.join(", ")}, got '${channel ?? ""}'`);
  }

  const target = values.target;
  if (target === undefined || !TARGETS.includes(target as Target)) {
    throw new Error(`--target must be one of ${TARGETS.join(", ")}, got '${target ?? ""}'`);
  }

  if (values.out === undefined) {
    throw new Error("--out is required: the directory to write the entitlements into");
  }

  return {
    channel: channel as Channel,
    target: target as Target,
    autofill: values.autofill,
    appGroup: values["app-group"],
    // Resolved against apps/desktop rather than the caller's directory, because that is what
    // every path in the electron-builder configuration is relative to.
    out: isAbsolute(values.out) ? values.out : join(projectDir, values.out),
  };
}

function main(): void {
  const options = parse(process.argv.slice(2));
  const written = documents(options);

  mkdirSync(options.out, { recursive: true });
  for (const [key, entitlements] of Object.entries(written)) {
    const file = join(options.out, FILES[key as keyof typeof FILES]);
    writeFileSync(file, serializePlist(entitlements));
    console.log(`Wrote ${file}`);
  }
}

// Only when run, so a spec can import `documents` without writing anything.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main();
}

export { documents, parse, FILES, TARGETS, type Options, type Target };
