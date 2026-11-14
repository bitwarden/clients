import { isHostnameExcluded, isHostnameInCidr, isIpv4Cidr, normalizeDomainListEntry } from "./cidr";

describe("cidr utils", () => {
  describe("isIpv4Cidr", () => {
    it.each(["192.0.2.0/24", "203.0.113.0/25", "192.0.2.1/32", "0.0.0.0/0", " 203.0.113.0/25 "])(
      "accepts %s",
      (value) => {
        expect(isIpv4Cidr(value)).toBe(true);
      },
    );

    it.each([
      "192.0.2.0",
      "192.0.2.0/33",
      "192.0.2.0/",
      "192.0.2.0/-1",
      "192.0.2.0/24/1",
      "256.0.0.0/8",
      "192.0.2/24",
      "example.com/24",
      "",
    ])("rejects %s", (value) => {
      expect(isIpv4Cidr(value)).toBe(false);
    });
  });

  describe("prefix lengths", () => {
    // 192.0.2.77 as an unsigned 32-bit integer
    const address = 192 * 2 ** 24 + 0 * 2 ** 16 + 2 * 2 ** 8 + 77;
    const toDotted = (value: number) =>
      [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join(".");

    it.each(Array.from({ length: 33 }, (_, prefix) => prefix))(
      "accepts /%i and matches exactly the addresses in the range",
      (prefix) => {
        const cidr = `192.0.2.77/${prefix}`;
        const size = 2 ** (32 - prefix);
        const start = Math.floor(address / size) * size;

        expect(isIpv4Cidr(cidr)).toBe(true);
        expect(isHostnameInCidr(toDotted(start), cidr)).toBe(true);
        expect(isHostnameInCidr(toDotted(start + size - 1), cidr)).toBe(true);
        if (start > 0) {
          expect(isHostnameInCidr(toDotted(start - 1), cidr)).toBe(false);
        }
        if (start + size <= 2 ** 32 - 1) {
          expect(isHostnameInCidr(toDotted(start + size), cidr)).toBe(false);
        }
      },
    );

    it.each(["/33", "/34", "/99", "/100"])("rejects %s", (prefix) => {
      expect(isIpv4Cidr(`192.0.2.0${prefix}`)).toBe(false);
    });
  });

  describe("isHostnameInCidr", () => {
    it("matches addresses inside the range, including its first and last address", () => {
      expect(isHostnameInCidr("192.0.2.0", "192.0.2.0/24")).toBe(true);
      expect(isHostnameInCidr("192.0.2.8", "192.0.2.0/24")).toBe(true);
      expect(isHostnameInCidr("192.0.2.255", "192.0.2.0/24")).toBe(true);
    });

    it("does not match addresses outside the range", () => {
      expect(isHostnameInCidr("192.0.3.0", "192.0.2.0/24")).toBe(false);
      expect(isHostnameInCidr("192.0.1.255", "192.0.2.0/24")).toBe(false);
    });

    it("applies the prefix length to a range whose host bits are set", () => {
      expect(isHostnameInCidr("192.0.2.1", "192.0.2.77/24")).toBe(true);
    });

    it("handles /32, /0 and the top of the address space", () => {
      expect(isHostnameInCidr("192.0.2.1", "192.0.2.1/32")).toBe(true);
      expect(isHostnameInCidr("192.0.2.2", "192.0.2.1/32")).toBe(false);
      expect(isHostnameInCidr("203.0.113.9", "0.0.0.0/0")).toBe(true);
      expect(isHostnameInCidr("255.255.255.255", "255.255.255.0/24")).toBe(true);
    });

    it("never matches hostnames that are not IPv4 addresses", () => {
      expect(isHostnameInCidr("example.com", "0.0.0.0/0")).toBe(false);
      expect(isHostnameInCidr("192.0.2.8.example.com", "192.0.2.0/24")).toBe(false);
    });

    it("never matches an entry that is not a CIDR range", () => {
      expect(isHostnameInCidr("192.0.2.8", "192.0.2.8")).toBe(false);
    });
  });

  describe("isHostnameExcluded", () => {
    it("matches an exact entry", () => {
      expect(isHostnameExcluded("example.com", { "example.com": null })).toBe(true);
    });

    it("matches an address inside a CIDR entry", () => {
      expect(isHostnameExcluded("192.0.2.8", { "example.com": null, "192.0.2.0/24": null })).toBe(
        true,
      );
    });

    it("does not match an unrelated host or address", () => {
      expect(
        isHostnameExcluded("198.51.100.8", { "example.com": null, "192.0.2.0/24": null }),
      ).toBe(false);
    });

    it("returns false when there are no exclusions", () => {
      expect(isHostnameExcluded("192.0.2.8", null)).toBe(false);
      expect(isHostnameExcluded("192.0.2.8", {})).toBe(false);
    });
  });
  describe("normalizeDomainListEntry", () => {
    it("keeps a valid CIDR range as typed, without surrounding whitespace", () => {
      expect(normalizeDomainListEntry("192.0.2.0/24")).toBe("192.0.2.0/24");
      expect(normalizeDomainListEntry("  198.51.100.0/0 ")).toBe("198.51.100.0/0");
    });

    it("reduces a hostname or URL to its hostname", () => {
      expect(normalizeDomainListEntry("https://example.com/login")).toBe("example.com");
      expect(normalizeDomainListEntry("192.0.2.5")).toBe("192.0.2.5");
      expect(normalizeDomainListEntry("192.0.2.5/login")).toBe("192.0.2.5");
    });

    it.each(["192.0.2.0/33", "192.0.2.0/-1", "192.0.2.0/24/1", "192.0.2/24", "256.0.0.0/8"])(
      "rejects %s instead of reducing it to a bare address",
      (value) => {
        expect(normalizeDomainListEntry(value)).toBeNull();
      },
    );

    it("returns null for an entry that is not a hostname", () => {
      expect(normalizeDomainListEntry("")).toBeNull();
    });
  });
});
