import { unsafeUrlReason } from "./url-safety";

describe("unsafeUrlReason", () => {
  it.each([
    ["https://example.com"],
    ["https://api.example.com/v1"],
    ["https://8.8.8.8"],
    ["https://[2001:4860:4860::8888]"],
  ])("returns null for a safe url (%s)", (url) => {
    expect(unsafeUrlReason(url)).toBeNull();
  });

  it("rejects a malformed url", () => {
    expect(unsafeUrlReason("not a url")).toEqual({ code: "invalid", detail: "" });
  });

  it.each([["http://example.com"], ["ftp://example.com"], ["file:///etc/passwd"]])(
    "rejects a non-https scheme (%s)",
    (url) => {
      const result = unsafeUrlReason(url);
      expect(result?.code).toBe("scheme");
    },
  );

  it.each([
    ["https://localhost"],
    ["https://127.0.0.1"],
    ["https://127.1.2.3"],
    ["https://10.0.0.5"],
    ["https://172.16.0.1"],
    ["https://172.31.255.255"],
    ["https://192.168.1.1"],
    ["https://169.254.169.254"],
    ["https://[::1]"],
    ["https://[fe80::1]"],
    ["https://[fc00::1]"],
    ["https://[fd12:3456::1]"],
    // "this network" / unspecified addresses
    ["https://0.0.0.0"],
    ["https://[::]"],
    // IPv4-mapped IPv6 loopback and private addresses
    ["https://[::ffff:127.0.0.1]"],
    ["https://[::ffff:192.168.1.1]"],
    // trailing-dot FQDN form of localhost, including multiple trailing dots
    ["https://localhost."],
    ["https://localhost.."],
    ["https://127.0.0.1.."],
    // deprecated IPv4-compatible IPv6 form (distinct from the IPv4-mapped ::ffff: form)
    ["https://[::127.0.0.1]"],
    ["https://[::192.168.1.1]"],
    // the .localhost TLD is reserved for loopback (RFC 6761) and resolved as such by browsers
    ["https://foo.localhost"],
    // RFC6598 shared address space (CGNAT), real internal addressing on several cloud/container platforms
    ["https://100.64.0.1"],
    ["https://100.127.255.255"],
  ])("rejects a private/loopback/link-local host (%s)", (url) => {
    const result = unsafeUrlReason(url);
    expect(result?.code).toBe("host");
  });

  it.each([
    ["https://172.15.255.255"],
    ["https://172.32.0.1"],
    ["https://100.63.255.255"],
    ["https://100.128.0.0"],
  ])("does not reject addresses adjacent to the RFC1918/RFC6598 ranges (%s)", (url) => {
    expect(unsafeUrlReason(url)).toBeNull();
  });

  it.each([["https://notlocalhost"], ["https://localhost.example.com"]])(
    "does not reject a hostname that merely contains 'localhost' (%s)",
    (url) => {
      expect(unsafeUrlReason(url)).toBeNull();
    },
  );

  it.each([
    ["https://0177.0.0.1"], // octal
    ["https://2130706433"], // decimal
    ["https://127.1"], // short form
    ["https://127.0.0.1."], // trailing-dot FQDN form of an IP literal
  ])("rejects a loopback address written in a form the URL parser normalizes (%s)", (url) => {
    const result = unsafeUrlReason(url);
    expect(result?.code).toBe("host");
  });

  describe("trustedOrigin", () => {
    it("returns null when the url's origin matches the trusted origin, even over http", () => {
      const result = unsafeUrlReason("http://bw.internal/download/1", "http://bw.internal/api");

      expect(result).toBeNull();
    });

    it("returns null when the url's origin matches a private-address trusted origin", () => {
      const result = unsafeUrlReason("https://192.168.1.50/download/1", "https://192.168.1.50/api");

      expect(result).toBeNull();
    });

    it("still applies the check when the url's origin differs from the trusted origin", () => {
      const result = unsafeUrlReason("https://169.254.169.254/download/1", "https://bw.internal");

      expect(result?.code).toBe("host");
    });

    it("still applies the check when trustedOrigin itself can't be parsed", () => {
      const result = unsafeUrlReason("https://169.254.169.254/download/1", "not a url");

      expect(result?.code).toBe("host");
    });

    it("does not treat two opaque origins as the same origin", () => {
      const result = unsafeUrlReason("file:///etc/passwd", "file:///etc/shadow");

      expect(result?.code).toBe("scheme");
    });
  });
});
