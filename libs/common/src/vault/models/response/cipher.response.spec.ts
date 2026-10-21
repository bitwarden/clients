import { CipherType } from "../../enums";

import { CipherResponse } from "./cipher.response";

// EncString placeholders; these tests only assert the envelope is carried through untouched.
const ENC_NAME = "2.name==|name==|name==";
const ENC_URI = "2.uri==|uri==|uri==";

function gatedResponse(partial: Record<string, unknown>, type: CipherType = CipherType.Login) {
  return new CipherResponse({
    Id: "cipher-1",
    Type: type,
    // A gated row carries no sensitive top-level fields, only the PartialData envelope.
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

    // A malformed envelope must not un-gate the row; the SDK fails closed.
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
