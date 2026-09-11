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

/// Serializes to the plist dialect Xcode and codesign write: tab indented, keys in the order
/// they were given, and a trailing newline.
export function serializePlist(entitlements: Entitlements): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ' +
      '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
  ];

  for (const [key, value] of Object.entries(entitlements)) {
    lines.push(`\t<key>${escapeXml(key)}</key>`);
    lines.push(...serializeValue(value, "\t"));
  }

  lines.push("</dict>", "</plist>");
  return `${lines.join("\n")}\n`;
}

function serializeValue(value: EntitlementValue, indent: string): string[] {
  if (typeof value === "boolean") {
    return [`${indent}<${value}/>`];
  }
  if (typeof value === "string") {
    return [`${indent}<string>${escapeXml(value)}</string>`];
  }
  return [
    `${indent}<array>`,
    ...value.map((item) => `${indent}\t<string>${escapeXml(item)}</string>`),
    `${indent}</array>`,
  ];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
