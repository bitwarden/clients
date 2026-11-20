import { AnonLayoutWrapperData } from "@bitwarden/components";

import { OpenOrgInviteErrorButton } from "./open-org-invite-error-button.type";

/**
 * Shared UI descriptor produced by both open-org-invite error mappers
 * (`getOpenOrgInviteStatusErrorUi` and `getOpenOrgInviteAcceptErrorUi`). Drives the anon-layout
 * chrome (page title + icon), the body-message copy, and the primary button rendered
 * below the body without consumers switching on the raw error kind themselves.
 */
export interface OpenOrgInviteErrorUi {
  anonLayoutData: AnonLayoutWrapperData;
  /**
   * i18n key for the body-message paragraph. Consumers resolve interpolation args at
   * render time (e.g. `email-domain-not-allowed` needs the user's email domain).
   */
  bodyMessageI18nKey: string;
  button: OpenOrgInviteErrorButton;
}
