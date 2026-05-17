import { SafeUrls, UrlType } from "./safe-urls";

describe("SafeUrls service", () => {
  it("should allow valid URLs", () => {
    expect(SafeUrls.canLaunch("https://bitwarden.com", UrlType.CipherUri)).toBe(true);
    expect(SafeUrls.canLaunch("http://bitwarden.com", UrlType.CipherUri)).toBe(true);
    expect(SafeUrls.canLaunch("ssh://my-server", UrlType.CipherUri)).toBe(true);
  });

  it("should fail invalid URLs", () => {
    expect(SafeUrls.canLaunch("bitwarden.com", UrlType.CipherUri)).toBe(false);
    expect(SafeUrls.canLaunch("", UrlType.CipherUri)).toBe(false);
    expect(SafeUrls.canLaunch(null, UrlType.CipherUri)).toBe(false);
  });

  it("should fail URLs with disallowed protocols", () => {
    expect(SafeUrls.canLaunch("file:///etc/passwd", UrlType.CipherUri)).toBe(false);
    expect(SafeUrls.canLaunch("\\\\network.share\\abc", UrlType.CipherUri)).toBe(false);
    expect(SafeUrls.canLaunch("smb://smb.server", UrlType.CipherUri)).toBe(false);
  });

  it("should only allow https for WebUrl", () => {
    expect(SafeUrls.canLaunch("https://bitwarden.com", UrlType.WebUrl)).toBe(true);
    expect(SafeUrls.canLaunch("http://bitwarden.com", UrlType.WebUrl)).toBe(false);
  });
});
