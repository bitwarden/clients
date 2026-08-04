import { FormArray, FormControl } from "@angular/forms";

import {
  atLeastOneNonEmptyCidrValidator,
  cidrValidator,
  noDuplicateCidrsValidator,
} from "./cidr.validator";

// The real CIDR check delegates to the Rust SDK's `is_valid_cidr` (backed by the `ipnet` crate),
// which the app injects via `CidrValidationService`. The SDK owns CIDR parsing and is covered by
// the crate's own Rust tests; re-implementing `ipnet` here would only test the stub against
// itself. These specs cover the repo's validator logic — trimming, empty-row handling, duplicate
// detection, and the at-least-one rule — so they pass a stand-in predicate that reports
// valid/invalid for a fixed set of inputs.
const isValidCidr = (value: string): boolean => value === "10.0.0.0/8" || value === "2001:db8::/32";

describe("cidrValidator", () => {
  const validate = (value: string) =>
    cidrValidator("Enter a valid CIDR range.", isValidCidr)(new FormControl(value));

  it("returns null for a valid IPv4 CIDR", () => {
    expect(validate("10.0.0.0/8")).toBeNull();
  });

  it("returns null for a valid IPv6 CIDR", () => {
    expect(validate("2001:db8::/32")).toBeNull();
  });

  it("returns invalidCidr error with message when the SDK rejects the value", () => {
    expect(validate("not-a-cidr")).toEqual({
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
