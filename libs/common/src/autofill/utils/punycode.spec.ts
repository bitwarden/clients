import { punycodeToUnicode } from "./punycode";

/**
 * Test IDN domains sourced from IANA reserved Test IDN top-level domains:
 * @see https://www.iana.org/domains/reserved
 */
describe("punycodeToUnicode", () => {
  describe("basic decoding of IANA test IDN TLDs", () => {
    it("decodes Arabic (إختبار)", () => {
      expect(punycodeToUnicode("xn--kgbechtv")).toBe("إختبار");
    });

    it("decodes Persian (آزمایشی)", () => {
      expect(punycodeToUnicode("xn--hgbk6aj7f53bba")).toBe("آزمایشی");
    });

    it("decodes Chinese Simplified (测试)", () => {
      expect(punycodeToUnicode("xn--0zwm56d")).toBe("测试");
    });

    it("decodes Chinese Traditional (測試)", () => {
      expect(punycodeToUnicode("xn--g6w251d")).toBe("測試");
    });

    it("decodes Russian Cyrillic (испытание)", () => {
      expect(punycodeToUnicode("xn--80akhbyknj4f")).toBe("испытание");
    });

    it("decodes Hindi Devanagari (परीक्षा)", () => {
      expect(punycodeToUnicode("xn--11b5bs3a9aj6g")).toBe("परीक्षा");
    });

    it("decodes Greek (δοκιμή)", () => {
      expect(punycodeToUnicode("xn--jxalpdlp")).toBe("δοκιμή");
    });

    it("decodes Korean Hangul (테스트)", () => {
      expect(punycodeToUnicode("xn--9t4b11yi5a")).toBe("테스트");
    });

    it("decodes Yiddish Hebrew (טעסט)", () => {
      expect(punycodeToUnicode("xn--deba0ad")).toBe("טעסט");
    });

    it("decodes Japanese Katakana (テスト)", () => {
      expect(punycodeToUnicode("xn--zckzah")).toBe("テスト");
    });

    it("decodes Tamil (பரிட்சை)", () => {
      expect(punycodeToUnicode("xn--hlcj6aya9esc7a")).toBe("பரிட்சை");
    });
  });

  describe("decoding with second-level labels", () => {
    it("decodes an IANA test IDN TLD paired with an ASCII second-level label", () => {
      expect(punycodeToUnicode("example.xn--jxalpdlp")).toBe("example.δοκιμή");
    });

    it("decodes multiple punycode labels", () => {
      expect(punycodeToUnicode("xn--0zwm56d.xn--g6w251d")).toBe("测试.測試");
    });
  });

  describe("passthrough for non-punycode hosts", () => {
    it("passes through IANA reserved example domains unchanged", () => {
      expect(punycodeToUnicode("example.com")).toBe("example.com");
      expect(punycodeToUnicode("example.net")).toBe("example.net");
      expect(punycodeToUnicode("example.org")).toBe("example.org");
    });

    it("passes through subdomains unchanged", () => {
      expect(punycodeToUnicode("www.example.com")).toBe("www.example.com");
    });

    it("passes through localhost unchanged", () => {
      expect(punycodeToUnicode("localhost")).toBe("localhost");
    });

    it("passes through IP addresses unchanged", () => {
      expect(punycodeToUnicode("192.168.1.1")).toBe("192.168.1.1");
    });
  });

  describe("port handling", () => {
    it("preserves ports on punycode hosts", () => {
      expect(punycodeToUnicode("xn--zckzah:8443")).toBe("テスト:8443");
    });

    it("preserves ports on plain ASCII hosts", () => {
      expect(punycodeToUnicode("example.com:8443")).toBe("example.com:8443");
    });

    it("preserves localhost with port", () => {
      expect(punycodeToUnicode("localhost:3000")).toBe("localhost:3000");
    });
  });

  describe("mixed labels", () => {
    it("decodes only the punycode labels, leaving ASCII labels intact", () => {
      expect(punycodeToUnicode("www.xn--9t4b11yi5a")).toBe("www.테스트");
    });

    it("handles subdomain with punycode parent", () => {
      expect(punycodeToUnicode("login.xn--80akhbyknj4f")).toBe("login.испытание");
    });
  });

  describe("edge cases", () => {
    it("returns empty string for empty input", () => {
      expect(punycodeToUnicode("")).toBe("");
    });

    it("returns invalid punycode labels as-is", () => {
      // "xn--" followed by invalid encoding should fall back gracefully
      expect(punycodeToUnicode("xn--invalid!!!.com")).toBe("xn--invalid!!!.com");
    });

    it("decodes labels with uppercase characters in the encoded body", () => {
      // RFC 3492 Section 5: decoding is case-insensitive
      expect(punycodeToUnicode("xn--Mnchen-3ya.de")).toBe("münchen.de");
      expect(punycodeToUnicode("XN--MNCHEN-3YA.de")).toBe("münchen.de");
    });

    it("returns labels with code points beyond Unicode range as-is", () => {
      // Crafted label that would decode to a code point > U+10FFFF
      // "xn--" + a long run of 'z' chars forces n to accumulate past 0x10FFFF
      const crafted = "xn--" + "z".repeat(200);
      expect(punycodeToUnicode(crafted + ".com")).toBe(crafted + ".com");
    });

    it("returns labels exceeding DNS label length limit as-is", () => {
      const longLabel = "xn--" + "a".repeat(60);
      expect(punycodeToUnicode(longLabel + ".com")).toBe(longLabel + ".com");
    });

    it("returns xn-- with empty body as-is", () => {
      expect(punycodeToUnicode("xn--.com")).toBe("xn--.com");
    });

    it("handles trailing dot (DNS root form)", () => {
      expect(punycodeToUnicode("xn--mnchen-3ya.de.")).toBe("münchen.de.");
    });

    it("handles non-numeric port-like suffix without misinterpreting it", () => {
      expect(punycodeToUnicode("example.com:abc")).toBe("example.com:abc");
    });
  });

  describe("IPv6 passthrough", () => {
    it("passes through bracketed IPv6 addresses unchanged", () => {
      expect(punycodeToUnicode("[::1]")).toBe("[::1]");
    });

    it("passes through bracketed IPv6 with port unchanged", () => {
      expect(punycodeToUnicode("[::1]:8443")).toBe("[::1]:8443");
    });

    it("passes through full IPv6 address unchanged", () => {
      expect(punycodeToUnicode("[2001:db8::1]:443")).toBe("[2001:db8::1]:443");
    });
  });
});
