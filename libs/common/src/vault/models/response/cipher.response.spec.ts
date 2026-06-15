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
});
