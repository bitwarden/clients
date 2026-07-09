import { FormArray, FormControl } from "@angular/forms";

import {
  atLeastOneNonEmptyCidrValidator,
  cidrValidator,
  isValidCidr,
  noDuplicateCidrsValidator,
} from "./cidr.validator";

// `isValidCidr` now delegates to the Rust SDK's `is_valid_cidr` (backed by the `ipnet` crate).
// Jest cannot load the real WASM module — every other bitwarden_license/libs spec that touches
// `@bitwarden/sdk-internal` mocks the module rather than letting it load for real (see e.g.
// onepassword-1pux-importer.spec.ts, purecrypto-randomizer.spec.ts, flight-recorder.spec.ts,
// biometric-persistent-encryption-migration.spec.ts — all use `jest.mock("@bitwarden/sdk-internal", ...)`).
// On top of that, the published `@bitwarden/sdk-internal` npm package doesn't export
// `is_valid_cidr` at all yet (it's landing in a parallel workstream), so there is nothing real
// to load here regardless.
//
// `mockIsValidCidr` below is a faithful re-implementation of the real rule described for the SDK
// function: exactly one explicit `/prefix`, a syntactically valid IPv4 or IPv6 address, prefix
// in range (0-32 / 0-128), and — the key behavior change from the old regex — zero host bits set
// past the prefix. It does not handle embedded IPv4-in-IPv6 mixed notation (e.g.
// "::ffff:192.0.2.1"); no case in this file exercises that.

function isStrictIPv4Octet(text: string): boolean {
  return /^\d{1,3}$/.test(text) && Number(text) <= 255 && (text === "0" || text[0] !== "0");
}

function ipv4ToBigInt(address: string): bigint | null {
  const octets = address.split(".");
  if (octets.length !== 4 || !octets.every(isStrictIPv4Octet)) {
    return null;
  }
  return octets.reduce((acc, octet) => acc * BigInt(256) + BigInt(octet), BigInt(0));
}

function isHexGroup(text: string): boolean {
  return /^[0-9a-fA-F]{1,4}$/.test(text);
}

function ipv6ToBigInt(address: string): bigint | null {
  if (address.includes(".")) {
    return null;
  }
  const compressed = address.split("::");
  if (compressed.length > 2) {
    // At most one "::" run-of-zeros compression is allowed in a real IPv6 address.
    return null;
  }
  let groups: string[];
  if (compressed.length === 2) {
    const head = compressed[0] === "" ? [] : compressed[0].split(":");
    const tail = compressed[1] === "" ? [] : compressed[1].split(":");
    const fillCount = 8 - head.length - tail.length;
    if (fillCount < 1 || !head.every(isHexGroup) || !tail.every(isHexGroup)) {
      return null;
    }
    groups = [...head, ...Array(fillCount).fill("0"), ...tail];
  } else {
    groups = address.split(":");
    if (groups.length !== 8 || !groups.every(isHexGroup)) {
      return null;
    }
  }
  return groups.reduce((acc, group) => acc * BigInt(65536) + BigInt(`0x${group}`), BigInt(0));
}

function hasZeroHostBits(value: bigint, prefixLength: number, totalBits: number): boolean {
  const hostBits = totalBits - prefixLength;
  if (hostBits <= 0) {
    return true;
  }
  const hostMask = (BigInt(1) << BigInt(hostBits)) - BigInt(1);
  return (value & hostMask) === BigInt(0);
}

const mockIsValidCidr = jest.fn((value: string): boolean => {
  const slashIndex = value.indexOf("/");
  if (slashIndex === -1 || value.indexOf("/", slashIndex + 1) !== -1) {
    return false;
  }
  const address = value.slice(0, slashIndex);
  const prefixText = value.slice(slashIndex + 1);
  if (!/^\d{1,3}$/.test(prefixText)) {
    return false;
  }
  const prefix = Number(prefixText);

  const v4 = ipv4ToBigInt(address);
  if (v4 !== null) {
    return prefix <= 32 && hasZeroHostBits(v4, prefix, 32);
  }
  const v6 = ipv6ToBigInt(address);
  if (v6 !== null) {
    return prefix <= 128 && hasZeroHostBits(v6, prefix, 128);
  }
  return false;
});

jest.mock("@bitwarden/sdk-internal", () => ({
  is_valid_cidr: (value: string) => mockIsValidCidr(value),
}));

describe("isValidCidr", () => {
  describe("valid IPv4 CIDRs", () => {
    it.each(["0.0.0.0/0", "10.0.0.0/8", "192.168.1.0/24", "172.16.0.0/12", "255.255.255.255/32"])(
      "accepts %s",
      (cidr) => {
        expect(isValidCidr(cidr)).toBe(true);
      },
    );
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

  // Behavior change from the SDK migration: the old regex only validated *shape* — each octet
  // in range and the prefix in range — it never checked that the address was the network
  // address for that prefix. The SDK's `is_valid_cidr` (via Rust's `ipnet`) does, and rejects
  // any address with host bits set past the prefix. Verified against the pre-migration regex
  // pair (`IPV4_CIDR_RE` / `IPV6_CIDR_RE`) that every case below previously returned `true`.
  describe("IPv4 CIDRs with non-zero host bits (rejected only by the SDK, not the old regex)", () => {
    it.each([
      "10.0.0.1/8",
      "192.168.1.5/24",
      // Previously listed under "valid IPv4 CIDRs" — /0 means every address bit is a host
      // bit, and 1.2.3.4 isn't the all-zero network address, so it's now rejected too.
      "1.2.3.4/0",
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

  // Same host-bits behavior change as IPv4, above, applied to IPv6.
  describe("IPv6 CIDRs with non-zero host bits (rejected only by the SDK, not the old regex)", () => {
    it.each(["2001:db8::1/32"])("rejects %s", (cidr) => {
      expect(isValidCidr(cidr)).toBe(false);
    });
  });

  // The old IPv6 regex (`/^[0-9a-fA-F:]+(?::[0-9a-fA-F]*)?\/(...)$/`, flagged TBD under
  // PM-37273) only checked that the address was made up of hex digits and colons — it never
  // counted groups or constrained "::" compression, so it accepted plainly invalid addresses.
  // Verified against that regex directly that every case below previously returned `true`.
  // The SDK does real parsing and correctly rejects all of them.
  describe("IPv6-shaped strings the old permissive regex incorrectly accepted", () => {
    it.each([
      // No colon at all — not an IPv6 address, just a decimal-looking string that happens to
      // be made of valid hex characters.
      "1234/64",
      "abcd/64",
      // More than one "::" compression is not valid IPv6.
      "2001:db8:::1/64",
      // 9 groups — a valid IPv6 address has at most 8.
      "1:2:3:4:5:6:7:8:9/64",
    ])("rejects %s", (cidr) => {
      expect(isValidCidr(cidr)).toBe(false);
    });
  });
});

describe("cidrValidator", () => {
  const validate = (value: string) =>
    cidrValidator("Enter a valid CIDR range.")(new FormControl(value));

  it("returns null for a valid IPv4 CIDR", () => {
    expect(validate("10.0.0.0/8")).toBeNull();
  });

  it("returns null for a valid IPv6 CIDR", () => {
    expect(validate("2001:db8::/32")).toBeNull();
  });

  it("returns invalidCidr error with message for a malformed value", () => {
    expect(validate("not-a-cidr")).toEqual({
      invalidCidr: { message: "Enter a valid CIDR range." },
    });
  });

  it("returns invalidCidr error with message for a value with non-zero host bits", () => {
    expect(validate("10.0.0.1/8")).toEqual({
      invalidCidr: { message: "Enter a valid CIDR range." },
    });
  });

  it("returns null for an empty string (empty handled at array level)", () => {
    expect(validate("")).toBeNull();
  });

  it("returns null for a whitespace-only string (treated as empty)", () => {
    expect(validate("   ")).toBeNull();
  });
});

describe("noDuplicateCidrsValidator", () => {
  const validate = (values: string[]) =>
    noDuplicateCidrsValidator()(new FormArray(values.map((v) => new FormControl(v))));

  it("returns null when all values are distinct", () => {
    expect(validate(["10.0.0.0/8", "192.168.0.0/16"])).toBeNull();
  });

  it("returns duplicateCidrs when two values match", () => {
    expect(validate(["10.0.0.0/8", "10.0.0.0/8"])).toEqual({ duplicateCidrs: true });
  });

  it("ignores leading/trailing whitespace when comparing", () => {
    expect(validate(["10.0.0.0/8", " 10.0.0.0/8 "])).toEqual({ duplicateCidrs: true });
  });

  it("ignores empty rows", () => {
    expect(validate(["", "10.0.0.0/8", "   "])).toBeNull();
  });

  it("returns null for a non-array control", () => {
    expect(noDuplicateCidrsValidator()(new FormControl("10.0.0.0/8"))).toBeNull();
  });
});

describe("atLeastOneNonEmptyCidrValidator", () => {
  const validate = (values: string[]) =>
    atLeastOneNonEmptyCidrValidator()(new FormArray(values.map((v) => new FormControl(v))));

  it("returns null when at least one row is non-empty", () => {
    expect(validate(["", "10.0.0.0/8"])).toBeNull();
  });

  it("returns atLeastOneCidr when every row is empty or whitespace", () => {
    expect(validate(["", "   "])).toEqual({ atLeastOneCidr: true });
  });

  it("returns atLeastOneCidr for an empty array", () => {
    expect(validate([])).toEqual({ atLeastOneCidr: true });
  });

  it("returns null for a non-array control", () => {
    expect(atLeastOneNonEmptyCidrValidator()(new FormControl(""))).toBeNull();
  });
});
