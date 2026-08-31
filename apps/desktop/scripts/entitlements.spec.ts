import { APP_IDS, TEAM_ID } from "./channel.js";
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
} from "./entitlements.mts";

const BUNDLE_ID = APP_IDS.stable;
const GROUP = `${TEAM_ID}.${BUNDLE_ID}`;
const AUTOFILL = "com.apple.developer.authentication-services.autofill-credential-provider";

/// The XML envelope around a document, so a case states only its keys. `serializePlist` has its
/// own cases at the bottom pinning this envelope and the tab indentation, so these helpers cannot
/// quietly agree with a broken implementation about the format.
function plist(...body: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    ...body,
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}

const bool = (key: string, value: boolean): string[] => [`\t<key>${key}</key>`, `\t<${value}/>`];
const str = (key: string, value: string): string[] => [
  `\t<key>${key}</key>`,
  `\t<string>${value}</string>`,
];
const array = (key: string, values: string[]): string[] => [
  `\t<key>${key}</key>`,
  "\t<array>",
  ...values.map((value) => `\t\t<string>${value}</string>`),
  "\t</array>",
];

const identity = [
  ...str("com.apple.application-identifier", GROUP),
  ...str("com.apple.developer.team-identifier", TEAM_ID),
];

/// Directories a sandboxed App Store build may write a native messaging host manifest into. Spelled
/// out because this is the list that had drifted between two hand-copied plists: one of them was
/// missing `/NativeMessagingHosts/` from the Helium path.
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

/// Each document in full. These were checked-in plists that the spec compared against; they are
/// generated now, so the expected text lives here. Key order is asserted because it is part of the
/// file, and the file is what gets signed.
describe("the entitlements documents", () => {
  it("writes a directly distributed app", () => {
    const generated = macAppEntitlements({ bundleId: BUNDLE_ID, autofill: false });

    expect(serializePlist(generated)).toBe(
      plist(
        ...identity,
        ...array("com.apple.security.application-groups", [GROUP]),
        ...bool("com.apple.security.cs.allow-jit", true),
      ),
    );
  });

  it("writes a directly distributed app that claims AutoFill", () => {
    const generated = macAppEntitlements({ bundleId: BUNDLE_ID, autofill: true });

    expect(serializePlist(generated)).toBe(
      plist(
        ...identity,
        ...array("com.apple.security.application-groups", [GROUP]),
        ...bool("com.apple.security.cs.allow-jit", true),
        ...bool(AUTOFILL, true),
      ),
    );
  });

  it("writes an App Store app", () => {
    const generated = masAppEntitlements({ bundleId: BUNDLE_ID, autofill: false });

    expect(serializePlist(generated)).toBe(
      plist(
        ...identity,
        ...bool("com.apple.security.app-sandbox", true),
        ...array("com.apple.security.application-groups", [GROUP]),
        ...bool("com.apple.security.cs.allow-jit", true),
        ...bool("com.apple.security.device.usb", true),
        ...bool("com.apple.security.files.bookmarks.app-scope", true),
        ...bool("com.apple.security.files.user-selected.read-write", true),
        ...bool("com.apple.security.network.client", true),
        ...array(
          "com.apple.security.temporary-exception.files.home-relative-path.read-write",
          NATIVE_MESSAGING_HOST_DIRS,
        ),
      ),
    );
  });

  it("writes an App Store app that claims AutoFill", () => {
    const generated = masAppEntitlements({ bundleId: BUNDLE_ID, autofill: true });

    expect(serializePlist(generated)).toBe(
      plist(
        ...identity,
        ...bool("com.apple.security.app-sandbox", true),
        ...array("com.apple.security.application-groups", [GROUP]),
        ...bool("com.apple.security.cs.allow-jit", true),
        ...bool("com.apple.security.device.usb", true),
        ...bool("com.apple.security.files.bookmarks.app-scope", true),
        ...bool("com.apple.security.files.user-selected.read-write", true),
        ...bool("com.apple.security.network.client", true),
        ...array(
          "com.apple.security.temporary-exception.files.home-relative-path.read-write",
          NATIVE_MESSAGING_HOST_DIRS,
        ),
        ...bool(AUTOFILL, true),
      ),
    );
  });

  it("writes the inherit document for a directly distributed app", () => {
    expect(serializePlist(macAppInheritEntitlements())).toBe(
      plist(...bool("com.apple.security.cs.allow-jit", true)),
    );
  });

  it("writes the inherit document for an App Store app", () => {
    expect(serializePlist(masAppInheritEntitlements())).toBe(
      plist(
        ...bool("com.apple.security.app-sandbox", true),
        ...bool("com.apple.security.cs.allow-jit", true),
        ...bool("com.apple.security.inherit", true),
      ),
    );
  });

  it("writes the App Store login helper", () => {
    expect(serializePlist(masLoginHelperEntitlements())).toBe(
      plist(...bool("com.apple.security.app-sandbox", true)),
    );
  });

  it("writes the native messaging proxy", () => {
    const generated = desktopProxyEntitlements({ bundleId: BUNDLE_ID, autofill: false });

    expect(serializePlist(generated)).toBe(
      plist(
        ...bool("com.apple.security.app-sandbox", true),
        ...array("com.apple.security.application-groups", [GROUP]),
        ...bool("com.apple.security.cs.allow-jit", true),
      ),
    );
  });

  it("writes the proxy copy that inherits the app's sandbox", () => {
    expect(serializePlist(desktopProxyInheritEntitlements())).toBe(
      plist(
        ...bool("com.apple.security.app-sandbox", true),
        ...bool("com.apple.security.inherit", true),
        ...bool("com.apple.security.cs.allow-jit", true),
      ),
    );
  });

  /// No application or team identifier: Xcode fills those in from the provisioning profile when it
  /// signs the extension.
  it("writes the autofill extension", () => {
    const generated = autofillExtensionEntitlements({ bundleId: BUNDLE_ID, autofill: false });

    expect(serializePlist(generated)).toBe(
      plist(
        ...bool("com.apple.security.app-sandbox", true),
        ...array("com.apple.security.application-groups", [GROUP]),
      ),
    );
  });

  it("writes the autofill extension when it claims AutoFill", () => {
    const generated = autofillExtensionEntitlements({ bundleId: BUNDLE_ID, autofill: true });

    expect(serializePlist(generated)).toBe(
      plist(
        ...bool("com.apple.security.app-sandbox", true),
        ...array("com.apple.security.application-groups", [GROUP]),
        ...bool(AUTOFILL, true),
      ),
    );
  });
});

describe("composing entitlements", () => {
  it("adds only the credential provider entitlement when autofill is on", () => {
    const off = autofillExtensionEntitlements({ bundleId: BUNDLE_ID, autofill: false });
    const on = autofillExtensionEntitlements({ bundleId: BUNDLE_ID, autofill: true });

    expect(Object.keys(on)).toEqual([
      ...Object.keys(off),
      "com.apple.developer.authentication-services.autofill-credential-provider",
    ]);
  });

  it("omits the entitlement rather than setting it to false", () => {
    const off = serializePlist(
      autofillExtensionEntitlements({ bundleId: BUNDLE_ID, autofill: false }),
    );

    expect(off).not.toContain("autofill-credential-provider");
  });

  it("names the app group and the application identifier after the bundle identifier", () => {
    const beta = masAppEntitlements({ bundleId: APP_IDS.beta, autofill: true });

    expect(beta["com.apple.application-identifier"]).toBe(`${TEAM_ID}.${APP_IDS.beta}`);
    expect(beta["com.apple.security.application-groups"]).toEqual([`${TEAM_ID}.${APP_IDS.beta}`]);
  });

  /// Every document that has to reach the shared container names the group. The socket lives
  /// there on every build, so there is nothing left for a channel to opt out of.
  it("gives the app its group whether it is sandboxed or not", () => {
    const options = { bundleId: BUNDLE_ID, autofill: false };
    const group = [`${TEAM_ID}.${BUNDLE_ID}`];

    expect(macAppEntitlements(options)["com.apple.security.application-groups"]).toEqual(group);
    expect(masAppEntitlements(options)["com.apple.security.application-groups"]).toEqual(group);
    expect(desktopProxyEntitlements(options)["com.apple.security.application-groups"]).toEqual(
      group,
    );
  });

  /// The extension shares the *app's* group, so its own identifier never appears here -- which is
  /// what keeps a beta extension out of the stable app's container.
  it("puts the extension in the app's group, not one named after itself", () => {
    const beta = autofillExtensionEntitlements({ bundleId: APP_IDS.beta, autofill: true });

    expect(beta["com.apple.security.application-groups"]).toEqual([`${TEAM_ID}.${APP_IDS.beta}`]);
    expect(beta["com.apple.security.application-groups"]).not.toContain(
      `${TEAM_ID}.${APP_IDS.beta}.autofill-extension`,
    );
  });
});

describe("serializePlist", () => {
  it("escapes characters that would otherwise close a tag", () => {
    expect(serializePlist({ "a&b": "<c>" })).toContain("<key>a&amp;b</key>");
    expect(serializePlist({ "a&b": "<c>" })).toContain("<string>&lt;c&gt;</string>");
  });

  it("writes booleans as empty elements, tab indented under their key", () => {
    expect(serializePlist({ on: true, off: false })).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ' +
        '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
        '<plist version="1.0">\n' +
        "<dict>\n" +
        "\t<key>on</key>\n" +
        "\t<true/>\n" +
        "\t<key>off</key>\n" +
        "\t<false/>\n" +
        "</dict>\n" +
        "</plist>\n",
    );
  });
});
