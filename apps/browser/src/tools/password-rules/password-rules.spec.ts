import { findPasswordRules } from "./password-rules";

jest.mock("./password-rules.json", () => ({
  "example.com": { "password-rules": "minlength: 8;" },
  "exact.example.org": { "password-rules": "maxlength: 12;", "exact-domain-match-only": true },
  "xn--bcher-kva.example": { "password-rules": "required: digit;" },
}));

describe("findPasswordRules", () => {
  it.each([
    ["https://example.com/signup", "example.com"],
    ["https://login.example.com", "example.com"],
    ["https://a.b.example.com", "example.com"],
    ["https://LOGIN.Example.COM", "example.com"],
    ["https://example.com./", "example.com"],
    ["https://user:pass@example.com:8443/path?q=1#x", "example.com"],
    ["https://exact.example.org", "exact.example.org"],
    ["https://bücher.example", "xn--bcher-kva.example"],
  ])("matches %s to %s", (url, domain) => {
    expect(findPasswordRules(url)?.domain).toEqual(domain);
  });

  it("returns the rules for the matched domain", () => {
    expect(findPasswordRules("https://example.com")).toEqual({
      domain: "example.com",
      rules: "minlength: 8;",
    });
  });

  it.each([
    "https://notexample.com",
    "https://example.com.evil.com",
    "https://evil.com/example.com",
    "https://evil.com/?next=https://example.com",
    "https://example.com@evil.com",
    "https://evil.com#example.com",
    "https://sub.exact.example.org",
    "https://com",
  ])("does not match %s", (url) => {
    expect(findPasswordRules(url)).toBeNull();
  });

  it.each([
    "http://example.com",
    "ftp://example.com",
    "chrome-extension://example.com/popup/index.html",
    "file:///example.com",
    "example.com",
    "",
    undefined,
  ])("ignores %s", (url) => {
    expect(findPasswordRules(url)).toBeNull();
  });
});
