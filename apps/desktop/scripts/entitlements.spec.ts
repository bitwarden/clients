import { readFileSync } from "fs";
import { join, resolve } from "path";

import {
  TEAM_ID,
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

const BUNDLE_ID = "com.bitwarden.desktop";
const projectDir = resolve(__dirname, "..");

function checkedIn(file: string): string {
  return readFileSync(join(projectDir, file), "utf8");
}

/// The checked-in files are what is signed today, so reproducing them exactly is what makes
/// generating them instead a no-op for every existing build. Once nothing reads them any more
/// these cases go with them.
describe("reproducing the checked-in entitlements", () => {
  it("matches autofill_extension.entitlements", () => {
    const generated = autofillExtensionEntitlements({ bundleId: BUNDLE_ID, autofill: false });

    expect(serializePlist(generated)).toBe(
      checkedIn("macos/autofill-extension/autofill_extension.entitlements"),
    );
  });

  it("matches autofill_extension_enabled.entitlements", () => {
    const generated = autofillExtensionEntitlements({ bundleId: BUNDLE_ID, autofill: true });

    expect(serializePlist(generated)).toBe(
      checkedIn("macos/autofill-extension/autofill_extension_enabled.entitlements"),
    );
  });

  it("matches entitlements.mac.plist", () => {
    const generated = macAppEntitlements({ bundleId: BUNDLE_ID, autofill: false });

    expect(serializePlist(generated)).toBe(checkedIn("resources/entitlements.mac.plist"));
  });

  it("matches entitlements.mas.plist", () => {
    const generated = masAppEntitlements({ bundleId: BUNDLE_ID, autofill: false });

    expect(serializePlist(generated)).toBe(checkedIn("resources/entitlements.mas.plist"));
  });

  it("matches entitlements.mac.inherit.plist", () => {
    expect(serializePlist(macAppInheritEntitlements())).toBe(
      checkedIn("resources/entitlements.mac.inherit.plist"),
    );
  });

  it("matches entitlements.mas.inherit.plist", () => {
    expect(serializePlist(masAppInheritEntitlements())).toBe(
      checkedIn("resources/entitlements.mas.inherit.plist"),
    );
  });

  /// The only one of these that a person indented by hand: it uses four spaces and indents the
  /// <dict> as well. Whitespace is not part of a plist, so this compares the content.
  it("matches entitlements.mas.loginhelper.plist apart from its indentation", () => {
    const unindented = (plist: string) =>
      plist
        .split("\n")
        .map((line) => line.trim())
        .join("\n");

    expect(unindented(serializePlist(masLoginHelperEntitlements()))).toBe(
      unindented(checkedIn("resources/entitlements.mas.loginhelper.plist")),
    );
  });

  it("matches entitlements.desktop_proxy.plist", () => {
    expect(serializePlist(desktopProxyEntitlements({ bundleId: BUNDLE_ID, autofill: false }))).toBe(
      checkedIn("resources/entitlements.desktop_proxy.plist"),
    );
  });

  it("matches entitlements.desktop_proxy.inherit.plist", () => {
    expect(serializePlist(desktopProxyInheritEntitlements())).toBe(
      checkedIn("resources/entitlements.desktop_proxy.inherit.plist"),
    );
  });

  /// Not byte-identical on purpose. The checked-in file lists the Helium directory as
  /// `.../net.imput.helium`, where every other copy has `.../net.imput.helium/NativeMessagingHosts/`
  /// -- a slip made while hand-copying entitlements.mas.plist. Generating both from one list
  /// fixes it, so this asserts the fix rather than the drift.
  it("matches entitlements.mas.autofill-enabled.plist apart from the drifted Helium path", () => {
    const generated = serializePlist(masAppEntitlements({ bundleId: BUNDLE_ID, autofill: true }));
    const file = checkedIn("resources/entitlements.mas.autofill-enabled.plist");

    expect(generated).not.toBe(file);
    expect(file).toContain("<string>/Library/Application Support/net.imput.helium</string>");
    expect(generated).toContain(
      "<string>/Library/Application Support/net.imput.helium/NativeMessagingHosts/</string>",
    );
    expect(
      file.replace(
        "<string>/Library/Application Support/net.imput.helium</string>",
        "<string>/Library/Application Support/net.imput.helium/NativeMessagingHosts/</string>",
      ),
    ).toBe(generated);
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
    const beta = masAppEntitlements({ bundleId: "com.bitwarden.desktop.beta", autofill: true });

    expect(beta["com.apple.application-identifier"]).toBe(`${TEAM_ID}.com.bitwarden.desktop.beta`);
    expect(beta["com.apple.security.application-groups"]).toEqual([
      `${TEAM_ID}.com.bitwarden.desktop.beta`,
    ]);
  });

  it("keeps the extension out of the app's group when the app has its own identifier", () => {
    const beta = autofillExtensionEntitlements({
      bundleId: "com.bitwarden.desktop.beta",
      autofill: true,
    });

    expect(beta["com.apple.security.application-groups"]).toEqual([
      `${TEAM_ID}.com.bitwarden.desktop.beta`,
    ]);
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
