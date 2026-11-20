import { KeyDefinitionLike, MigrationHelper } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

export const NEW_SSO_USER_KEY_CONNECTOR_CONVERSION: KeyDefinitionLike = {
  key: "newSsoUserKeyConnectorConversion",
  stateDefinition: { name: "keyConnector" },
};

type ExpectedConversion = {
  organizationId?: string;
  organizationSsoIdentifier?: string;
  [key: string]: unknown;
};

/**
 * Moves the organization SSO identifier in the stored Key Connector conversion data from the
 * `organizationId` property to the `organizationSsoIdentifier` property. The value does not change.
 */
export class RenameKeyConnectorConversionSsoIdentifier extends Migrator<87, 88> {
  async migrate(helper: MigrationHelper): Promise<void> {
    await Promise.all(
      (await helper.getAccounts()).map(async ({ userId }) => {
        const conversion = await helper.getFromUser<ExpectedConversion>(
          userId,
          NEW_SSO_USER_KEY_CONNECTOR_CONVERSION,
        );
        if (conversion == null || !("organizationId" in conversion)) {
          return;
        }

        const { organizationId, ...rest } = conversion;
        await helper.setToUser(userId, NEW_SSO_USER_KEY_CONNECTOR_CONVERSION, {
          ...rest,
          organizationSsoIdentifier: organizationId,
        });
      }),
    );
  }

  async rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
