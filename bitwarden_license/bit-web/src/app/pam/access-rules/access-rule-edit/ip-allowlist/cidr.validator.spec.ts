import { FormArray, FormControl } from "@angular/forms";

import {
  atLeastOneNonEmptyCidrValidator,
  cidrValidator,
  duplicateCidrValues,
  noDuplicateCidrsValidator,
} from "./cidr.validator";

// CIDR parsing is the SDK's `is_valid_cidr`, tested in Rust; these specs cover the validators
// around it with a stand-in predicate.
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

describe("duplicateCidrValues", () => {
  it("returns an empty set when all values are distinct", () => {
    expect(duplicateCidrValues(["10.0.0.0/8", "192.168.0.0/16"])).toEqual(new Set());
  });

  it("returns the repeated value, trimmed, once per distinct range", () => {
    expect(duplicateCidrValues(["10.0.0.0/8", " 10.0.0.0/8 ", "10.0.0.0/8"])).toEqual(
      new Set(["10.0.0.0/8"]),
    );
  });

  it("ignores empty and whitespace-only rows", () => {
    expect(duplicateCidrValues(["", "   ", "10.0.0.0/8"])).toEqual(new Set());
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
