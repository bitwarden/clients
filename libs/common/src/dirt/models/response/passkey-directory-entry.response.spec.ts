import { PasskeyDirectoryEntryResponse } from "./passkey-directory-entry.response";

describe("PasskeyDirectoryEntryResponse", () => {
  it("should parse domainName and instructions from response", () => {
    const response = new PasskeyDirectoryEntryResponse({
      DomainName: "example.com",
      Instructions: "https://example.com/passkey-setup",
    });

    expect(response.domainName).toEqual("example.com");
    expect(response.instructions).toEqual("https://example.com/passkey-setup");
  });

  it("should default instructions to null when null", () => {
    const response = new PasskeyDirectoryEntryResponse({
      DomainName: "example.com",
      Instructions: null,
    });

    expect(response.domainName).toEqual("example.com");
    expect(response.instructions).toBeNull();
  });

  it("should default instructions to undefined when missing", () => {
    const response = new PasskeyDirectoryEntryResponse({
      DomainName: "test.com",
    });

    expect(response.domainName).toEqual("test.com");
    expect(response.instructions).toBeUndefined();
  });

  it("should parse supportsPasskeyLogin and supportsPasskeyMfa from response", () => {
    const response = new PasskeyDirectoryEntryResponse({
      DomainName: "example.com",
      Instructions: "https://example.com/passkey-setup",
      Passwordless: true,
      Mfa: true,
    });

    expect(response.supportsPasskeyLogin).toBe(true);
    expect(response.supportsPasskeyMfa).toBe(true);
  });

  it("should default supportsPasskeyLogin and supportsPasskeyMfa to false when missing", () => {
    const response = new PasskeyDirectoryEntryResponse({
      DomainName: "example.com",
    });

    expect(response.supportsPasskeyLogin).toBe(false);
    expect(response.supportsPasskeyMfa).toBe(false);
  });

  it("should handle supportsPasskeyLogin true and supportsPasskeyMfa false", () => {
    const response = new PasskeyDirectoryEntryResponse({
      DomainName: "example.com",
      Passwordless: true,
      Mfa: false,
    });

    expect(response.supportsPasskeyLogin).toBe(true);
    expect(response.supportsPasskeyMfa).toBe(false);
  });

  it("should default supportsPasskeyLogin and supportsPasskeyMfa to false when null", () => {
    const response = new PasskeyDirectoryEntryResponse({
      DomainName: "example.com",
      Passwordless: null,
      Mfa: null,
    });

    expect(response.supportsPasskeyLogin).toBe(false);
    expect(response.supportsPasskeyMfa).toBe(false);
  });
});
