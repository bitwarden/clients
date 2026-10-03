import { X509Certificate, createHash } from "node:crypto";
import { promises as fs, readFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { IdentityMetadata, MtlsConfiguration } from "../../models/mtls";

import { normalizeChallengeEndpoint, normalizeEndpoint } from "./endpoint";
import { MtlsRegistry } from "./mtls-registry";
import { selectOfferedIdentity } from "./selection";

const certificate = readFileSync(path.join(__dirname, "fixtures", "test-cert.pem"), "utf8");
const fingerprint = createHash("sha256").update(new X509Certificate(certificate).raw).digest("hex");
const otherFingerprint = "a".repeat(64);
const identity: IdentityMetadata = {
  fingerprint,
  label: "Test client",
  subject: "CN=localhost",
  issuer: "CN=localhost",
  notBefore: "2020-01-01T00:00:00.000Z",
  notAfter: "2030-01-01T00:00:00.000Z",
  importedAt: "2026-01-01T00:00:00.000Z",
};

describe("mTLS endpoint normalization", () => {
  it.each([
    ["https://VAULT.example/api?x=1", "vault.example:443"],
    ["wss://vault.example/notifications/hub", "vault.example:443"],
    ["https://vault.example:8443/", "vault.example:8443"],
    ["https://vault.example./", "vault.example:443"],
    ["https://[::1]:8443/", "[::1]:8443"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeEndpoint(input)).toBe(expected);
  });

  it.each([
    "http://vault.example/",
    "https://user:password@vault.example/",
    "https://vault.example:65536/",
    "not a URL",
  ])("rejects %s", (input) => {
    expect(() => normalizeEndpoint(input)).toThrow("invalid-endpoint");
  });
});

describe("mTLS certificate selection", () => {
  const configuration: MtlsConfiguration = {
    version: 1,
    revision: 1,
    storeId: "00000000-0000-4000-8000-000000000000",
    identities: { [fingerprint]: identity },
    bindings: { "vault.example:443": fingerprint },
    cleanup: [],
  };

  it.each(["vault.example:443", "VAULT.example:443", "vault.example.:443"])(
    "selects the bound certificate for Electron's authority challenge %s",
    (challenge) => {
      const offered = [{ data: certificate }];
      expect(selectOfferedIdentity(configuration, challenge, offered)).toEqual({
        certificate: offered[0],
      });
    },
  );

  it("preserves the port and bracketed IPv6 address of a TLS challenge", () => {
    expect(normalizeChallengeEndpoint("[::1]:8443")).toBe("[::1]:8443");
    expect(
      selectOfferedIdentity(configuration, "vault.example:8443", [{ data: certificate }]),
    ).toEqual({});
  });

  it.each([
    "vault.example",
    "user@vault.example:443",
    "vault.example:443/api",
    "http://vault.example:443",
    "vault.example:65536",
    "::1:443",
  ])("rejects an invalid challenge %s", (challenge) => {
    expect(selectOfferedIdentity(configuration, challenge, [{ data: certificate }])).toEqual({
      error: "invalid-endpoint",
    });
  });

  it("chooses only an offered identity matching the bound DER SHA-256", () => {
    const offered = [{ data: "invalid" }, { data: certificate }];
    expect(
      selectOfferedIdentity(
        configuration,
        "wss://vault.example/hub",
        offered,
        new Date("2026-01-01"),
      ),
    ).toEqual({ certificate: offered[1] });
    expect(selectOfferedIdentity(configuration, "https://elsewhere.example/", offered)).toEqual({});
    expect(selectOfferedIdentity(configuration, "https://vault.example/", [offered[0]])).toEqual({
      error: "identity-not-offered",
    });
  });

  it("rejects a locally expired identity even if Chromium offers it", () => {
    expect(
      selectOfferedIdentity(
        configuration,
        "https://vault.example/",
        [{ data: certificate }],
        new Date("2031-01-01"),
      ),
    ).toEqual({ error: "certificate-expired" });
  });
});

describe("mTLS registry", () => {
  let userData: string;

  beforeEach(async () => {
    userData = await fs.mkdtemp(path.join(os.tmpdir(), "bitwarden-mtls-test-"));
  });

  afterEach(async () => {
    await fs.rm(userData, { recursive: true, force: true });
  });

  it("persists bindings across reloads while the active snapshot waits for restart", async () => {
    const registry = await MtlsRegistry.load(userData);
    await registry.addIdentity(identity, 0);
    const pending = await registry.bind(
      fingerprint,
      ["https://vault.example/api", "wss://vault.example/hub"],
      1,
      false,
    );
    expect(pending.bindings).toEqual({ "vault.example:443": fingerprint });
    expect(registry.active.bindings).toEqual({});
    expect(registry.restartRequired).toBe(true);

    const reloaded = await MtlsRegistry.load(userData);
    expect(reloaded.active.bindings).toEqual({ "vault.example:443": fingerprint });
    expect(reloaded.restartRequired).toBe(false);
    expect((await fs.stat(path.join(userData, "mtls", "registry.json"))).mode & 0o777).toBe(0o600);
  });

  it("rejects conflicting revisions and preserves shared identities on unbind", async () => {
    const registry = await MtlsRegistry.load(userData);
    await registry.addIdentity(identity, 0);
    await registry.addIdentity({ ...identity, fingerprint: otherFingerprint }, 1);
    await registry.bind(fingerprint, ["https://one.example", "https://two.example"], 2, false);
    await expect(
      registry.bind(otherFingerprint, ["https://one.example"], 3, false),
    ).rejects.toThrow("conflict");
    await expect(registry.unbind("https://one.example", 2)).rejects.toThrow("conflict");
    const pending = await registry.unbind("https://one.example", 3);
    expect(pending.bindings).toEqual({ "two.example:443": fingerprint });
    expect(pending.identities[fingerprint]).toBeDefined();
  });

  it("serializes concurrent mutations and schedules removal only after unbinding every endpoint", async () => {
    const registry = await MtlsRegistry.load(userData);
    await registry.addIdentity(identity, 0);
    const first = registry.bind(fingerprint, ["https://one.example"], 1, false);
    const second = registry.bind(fingerprint, ["https://two.example"], 1, false);
    await expect(first).resolves.toMatchObject({ revision: 2 });
    await expect(second).rejects.toThrow("conflict");
    const pending = await registry.remove(fingerprint, 2);
    expect(pending.bindings).toEqual({});
    expect(pending.cleanup).toEqual([fingerprint]);
    expect(registry.active.cleanup).toEqual([]);
  });

  it("persists completed cleanup and rejects stale cleanup revisions", async () => {
    const registry = await MtlsRegistry.load(userData);
    await registry.addIdentity(identity, 0);
    await registry.bind(fingerprint, ["https://vault.example"], 1, false);
    await registry.remove(fingerprint, 2);
    await expect(registry.completeCleanup(fingerprint, 2)).rejects.toThrow("conflict");
    const completed = await registry.completeCleanup(fingerprint, 3);
    expect(completed.cleanup).toEqual([]);
    expect((await MtlsRegistry.load(userData)).pending.cleanup).toEqual([]);
  });

  it("journals a new import before committing identity and binding atomically", async () => {
    const registry = await MtlsRegistry.load(userData);
    const prepared = await registry.scheduleCleanup(fingerprint, 0);
    expect(prepared.cleanup).toEqual([fingerprint]);
    const committed = await registry.commitIdentity(
      identity,
      ["https://vault.example/api"],
      1,
      false,
    );
    expect(committed.cleanup).toEqual([]);
    expect(committed.bindings).toEqual({ "vault.example:443": fingerprint });
    expect((await MtlsRegistry.load(userData)).pending.identities[fingerprint]).toEqual(identity);
  });

  it("preserves a corrupt registry for recovery", async () => {
    await fs.mkdir(path.join(userData, "mtls"));
    await fs.writeFile(path.join(userData, "mtls", "registry.json"), "{invalid");
    await expect(MtlsRegistry.load(userData)).rejects.toThrow("store-corrupt");
    expect(await fs.readFile(path.join(userData, "mtls", "registry.json"), "utf8")).toBe(
      "{invalid",
    );
  });
});
