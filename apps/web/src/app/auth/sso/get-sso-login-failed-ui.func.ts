import { Params } from "@angular/router";

import { TwoFactorAuthEmailIcon, TwoFactorTimeoutIcon } from "@bitwarden/assets/svg";

import { SsoLoginFailedErrorKind } from "./sso-login-failed-error-kind.type";
import { SsoLoginFailedUi } from "./sso-login-failed-ui.type";

/**
 * Maps an SSO-login failure kind to its UI descriptor. Each variant declares
 * its body-copy i18n key and any placeholders it reads from the route query
 * params. Centralized here so any future kind, copy update, or icon swap
 * lands in one place.
 */
export function getSsoLoginFailedUi(
  kind: SsoLoginFailedErrorKind,
  qParams: Params,
): SsoLoginFailedUi {
  switch (kind) {
    case SsoLoginFailedErrorKind.StagedOrgUserDirectInviteSent:
      return {
        anonLayoutData: {
          pageTitle: { key: "inviteSentToEmail" },
          pageIcon: TwoFactorAuthEmailIcon,
        },
        bodyMessage: {
          key: "ssoStagedOrgUserDirectInviteEmailSent",
          placeholders: [qParams.organizationName ?? ""],
        },
      };
    case SsoLoginFailedErrorKind.NoSeatsAvailable:
      return {
        anonLayoutData: {
          pageTitle: { key: "cannotAcceptInvitation" },
          pageIcon: TwoFactorTimeoutIcon,
        },
        bodyMessage: { key: "ssoNoSeatsAvailableMessage" },
      };
  }
}
