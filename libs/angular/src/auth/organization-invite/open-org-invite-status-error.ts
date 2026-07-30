import { AccountWarning } from "@bitwarden/assets/svg";
import { OpenOrgInviteStatusResult } from "@bitwarden/common/auth/organization-invite";
import { AnonLayoutWrapperData } from "@bitwarden/components";

/**
 * UI descriptor produced by {@link openOrgInviteStatusErrorUi} for any classified
 * non-`ok` `OpenOrgInviteStatusResult`. Two-part payload so consumers can drive both
 * the anon-layout chrome (page title + icon) and their own template body without
 * switching on the raw status kind themselves.
 */
export interface OpenOrgInviteStatusErrorUi {
  anonLayoutData: AnonLayoutWrapperData;
  /** i18n key for the body-message paragraph that replaces the normal flow content. */
  bodyMessageKey: string;
}

/**
 * Maps a status-endpoint result to the shared UI descriptor for its classified failure
 * kinds. `ok` returns null (caller proceeds with the fresh status). `unexpected` rethrows
 * so the caller's generic error path — typically `AcceptFlowService`'s `failedMessage`
 * handling — surfaces the underlying message rather than a silently-classified failure.
 *
 * Centralized here (rather than duplicated in the two consumer components) so any future
 * status kind, copy update, or icon swap lands in one place.
 */
export function openOrgInviteStatusErrorUi(
  status: OpenOrgInviteStatusResult,
): OpenOrgInviteStatusErrorUi | null {
  switch (status.kind) {
    case "ok":
      return null;
    case "not-found":
      // TODO: placeholder — pending design. Icon + copy (openInviteNotFoundTitle /
      // openInviteNotFoundMessage) are stand-ins. Server response for 404 carries no
      // org name, so copy stays generic even after design lands.
      return {
        anonLayoutData: {
          pageTitle: { key: "openInviteNotFoundTitle" },
          pageIcon: AccountWarning,
        },
        bodyMessageKey: "openInviteNotFoundMessage",
      };
    case "plan-not-supported":
      // TODO: placeholder — pending design. Icon + copy are stand-ins.
      // `status.organizationName` is available on this kind and should feed an
      // interpolated title once design approves the copy.
      return {
        anonLayoutData: {
          pageTitle: { key: "openInvitePlanNotSupportedTitle" },
          pageIcon: AccountWarning,
        },
        bodyMessageKey: "openInvitePlanNotSupportedMessage",
      };
    case "no-seats":
      // TODO: placeholder — pending design. `status.organizationName` is available on
      // this kind and should feed an interpolated title once design approves the copy.
      return {
        anonLayoutData: {
          pageTitle: { key: "openInviteNoSeatsTitle" },
          pageIcon: AccountWarning,
        },
        bodyMessageKey: "openInviteNoSeatsMessage",
      };
    case "unexpected":
      throw new Error(status.errorMessage);
  }
}
