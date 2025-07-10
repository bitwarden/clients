import { SafeUrls } from "./safe-urls";

describe("SafeUrls service", () => {
  it("should allow valid URLs", () => {
    expect(SafeUrls.canLaunch("https://bitwarden.com")).toBe(true);
    expect(SafeUrls.canLaunch("http://bitwarden.com")).toBe(true);
    expect(SafeUrls.canLaunch("ssh://my-server")).toBe(true);
  });

  it("should fail invalid URLs", () => {
    expect(SafeUrls.canLaunch("bitwarden.com")).toBe(false);
    expect(SafeUrls.canLaunch("")).toBe(false);
    expect(SafeUrls.canLaunch(null)).toBe(false);
  });

  it("should fail URLs with disallowed protocols", () => {
    expect(SafeUrls.canLaunch("file:///etc/passwd")).toBe(false);
    expect(SafeUrls.canLaunch("\\\\network.share\\abc")).toBe(false);
    expect(SafeUrls.canLaunch("smb://smb.server")).toBe(false);
  });
});
