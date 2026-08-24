import {
  APP_IDS,
  CHANNELS,
  TEAM_ID,
  appGroupFor,
  autofillExtensionIdFor,
  channelForAppId,
} from "./channel.js";

/// These identifiers are what the signed bundle, its entitlements, its App Group and its
/// provisioning profile all have to agree on, so they are asserted rather than left to a reader
/// comparing strings across five files.
describe("channel identifiers", () => {
  it("gives every channel a distinct application identifier", () => {
    const ids = CHANNELS.map((channel) => APP_IDS[channel]);

    expect(new Set(ids).size).toBe(CHANNELS.length);
  });

  /// The identifier beta is actually registered under. electron-builder.beta.json said
  /// `com.bitwarden.desktop.beta`, which was a guess and was never registered.
  it("names beta com.bitwarden.beta.desktop", () => {
    expect(APP_IDS.stable).toBe("com.bitwarden.desktop");
    expect(APP_IDS.beta).toBe("com.bitwarden.beta.desktop");
  });

  it("names the app group after the app, prefixed by the team", () => {
    expect(appGroupFor(APP_IDS.beta)).toBe(`${TEAM_ID}.com.bitwarden.beta.desktop`);
  });

  /// macOS requires an app extension's identifier to be prefixed by its containing app's, so the
  /// extension cannot be named independently of the channel.
  it("prefixes the extension identifier with the app's", () => {
    for (const channel of CHANNELS) {
      expect(autofillExtensionIdFor(APP_IDS[channel]).startsWith(`${APP_IDS[channel]}.`)).toBe(
        true,
      );
    }
  });
});

describe("channelForAppId", () => {
  it("round-trips every channel", () => {
    for (const channel of CHANNELS) {
      expect(channelForAppId(APP_IDS[channel])).toBe(channel);
    }
  });

  /// The reason this exists rather than a suffix test: after-pack.js used to ask whether the
  /// identifier ended in `.beta`, which `com.bitwarden.beta.desktop` does not, so a beta build
  /// would have been signed with stable's App Group.
  it("recognises beta even though its identifier does not end in .beta", () => {
    expect(APP_IDS.beta.endsWith(".beta")).toBe(false);
    expect(channelForAppId(APP_IDS.beta)).toBe("beta");
  });

  it("throws on an identifier that is not one of ours rather than assuming stable", () => {
    expect(() => channelForAppId("com.bitwarden.desktop.beta")).toThrow(
      /Unknown application identifier/,
    );
  });
});
