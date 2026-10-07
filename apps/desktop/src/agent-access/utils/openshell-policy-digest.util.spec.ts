import { createHash } from "crypto";
import { readFileSync } from "fs";
import * as path from "path";

import { mock } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";

import { OpenShellEndpoint } from "../models/openshell";

import {
  computeOpenShellPolicyDigest,
  openShellPolicyCanonicalBytes,
} from "./openshell-policy-digest.util";

/** §M8.11 golden vectors, read from the same fixture file the Rust and aac tests use. */
const vectors: { vectors: Array<{ endpoints: OpenShellEndpoint[]; digest: string }> } = JSON.parse(
  readFileSync(
    path.join(
      __dirname,
      "../../../desktop_native/agent_access/tests/fixtures/openshell/openshell-digest-vectors.json",
    ),
    "utf8",
  ),
);

/** A CryptoFunctionService whose `hash` is Node's SHA-256, so the vectors are checked for real. */
function sha256CryptoFunctionService(): CryptoFunctionService {
  const service = mock<CryptoFunctionService>();
  service.hash.mockImplementation(async (value) => {
    const digest = createHash("sha256")
      .update(typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value))
      .digest();
    return new Uint8Array(digest) as Uint8Array<ArrayBuffer>;
  });
  return service;
}

describe("openshell policy digest (§M8.5)", () => {
  const cryptoFunctionService = sha256CryptoFunctionService();

  it.each(vectors.vectors.map((vector, index) => [index, vector] as const))(
    "matches golden vector %i",
    async (_index, vector) => {
      await expect(
        computeOpenShellPolicyDigest(cryptoFunctionService, vector.endpoints),
      ).resolves.toBe(vector.digest);
    },
  );

  it("is independent of input order", async () => {
    const endpoints = vectors.vectors[1].endpoints;
    const reversed = [...endpoints].reverse();
    expect(await computeOpenShellPolicyDigest(cryptoFunctionService, reversed)).toBe(
      await computeOpenShellPolicyDigest(cryptoFunctionService, endpoints),
    );
  });

  it("builds the pinned canonical string with an empty path for an absent one", () => {
    const bytes = openShellPolicyCanonicalBytes([
      { host: "uploads.github.com", port: 443, source: "policyBinding" },
      { host: "api.github.com", port: 443, path: "/**", source: "profile" },
    ]);
    expect(new TextDecoder().decode(bytes)).toBe(
      "api.github.com\t443\t/**\tprofile\nuploads.github.com\t443\t\tpolicyBinding\n",
    );
  });

  it("sorts by UTF-8 byte order, not UTF-16 code units", () => {
    // U+FF5E (3 UTF-8 bytes, 0xEF…) sorts after U+1F600 (4 bytes, 0xF0…) in UTF-16 order but
    // before it in byte order.
    const bytes = openShellPolicyCanonicalBytes([
      { host: "a.com", port: 1, path: "/\u{1F600}", source: "profile" },
      { host: "a.com", port: 1, path: "/\uFF5E", source: "profile" },
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text.indexOf("\uFF5E")).toBeLessThan(text.indexOf("\u{1F600}"));
  });

  it("returns lowercase hex with the sha256: prefix", async () => {
    const digest = await computeOpenShellPolicyDigest(cryptoFunctionService, []);
    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
