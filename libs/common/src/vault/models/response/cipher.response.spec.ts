import { CipherType } from "../../enums";

import { CipherResponse } from "./cipher.response";

// Encrypted (EncString) placeholders — the decrypt path runs later; here we only
// assert that the gated blob's encrypted fields are lifted onto the response.
const ENC_NAME = "2.name==|name==|name==";
const ENC_URI = "2.uri==|uri==|uri==";
const ENC_CHECKSUM = "2.sum==|sum==|sum==";
const ENC_PASSWORD = "2.pass==|pass==|pass==";

function gatedResponse(partial: Record<string, unknown>, type: CipherType = CipherType.Login) {
  return new CipherResponse({
    Id: "cipher-1",
    Type: type,
    // Sensitive top-level fields are absent on a gated row; the server ships them
    // (encrypted, partially) inside PartialData instead.
    PartialData: JSON.stringify(partial),
  });
}

describe("CipherResponse PAM partial data", () => {
  it("lifts the encrypted Name onto the response so the standard decrypt path runs", () => {
    const response = gatedResponse({ Name: ENC_NAME, Uris: [] });

    expect(response.name).toBe(ENC_NAME);
    expect(response.partialData).toContain(ENC_NAME);
  });

  it("lifts gated login URIs so the partial view exposes a domain", () => {
    const response = gatedResponse({
      Name: ENC_NAME,
      Uris: [{ Uri: ENC_URI, UriChecksum: ENC_CHECKSUM }],
    });

    expect(response.login).not.toBeNull();
    expect(response.login.uris).toHaveLength(1);
    expect(response.login.uris[0].uri).toBe(ENC_URI);
  });

  it("does not lift any secret login fields the gated view should never carry", () => {
    // Even if a blob were to over-share, only URIs are lifted onto the gated view.
    const response = gatedResponse({
      Name: ENC_NAME,
      Uris: [{ Uri: ENC_URI }],
      Password: ENC_PASSWORD,
      Totp: ENC_PASSWORD,
    });

    expect(response.login.uris[0].uri).toBe(ENC_URI);
    expect(response.login.password).toBeUndefined();
    expect(response.login.totp).toBeUndefined();
  });

  it("leaves login unset when the gated cipher has no URIs", () => {
    const response = gatedResponse({ Name: ENC_NAME, Uris: [] });

    // No URIs in the blob → nothing to surface → keep the minimal gated shape so
    // the icon falls back to the generic glyph rather than a favicon.
    expect(response.login).toBeUndefined();
  });

  it("does not build a login for a non-Login gated cipher", () => {
    const response = gatedResponse(
      { Name: ENC_NAME, Uris: [{ Uri: ENC_URI }] },
      CipherType.SecureNote,
    );

    expect(response.login).toBeUndefined();
  });

  it("prefers a real top-level Name over the blob's", () => {
    const response = new CipherResponse({
      Id: "cipher-1",
      Type: CipherType.Login,
      Name: ENC_NAME,
      PartialData: JSON.stringify({ Name: "2.other==|other==|other==" }),
    });

    expect(response.name).toBe(ENC_NAME);
  });

  it("accepts an already-parsed PartialData object and normalizes it to a string", () => {
    // Some transports hand back parsed JSON rather than a string.
    const response = new CipherResponse({
      Id: "cipher-1",
      Type: CipherType.Login,
      PartialData: { Name: ENC_NAME, Uris: [{ Uri: ENC_URI }] },
    });

    expect(typeof response.partialData).toBe("string");
    expect(response.name).toBe(ENC_NAME);
    expect(response.login.uris[0].uri).toBe(ENC_URI);
  });

  it("preserves the gating marker when the blob is malformed", () => {
    const response = new CipherResponse({
      Id: "cipher-1",
      Type: CipherType.Login,
      PartialData: "{not json",
    });

    // Failing to parse must not un-gate the row: the marker survives even though
    // there is no name to show.
    expect(response.partialData).toBe("{not json");
    expect(response.name).toBeUndefined();
    expect(response.login).toBeUndefined();
  });

  it("leaves partialData null for a normal, non-gated cipher", () => {
    const response = new CipherResponse({
      Id: "cipher-1",
      Type: CipherType.Login,
      Name: ENC_NAME,
      Data: "{}",
    });

    expect(response.partialData).toBeNull();
  });
});
