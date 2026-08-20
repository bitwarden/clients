import { AccountWarning, ReportBreach, TwoFactorTimeoutIcon } from "@bitwarden/assets/svg";

import { OpenOrgInviteAcceptRenderableErrorKind } from "./open-org-invite-accept-renderable-error-kind.type";
import { OpenOrgInviteErrorButton } from "./open-org-invite-error-button.type";
import { OpenOrgInviteErrorUi } from "./open-org-invite-error-ui.type";

/**
 * Maps a renderable accept-endpoint error to its UI descriptor. Accept-endpoint kinds
 * all fire from the authed handler, so the button is always `go-to-vault`. The page
 * title is constant across kinds; icon and body copy vary per kind.
 *
 * Centralized here (rather than duplicated inside the consumer component) so any future
 * kind, copy update, or icon swap lands in one place.
 *
 * @param kind The accept-endpoint error kind to render.
 * @param vfo1Enabled Whether the `vfo1-foundation` flag is enabled — selects
 * shared-vault terminology variants for affected body copy.
 */
export function getOpenOrgInviteAcceptErrorUi(
  kind: OpenOrgInviteAcceptRenderableErrorKind,
  vfo1Enabled: boolean,
): OpenOrgInviteErrorUi {
  const button: OpenOrgInviteErrorButton = {
    kind: "go-to-vault",
    labelI18nKey: "goToVault",
    navigateTo: "/",
  };
  const pageTitle = { key: "openOrgInviteAcceptFailedTitle" };
  switch (kind) {
    case "link-not-found":
      return {
        anonLayoutData: { pageTitle, pageIcon: TwoFactorTimeoutIcon },
        bodyMessageI18nKey: "openOrgInviteLinkNoLongerValid",
        button,
      };
    case "plan-not-supported":
      // Shares body copy with `link-not-found`: the user cannot tell them apart and
      // there's no distinct remediation. Icon still differs so the visual doesn't imply
      // a link-expiry semantic when the plan is the actual blocker.
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: "openOrgInviteLinkNoLongerValid",
        button,
      };
    case "email-domain-not-allowed":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: "openOrgInviteAcceptEmailDomainNotAllowed",
        button,
      };
    case "org-access-revoked":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: "openOrgInviteAcceptOrgAccessRevoked",
        button,
      };
    case "no-seats":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: "openOrgInviteNoSeatsMessage",
        button,
      };
    case "two-factor-required":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: "openOrgInviteAcceptTwoFactorRequired",
        button,
      };
    case "email-not-verified":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: "openOrgInviteAcceptEmailNotVerified",
        button,
      };
    // Single-org and auto-confirm target-org variants share body copy: both are the same
    // "the org you are trying to join enforces single-org membership" outcome from the
    // user's perspective, differing only in which server-side policy family produced it.
    case "single-org-policy-violation-target-org":
    case "auto-confirm-policy-violation-target-org":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: vfo1Enabled
          ? "openOrgInviteAcceptSingleOrgErrorTargetOrg"
          : "openOrgInviteAcceptSingleOrgTargetOrg",
        button,
      };
    case "single-org-policy-violation-other-org":
    case "auto-confirm-policy-violation-other-org":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: vfo1Enabled
          ? "openOrgInviteAcceptSingleOrgErrorOtherOrg"
          : "openOrgInviteAcceptSingleOrgOtherOrg",
        button,
      };
    case "provider-users-disallowed":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: "openOrgInviteAcceptProviderUser",
        button,
      };
    case "free-admin-limit-reached":
      return {
        anonLayoutData: { pageTitle, pageIcon: AccountWarning },
        bodyMessageI18nKey: "openOrgInviteAcceptFreeAdminLimit",
        button,
      };
    case "reset-password-key-required":
      return {
        anonLayoutData: { pageTitle, pageIcon: ReportBreach },
        bodyMessageI18nKey: "openOrgInviteAcceptResetPasswordKeyRequired",
        button,
      };
    case "unexpected":
      return {
        anonLayoutData: { pageTitle, pageIcon: ReportBreach },
        bodyMessageI18nKey: "openOrgInviteAcceptUnexpected",
        button,
      };
  }
}
