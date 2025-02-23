import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

export enum LegacyKeyMigrationAction {
  PREVENT_LOGIN_AND_SHOW_REQUIRE_MIGRATION_WARNING,
  NAVIGATE_TO_MIGRATION_COMPONENT,
}

export enum DuoLaunchAction {
  DIRECT_LAUNCH,
  SINGLE_ACTION_POPOUT,
}

/**
 * Manages all cross client functionality so we can have a single two factor auth component
 * implementation for all clients.
 */
export abstract class TwoFactorAuthComponentService {
  /**
   * Determines if the client should check for a webauthn response on init.
   * Currently, only the extension should check during component initialization.
   */
  abstract shouldCheckForWebAuthnQueryParamResponse(): boolean;

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
   * Optionally closes any single action popouts (extension only).
   * @returns true if we are in a single action popout and it was closed, false otherwise.
   */
  abstract closeSingleActionPopouts?(): Promise<boolean>;

  /**
   * Optionally refreshes any open windows (exempts current window).
   * Only defined on the extension client for the goal of refreshing sidebars.
   */
  abstract reloadOpenWindows?(): void;

  /**
   * Determines the action to take when launching the Duo flow.
   * The extension has to popout the flow, while other clients can launch it directly.
   */
  abstract determineDuoLaunchAction(): DuoLaunchAction;
}
