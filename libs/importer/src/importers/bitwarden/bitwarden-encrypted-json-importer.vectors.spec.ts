import { CipherWithIdExport, FolderWithIdExport } from "@bitwarden/common/models/export";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  CipherView as SdkCipherView,
  Folder as SdkFolder,
  FolderView,
  InitUserCryptoRequest,
  ManagedSettingsClient,
  PasswordManagerClient,
  PureCrypto,
} from "@bitwarden/sdk-internal";
import { BitwardenEncryptedIndividualJsonExport } from "@bitwarden/vault-export-core";

import { accountEncryptedV1 } from "../spec-data/bitwarden-json/account-encrypted-v1.json";
import { accountEncryptedV2 } from "../spec-data/bitwarden-json/account-encrypted-v2.json";

/**
 * Test Vector Stability Tests. We want to ensure we do not break format compatibility accidentally.
 * - V1: legacy field-level ciphers.
 * - V2: blob ciphers, where all content is sealed in `data`.
 */
describe.each([
  ["V1", accountEncryptedV1],
  ["V2", accountEncryptedV2],
])("account-restricted export vector %s", (_, vector) => {
  const exportFile = JSON.parse(vector.exportJson) as BitwardenEncryptedIndividualJsonExport;
  const expectedFolders = vector.expected.folders as FolderView[];
  const expectedCiphers = vector.expected.ciphers as SdkCipherView[];
  let client: PasswordManagerClient;

  beforeAll(async () => {
    client = new PasswordManagerClient(
      { get_access_token: () => Promise.resolve(undefined) },
      undefined,
      new ManagedSettingsClient(),
    );
    await client
      .crypto()
      .initialize_user_crypto(vector.account as unknown as InitUserCryptoRequest);
  });

  it("decrypts the key validation with the user key", async () => {
    const userKey = await client.crypto().get_user_encryption_key();

    const validation = PureCrypto.symmetric_decrypt_string(
      exportFile.encKeyValidation_DO_NOT_EDIT,
      Utils.fromB64ToArray(userKey),
    );

    // The result doesn't matter, what matters is that the validation decrypts fine. The decryption is authenticated so it
    // will fail if the wrong key is used.
    expect(validation).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("decrypts the folders", () => {
    const folders = exportFile.folders.map((f) => {
      const domain = FolderWithIdExport.toDomain(f);
      const sdkFolder = {
        id: domain.id,
        name: domain.name.encryptedString,
        revisionDate: expectedFolders[0].revisionDate,
      } as unknown as SdkFolder;
      return client.vault().folders().decrypt(sdkFolder);
    });

    expect(folders).toEqual(expectedFolders);
  });

  it.each(expectedCiphers.map((c) => [c.name, c] as const))(
    "decrypts cipher %s",
    async (_, expected) => {
      const item = exportFile.items.find((i) => i.id === String(expected.id));
      const sdkCipher = CipherWithIdExport.toDomain(item).toSdkCipher();
      sdkCipher.id = item.id as unknown as SdkCipherView["id"];

      const decrypted = await client.vault().ciphers().decrypt(sdkCipher);

      expect(withoutVolatile(decrypted)).toEqual(withoutVolatile(expected));
    },
  );
});

/**
 * Fields that legitimately differ between the input view and the decrypted view:
 * - `key`: the cipher key generated during encryption.
 * - `keyValue`: a passkey's key stays encrypted in a decrypted `CipherView`.
 * - `uriChecksum`: generated during encryption.
 * - item flags that are not part of the export.
 */
const VOLATILE_KEYS = new Set([
  "key",
  "keyValue",
  "uriChecksum",
  "edit",
  "viewPassword",
  "organizationUseTotp",
  "permissions",
]);

/** Drops volatile fields and treats `null`, `undefined` and `[]` as absent. */
function withoutVolatile(view: SdkCipherView) {
  return JSON.parse(
    JSON.stringify(view, (key, value) =>
      VOLATILE_KEYS.has(key) || value === null || (Array.isArray(value) && value.length === 0)
        ? undefined
        : value,
    ),
  );
}
