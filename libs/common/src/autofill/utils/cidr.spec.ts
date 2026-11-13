import { isHostnameExcluded, isHostnameInCidr, isIpv4Cidr } from "./cidr";

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
});
