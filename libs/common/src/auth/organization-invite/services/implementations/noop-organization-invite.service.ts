import { Observable, of } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { MasterPasswordPolicyOptions } from "../../../../admin-console/models/domain/master-password-policy-options";
import { Policy } from "../../../../admin-console/models/domain/policy";
import { DirectOrganizationInvite } from "../../models/direct-organization-invite";
import {
  OpenOrganizationInvite,
  OpenOrgInviteLinkData,
} from "../../models/open-organization-invite";
import { OpenOrgInviteAcceptResult } from "../../types/open-org-invite-accept-result.type";
import { OpenOrgInviteStatusResult } from "../../types/open-org-invite-status-result.type";
import { OpenOrgInviteUnsealResult } from "../../types/open-org-invite-unseal-result.type";
import { OpenOrgInviteValidateEmailDomainResult } from "../../types/open-org-invite-validate-email-domain-result.type";
import { OrganizationInvite } from "../../types/organization-invite.type";
import { OrganizationInviteService } from "../organization-invite.service";

/**
 * No-op {@link OrganizationInviteService} for clients without invite state or accept routes
 * (currently every client except web). Split by intent:
 *
 * - Reads return the "no invite in state" answer (`null` / `undefined` / `of(null)`) — matches
 *   the truth on non-web and lets shared code stay client-agnostic.
 * - Idempotent cleanups (`clear*`) silently resolve — target state ("gone") is already true.
 *   Notably, `clearOrganizationInvite` is called unguarded from
 *   `ChangePasswordComponent.logOut` on every client, so it must not throw.
 * - Persistence writes (`setOrganizationInvite`) and every result-typed method throw, because
 *   reaching them on the noop is a DI-misconfiguration bug — every call site is behind a
 *   web-only route or a URL-param guard that shorts on non-web state.
 */
export class NoopOrganizationInviteService implements OrganizationInviteService {
  readonly activeInvite$: Observable<OrganizationInvite | null> = of(null);

  async getOrganizationInvite(): Promise<OrganizationInvite | null> {
    return null;
  }

  async getOpenOrgInvite(): Promise<OpenOrganizationInvite | null> {
    return null;
  }

  async setOrganizationInvite(_invite: OrganizationInvite): Promise<void> {
    throw new Error(
      "OrganizationInviteService.setOrganizationInvite called on NoopOrganizationInviteService — " +
        "DefaultOrganizationInviteService must be registered on this client to persist invite state.",
    );
  }

  async clearOrganizationInvite(): Promise<void> {
    return;
  }

  async clearOpenOrgInvite(): Promise<void> {
    return;
  }

  async validateAndAcceptDirectOrgInvite(
    _invite: DirectOrganizationInvite,
    _userId: UserId,
    _postAuthRedirectUrl: string,
  ): Promise<boolean> {
    throw new Error(
      "OrganizationInviteService.validateAndAcceptDirectOrgInvite called on NoopOrganizationInviteService — " +
        "DefaultOrganizationInviteService must be registered on this client for accept flows.",
    );
  }

  async acceptOpenOrgInvite(
    _invite: OpenOrganizationInvite,
    _userId: UserId,
    _postAuthRedirectUrl: string,
  ): Promise<OpenOrgInviteAcceptResult> {
    throw new Error(
      "OrganizationInviteService.acceptOpenOrgInvite called on NoopOrganizationInviteService — " +
        "DefaultOrganizationInviteService must be registered on this client for accept flows.",
    );
  }

  async getOrgPoliciesForInvite(_invite: OrganizationInvite): Promise<Policy[] | undefined> {
    return undefined;
  }

  async getMasterPasswordPolicyOptionsForInvite(
    _invite: OrganizationInvite,
  ): Promise<MasterPasswordPolicyOptions | undefined> {
    return undefined;
  }

  async getOpenOrgInviteStatus(
    _organizationId: string,
    _code: string,
  ): Promise<OpenOrgInviteStatusResult> {
    throw new Error(
      "OrganizationInviteService.getOpenOrgInviteStatus called on NoopOrganizationInviteService — " +
        "DefaultOrganizationInviteService must be registered on this client to query invite status.",
    );
  }

  async validateOpenOrgInviteEmailDomain(
    _organizationId: string,
    _code: string,
    _email: string,
  ): Promise<OpenOrgInviteValidateEmailDomainResult> {
    throw new Error(
      "OrganizationInviteService.validateOpenOrgInviteEmailDomain called on NoopOrganizationInviteService — " +
        "DefaultOrganizationInviteService must be registered on this client to validate invite email domains.",
    );
  }

  async sealOpenOrgInvite(_email: string, _invite: OpenOrgInviteLinkData): Promise<string | null> {
    throw new Error(
      "OrganizationInviteService.sealOpenOrgInvite called on NoopOrganizationInviteService — " +
        "DefaultOrganizationInviteService must be registered on this client to seal invite blobs.",
    );
  }

  async unsealOpenOrgInvite(
    _email: string,
    _sealedData: string,
  ): Promise<OpenOrgInviteUnsealResult> {
    throw new Error(
      "OrganizationInviteService.unsealOpenOrgInvite called on NoopOrganizationInviteService — " +
        "DefaultOrganizationInviteService must be registered on this client to unseal invite blobs.",
    );
  }

  async clearSealedOpenOrgInviteSecret(_email: string): Promise<void> {
    return;
  }

  async clearExpiredSealedOpenOrgInviteSecrets(): Promise<void> {
    return;
  }
}
