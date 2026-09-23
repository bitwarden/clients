import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { Migrator } from "../migrator";

export const USER_DECRYPTION_OPTIONS: KeyDefinitionLike = {
  key: "decryptionOptions",
  stateDefinition: { name: "userDecryptionOptions" },
};

export const WEBAUTHN_PRF_OPTIONS: KeyDefinitionLike = {
  key: "webAuthnPrfOptions",
  stateDefinition: { name: "crypto" },
};

type WebAuthnPrfOption = {
  encryptedPrivateKey: string;
  encryptedUserKey: string;
  credentialId?: string;
  transports?: string[];
};

type ExpectedUserDecryptionOptions = {
  webAuthnPrfOptions?: WebAuthnPrfOption[];
};

/**
 * WebAuthn PRF unlock data used to live as one field of the larger user decryption options blob.
 * It now has its own state, stored in the shape the SDK expects, so the state bridge can hand it
 * to the SDK without mapping.
 *
 * The source field is left in place, so this is a copy rather than a move.
 */
export class MoveWebAuthnPrfOptionsToCryptoState extends Migrator<82, 83> {
  async migrate(helper: MigrationHelper): Promise<void> {
    async function migrateAccount(userId: string) {
      const decryptionOptions = await helper.getFromUser<ExpectedUserDecryptionOptions>(
        userId,
        USER_DECRYPTION_OPTIONS,
      );

      const prfOptions = decryptionOptions?.webAuthnPrfOptions;
      if (!Array.isArray(prfOptions) || prfOptions.length === 0) {
        return;
      }

      if ((await helper.getFromUser(userId, WEBAUTHN_PRF_OPTIONS)) != null) {
        return;
      }

      await helper.setToUser(userId, WEBAUTHN_PRF_OPTIONS, { options: prfOptions });
    }

    const accounts = await helper.getAccounts();
    await Promise.all(accounts.map(({ userId }) => migrateAccount(userId)));
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    async function rollbackAccount(userId: string) {
      if ((await helper.getFromUser(userId, WEBAUTHN_PRF_OPTIONS)) != null) {
        await helper.removeFromUser(userId, WEBAUTHN_PRF_OPTIONS);
      }
    }

    const accounts = await helper.getAccounts();
    await Promise.all(accounts.map(({ userId }) => rollbackAccount(userId)));
  }
}
