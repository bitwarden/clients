import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
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
