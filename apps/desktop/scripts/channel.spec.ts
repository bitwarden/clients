import { APP_IDS, CHANNELS, TEAM_ID, appGroupFor } from "./channel.js";

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
});
