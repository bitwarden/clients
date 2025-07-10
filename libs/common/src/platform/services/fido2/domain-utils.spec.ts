import { isValidRpId } from "./domain-utils";

// Spec: If options.rp.id is not a registrable domain suffix of and is not equal to effectiveDomain, return a DOMException whose name is "SecurityError", and terminate this algorithm.
describe("validateRpId", () => {
  it("should not be valid when rpId is more specific than origin", () => {
    const rpId = "sub.login.bitwarden.com";
    const origin = "https://login.bitwarden.com:1337";

    expect(isValidRpId(rpId, origin)).toBe(false);
  });

  it("should not be valid when effective domains of rpId and origin do not match", () => {
    const rpId = "passwordless.dev";
    const origin = "https://login.bitwarden.com:1337";

    expect(isValidRpId(rpId, origin)).toBe(false);
  });

  it("should not be valid when subdomains are the same but effective domains of rpId and origin do not match", () => {
    const rpId = "login.passwordless.dev";
    const origin = "https://login.bitwarden.com:1337";

    expect(isValidRpId(rpId, origin)).toBe(false);
  });

  it("should not be valid when rpId and origin are both different TLD", () => {
    const rpId = "bitwarden";
    const origin = "localhost";

    expect(isValidRpId(rpId, origin)).toBe(false);
  });

  // Only allow localhost for rpId, need to properly investigate the implications of
  // adding support for ip-addresses and other TLDs
  it("should not be valid when rpId and origin are both the same TLD", () => {
    const rpId = "bitwarden";
    const origin = "bitwarden";

    expect(isValidRpId(rpId, origin)).toBe(false);
  });

  it("should not be valid when rpId and origin are ip-addresses", () => {
    const rpId = "127.0.0.1";
    const origin = "127.0.0.1";

    expect(isValidRpId(rpId, origin)).toBe(false);
  });

  it("should be valid when domains of rpId and origin are localhost", () => {
    const rpId = "localhost";
    const origin = "https://localhost:8080";

    expect(isValidRpId(rpId, origin)).toBe(true);
  });

  it("should be valid when domains of rpId and origin are the same", () => {
    const rpId = "bitwarden.com";
    const origin = "https://bitwarden.com";

    expect(isValidRpId(rpId, origin)).toBe(true);
  });

  it("should be valid when origin is a subdomain of rpId", () => {
    const rpId = "bitwarden.com";
    const origin = "https://login.bitwarden.com:1337";

    expect(isValidRpId(rpId, origin)).toBe(true);
  });

  it("should be valid when domains of rpId and origin are the same and they are both subdomains", () => {
    const rpId = "login.bitwarden.com";
    const origin = "https://login.bitwarden.com:1337";

    expect(isValidRpId(rpId, origin)).toBe(true);
  });

  it("should be valid when origin is a subdomain of rpId and they are both subdomains", () => {
    const rpId = "login.bitwarden.com";
    const origin = "https://sub.login.bitwarden.com:1337";

    expect(isValidRpId(rpId, origin)).toBe(true);
  });
});
