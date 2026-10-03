import { spawn } from "node:child_process";
import { X509Certificate } from "node:crypto";

import { MtlsErrorCode, MtlsResult } from "../../models/mtls";

import { resolveMtlsStoreLocation } from "./store-location";

const MAX_BUNDLE = 10 * 1024 * 1024;
const MAX_PASSWORD = 4096;
const MAX_RESPONSE = 64 * 1024;
const TIMEOUT_MS = 30_000;
const KNOWN_ERRORS: ReadonlySet<string> = new Set<MtlsErrorCode>([
  "unsupported",
  "invalid-file",
  "invalid-password",
  "unsupported-bundle",
  "certificate-expired",
  "certificate-not-yet-valid",
  "store-password-unsupported",
  "store-location-unsupported",
  "store-corrupt",
  "backend-failed",
  "conflict",
  "identity-missing",
]);

export interface InspectedBundle {
  /** Public leaf certificate only. The private key never returns from the helper. */
  certificateDer: Buffer;
}

/** One request per isolated helper process. Password and bundle travel only over stdin. */
export class MtlsBackend {
  constructor(
    private readonly helperPath = "/app/bin/mtls_helper",
    private readonly validateStore = resolveMtlsStoreLocation,
  ) {}

  inspectBundle(bundle: Buffer, password: string): Promise<MtlsResult<InspectedBundle>> {
    return this.run("inspect", bundle, password);
  }

  async importBundle(
    bundle: Buffer,
    password: string,
    storeId: string,
  ): Promise<MtlsResult<InspectedBundle>> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(storeId)) {
      return { ok: false, error: { code: "invalid-file" } };
    }
    const inspected = await this.inspectBundle(bundle, password);
    if (inspected.ok === false) {
      return inspected;
    }
    try {
      const certificate = new X509Certificate(inspected.value.certificateDer);
      const now = Date.now();
      if (now < Date.parse(certificate.validFrom)) {
        return { ok: false, error: { code: "certificate-not-yet-valid" } };
      }
      if (now > Date.parse(certificate.validTo)) {
        return { ok: false, error: { code: "certificate-expired" } };
      }
      const usage = certificate.keyUsage;
      if (usage?.length && !usage.includes("1.3.6.1.5.5.7.3.2") && !usage.includes("2.5.29.37.0")) {
        return { ok: false, error: { code: "unsupported-bundle" } };
      }
    } catch {
      return { ok: false, error: { code: "unsupported-bundle" } };
    }
    const imported = await this.run("import", bundle, password, storeId);
    if (imported.ok && !imported.value.certificateDer.equals(inspected.value.certificateDer)) {
      return { ok: false, error: { code: "backend-failed" } };
    }
    return imported;
  }

  async deleteIdentity(fingerprint: string, storeId: string): Promise<MtlsResult<void>> {
    if (
      !/^[0-9a-f]{64}$/.test(fingerprint) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(storeId)
    ) {
      return { ok: false, error: { code: "invalid-file" } };
    }
    const result = await this.runHelper(["delete", storeId, fingerprint]);
    return result.ok ? { ok: true, value: undefined } : result;
  }

  private async run(
    operation: "inspect" | "import",
    bundle: Buffer,
    password: string,
    storeId?: string,
  ): Promise<MtlsResult<InspectedBundle>> {
    const passwordBytes = Buffer.from(password, "utf8");
    if (
      passwordBytes.length < 1 ||
      passwordBytes.length > MAX_PASSWORD ||
      bundle.length < 1 ||
      bundle.length > MAX_BUNDLE
    ) {
      passwordBytes.fill(0);
      return { ok: false, error: { code: "invalid-file" } };
    }

    const header = Buffer.alloc(12);
    header.writeUInt32BE(1, 0);
    header.writeUInt32BE(passwordBytes.length, 4);
    header.writeUInt32BE(bundle.length, 8);

    try {
      return await this.runHelper(storeId ? [operation, storeId] : [operation], [
        header,
        passwordBytes,
        bundle,
      ]);
    } finally {
      passwordBytes.fill(0);
    }
  }

  /** Shared bounded transport for every NSS helper operation. */
  private runHelper(args: string[], input: Buffer[]): Promise<MtlsResult<InspectedBundle>>;
  private runHelper(args: string[]): Promise<MtlsResult<undefined>>;
  private async runHelper(
    args: string[],
    input?: Buffer[],
  ): Promise<MtlsResult<InspectedBundle | undefined>> {
    try {
      await this.validateStore();
    } catch (error) {
      return {
        ok: false,
        error: {
          code:
            (error as Error).message === "unsupported"
              ? "unsupported"
              : "store-location-unsupported",
        },
      };
    }
    return new Promise((resolve) => {
      let finished = false;
      let outputLength = 0;
      const chunks: Buffer[] = [];
      const child = spawn(this.helperPath, args, {
        shell: false,
        stdio: [input ? "pipe" : "ignore", "pipe", "ignore"],
        env: {
          HOME: process.env.HOME,
          XDG_DATA_HOME: process.env.XDG_DATA_HOME,
          FLATPAK_ID: process.env.FLATPAK_ID,
        },
      });

      const finish = (value: MtlsResult<InspectedBundle | undefined>) => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timer);
        resolve(value);
      };
      const fail = () => finish({ ok: false, error: { code: "backend-failed" } });
      const timer = setTimeout(() => {
        child.kill();
        fail();
      }, TIMEOUT_MS);

      child.on("error", fail);
      child.stdin?.on("error", fail);
      child.stdout.on("data", (chunk: Buffer) => {
        outputLength += chunk.length;
        if (outputLength > MAX_RESPONSE + 4) {
          child.kill();
          fail();
          return;
        }
        chunks.push(chunk);
      });
      child.on("close", (code) => {
        if (finished) {
          return;
        }
        if (code !== 0 || outputLength < 4) {
          fail();
          return;
        }
        const output = Buffer.concat(chunks);
        const expected = output.readUInt32BE(0);
        if (expected > MAX_RESPONSE || expected !== output.length - 4) {
          fail();
          return;
        }
        try {
          const message: unknown = JSON.parse(output.subarray(4).toString("utf8"));
          if (typeof message !== "object" || message === null || !("version" in message)) {
            fail();
            return;
          }
          if (message.version !== 1 || !("ok" in message)) {
            fail();
            return;
          }
          if (
            message.ok === false &&
            "error" in message &&
            typeof message.error === "string" &&
            KNOWN_ERRORS.has(message.error)
          ) {
            finish({ ok: false, error: { code: message.error as MtlsErrorCode } });
            return;
          }
          if (message.ok === true && !input) {
            finish({ ok: true, value: undefined });
            return;
          }
          if (message.ok === true && "certificateDer" in message) {
            const encoded = message.certificateDer;
            if (typeof encoded !== "string" || encoded.length > MAX_RESPONSE / 2) {
              fail();
              return;
            }
            const certificateDer = Buffer.from(encoded, "base64");
            if (certificateDer.length === 0 || certificateDer.toString("base64") !== encoded) {
              fail();
              return;
            }
            finish({ ok: true, value: { certificateDer } });
            return;
          }
        } catch {
          // A malformed helper response is never shown to the renderer.
        }
        fail();
      });

      if (input && child.stdin) {
        for (const chunk of input) {
          child.stdin.write(chunk);
        }
        child.stdin.end();
      }
    });
  }
}
