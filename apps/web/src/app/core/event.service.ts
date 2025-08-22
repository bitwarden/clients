// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DeviceType, EventType } from "@bitwarden/common/enums";
import { EventResponse } from "@bitwarden/common/models/response/event.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Injectable()
export class EventService {
  private policies: Policy[];

  constructor(
    private i18nService: I18nService,
    policyService: PolicyService,
    accountService: AccountService,
  ) {
    accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => policyService.policies$(userId)),
      )
      .subscribe((policies) => {
        this.policies = policies;
      });
  }

  getDefaultDateFilters() {
    const d = new Date();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
    d.setDate(d.getDate() - 30);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0);
    return [this.toDateTimeLocalString(start), this.toDateTimeLocalString(end)];
  }

  formatDateFilters(filterStart: string, filterEnd: string) {
    const start: Date = new Date(filterStart);
    const end: Date = new Date(filterEnd + ":59.999");
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      throw new Error("Invalid date range.");
    }
    return [start.toISOString(), end.toISOString()];
  }

  async getEventInfo(ev: EventResponse, options = new EventOptions()): Promise<EventInfo> {
    const appInfo = this.getAppInfo(ev);
    const { message, humanReadableMessage } = await this.getEventMessage(ev, options);
    return {
      message: message,
      humanReadableMessage: humanReadableMessage,
      appIcon: appInfo[0],
      appName: appInfo[1],
    };
  }

  private async getEventMessage(ev: EventResponse, options: EventOptions) {
    let msg = "";
    let humanReadableMsg = "";
    switch (ev.type) {
      // User
      case EventType.User_LoggedIn:
        msg = humanReadableMsg = this.i18nService.t("loggedIn");
        break;
      case EventType.User_ChangedPassword:
        msg = humanReadableMsg = this.i18nService.t("changedPassword");
        break;
      case EventType.User_Updated2fa:
        msg = humanReadableMsg = this.i18nService.t("enabledUpdated2fa");
        break;
      case EventType.User_Disabled2fa:
        msg = humanReadableMsg = this.i18nService.t("disabled2fa");
        break;
      case EventType.User_Recovered2fa:
        msg = humanReadableMsg = this.i18nService.t("recovered2fa");
        break;
      case EventType.User_FailedLogIn:
        msg = humanReadableMsg = this.i18nService.t("failedLogin");
        break;
      case EventType.User_FailedLogIn2fa:
        msg = humanReadableMsg = this.i18nService.t("failedLogin2fa");
        break;
      case EventType.User_ClientExportedVault:
        msg = humanReadableMsg = this.i18nService.t("exportedVault");
        break;
      case EventType.User_UpdatedTempPassword:
        msg = humanReadableMsg = this.i18nService.t("updatedTempPassword");
        break;
      case EventType.User_MigratedKeyToKeyConnector:
        msg = humanReadableMsg = this.i18nService.t("migratedKeyConnector");
        break;
      case EventType.User_RequestedDeviceApproval:
        msg = humanReadableMsg = this.i18nService.t("requestedDeviceApproval");
        break;
      case EventType.User_TdeOffboardingPasswordSet:
        msg = humanReadableMsg = this.i18nService.t("tdeOffboardingPasswordSet");
        break;
      // Cipher
      case EventType.Cipher_Created:
        msg = this.i18nService.t("createdItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("createdItemId", this.getShortId(ev.cipherId));
        break;
      case EventType.Cipher_Updated:
        msg = this.i18nService.t("editedItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("editedItemId", this.getShortId(ev.cipherId));
        break;
      case EventType.Cipher_Deleted:
        msg = this.i18nService.t("permanentlyDeletedItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "permanentlyDeletedItemId",
          this.getShortId(ev.cipherId),
        );
        break;
      case EventType.Cipher_SoftDeleted:
        msg = this.i18nService.t("deletedItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("deletedItemId", this.getShortId(ev.cipherId));
        break;
      case EventType.Cipher_Restored:
        msg = this.i18nService.t("restoredItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("restoredItemId", this.formatCipherId(ev, options));
        break;
      case EventType.Cipher_AttachmentCreated:
        msg = this.i18nService.t("createdAttachmentForItem", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "createdAttachmentForItem",
          this.getShortId(ev.cipherId),
        );
        break;
      case EventType.Cipher_AttachmentDeleted:
        msg = this.i18nService.t("deletedAttachmentForItem", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "deletedAttachmentForItem",
          this.getShortId(ev.cipherId),
        );
        break;
      case EventType.Cipher_Shared:
        msg = this.i18nService.t("movedItemIdToOrg", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("movedItemIdToOrg", this.getShortId(ev.cipherId));
        break;
      case EventType.Cipher_ClientViewed:
        msg = this.i18nService.t("viewedItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("viewedItemId", this.getShortId(ev.cipherId));
        break;
      case EventType.Cipher_ClientToggledPasswordVisible:
        msg = this.i18nService.t("viewedPasswordItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("viewedPasswordItemId", this.getShortId(ev.cipherId));
        break;
      case EventType.Cipher_ClientToggledHiddenFieldVisible:
        msg = this.i18nService.t("viewedHiddenFieldItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "viewedHiddenFieldItemId",
          this.getShortId(ev.cipherId),
        );
        break;
      case EventType.Cipher_ClientToggledCardNumberVisible:
        msg = this.i18nService.t("viewedCardNumberItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "viewedCardNumberItemId",
          this.getShortId(ev.cipherId),
        );
        break;
      case EventType.Cipher_ClientToggledCardCodeVisible:
        msg = this.i18nService.t("viewedSecurityCodeItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "viewedSecurityCodeItemId",
          this.getShortId(ev.cipherId),
        );
        break;
      case EventType.Cipher_ClientCopiedHiddenField:
        msg = this.i18nService.t("copiedHiddenFieldItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "copiedHiddenFieldItemId",
          this.getShortId(ev.cipherId),
        );
        break;
      case EventType.Cipher_ClientCopiedPassword:
        msg = this.i18nService.t("copiedPasswordItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("copiedPasswordItemId", this.getShortId(ev.cipherId));
        break;
      case EventType.Cipher_ClientCopiedCardCode:
        msg = this.i18nService.t("copiedSecurityCodeItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "copiedSecurityCodeItemId",
          this.getShortId(ev.cipherId),
        );
        break;
      case EventType.Cipher_ClientAutofilled:
        msg = this.i18nService.t("autofilledItemId", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t("autofilledItemId", this.getShortId(ev.cipherId));
        break;
      case EventType.Cipher_UpdatedCollections:
        msg = this.i18nService.t("editedCollectionsForItem", this.formatCipherId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "editedCollectionsForItem",
          this.getShortId(ev.cipherId),
        );
        break;
      // Collection
      case EventType.Collection_Created:
        msg = this.i18nService.t("createdCollectionId", this.formatCollectionId(ev));
        humanReadableMsg = this.i18nService.t(
          "createdCollectionId",
          this.getShortId(ev.collectionId),
        );
        break;
      case EventType.Collection_Updated:
        msg = this.i18nService.t("editedCollectionId", this.formatCollectionId(ev));
        humanReadableMsg = this.i18nService.t(
          "editedCollectionId",
          this.getShortId(ev.collectionId),
        );
        break;
      case EventType.Collection_Deleted:
        msg = this.i18nService.t("deletedCollectionId", this.formatCollectionId(ev));
        humanReadableMsg = this.i18nService.t(
          "deletedCollectionId",
          this.getShortId(ev.collectionId),
        );
        break;
      // Group
      case EventType.Group_Created:
        msg = this.i18nService.t("createdGroupId", this.formatGroupId(ev));
        humanReadableMsg = this.i18nService.t("createdGroupId", this.getShortId(ev.groupId));
        break;
      case EventType.Group_Updated:
        msg = this.i18nService.t("editedGroupId", this.formatGroupId(ev));
        humanReadableMsg = this.i18nService.t("editedGroupId", this.getShortId(ev.groupId));
        break;
      case EventType.Group_Deleted:
        msg = this.i18nService.t("deletedGroupId", this.formatGroupId(ev));
        humanReadableMsg = this.i18nService.t("deletedGroupId", this.getShortId(ev.groupId));
        break;
      // Org user
      case EventType.OrganizationUser_Invited:
        msg = this.i18nService.t("invitedUserId", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "invitedUserId",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_Confirmed:
        msg = this.i18nService.t("confirmedUserId", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "confirmedUserId",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_Updated:
        msg = this.i18nService.t("editedUserId", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "editedUserId",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_Removed:
        msg = this.i18nService.t("removedUserId", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "removedUserId",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_UpdatedGroups:
        msg = this.i18nService.t("editedGroupsForUser", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "editedGroupsForUser",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_UnlinkedSso:
        msg = this.i18nService.t("unlinkedSsoUser", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "unlinkedSsoUser",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_ResetPassword_Enroll:
        msg = this.i18nService.t("eventEnrollAccountRecovery", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "eventEnrollAccountRecovery",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_ResetPassword_Withdraw:
        msg = this.i18nService.t("eventWithdrawAccountRecovery", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "eventWithdrawAccountRecovery",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_AdminResetPassword:
        msg = this.i18nService.t("eventAdminPasswordReset", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "eventAdminPasswordReset",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_ResetSsoLink:
        msg = this.i18nService.t("eventResetSsoLink", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "eventResetSsoLink",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_FirstSsoLogin:
        msg = this.i18nService.t("firstSsoLogin", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "firstSsoLogin",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_Revoked:
        msg = this.i18nService.t("revokedUserId", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "revokedUserId",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_Restored:
        msg = this.i18nService.t("restoredUserId", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "restoredUserId",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_ApprovedAuthRequest:
        msg = this.i18nService.t("approvedAuthRequest", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "approvedAuthRequest",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_RejectedAuthRequest:
        msg = this.i18nService.t("rejectedAuthRequest", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "rejectedAuthRequest",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_Deleted:
        msg = this.i18nService.t("deletedUserIdEventMessage", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "deletedUserIdEventMessage",
          this.getShortId(ev.organizationUserId),
        );
        break;
      case EventType.OrganizationUser_Left:
        msg = this.i18nService.t("userLeftOrganization", this.formatOrgUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "userLeftOrganization",
          this.getShortId(ev.organizationUserId),
        );
        break;
      // Org
      case EventType.Organization_Updated:
        msg = humanReadableMsg = this.i18nService.t("editedOrgSettings");
        break;
      case EventType.Organization_PurgedVault:
        msg = humanReadableMsg = this.i18nService.t("purgedOrganizationVault");
        break;
      case EventType.Organization_ClientExportedVault:
        msg = humanReadableMsg = this.i18nService.t("exportedOrganizationVault");
        break;
      case EventType.Organization_VaultAccessed:
        msg = humanReadableMsg = this.i18nService.t("vaultAccessedByProvider");
        break;
      case EventType.Organization_EnabledSso:
        msg = humanReadableMsg = this.i18nService.t("enabledSso");
        break;
      case EventType.Organization_DisabledSso:
        msg = humanReadableMsg = this.i18nService.t("disabledSso");
        break;
      case EventType.Organization_EnabledKeyConnector:
        msg = humanReadableMsg = this.i18nService.t("enabledKeyConnector");
        break;
      case EventType.Organization_DisabledKeyConnector:
        msg = humanReadableMsg = this.i18nService.t("disabledKeyConnector");
        break;
      case EventType.Organization_SponsorshipsSynced:
        msg = humanReadableMsg = this.i18nService.t("sponsorshipsSynced");
        break;
      case EventType.Organization_CollectionManagementUpdated:
        msg = this.i18nService.t("modifiedCollectionManagement", this.formatOrganizationId(ev));
        humanReadableMsg = this.i18nService.t(
          "modifiedCollectionManagement",
          this.getShortId(ev.organizationId),
        );
        break;

      // Policies
      case EventType.Policy_Updated: {
        msg = this.i18nService.t("modifiedPolicyId", this.formatPolicyId(ev));

        const policy = this.policies.filter((p) => p.id === ev.policyId)[0];
        let p1 = this.getShortId(ev.policyId);
        if (policy != null) {
          p1 = PolicyType[policy.type];
        }

        humanReadableMsg = this.i18nService.t("modifiedPolicyId", p1);
        break;
      }
      // Provider users:
      case EventType.ProviderUser_Invited:
        msg = this.i18nService.t("invitedUserId", this.formatProviderUserId(ev));
        humanReadableMsg = this.i18nService.t("invitedUserId", this.getShortId(ev.providerUserId));
        break;
      case EventType.ProviderUser_Confirmed:
        msg = this.i18nService.t("confirmedUserId", this.formatProviderUserId(ev));
        humanReadableMsg = this.i18nService.t(
          "confirmedUserId",
          this.getShortId(ev.providerUserId),
        );
        break;
      case EventType.ProviderUser_Updated:
        msg = this.i18nService.t("editedUserId", this.formatProviderUserId(ev));
        humanReadableMsg = this.i18nService.t("editedUserId", this.getShortId(ev.providerUserId));
        break;
      case EventType.ProviderUser_Removed:
        msg = this.i18nService.t("removedUserId", this.formatProviderUserId(ev));
        humanReadableMsg = this.i18nService.t("removedUserId", this.getShortId(ev.providerUserId));
        break;
      case EventType.ProviderOrganization_Created:
        msg = this.i18nService.t("createdOrganizationId", this.formatProviderOrganizationId(ev));
        humanReadableMsg = this.i18nService.t(
          "createdOrganizationId",
          this.getShortId(ev.providerOrganizationId),
        );
        break;
      case EventType.ProviderOrganization_Added:
        msg = this.i18nService.t("addedOrganizationId", this.formatProviderOrganizationId(ev));
        humanReadableMsg = this.i18nService.t(
          "addedOrganizationId",
          this.getShortId(ev.providerOrganizationId),
        );
        break;
      case EventType.ProviderOrganization_Removed:
        msg = this.i18nService.t("removedOrganizationId", this.formatProviderOrganizationId(ev));
        humanReadableMsg = this.i18nService.t(
          "removedOrganizationId",
          this.getShortId(ev.providerOrganizationId),
        );
        break;
      case EventType.ProviderOrganization_VaultAccessed:
        msg = this.i18nService.t("accessedClientVault", this.formatProviderOrganizationId(ev));
        humanReadableMsg = this.i18nService.t(
          "accessedClientVault",
          this.getShortId(ev.providerOrganizationId),
        );
        break;
      // Org Domain claiming events
      case EventType.OrganizationDomain_Added:
        msg = humanReadableMsg = this.i18nService.t("addedDomain", ev.domainName);
        break;
      case EventType.OrganizationDomain_Removed:
        msg = humanReadableMsg = this.i18nService.t("removedDomain", ev.domainName);
        break;
      case EventType.OrganizationDomain_Verified:
        msg = humanReadableMsg = this.i18nService.t("domainClaimedEvent", ev.domainName);
        break;
      case EventType.OrganizationDomain_NotVerified:
        msg = humanReadableMsg = this.i18nService.t("domainNotClaimedEvent", ev.domainName);
        break;
      // Secrets Manager
      case EventType.Secret_Retrieved:
        msg = this.i18nService.t("accessedSecretWithId", this.formatSecretId(ev, options));
        humanReadableMsg = this.i18nService.t("accessedSecretWithId", this.getShortId(ev.secretId));
        break;
      case EventType.Secret_Created:
        msg = this.i18nService.t("createdSecretWithId", this.formatSecretId(ev, options));
        humanReadableMsg = this.i18nService.t("createdSecretWithId", this.getShortId(ev.secretId));
        break;
      case EventType.Secret_Deleted:
        msg = this.i18nService.t("deletedSecretWithId", this.formatSecretId(ev, options));
        humanReadableMsg = this.i18nService.t("deletedSecretWithId", this.getShortId(ev.secretId));
        break;
      case EventType.Secret_Permanently_Deleted:
        msg = this.i18nService.t(
          "permanentlyDeletedSecretWithId",
          this.formatSecretId(ev, options),
        );
        humanReadableMsg = this.i18nService.t(
          "permanentlyDeletedSecretWithId",
          this.getShortId(ev.secretId),
        );
        break;
      case EventType.Secret_Restored:
        msg = this.i18nService.t("restoredSecretWithId", this.formatSecretId(ev, options));
        humanReadableMsg = this.i18nService.t("restoredSecretWithId", this.getShortId(ev.secretId));
        break;
      case EventType.Secret_Edited:
        msg = this.i18nService.t("editedSecretWithId", this.formatSecretId(ev, options));
        humanReadableMsg = this.i18nService.t("editedSecretWithId", this.getShortId(ev.secretId));
        break;
      case EventType.Project_Retrieved:
        msg = this.i18nService.t("accessedProjectWithId", this.formatProjectId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "accessedProjectWithId",
          this.getShortId(ev.projectId),
        );
        break;
      case EventType.Project_Created:
        msg = this.i18nService.t("createdProjectWithId", this.formatProjectId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "createdProjectWithId",
          this.getShortId(ev.projectId),
        );
        break;
      case EventType.Project_Deleted:
        msg = this.i18nService.t("deletedProjectWithId", this.formatProjectId(ev, options));
        humanReadableMsg = this.i18nService.t(
          "deletedProjectWithId",
          this.getShortId(ev.projectId),
        );
        break;
      case EventType.Project_Edited:
        msg = this.i18nService.t("editedProjectWithId", this.formatProjectId(ev, options));
        humanReadableMsg = this.i18nService.t("editedProjectWithId", this.getShortId(ev.projectId));
        break;
      case EventType.ServiceAccount_UserAdded:
        msg = this.i18nService.t(
          "addedUserToServiceAccountWithId",
          this.formatUserId(ev, options),
          this.formatServiceAccountId(ev, options),
        );
        humanReadableMsg = this.i18nService.t(
          "addedUserToServiceAccountWithId",
          this.formatUserId(ev, options),
          this.formatServiceAccountId(ev, options),
        );
        break;
      case EventType.ServiceAccount_UserRemoved:
        msg = this.i18nService.t(
          "removedUserToServiceAccountWithId",
          this.formatUserId(ev, options),
          this.formatServiceAccountId(ev, options),
        );
        humanReadableMsg = this.i18nService.t(
          "removedUserToServiceAccountWithId",
          this.formatUserId(ev, options),
          this.formatServiceAccountId(ev, options),
        );
        break;
      case EventType.ServiceAccount_GroupRemoved:
        msg = this.i18nService.t(
          "removedGroupFromServiceAccountWithId",
          this.formatGroupId(ev),
          this.formatServiceAccountId(ev, options),
        );
        humanReadableMsg = this.i18nService.t(
          "removedGroupFromServiceAccountWithId",
          this.formatGroupId(ev),
          this.formatServiceAccountId(ev, options),
        );
        break;
      case EventType.ServiceAccount_GroupAdded:
        msg = this.i18nService.t(
          "addedGroupToServiceAccountWithId",
          this.formatGroupId(ev),
          this.formatServiceAccountId(ev, options),
        );
        humanReadableMsg = this.i18nService.t(
          "addedGroupToServiceAccountWithId",
          this.formatGroupId(ev),
          this.formatServiceAccountId(ev, options),
        );
        break;
      case EventType.ServiceAccount_Created:
        msg = this.i18nService.t(
          "serviceAccountCreatedWithId",
          this.formatServiceAccountId(ev, options),
        );
        humanReadableMsg = this.i18nService.t(
          "serviceAccountCreatedWithId",
          this.formatServiceAccountId(ev, options),
        );
        break;
      case EventType.ServiceAccount_Deleted:
        msg = this.i18nService.t(
          "serviceAccountDeletedWithId",
          this.formatServiceAccountId(ev, options),
        );
        humanReadableMsg = this.i18nService.t(
          "serviceAccountDeletedWithId",
          this.formatServiceAccountId(ev, options),
        );
        break;
      default:
        break;
    }
    return {
      message: msg === "" ? null : msg,
      humanReadableMessage: humanReadableMsg === "" ? null : humanReadableMsg,
    };
  }

  private getAppInfo(ev: EventResponse): [string, string] {
    if (ev.serviceAccountId) {
      return ["bwi-globe", this.i18nService.t("sdk")];
    }

    switch (ev.deviceType) {
      case DeviceType.Android:
        return ["bwi-mobile", this.i18nService.t("mobile") + " - Android"];
      case DeviceType.iOS:
        return ["bwi-mobile", this.i18nService.t("mobile") + " - iOS"];
      case DeviceType.UWP:
        return ["bwi-mobile", this.i18nService.t("mobile") + " - Windows"];
      case DeviceType.ChromeExtension:
        return ["bwi-puzzle", this.i18nService.t("extension") + " - Chrome"];
      case DeviceType.FirefoxExtension:
        return ["bwi-puzzle", this.i18nService.t("extension") + " - Firefox"];
      case DeviceType.OperaExtension:
        return ["bwi-puzzle", this.i18nService.t("extension") + " - Opera"];
      case DeviceType.EdgeExtension:
        return ["bwi-puzzle", this.i18nService.t("extension") + " - Edge"];
      case DeviceType.VivaldiExtension:
        return ["bwi-puzzle", this.i18nService.t("extension") + " - Vivaldi"];
      case DeviceType.SafariExtension:
        return ["bwi-puzzle", this.i18nService.t("extension") + " - Safari"];
      case DeviceType.WindowsDesktop:
        return ["bwi-desktop", this.i18nService.t("desktop") + " - Windows"];
      case DeviceType.MacOsDesktop:
        return ["bwi-desktop", this.i18nService.t("desktop") + " - macOS"];
      case DeviceType.LinuxDesktop:
        return ["bwi-desktop", this.i18nService.t("desktop") + " - Linux"];
      case DeviceType.ChromeBrowser:
        return ["bwi-browser", this.i18nService.t("webVault") + " - Chrome"];
      case DeviceType.FirefoxBrowser:
        return ["bwi-browser", this.i18nService.t("webVault") + " - Firefox"];
      case DeviceType.OperaBrowser:
        return ["bwi-browser", this.i18nService.t("webVault") + " - Opera"];
      case DeviceType.SafariBrowser:
        return ["bwi-browser", this.i18nService.t("webVault") + " - Safari"];
      case DeviceType.VivaldiBrowser:
        return ["bwi-browser", this.i18nService.t("webVault") + " - Vivaldi"];
      case DeviceType.EdgeBrowser:
        return ["bwi-browser", this.i18nService.t("webVault") + " - Edge"];
      case DeviceType.IEBrowser:
        return ["bwi-browser", this.i18nService.t("webVault") + " - IE"];
      case DeviceType.Server:
        return ["bwi-user-monitor", this.i18nService.t("server")];
      case DeviceType.WindowsCLI:
        return ["bwi-cli", this.i18nService.t("cli") + " - Windows"];
      case DeviceType.MacOsCLI:
        return ["bwi-cli", this.i18nService.t("cli") + " - macOS"];
      case DeviceType.LinuxCLI:
        return ["bwi-cli", this.i18nService.t("cli") + " - Linux"];
      case DeviceType.UnknownBrowser:
        return [
          "bwi-browser",
          this.i18nService.t("webVault") + " - " + this.i18nService.t("unknown"),
        ];
      default:
        return ["bwi-globe", this.i18nService.t("unknown")];
    }
  }

  private formatCipherId(ev: EventResponse, options: EventOptions) {
    const shortId = this.getShortId(ev.cipherId);
    if (ev.organizationId == null || !options.cipherInfo) {
      return "<code>" + shortId + "</code>";
    }
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      `#/organizations/${ev.organizationId}/vault?search=${shortId}&viewEvents=${ev.cipherId}&type=all`,
    );
    return a.outerHTML;
  }

  private formatGroupId(ev: EventResponse) {
    const shortId = this.getShortId(ev.groupId);
    const a = this.makeAnchor(shortId);
    a.setAttribute("href", "#/organizations/" + ev.organizationId + "/groups?search=" + shortId);
    return a.outerHTML;
  }

  private formatCollectionId(ev: EventResponse) {
    const shortId = this.getShortId(ev.collectionId);
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      `#/organizations/${ev.organizationId}/vault?collectionId=${ev.collectionId}`,
    );
    return a.outerHTML;
  }

  private formatOrgUserId(ev: EventResponse) {
    const shortId = this.getShortId(ev.organizationUserId);
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      "#/organizations/" +
        ev.organizationId +
        "/members?search=" +
        shortId +
        "&viewEvents=" +
        ev.organizationUserId,
    );
    return a.outerHTML;
  }

  private formatProviderUserId(ev: EventResponse) {
    const shortId = this.getShortId(ev.providerUserId);
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      "#/providers/" +
        ev.providerId +
        "/manage/people?search=" +
        shortId +
        "&viewEvents=" +
        ev.providerUserId,
    );
    return a.outerHTML;
  }

  private formatProviderOrganizationId(ev: EventResponse) {
    const shortId = this.getShortId(ev.providerOrganizationId);
    const a = this.makeAnchor(shortId);
    a.setAttribute("href", "#/providers/" + ev.providerId + "/clients?search=" + shortId);
    return a.outerHTML;
  }

  private formatOrganizationId(ev: EventResponse) {
    const shortId = this.getShortId(ev.organizationId);
    const a = this.makeAnchor(shortId);
    a.setAttribute("href", "#/organizations/" + ev.organizationId + "/settings/account");
    return a.outerHTML;
  }

  private formatPolicyId(ev: EventResponse) {
    const shortId = this.getShortId(ev.policyId);
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      "#/organizations/" + ev.organizationId + "/settings/policies?policyId=" + ev.policyId,
    );
    return a.outerHTML;
  }

  formatSecretId(ev: EventResponse, options: EventOptions): string {
    const shortId = this.getShortId(ev.secretId);
    if (options.disableLink) {
      return shortId;
    }
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      "#/sm/" +
        ev.organizationId +
        "/secrets?search=" +
        shortId +
        "&viewEvents=" +
        ev.secretId +
        "&type=all",
    );
    return a.outerHTML;
  }

  formatProjectId(ev: EventResponse, options: EventOptions): string {
    const shortId = this.getShortId(ev.projectId);
    if (options.disableLink) {
      return shortId;
    }
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      "#/sm/" +
        ev.organizationId +
        "/projects?search=" +
        shortId +
        "&viewEvents=" +
        ev.projectId +
        "&type=all",
    );
    return a.outerHTML;
  }

  formatServiceAccountId(ev: EventResponse, options: EventOptions): string {
    const shortId = this.getShortId(ev.grantedServiceAccountId);
    if (options.disableLink) {
      return shortId;
    }
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      "#/sm/" +
        ev.organizationId +
        "/machine-accounts?search=" +
        shortId +
        "&viewEvents=" +
        ev.grantedServiceAccountId +
        "&type=all",
    );
    return a.outerHTML;
  }

  formatUserId(ev: EventResponse, options: EventOptions): string {
    const shortId = this.getShortId(ev.userId);
    if (options.disableLink) {
      return shortId;
    }
    const a = this.makeAnchor(shortId);
    a.setAttribute("href", "#/organizations/" + ev.organizationId + "/members?search=" + shortId);
=======
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      "#/sm/" +
        ev.organizationId +
        "/secrets?search=" +
        shortId +
        "&viewEvents=" +
        ev.secretId +
        "&type=all",
    );
    return a.outerHTML;
  }

  formatProjectId(ev: EventResponse, options: EventOptions): string {
    const shortId = this.getShortId(ev.projectId);
    if (options.disableLink) {
      return shortId;
    }
    const a = this.makeAnchor(shortId);
    a.setAttribute(
      "href",
      "#/sm/" +
        ev.organizationId +
        "/projects?search=" +
        shortId +
        "&viewEvents=" +
        ev.projectId +
        "&type=all",
    );
    return a.outerHTML;
  }

  private makeAnchor(shortId: string) {
    const a = document.createElement("a");
    a.title = this.i18nService.t("view");
    a.innerHTML = "<code>" + shortId + "</code>";
    return a;
  }

  private getShortId(id: string) {
    return id?.substring(0, 8);
  }

  private toDateTimeLocalString(date: Date) {
    return (
      date.getFullYear() +
      "-" +
      this.pad(date.getMonth() + 1) +
      "-" +
      this.pad(date.getDate()) +
      "T" +
      this.pad(date.getHours()) +
      ":" +
      this.pad(date.getMinutes())
    );
  }

  private pad(num: number) {
    const norm = Math.floor(Math.abs(num));
    return (norm < 10 ? "0" : "") + norm;
  }
}

export class EventInfo {
  message: string;
  humanReadableMessage: string;
  appIcon: string;
  appName: string;
}

export class EventOptions {
  cipherInfo = true;
  disableLink = false;
}
