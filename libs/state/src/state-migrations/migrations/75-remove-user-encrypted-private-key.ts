import {
  SignedPublicKey,
  WrappedAccountCryptographicState,
  EncString,
  SignedSecurityState,
} from "@bitwarden/sdk-internal";

import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

type ExpectedAccountType = NonNullable<unknown>;

export const userEncryptedPrivateKey: KeyDefinitionLike = {
  key: "privateKey",
  stateDefinition: {
    name: "crypto",
  },
};

export const userKeyEncryptedSigningKey: KeyDefinitionLike = {
  key: "userSigningKey",
  stateDefinition: {
    name: "crypto",
  },
};

export const userSignedPublicKey: KeyDefinitionLike = {
  key: "userSignedPublicKey",
  stateDefinition: {
    name: "crypto",
  },
};

export const accountSecurityState: KeyDefinitionLike = {
  key: "accountSecurityState",
  stateDefinition: {
    name: "crypto",
  },
};

export const accountCryptographicState: KeyDefinitionLike = {
  key: "accountCryptographicState",
  stateDefinition: {
    name: "crypto",
  },
};

export class RemoveUserEncryptedPrivateKey extends Migrator<74, 75> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const accounts = await helper.getAccounts<ExpectedAccountType>();
    for (const { userId } of accounts) {
      // Check if account cryptographic state already exists
      const existingAccountCryptoState = await helper.getFromUser(
        userId,
        accountCryptographicState,
      );

      // Gather all individual cryptographic key state parts
      const privateKey = await helper.getFromUser(userId, userEncryptedPrivateKey);
      const signingKey = await helper.getFromUser(userId, userKeyEncryptedSigningKey);
      const signedPubKey = await helper.getFromUser(userId, userSignedPublicKey);
      const accountSecurity = await helper.getFromUser(userId, accountSecurityState);

      // Only migrate if account cryptographic state does not exist
      if (!existingAccountCryptoState) {
        // Build the new account cryptographic state object
        let newAccountCryptographicState: WrappedAccountCryptographicState;
        if (
          privateKey != null &&
          signingKey == null &&
          signedPubKey == null &&
          accountSecurity == null
        ) {
          newAccountCryptographicState = { V1: { private_key: privateKey as EncString } };
          await helper.setToUser(userId, accountCryptographicState, newAccountCryptographicState);
        } else if (
          privateKey != null &&
          signingKey != null &&
          signedPubKey != null &&
          accountSecurity != null
        ) {
          newAccountCryptographicState = {
            V2: {
              private_key: privateKey as EncString,
              signing_key: signingKey as EncString,
              signed_public_key: signedPubKey as SignedPublicKey,
              security_state: accountSecurity as SignedSecurityState,
            },
          };
          await helper.setToUser(userId, accountCryptographicState, newAccountCryptographicState);
        } else {
          helper.logService.warning(
            `Incomplete cryptographic state for user ${userId}, skipping migration of account cryptographic state.`,
          );
        }
      }

      // Always remove the old states
      if (privateKey != null) {
        await helper.removeFromUser(userId, userEncryptedPrivateKey);
      }
      if (signingKey != null) {
        await helper.removeFromUser(userId, userKeyEncryptedSigningKey);
      }
      if (signedPubKey != null) {
        await helper.removeFromUser(userId, userSignedPublicKey);
      }
      if (accountSecurity != null) {
        await helper.removeFromUser(userId, accountSecurityState);
      }
    }
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
