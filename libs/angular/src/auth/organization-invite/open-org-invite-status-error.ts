import { AccountWarning } from "@bitwarden/assets/svg";
import { OpenOrgInviteStatusResult } from "@bitwarden/common/auth/organization-invite";
import { AnonLayoutWrapperData } from "@bitwarden/components";

/**
 * UI descriptor produced by {@link openOrgInviteStatusErrorUi} for any non-`ok`
 * `OpenOrgInviteStatusResult`. Two-part payload so consumers can drive both the
 * anon-layout chrome (page title + icon) and their own template body without
 * switching on the raw status kind themselves.
 */
export interface OpenOrgInviteStatusErrorUi {
  anonLayoutData: AnonLayoutWrapperData;
  /** i18n key for the body-message paragraph that replaces the normal flow content. */
  bodyMessageI18nKey: string;
  /**
   * Populated only for the `unexpected` kind — the raw server-side error detail. Pass to
   * `LogService` for diagnostics; do not render it. The user sees only the generic copy
   * behind `bodyMessageI18nKey`.
   */
  errorMessageToLog?: string;
}

/**
 * Maps a status-endpoint result to the shared UI descriptor for its non-`ok` kinds.
 * `ok` returns null (caller proceeds with the fresh status). `unexpected` returns a
 * generic-copy descriptor with `errorMessageToLog` populated so callers can log the raw
 * detail without surfacing it to the user.
 *
 * Centralized here (rather than duplicated in the two consumer components) so any
 * future status kind, copy update, or icon swap lands in one place.
 */
export function openOrgInviteStatusErrorUi(
  status: OpenOrgInviteStatusResult,
): OpenOrgInviteStatusErrorUi | null {
  switch (status.kind) {
    case "ok":
      return null;
    case "not-found":
      // TODO: placeholder — pending design. Icon + copy (openOrgInviteNotFoundTitle /
      // openOrgInviteNotFoundMessage) are stand-ins. Server response for 404 carries no
      // org name, so copy stays generic even after design lands.
      return {
        anonLayoutData: {
          pageTitle: { key: "openOrgInviteNotFoundTitle" },
          pageIcon: AccountWarning,
        },
        bodyMessageI18nKey: "openOrgInviteNotFoundMessage",
      };
    case "plan-not-supported":
      // TODO: placeholder — pending design. Icon + copy are stand-ins.
      // `status.organizationName` is available on this kind and should feed an
      // interpolated title once design approves the copy.
      return {
        anonLayoutData: {
          pageTitle: { key: "openOrgInvitePlanNotSupportedTitle" },
          pageIcon: AccountWarning,
        },
        bodyMessageI18nKey: "openOrgInvitePlanNotSupportedMessage",
      };
    case "no-seats":
      // TODO: placeholder — pending design. `status.organizationName` is available on
      // this kind and should feed an interpolated title once design approves the copy.
      return {
        anonLayoutData: {
          pageTitle: { key: "openOrgInviteNoSeatsTitle" },
          pageIcon: AccountWarning,
        },
        bodyMessageI18nKey: "openOrgInviteNoSeatsMessage",
      };
    case "unexpected":
      // TODO: placeholder — pending design. Icon + copy stand-ins for the generic
      // server-error surface. `errorMessageToLog` carries the raw server detail for
      // LogService diagnostics; not shown to the user.
      return {
        anonLayoutData: {
          pageTitle: { key: "openOrgInviteStatusUnexpectedErrorTitle" },
          pageIcon: AccountWarning,
        },
        bodyMessageI18nKey: "openOrgInviteStatusUnexpectedErrorMessage",
        errorMessageToLog: status.errorMessage,
      };
  }
}
