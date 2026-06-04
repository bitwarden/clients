import { argon2d, argon2id } from "@noble/hashes/argon2";
import {
  Consts,
  Credentials,
  CryptoEngine,
  Kdbx,
  KdbxEntry,
  KdbxError,
  KdbxGroup,
  ProtectedValue,
} from "kdbxweb";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { ImportResult } from "../models";

import { BaseImporter } from "./base-importer";
import { Importer } from "./importer";

/** Credentials required to unlock a KDBX database: required password and optional key-file */
export interface KdbxCredentials {
  password: string;
  keyFile: Uint8Array | null;
}

/** The first four bytes of every KDBX file: signature 0x9AA2D903, little-endian
     https://keepass.info/help/kb/kdbx.html
 */
const KDBX_SIGNATURE = [0x03, 0xd9, 0xa2, 0x9a];

/*
   kdbxweb's APIs require ArrayBuffer
   Uint8Array's `.buffer` is typed as ArrayBufferLike
 */
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(arr.byteLength);
  copy.set(arr);
  return copy.buffer;
}

/*
   RFC 4648 Base32 (uppercase, unpadded). Bitwarden's TOTP expects a Base32 secret, so KeePass's
   Hex/Base64/UTF-8 secret variants are decoded to bytes and re-encoded here.
 */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    // Keep only the unflushed low bits so `value` can't overflow 32-bit bitwise ops.
    value &= (1 << bits) - 1;
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/*
   kdbxweb ships no KDF. KDBX4 uses Argon2 (Argon2d by default in KeePass/KeePassXC, or Argon2id).
   The SDK only computes Argon2id for the account KDF so it can't be reused here; @noble/hashes provides both variants.
 */
let argon2Registered = false;
function ensureArgon2Impl(): void {
  if (argon2Registered) {
    return;
  }
  CryptoEngine.setArgon2Impl(
    (password, salt, memory, iterations, length, parallelism, type, version) => {
      // kdbxweb passes memory in KiB, which matches @noble/hashes' `m` parameter.
      // KDBX only uses Argon2d (0) and Argon2id (2); Argon2i is never emitted. `version` (0x10 or 0x13) must be
      // forwarded — the two versions use different mixing and derive different keys.
      const hashFn = type === CryptoEngine.Argon2TypeArgon2d ? argon2d : argon2id;
      const hash = hashFn(new Uint8Array(password), new Uint8Array(salt), {
        t: iterations,
        m: memory,
        p: parallelism,
        dkLen: length,
        version,
      });
      return Promise.resolve(toArrayBuffer(hash));
    },
  );
  argon2Registered = true;
}

/**
 * Imports a KeePass KDBX database. Because the shared Importer interface
 * is text-only, callers pass the file base64-encoded.
 */
export class KeePassKdbxImporter extends BaseImporter implements Importer {
  private recycleBinUuid: string | null = null;

  private static readonly totpFieldKeys = new Set<string>([
    "otp",
    "TimeOtp-Secret",
    "TimeOtp-Secret-Hex",
    "TimeOtp-Secret-Base32",
    "TimeOtp-Secret-Base64",
    "TimeOtp-Period",
    "TimeOtp-Length",
    "TimeOtp-Algorithm",
  ]);

  constructor(
    private i18nService: I18nService,
    private promptForKdbxCredentials_callback: () => Promise<KdbxCredentials>,
  ) {
    super();
  }

  async parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();

    const bytes = Utils.fromB64ToArray(data);
    if (!this.hasKdbxSignature(bytes)) {
      // Reject wrong file types before parse
      result.success = false;
      result.errorMessage = this.i18nService.t("kdbxWrongFileType");
      return result;
    }

    const credentials = await this.promptForKdbxCredentials_callback();
    if (credentials == null) {
      // The user dismissed the credentials prompt.
      result.success = false;
      result.errorMessage = this.i18nService.t("importCanceled");
      return result;
    }

    let db: Kdbx;
    try {
      ensureArgon2Impl();
      const credential = new Credentials(
        ProtectedValue.fromString(credentials.password ?? ""),
        credentials.keyFile != null ? toArrayBuffer(credentials.keyFile) : null,
      );
      // Credentials hashes the password/key file asynchronously; wait for it before loading.
      await credential.ready;
      db = await Kdbx.load(toArrayBuffer(bytes), credential);
    } catch (e) {
      result.success = false;
      if (e instanceof KdbxError && e.code === Consts.ErrorCodes.InvalidKey) {
        // Wrong password or key file - allow the user to retry.
        result.errorMessage = this.i18nService.t("invalidFilePassword");
      } else {
        // Corrupted or outdated file - suggest re-exporting from KeePass.
        result.errorMessage = this.i18nService.t("kdbxCorruptOrOutdated");
      }
      return result;
    }

    this.recycleBinUuid =
      db.meta.recycleBinEnabled && db.meta.recycleBinUuid != null
        ? db.meta.recycleBinUuid.id
        : null;

    // The top-level group is the database root itself; its children become the user's folders.
    db.groups.forEach((group) => this.traverse(result, group, true, ""));

    if (this.organization) {
      this.moveFoldersToCollections(result);
    }

    result.success = true;
    return result;
  }

  private traverse(
    result: ImportResult,
    group: KdbxGroup,
    isRootNode: boolean,
    groupPrefixName: string,
  ): void {
    // Skip the recycle bin and everything inside it.
    if (
      this.recycleBinUuid != null &&
      group.uuid != null &&
      group.uuid.id === this.recycleBinUuid
    ) {
      return;
    }

    const folderIndex = result.folders.length;
    let groupName = groupPrefixName;

    if (!isRootNode) {
      if (groupName !== "") {
        groupName += "/";
      }
      groupName += this.isNullOrWhitespace(group.name) ? "-" : group.name;
      const folder = new FolderView();
      folder.name = groupName;
      result.folders.push(folder);
    }

    group.entries.forEach((entry) => {
      const cipherIndex = result.ciphers.length;
      const cipher = this.initLoginCipher();

      const totp = this.buildTotp(entry);
      if (totp != null) {
        cipher.login.totp = totp;
      }

      entry.fields.forEach((fieldValue, key) => {
        if (KeePassKdbxImporter.totpFieldKeys.has(key)) {
          return;
        }

        const isProtected = fieldValue instanceof ProtectedValue;
        const value = isProtected
          ? (fieldValue as ProtectedValue).getText()
          : (fieldValue as string);
        if (this.isNullOrWhitespace(value)) {
          return;
        }

        switch (key) {
          case "Title":
            cipher.name = value;
            break;
          case "UserName":
            cipher.login.username = value;
            break;
          case "Password":
            cipher.login.password = value;
            break;
          case "URL":
            cipher.login.uris = this.makeUriArray(value);
            break;
          case "Notes":
            cipher.notes += value + "\n";
            break;
          default:
            if (isProtected) {
              // Protected custom strings are always imported as hidden fields.
              const field = new FieldView();
              field.type = FieldType.Hidden;
              field.name = key;
              field.value = value;
              cipher.fields.push(field);
            } else {
              this.processKvp(cipher, key, value, FieldType.Text);
            }
            break;
        }
      });

      // Binary attachments (entry.binaries) are intentionally ignored, matching every other
      // importer (e.g. the 1Password 1pux importer drops document/attachment data). The bulk import
      // pipeline cannot carry attachment content.

      this.cleanupCipher(cipher);
      result.ciphers.push(cipher);

      if (!isRootNode) {
        result.folderRelationships.push([cipherIndex, folderIndex]);
      }
    });

    group.groups.forEach((subGroup) => this.traverse(result, subGroup, false, groupName));
  }

  private hasKdbxSignature(bytes: Uint8Array): boolean {
    if (bytes == null || bytes.length < KDBX_SIGNATURE.length) {
      return false;
    }
    return KDBX_SIGNATURE.every((b, i) => bytes[i] === b);
  }

  private fieldText(entry: KdbxEntry, key: string): string | null {
    const value = entry.fields.get(key);
    if (value == null) {
      return null;
    }
    return value instanceof ProtectedValue ? value.getText() : (value as string);
  }

  /**
   * Builds the value for cipher.login.totp from a KeePass entry, handling both KeePassXC's `otp`
   * field and KeePass 2.x's native `TimeOtp-*` fields. Returns null when the entry has no TOTP.
   */
  private buildTotp(entry: KdbxEntry): string | null {
    // KeePassXC: `otp` holds an otpauth:// URI or a legacy "key=SECRET&..." string.
    const otp = this.fieldText(entry, "otp");
    if (otp != null && !this.isNullOrWhitespace(otp)) {
      return otp.replace("key=", "");
    }

    const secret = this.timeOtpSecretAsBase32(entry);
    if (secret == null) {
      return null;
    }
    return this.timeOtpToTotp(entry, secret);
  }

  /** Resolves the KeePass 2.x TOTP secret (in any supported encoding) to a Base32 secret. */
  private timeOtpSecretAsBase32(entry: KdbxEntry): string | null {
    const base32 = this.fieldText(entry, "TimeOtp-Secret-Base32");
    if (base32 != null && !this.isNullOrWhitespace(base32)) {
      return base32.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();
    }
    const base64 = this.fieldText(entry, "TimeOtp-Secret-Base64");
    if (base64 != null && !this.isNullOrWhitespace(base64)) {
      return toBase32(Utils.fromB64ToArray(base64));
    }
    const hex = this.fieldText(entry, "TimeOtp-Secret-Hex");
    if (hex != null && !this.isNullOrWhitespace(hex)) {
      return toBase32(Utils.fromHexToArray(hex));
    }
    const utf8 = this.fieldText(entry, "TimeOtp-Secret");
    if (utf8 != null && !this.isNullOrWhitespace(utf8)) {
      return toBase32(Utils.fromUtf8ToArray(utf8));
    }
    return null;
  }

  /**
   * Returns the bare Base32 secret for default settings (Bitwarden's default is SHA1/30s/6 digits),
   * or an otpauth:// URI when the entry specifies a non-default period, length, or algorithm.
   */
  private timeOtpToTotp(entry: KdbxEntry, secret: string): string {
    const period = this.nonDefault(this.fieldText(entry, "TimeOtp-Period"), "30");
    const digits = this.nonDefault(this.fieldText(entry, "TimeOtp-Length"), "6");
    const algorithm = this.totpAlgorithm(this.fieldText(entry, "TimeOtp-Algorithm"));

    if (period == null && digits == null && algorithm == null) {
      return secret;
    }

    const params = new URLSearchParams({ secret });
    if (algorithm != null) {
      params.set("algorithm", algorithm);
    }
    if (digits != null) {
      params.set("digits", digits);
    }
    if (period != null) {
      params.set("period", period);
    }
    const label = encodeURIComponent(this.fieldText(entry, "Title") ?? "Imported");
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  private nonDefault(value: string | null, defaultValue: string): string | null {
    if (value == null || this.isNullOrWhitespace(value)) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed === defaultValue ? null : trimmed;
  }

  /** Maps KeePass's algorithm name to the otpauth value, or null for the SHA1 default. */
  private totpAlgorithm(value: string | null): string | null {
    if (value == null || this.isNullOrWhitespace(value)) {
      return null;
    }
    switch (value.trim().toUpperCase()) {
      case "HMAC-SHA-256":
        return "SHA256";
      case "HMAC-SHA-512":
        return "SHA512";
      default:
        return null;
    }
  }
}
