import { FormControl } from "@angular/forms";

import { cidrValidator, isValidCidr } from "./cidr.validator";

describe("isValidCidr", () => {
  describe("valid IPv4 CIDRs", () => {
    it.each([
      "0.0.0.0/0",
      "10.0.0.0/8",
      "192.168.1.0/24",
      "172.16.0.0/12",
      "255.255.255.255/32",
      "1.2.3.4/0",
    ])("accepts %s", (cidr) => {
      expect(isValidCidr(cidr)).toBe(true);
    });
  });

  describe("invalid IPv4 CIDRs", () => {
    it.each([
      "256.0.0.0/24",
      "192.168.1.0/33",
      "10.0.0/24",
      "10.0.0.0",
      "10.0.0.0/",
      "not-an-ip/24",
      "",
      "192.168.1.0/24/extra",
    ])("rejects %s", (cidr) => {
      expect(isValidCidr(cidr)).toBe(false);
    });
  });

  describe("valid IPv6 CIDRs", () => {
    it.each([
      "2001:db8::/32",
      "::/0",
      "::1/128",
      "fe80::/10",
      "2001:0db8:0000:0000:0000:0000:0000:0000/32",
    ])("accepts %s", (cidr) => {
      expect(isValidCidr(cidr)).toBe(true);
    });
  });

  describe("invalid IPv6 CIDRs", () => {
    it.each(["2001:db8::/129", "not-ipv6/64"])("rejects %s", (cidr) => {
      expect(isValidCidr(cidr)).toBe(false);
    });
  });
});

describe("cidrValidator", () => {
  const validate = (value: string) => cidrValidator()(new FormControl(value));

  it("returns null for a valid IPv4 CIDR", () => {
    expect(validate("10.0.0.0/8")).toBeNull();
  });

  it("returns null for a valid IPv6 CIDR", () => {
    expect(validate("2001:db8::/32")).toBeNull();
  });

  it("returns invalidCidr error for a malformed value", () => {
    expect(validate("not-a-cidr")).toEqual({ invalidCidr: true });
  });

  it("returns null for an empty string (empty handled at array level)", () => {
    expect(validate("")).toBeNull();
  });

  it("returns null for a whitespace-only string (treated as empty)", () => {
    expect(validate("   ")).toBeNull();
  });
});
