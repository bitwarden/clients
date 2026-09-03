import { AccountWarning, ReportBreach, TwoFactorTimeoutIcon } from "@bitwarden/assets/svg";
import { OpenOrgInviteStatusError } from "@bitwarden/common/auth/organization-invite";

import { AuthRoute } from "../constants";

import { OpenOrgInviteErrorButton } from "./open-org-invite-error-button.type";
import { OpenOrgInviteErrorUi } from "./open-org-invite-error-ui.type";

/**
 * Maps a status-endpoint error kind to its UI descriptor. Callers gate the `ok` arm and
 * handle diagnostic logging themselves before calling — the input is narrowed to the
 * error-only discriminator so the mapper's exhaustive switch stays focused on UI mapping.
 *
 * Centralized here (rather than duplicated in the two consumer components) so any
 * future status kind, copy update, or icon swap lands in one place.
 *
 * @param kind The status-endpoint error kind to render.
 * @param isAuthed Current authentication context; drives the button target
 *   (`go-to-login` when unauthed, `go-to-vault` when authed).
 */
export function getOpenOrgInviteStatusErrorUi(
  kind: OpenOrgInviteStatusError["kind"],
  isAuthed: boolean,
): OpenOrgInviteErrorUi {
  const button: OpenOrgInviteErrorButton = isAuthed
    ? { kind: "go-to-vault", labelI18nKey: "goToVault", navigateTo: "/" }
    : { kind: "go-to-login", labelI18nKey: "goToLogin", navigateTo: `/${AuthRoute.Login}` };
  switch (kind) {
    case "not-found":
      return {
        anonLayoutData: {
          pageTitle: { key: "cannotAcceptInvitation" },
          pageIcon: TwoFactorTimeoutIcon,
        },
        bodyMessageI18nKey: "openOrgInviteLinkNoLongerValid",
        button,
      };
    case "plan-not-supported":
      // link-not-found and plan-not-supported share the same body-copy key: the user
      // cannot tell them apart and there's no distinct remediation. Icon still uses the
      // default here (rather than TwoFactorTimeoutIcon) because plan-not-supported is a
      // distinct semantic condition even if the copy overlaps.
      return {
        anonLayoutData: {
          pageTitle: { key: "cannotAcceptInvitation" },
          pageIcon: AccountWarning,
        },
        bodyMessageI18nKey: "openOrgInviteLinkNoLongerValid",
        button,
      };
    case "no-seats":
      return {
        anonLayoutData: {
          pageTitle: { key: "cannotAcceptInvitation" },
          pageIcon: AccountWarning,
        },
        bodyMessageI18nKey: "openOrgInviteNoSeatsMessage",
        button,
      };
    case "unexpected":
      return {
        anonLayoutData: {
          pageTitle: { key: "cannotAcceptInvitation" },
          pageIcon: ReportBreach,
        },
        bodyMessageI18nKey: "openOrgInviteStatusUnexpectedErrorMessage",
        button,
      };
  }
}
