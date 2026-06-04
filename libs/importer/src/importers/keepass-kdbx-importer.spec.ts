/**
 * @jest-environment node
 */
// kdbxweb relies on WebCrypto (crypto.subtle) for AES, which jsdom does not provide but Node does.
import { argon2d, argon2id } from "@noble/hashes/argon2";
import { mock, MockProxy } from "jest-mock-extended";
import * as kdbxweb from "kdbxweb";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FieldType } from "@bitwarden/common/vault/enums";

import { KdbxCredentials, KeePassKdbxImporter } from "./keepass-kdbx-importer";

// Register an Argon2 implementation so kdbxweb can save KDBX4 fixtures in this test (the importer
// registers its own when it loads). Mirrors the implementation in the importer.
kdbxweb.CryptoEngine.setArgon2Impl(
  (password, salt, memory, iterations, length, parallelism, type, version) => {
    const hashFn = type === kdbxweb.CryptoEngine.Argon2TypeArgon2d ? argon2d : argon2id;
    const hash = hashFn(new Uint8Array(password), new Uint8Array(salt), {
      t: iterations,
      m: memory,
      p: parallelism,
      dkLen: length,
      version,
    });
    const out = new Uint8Array(hash.byteLength);
    out.set(hash);
    return Promise.resolve(out.buffer);
  },
);

async function createDatabase(
  password: string | null,
  keyFile: Uint8Array | null,
  build: (db: kdbxweb.Kdbx, root: kdbxweb.KdbxGroup) => void | Promise<void>,
): Promise<string> {
  const credentials = new kdbxweb.Credentials(
    password != null ? kdbxweb.ProtectedValue.fromString(password) : null,
    keyFile ?? null,
  );
  await credentials.ready;
  const db = kdbxweb.Kdbx.create(credentials, "Test");
  await build(db, db.getDefaultGroup());
  const buffer = await db.save();
  return Utils.fromBufferToB64(buffer);
}

describe("KeePass KDBX Importer", () => {
  let i18nService: MockProxy<I18nService>;

  function importerFor(credentials: KdbxCredentials | null): KeePassKdbxImporter {
    return new KeePassKdbxImporter(i18nService, () => Promise.resolve(credentials));
  }

  beforeEach(() => {
    i18nService = mock<I18nService>();
    // Return the key (with the first argument appended) so error messages can be asserted by key.
    i18nService.t.mockImplementation((key: string, ...args: string[]) =>
      args.length > 0 ? `${key}:${args[0]}` : key,
    );
  });

  it("parses standard login fields under a group", async () => {
    const data = await createDatabase("password", null, (db, root) => {
      const group = db.createGroup(root, "Social");
      const entry = db.createEntry(group);
      entry.fields.set("Title", "GitHub");
      entry.fields.set("UserName", "octocat");
      entry.fields.set("Password", kdbxweb.ProtectedValue.fromString("hunter2"));
      entry.fields.set("URL", "https://github.com");
      entry.fields.set("Notes", "my note");
      entry.fields.set("otp", "JBSWY3DPEHPK3PXP");
    });

    const result = await importerFor({ password: "password", keyFile: null }).parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("GitHub");
    expect(cipher.login.username).toBe("octocat");
    expect(cipher.login.password).toBe("hunter2");
    expect(cipher.login.uris[0].uri).toBe("https://github.com");
    expect(cipher.notes).toContain("my note");
    expect(cipher.login.totp).toBe("JBSWY3DPEHPK3PXP");

    expect(result.folders.map((f) => f.name)).toContain("Social");
    expect(result.folderRelationships).toEqual([
      [0, result.folders.findIndex((f) => f.name === "Social")],
    ]);
  });

  it("imports protected custom fields as hidden and plain ones as text", async () => {
    const data = await createDatabase("password", null, (db, root) => {
      const entry = db.createEntry(root);
      entry.fields.set("Title", "Custom");
      entry.fields.set("PlainField", "plain value");
      entry.fields.set("SecretField", kdbxweb.ProtectedValue.fromString("secret value"));
    });

    const result = await importerFor({ password: "password", keyFile: null }).parse(data);

    expect(result.success).toBe(true);
    const fields = result.ciphers[0].fields;
    const plain = fields.find((f) => f.name === "PlainField");
    const secret = fields.find((f) => f.name === "SecretField");
    expect(plain.type).toBe(FieldType.Text);
    expect(plain.value).toBe("plain value");
    expect(secret.type).toBe(FieldType.Hidden);
    expect(secret.value).toBe("secret value");
  });

  it("preserves nested group hierarchy as folder paths", async () => {
    const data = await createDatabase("password", null, (db, root) => {
      const parent = db.createGroup(root, "Parent");
      const child = db.createGroup(parent, "Child");
      const entry = db.createEntry(child);
      entry.fields.set("Title", "Nested");
    });

    const result = await importerFor({ password: "password", keyFile: null }).parse(data);

    expect(result.success).toBe(true);
    expect(result.folders.map((f) => f.name)).toEqual(
      expect.arrayContaining(["Parent", "Parent/Child"]),
    );
    const childIndex = result.folders.findIndex((f) => f.name === "Parent/Child");
    expect(result.folderRelationships).toContainEqual([0, childIndex]);
  });

  it("unlocks a database protected by password and key file", async () => {
    const keyFile = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const data = await createDatabase("password", keyFile, (db, root) => {
      const entry = db.createEntry(root);
      entry.fields.set("Title", "WithKeyFile");
    });

    const result = await importerFor({ password: "password", keyFile }).parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers[0].name).toBe("WithKeyFile");
  });

  it("silently ignores binary attachments, matching other importers", async () => {
    const data = await createDatabase("password", null, async (db, root) => {
      const entry = db.createEntry(root);
      entry.fields.set("Title", "HasAttachment");
      entry.fields.set("Password", kdbxweb.ProtectedValue.fromString("pw"));
      const binary = await db.createBinary(new Uint8Array([1, 2, 3]).buffer);
      entry.binaries.set("recovery-codes.txt", binary);
    });

    const result = await importerFor({ password: "password", keyFile: null }).parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    // The entry imports as a normal login; the attachment leaves no trace (no notes pollution).
    expect(cipher.name).toBe("HasAttachment");
    expect(cipher.login.password).toBe("pw");
    expect(cipher.notes ?? "").not.toContain("recovery-codes.txt");
    expect(cipher.attachments == null || cipher.attachments.length === 0).toBe(true);
  });

  it("returns a retryable error for the wrong password", async () => {
    const data = await createDatabase("correct-password", null, (db, root) => {
      const entry = db.createEntry(root);
      entry.fields.set("Title", "Secret");
    });

    const result = await importerFor({ password: "wrong-password", keyFile: null }).parse(data);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("invalidFilePassword");
    expect(result.ciphers.length).toBe(0);
  });

  it("rejects a file that is not a KDBX database before parsing", async () => {
    const notKdbx = Utils.fromBufferToB64(new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44]).buffer);

    const result = await importerFor({ password: "password", keyFile: null }).parse(notKdbx);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("kdbxWrongFileType");
  });

  it("fails gracefully when credentials are dismissed", async () => {
    const data = await createDatabase("password", null, (db, root) => {
      db.createEntry(root).fields.set("Title", "Secret");
    });

    const result = await importerFor(null).parse(data);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("importCanceled");
    expect(result.ciphers.length).toBe(0);
  });

  describe("KeePass 2.x native TOTP (TimeOtp-*)", () => {
    async function importEntryWith(build: (entry: kdbxweb.KdbxEntry) => void) {
      const data = await createDatabase("password", null, (db, root) => {
        const entry = db.createEntry(root);
        entry.fields.set("Title", "Entry with OTP");
        build(entry);
      });
      return importerFor({ password: "password", keyFile: null }).parse(data);
    }

    it("maps a Base32 secret to a bare totp and not a custom field", async () => {
      const result = await importEntryWith((entry) => {
        entry.fields.set(
          "TimeOtp-Secret-Base32",
          kdbxweb.ProtectedValue.fromString("JBSWY3DPEHPK3PXP"),
        );
      });

      const cipher = result.ciphers[0];
      expect(cipher.login.totp).toBe("JBSWY3DPEHPK3PXP");
      expect(cipher.fields.some((f) => f.name.startsWith("TimeOtp"))).toBe(false);
    });

    it("builds an otpauth URI for non-default period, length, and algorithm", async () => {
      const result = await importEntryWith((entry) => {
        entry.fields.set("TimeOtp-Secret-Base32", "JBSWY3DPEHPK3PXP");
        entry.fields.set("TimeOtp-Period", "60");
        entry.fields.set("TimeOtp-Length", "8");
        entry.fields.set("TimeOtp-Algorithm", "HMAC-SHA-256");
      });

      const url = new URL(result.ciphers[0].login.totp);
      expect(url.protocol).toBe("otpauth:");
      expect(url.searchParams.get("secret")).toBe("JBSWY3DPEHPK3PXP");
      expect(url.searchParams.get("period")).toBe("60");
      expect(url.searchParams.get("digits")).toBe("8");
      expect(url.searchParams.get("algorithm")).toBe("SHA256");
    });

    it("keeps a bare secret when settings are explicitly default", async () => {
      const result = await importEntryWith((entry) => {
        entry.fields.set("TimeOtp-Secret-Base32", "JBSWY3DPEHPK3PXP");
        entry.fields.set("TimeOtp-Period", "30");
        entry.fields.set("TimeOtp-Length", "6");
      });

      expect(result.ciphers[0].login.totp).toBe("JBSWY3DPEHPK3PXP");
    });

    // "Hello" encodes to the Base32 secret "JBSWY3DP".
    it("decodes a Base64 secret to Base32", async () => {
      const result = await importEntryWith((entry) => {
        entry.fields.set("TimeOtp-Secret-Base64", "SGVsbG8=");
      });

      expect(result.ciphers[0].login.totp).toBe("JBSWY3DP");
    });

    it("decodes a Hex secret to Base32", async () => {
      const result = await importEntryWith((entry) => {
        entry.fields.set("TimeOtp-Secret-Hex", "48656c6c6f");
      });

      expect(result.ciphers[0].login.totp).toBe("JBSWY3DP");
    });

    it("encodes a UTF-8 secret to Base32", async () => {
      const result = await importEntryWith((entry) => {
        entry.fields.set("TimeOtp-Secret", "Hello");
      });

      expect(result.ciphers[0].login.totp).toBe("JBSWY3DP");
    });
  });
});
