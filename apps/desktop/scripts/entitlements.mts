/// The entitlements the macOS app and its autofill extension are signed with.
///
/// An entitlements file is not a request. Whatever is in the file that gets signed over is what
/// the binary actually has; the provisioning profile only bounds which entitlements it is
/// allowed to claim. So the difference between two of these files is a difference in what the
/// shipped binary can do, which is why they are composed from one description here rather than
/// kept as near-copies of each other.
///
/// There were six checked-in plists, and the pairs among them differed by a single key. They
/// had already drifted: entitlements.mas.autofill-enabled.plist listed the Helium native
/// messaging host directory as `.../net.imput.helium` where entitlements.mas.plist has
/// `.../net.imput.helium/NativeMessagingHosts/`, so the App Store autofill build could not read
/// it. Composing them makes that class of difference impossible rather than unlikely, and a
/// second bundle identifier for beta builds costs a parameter instead of six more files.
///
/// Pure, like build-config.mts: everything is passed in, and the caller writes the result.

import * as plistModule from "plist";

// `plist` assigns its exports in a loop, which Node's CommonJS-to-ESM analysis cannot see: a
// named import of `build` fails there outright, while the CommonJS that the test transform emits
// has no `default` to reach it through. So take whichever of the two the running module system
// actually provided.
const { build } = (plistModule as { default?: typeof plistModule }).default ?? plistModule;

/// Apple developer team, which is what an application identifier and an app group are prefixed
/// with.
export const TEAM_ID = "LTZ2PFU5D6";

export type EntitlementValue = boolean | string | readonly string[];
export type Entitlements = Record<string, EntitlementValue>;

export interface EntitlementsOptions {
  /// Bundle identifier of the app. The extension's own identifier is not used here: what it
  /// shares with the app is the group, and a group is named after the app.
  bundleId: string;
  teamId?: string;
  /// Whether this build claims the AutoFill credential provider entitlement, which is what
  /// lets macOS offer the app's passwords and passkeys to other applications.
  autofill: boolean;
}

/// Directories the sandboxed app is allowed to write a native messaging host manifest into, so
/// that the browser extension can talk to the desktop app. Relative to the user's home.
const NATIVE_MESSAGING_HOST_DIRS = [
  "/Library/Application Support/Mozilla/NativeMessagingHosts/",
  "/Library/Application Support/Google/Chrome/NativeMessagingHosts/",
  "/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts/",
  "/Library/Application Support/Google/Chrome Dev/NativeMessagingHosts/",
  "/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts/",
  "/Library/Application Support/Chromium/NativeMessagingHosts/",
  "/Library/Application Support/Microsoft Edge/NativeMessagingHosts/",
  "/Library/Application Support/Microsoft Edge Beta/NativeMessagingHosts/",
  "/Library/Application Support/Microsoft Edge Dev/NativeMessagingHosts/",
  "/Library/Application Support/Microsoft Edge Canary/NativeMessagingHosts/",
  "/Library/Application Support/Vivaldi/NativeMessagingHosts/",
  "/Library/Application Support/Zen/NativeMessagingHosts/",
  "/Library/Application Support/net.imput.helium/NativeMessagingHosts/",
];

/// The AutoFill credential provider entitlement, spelled once.
const AUTOFILL = "com.apple.developer.authentication-services.autofill-credential-provider";

function appGroup(options: EntitlementsOptions): string {
  return `${options.teamId ?? TEAM_ID}.${options.bundleId}`;
}

function identity(options: EntitlementsOptions): Entitlements {
  const teamId = options.teamId ?? TEAM_ID;
  return {
    "com.apple.application-identifier": `${teamId}.${options.bundleId}`,
    "com.apple.developer.team-identifier": teamId,
  };
}

/// Only when claimed. An entitlement set to false is still an entitlement in the file, and
/// asking for one the provisioning profile does not carry fails the signature.
function whenAutofill(options: EntitlementsOptions): Entitlements {
  return options.autofill ? { [AUTOFILL]: true } : {};
}

/// The autofill extension: sandboxed, and in the app's group so the two can talk. The
/// application and team identifiers are absent on purpose -- Xcode fills those in from the
/// provisioning profile at signing time.
export function autofillExtensionEntitlements(options: EntitlementsOptions): Entitlements {
  return {
    "com.apple.security.app-sandbox": true,
    "com.apple.security.application-groups": [appGroup(options)],
    ...whenAutofill(options),
  };
}

/// A directly distributed app: signed with a Developer ID, notarized, and not sandboxed.
export function macAppEntitlements(options: EntitlementsOptions): Entitlements {
  return {
    ...identity(options),
    "com.apple.security.cs.allow-jit": true,
    ...whenAutofill(options),
  };
}

/// An App Store app, which is sandboxed and so has to name every capability it needs.
export function masAppEntitlements(options: EntitlementsOptions): Entitlements {
  return {
    ...identity(options),
    "com.apple.security.app-sandbox": true,
    "com.apple.security.application-groups": [appGroup(options)],
    "com.apple.security.cs.allow-jit": true,
    "com.apple.security.device.usb": true,
    "com.apple.security.files.bookmarks.app-scope": true,
    "com.apple.security.files.user-selected.read-write": true,
    "com.apple.security.network.client": true,
    "com.apple.security.temporary-exception.files.home-relative-path.read-write":
      NATIVE_MESSAGING_HOST_DIRS,
    ...whenAutofill(options),
  };
}

/// Inherited by the app's child processes on a directly distributed build. Not sandboxed, so
/// there is nothing to inherit but the JIT permission the renderer needs.
export function macAppInheritEntitlements(): Entitlements {
  return { "com.apple.security.cs.allow-jit": true };
}

/// Inherited by the app's child processes inside the sandbox. `inherit` is what makes a child
/// take the parent's sandbox rather than being denied everything.
export function masAppInheritEntitlements(): Entitlements {
  return {
    "com.apple.security.app-sandbox": true,
    "com.apple.security.cs.allow-jit": true,
    "com.apple.security.inherit": true,
  };
}

/// The App Store login helper, which only needs to be inside the sandbox.
export function masLoginHelperEntitlements(): Entitlements {
  return { "com.apple.security.app-sandbox": true };
}

/// The native messaging proxy on an App Store build. It is launched by the browser rather than
/// by the app, so it does not inherit the app's sandbox and has to name the app group itself --
/// that group is the only way it can reach the app.
export function desktopProxyEntitlements(options: EntitlementsOptions): Entitlements {
  return {
    "com.apple.security.app-sandbox": true,
    "com.apple.security.application-groups": [appGroup(options)],
    "com.apple.security.cs.allow-jit": true,
  };
}

/// The copy of the proxy that the app launches, which does inherit the sandbox.
export function desktopProxyInheritEntitlements(): Entitlements {
  return {
    "com.apple.security.app-sandbox": true,
    "com.apple.security.inherit": true,
    "com.apple.security.cs.allow-jit": true,
  };
}

/// Serializes to the plist dialect Xcode and codesign write.
///
/// `offset: -1` is what puts `<dict>` at column zero with its keys one tab in, which is how
/// Xcode writes these and therefore how the checked-in files are written; xmlbuilder would
/// otherwise indent `<dict>` one level under `<plist>`. The trailing newline is xmlbuilder's
/// only other departure from that format.
///
/// The specs compare the result against the checked-in plists byte for byte, so a change in how
/// this renders is a failing test rather than a surprise at signing time.
export function serializePlist(entitlements: Entitlements): string {
  return `${build(entitlements, { indent: "\t", offset: -1 })}\n`;
}
