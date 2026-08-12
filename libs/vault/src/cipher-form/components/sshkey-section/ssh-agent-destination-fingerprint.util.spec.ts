import { FormControl } from "@angular/forms";

import {
  normalizeSshAgentDestinationFingerprints,
  sshAgentDestinationFingerprintValidator,
} from "./ssh-agent-destination-fingerprint.util";

describe("sshAgentDestinationFingerprintValidator", () => {
  const ERROR_MESSAGE = "Enter a valid SHA256 host key fingerprint";
  const validator = sshAgentDestinationFingerprintValidator(ERROR_MESSAGE);

  it("returns null for an empty value", () => {
    expect(validator(new FormControl(""))).toBeNull();
  });

  it("returns null for a whitespace-only value", () => {
    expect(validator(new FormControl("   "))).toBeNull();
  });

  it("returns null for a value with the SHA256: prefix", () => {
    expect(validator(new FormControl("SHA256:abcd1234"))).toBeNull();
  });

  it("returns the given message for a value missing the SHA256: prefix", () => {
    expect(validator(new FormControl("abcd1234"))).toEqual({
      invalidSshAgentDestinationFingerprint: { message: ERROR_MESSAGE },
    });
  });

  it("returns the given message for a value with a different digest prefix", () => {
    expect(validator(new FormControl("MD5:abcd1234"))).toEqual({
      invalidSshAgentDestinationFingerprint: { message: ERROR_MESSAGE },
    });
  });
});

describe("normalizeSshAgentDestinationFingerprints", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeSshAgentDestinationFingerprints(["  SHA256:aaaa  "])).toEqual(["SHA256:aaaa"]);
  });

  it("drops empty and whitespace-only values", () => {
    expect(normalizeSshAgentDestinationFingerprints(["SHA256:aaaa", "", "   "])).toEqual([
      "SHA256:aaaa",
    ]);
  });

  it("removes exact duplicates, keeping the first occurrence's position", () => {
    expect(
      normalizeSshAgentDestinationFingerprints(["SHA256:aaaa", "SHA256:bbbb", "SHA256:aaaa"]),
    ).toEqual(["SHA256:aaaa", "SHA256:bbbb"]);
  });

  it("returns an empty array for an all-empty input", () => {
    expect(normalizeSshAgentDestinationFingerprints(["", "  ", null, undefined])).toEqual([]);
  });

  it("returns an empty array for an empty input", () => {
    expect(normalizeSshAgentDestinationFingerprints([])).toEqual([]);
  });
});
