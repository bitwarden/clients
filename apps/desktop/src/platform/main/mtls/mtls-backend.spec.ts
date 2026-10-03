import { X509Certificate } from "node:crypto";
import { promises as fs, readFileSync } from "node:fs";
import * as path from "node:path";

import { MtlsBackend } from "./mtls-backend";

const certificateDer = new X509Certificate(
  readFileSync(path.join(__dirname, "fixtures", "test-cert.pem")),
).raw;

const fixture = `#!/usr/bin/env node
if (process.argv[2] === "delete") {
  const accepted = process.argv[3] === "12345678-1234-1234-1234-123456789abc" &&
    process.argv[4] === "a".repeat(64);
  const body = Buffer.from(JSON.stringify(accepted
    ? { version: 1, ok: true }
    : { version: 1, ok: false, error: "conflict" }));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length);
  process.stdout.write(Buffer.concat([header, body]), () => process.exit(0));
}
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const request = Buffer.concat(chunks);
  const version = request.readUInt32BE(0);
  const passwordLength = request.readUInt32BE(4);
  const bundleLength = request.readUInt32BE(8);
  const password = request.subarray(12, 12 + passwordLength);
  const bundle = request.subarray(12 + passwordLength);
  const accepted = version === 1 && bundleLength === bundle.length &&
    password.toString("utf8") === "correct" &&
    (process.argv[2] === "inspect" || (process.argv[2] === "import" &&
      process.argv[3] === "12345678-1234-1234-1234-123456789abc")) &&
    !process.argv.join(" ").includes("correct");
  const result = accepted
    ? { version: 1, ok: true, certificateDer: "${certificateDer.toString("base64")}" }
    : { version: 1, ok: false, error: "invalid-password" };
  const body = Buffer.from(JSON.stringify(result));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(body.length);
  process.stdout.write(Buffer.concat([header, body]));
});
`;

describe("mTLS helper client", () => {
  const testRoot = path.resolve(process.cwd(), "../../.flatpak/mtls-backend-tests");
  const helperPath = path.join(testRoot, "fake-helper");
  const allowedStore = async () => path.join(testRoot, "nssdb");

  beforeAll(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    await fs.writeFile(helperPath, fixture, { mode: 0o700 });
  });

  afterAll(async () => {
    await fs.rm(helperPath, { force: true });
  });

  it("passes the password through stdin and accepts only a framed public certificate", async () => {
    const backend = new MtlsBackend(helperPath, allowedStore);
    const result = await backend.inspectBundle(Buffer.from([4, 5]), "correct");
    expect(result).toEqual({ ok: true, value: { certificateDer } });
  });

  it("returns a sanitized helper error", async () => {
    const backend = new MtlsBackend(helperPath, allowedStore);
    const result = await backend.inspectBundle(Buffer.from([4, 5]), "wrong");
    expect(result).toEqual({ ok: false, error: { code: "invalid-password" } });
  });

  it("passes the registry store ID for import and rejects malformed IDs", async () => {
    const backend = new MtlsBackend(helperPath, allowedStore);
    expect(
      await backend.importBundle(
        Buffer.from([4, 5]),
        "correct",
        "12345678-1234-1234-1234-123456789abc",
      ),
    ).toEqual({ ok: true, value: { certificateDer } });
    expect(await backend.importBundle(Buffer.from([4, 5]), "correct", "../other")).toEqual({
      ok: false,
      error: { code: "invalid-file" },
    });
  });

  it("deletes only a validated fingerprint owned by the registry", async () => {
    const backend = new MtlsBackend(helperPath, allowedStore);
    expect(
      await backend.deleteIdentity("a".repeat(64), "12345678-1234-1234-1234-123456789abc"),
    ).toEqual({ ok: true, value: undefined });
    expect(
      await backend.deleteIdentity("../other", "12345678-1234-1234-1234-123456789abc"),
    ).toEqual({
      ok: false,
      error: { code: "invalid-file" },
    });
  });

  it.each(["inspect", "delete"] as const)(
    "rejects malformed or oversized %s responses without exposing helper output",
    async (operation) => {
      const malformedHelper = path.join(testRoot, "malformed-helper");
      const responses = [
        Buffer.from([0, 0, 0]),
        Buffer.from([0, 0, 0, 8, 123, 125]),
        Buffer.alloc(64 * 1024 + 5),
        ...[
          { version: 2, ok: true },
          { version: 1, ok: false, error: "private helper detail" },
          { version: 1, ok: false, error: ["conflict"] },
        ].map((message) => {
          const body = Buffer.from(JSON.stringify(message));
          const header = Buffer.alloc(4);
          header.writeUInt32BE(body.length);
          return Buffer.concat([header, body]);
        }),
      ];
      try {
        for (const response of responses) {
          await fs.writeFile(
            malformedHelper,
            `#!/usr/bin/env node
const respond = () => process.stdout.write(Buffer.from("${response.toString("base64")}", "base64"));
if (process.argv[2] === "delete") { respond(); }
else { process.stdin.resume(); process.stdin.on("end", respond); }
`,
            { mode: 0o700 },
          );
          const backend = new MtlsBackend(malformedHelper, allowedStore);
          const result =
            operation === "inspect"
              ? await backend.inspectBundle(Buffer.from([4, 5]), "correct")
              : await backend.deleteIdentity(
                  "a".repeat(64),
                  "12345678-1234-1234-1234-123456789abc",
                );
          expect(result).toEqual({ ok: false, error: { code: "backend-failed" } });
        }
      } finally {
        await fs.rm(malformedHelper, { force: true });
      }
    },
  );

  it("rejects an input outside the helper's bounds before spawning", async () => {
    const backend = new MtlsBackend("/nonexistent/mtls-helper", allowedStore);
    const result = await backend.inspectBundle(Buffer.from([4, 5]), "a".repeat(4097));
    expect(result).toEqual({ ok: false, error: { code: "invalid-file" } });
  });

  it("rejects an unsafe store before starting the helper", async () => {
    const backend = new MtlsBackend("/nonexistent/mtls-helper", async () => {
      throw new Error("store-location-unsupported");
    });
    const result = await backend.inspectBundle(Buffer.from([4, 5]), "correct");
    expect(result).toEqual({ ok: false, error: { code: "store-location-unsupported" } });
  });
});
