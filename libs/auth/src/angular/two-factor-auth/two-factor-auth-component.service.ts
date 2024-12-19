import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

export enum LegacyKeyMigrationAction {
  PREVENT_LOGIN_AND_SHOW_REQUIRE_MIGRATION_WARNING,
  NAVIGATE_TO_MIGRATION_COMPONENT,
}

/**
 * Manages all cross client functionality so we can have a single two factor auth component
 * implementation for all clients.
 */
export abstract class TwoFactorAuthComponentService {
  /**
   * Determines if the client should check for a webauthn response on init.
   * Currently, only the extension should check on init.
   */
  abstract shouldCheckForWebauthnResponseOnInit(): boolean;

  /**
   * Extends the popup width if required.
   * Some client specific situations require the popup to be wider than the default width.
   */
  abstract extendPopupWidthIfRequired?(
    selected2faProviderType: TwoFactorProviderType,
  ): Promise<void>;

  /**
   * Removes the popup width extension.
   */
  abstract removePopupWidthExtension?(): void;

  /**
   * Optionally closes the window if the client requires it
   */
  abstract closeWindow?(): void;

  /**
   * We used to use the user's master key to encrypt their data. We deprecated that approach
   * and now use a user key. This method should be called if we detect that the user
   * is still using the old master key encryption scheme (server sends down a flag to
   * indicate this). This method then determines what action to take based on the client.
   *
   * We have two possible actions:
   * 1. Prevent the user from logging in and show a warning that they need to migrate their key on the web client today.
   * 2. Navigate the user to the key migration component on the web client.
   */
  abstract determineLegacyKeyMigrationAction(): LegacyKeyMigrationAction;

  /**
   * Optionally handles the success flow for the SSO + 2FA required flow.
   * Only defined on clients that require custom success handling.
   */
  abstract handleSso2faFlowSuccess?(): Promise<void>;
}
