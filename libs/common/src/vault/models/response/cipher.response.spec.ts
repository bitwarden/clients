import { CipherType } from "../../enums";

import { CipherResponse } from "./cipher.response";

// Encrypted (EncString) placeholders — the SDK decrypts the envelope later; here we only
// assert that the raw gating envelope is carried through untouched.
const ENC_NAME = "2.name==|name==|name==";
const ENC_URI = "2.uri==|uri==|uri==";

function gatedResponse(partial: Record<string, unknown>, type: CipherType = CipherType.Login) {
  return new CipherResponse({
    Id: "cipher-1",
    Type: type,
    // Sensitive top-level fields are absent on a gated row; the server ships a reduced
    // (encrypted) envelope inside PartialData instead.
    PartialData: JSON.stringify(partial),
  });
}

describe("CipherResponse PAM partial data", () => {
  it("keeps the raw PartialData envelope verbatim as the gating marker", () => {
    const response = gatedResponse({ Name: ENC_NAME, Uris: [{ Uri: ENC_URI }] });

    expect(typeof response.partialData).toBe("string");
    expect(response.partialData).toContain(ENC_NAME);
    expect(response.partialData).toContain(ENC_URI);
  });

  it("does not lift name or login onto the response — the SDK decrypts the envelope", () => {
    // The client no longer parses the envelope; it hands the raw blob to the SDK, which
    // owns the field allowlist and produces the partial decrypted view.
    const response = gatedResponse({ Name: ENC_NAME, Uris: [{ Uri: ENC_URI }] });

    expect(response.name).not.toBe(ENC_NAME);
    expect(response.login).toBeUndefined();
  });

  it("accepts an already-parsed PartialData object and normalizes it to a string", () => {
    // Some transports hand back parsed JSON rather than a string.
    const response = new CipherResponse({
      Id: "cipher-1",
      Type: CipherType.Login,
      PartialData: { Name: ENC_NAME, Uris: [{ Uri: ENC_URI }] },
    });

    expect(typeof response.partialData).toBe("string");
    expect(response.partialData).toContain(ENC_NAME);
  });

  it("preserves the gating marker even when the envelope is malformed", () => {
    const response = new CipherResponse({
      Id: "cipher-1",
      Type: CipherType.Login,
      PartialData: "{not json",
    });

    // A malformed envelope must not un-gate the row — the marker survives untouched; the
    // SDK fails closed and renders a nameless partial view.
    expect(response.partialData).toBe("{not json");
  });

  it("leaves partialData undefined for a normal, non-gated cipher", () => {
    const response = new CipherResponse({
      Id: "cipher-1",
      Type: CipherType.Login,
      Name: ENC_NAME,
      Data: "{}",
    });

    expect(response.partialData).toBeUndefined();
  });
});
