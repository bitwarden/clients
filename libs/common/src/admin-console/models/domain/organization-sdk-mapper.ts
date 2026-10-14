import {
  MemberDecryptionType as SdkMemberDecryptionType,
  OrganizationId as SdkOrganizationId,
  OrganizationUserId as SdkOrganizationUserId,
  OrganizationUserStatusType as SdkOrganizationUserStatusType,
  OrganizationUserType as SdkOrganizationUserType,
  ProductTierType as SdkProductTierType,
  ProfileOrganization as SdkProfileOrganization,
  ProviderType as SdkProviderType,
  UserId as SdkUserId,
} from "@bitwarden/sdk-internal";

import { asUuid, uuidAsString } from "../../../platform/abstractions/sdk/sdk.service";
import { SdkRecordMapper } from "../../../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../../../platform/state";
import { ORGANIZATIONS } from "../../services/organization/organization.state";
import { OrganizationData } from "../data/organization.data";

/**
 * Bridges the client's `ORGANIZATIONS` state to the SDK's organization repository so the SDK can
 * read/write organizations from the same state legacy sync already populates.
 *
 * The client and SDK enums share the same numeric values, so they are cast rather than mapped.
 */
export class OrganizationRecordMapper implements SdkRecordMapper<
  OrganizationData,
  SdkProfileOrganization
> {
  userKeyDefinition(): UserKeyDefinition<Record<string, OrganizationData>> {
    return ORGANIZATIONS;
  }

  toSdk(value: OrganizationData): SdkProfileOrganization {
    return {
      details: {
        id: asUuid<SdkOrganizationId>(value.id),
        name: value.name,
        enabled: value.enabled,
        hasPublicAndPrivateKeys: value.hasPublicAndPrivateKeys,
      },
      plan: {
        productTierType: value.productTierType as number as SdkProductTierType,
        seats: value.seats ?? undefined,
        maxCollections: value.maxCollections ?? undefined,
        maxStorageGb: value.maxStorageGb ?? undefined,
        selfHost: value.selfHost,
        usersGetPremium: value.usersGetPremium,
        usePolicies: value.usePolicies,
        useGroups: value.useGroups,
        useDirectory: value.useDirectory,
        useEvents: value.useEvents,
        useTotp: value.useTotp,
        use2fa: value.use2fa,
        useApi: value.useApi,
        useSso: value.useSso,
        useOrganizationDomains: value.useOrganizationDomains,
        useKeyConnector: value.useKeyConnector,
        useScim: value.useScim,
        useCustomPermissions: value.useCustomPermissions,
        useResetPassword: value.useResetPassword,
        useSecretsManager: value.useSecretsManager,
        usePasswordManager: value.usePasswordManager,
        usePam: value.usePam,
        useActivateAutofillPolicy: value.useActivateAutofillPolicy,
        useAutomaticUserConfirmation: value.useAutomaticUserConfirmation,
        useAccessIntelligence: value.useAccessIntelligence,
        useAdminSponsoredFamilies: value.useAdminSponsoredFamilies,
        useDisableSMAdsForUsers: value.useDisableSMAdsForUsers ?? false,
        usePhishingBlocker: value.usePhishingBlocker,
        useMyItems: value.useMyItems,
        useInviteLinks: value.useInviteLinks,
      },
      membership: {
        status: value.status as number as SdkOrganizationUserStatusType,
        type: value.type as number as SdkOrganizationUserType,
        permissions: {
          accessEventLogs: value.permissions?.accessEventLogs,
          accessImportExport: value.permissions?.accessImportExport,
          accessReports: value.permissions?.accessReports,
          createNewCollections: value.permissions?.createNewCollections,
          editAnyCollection: value.permissions?.editAnyCollection,
          deleteAnyCollection: value.permissions?.deleteAnyCollection,
          manageGroups: value.permissions?.manageGroups,
          manageSso: value.permissions?.manageSso,
          managePolicies: value.permissions?.managePolicies,
          manageUsers: value.permissions?.manageUsers,
          manageResetPassword: value.permissions?.manageResetPassword,
          manageScim: value.permissions?.manageScim,
        },
        userId: asUuid<SdkUserId>(value.userId),
        organizationUserId:
          value.organizationUserId != null
            ? asUuid<SdkOrganizationUserId>(value.organizationUserId)
            : undefined,
        isMember: value.isMember,
        isProviderUser: value.isProviderUser,
        resetPasswordEnrolled: value.resetPasswordEnrolled,
        ssoBound: value.ssoBound,
        userIsClaimedByOrganization: value.userIsClaimedByOrganization,
        accessSecretsManager: value.accessSecretsManager,
      },
      collectionManagement: {
        limitCollectionCreation: value.limitCollectionCreation,
        limitCollectionDeletion: value.limitCollectionDeletion,
        limitItemDeletion: value.limitItemDeletion,
        allowAdminAccessToAllCollectionItems: value.allowAdminAccessToAllCollectionItems,
      },
      provider:
        value.providerId != null && value.providerType != null
          ? {
              id: asUuid(value.providerId),
              type: value.providerType as number as SdkProviderType,
              name: value.providerName ?? undefined,
            }
          : undefined,
      sso: {
        enabled: value.ssoEnabled,
        identifier: value.identifier ?? undefined,
        memberDecryptionType:
          value.ssoMemberDecryptionType != null
            ? (value.ssoMemberDecryptionType as number as SdkMemberDecryptionType)
            : undefined,
        keyConnectorEnabled: value.keyConnectorEnabled,
        keyConnectorUrl: value.keyConnectorUrl ?? undefined,
      },
      familySponsorship: {
        available: value.familySponsorshipAvailable,
        friendlyName: value.familySponsorshipFriendlyName ?? undefined,
        validUntil: value.familySponsorshipValidUntil?.toISOString(),
        lastSyncDate: value.familySponsorshipLastSyncDate?.toISOString(),
        toDelete: value.familySponsorshipToDelete ?? undefined,
        isAdminInitiated: value.isAdminInitiated,
      },
    };
  }

  fromSdk(value: SdkProfileOrganization): OrganizationData {
    const { details, plan, membership, collectionManagement, provider, sso, familySponsorship } =
      value;

    return OrganizationData.fromJSON({
      id: uuidAsString(details.id),
      name: details.name,
      enabled: details.enabled,
      hasPublicAndPrivateKeys: details.hasPublicAndPrivateKeys,

      productTierType: plan.productTierType as number,
      seats: plan.seats ?? null,
      maxCollections: plan.maxCollections ?? null,
      maxStorageGb: plan.maxStorageGb ?? undefined,
      selfHost: plan.selfHost,
      usersGetPremium: plan.usersGetPremium,
      usePolicies: plan.usePolicies,
      useGroups: plan.useGroups,
      useDirectory: plan.useDirectory,
      useEvents: plan.useEvents,
      useTotp: plan.useTotp,
      use2fa: plan.use2fa,
      useApi: plan.useApi,
      useSso: plan.useSso,
      useOrganizationDomains: plan.useOrganizationDomains,
      useKeyConnector: plan.useKeyConnector,
      useScim: plan.useScim,
      useCustomPermissions: plan.useCustomPermissions,
      useResetPassword: plan.useResetPassword,
      useSecretsManager: plan.useSecretsManager,
      usePasswordManager: plan.usePasswordManager,
      usePam: plan.usePam,
      useActivateAutofillPolicy: plan.useActivateAutofillPolicy,
      useAutomaticUserConfirmation: plan.useAutomaticUserConfirmation,
      useAccessIntelligence: plan.useAccessIntelligence,
      useAdminSponsoredFamilies: plan.useAdminSponsoredFamilies,
      useDisableSMAdsForUsers: plan.useDisableSMAdsForUsers,
      usePhishingBlocker: plan.usePhishingBlocker,
      useMyItems: plan.useMyItems,
      useInviteLinks: plan.useInviteLinks,

      status: membership.status as number,
      type: membership.type as number,
      permissions: {
        accessEventLogs: membership.permissions.accessEventLogs ?? false,
        accessImportExport: membership.permissions.accessImportExport ?? false,
        accessReports: membership.permissions.accessReports ?? false,
        createNewCollections: membership.permissions.createNewCollections ?? false,
        editAnyCollection: membership.permissions.editAnyCollection ?? false,
        deleteAnyCollection: membership.permissions.deleteAnyCollection ?? false,
        manageCiphers: false,
        manageGroups: membership.permissions.manageGroups ?? false,
        manageSso: membership.permissions.manageSso ?? false,
        managePolicies: membership.permissions.managePolicies ?? false,
        manageUsers: membership.permissions.manageUsers ?? false,
        manageResetPassword: membership.permissions.manageResetPassword ?? false,
        manageScim: membership.permissions.manageScim ?? false,
      },
      userId: uuidAsString(membership.userId),
      organizationUserId:
        membership.organizationUserId != null ? uuidAsString(membership.organizationUserId) : null,
      isMember: membership.isMember,
      isProviderUser: membership.isProviderUser,
      resetPasswordEnrolled: membership.resetPasswordEnrolled,
      ssoBound: membership.ssoBound,
      userIsClaimedByOrganization: membership.userIsClaimedByOrganization,
      accessSecretsManager: membership.accessSecretsManager,

      limitCollectionCreation: collectionManagement.limitCollectionCreation,
      limitCollectionDeletion: collectionManagement.limitCollectionDeletion,
      limitItemDeletion: collectionManagement.limitItemDeletion,
      allowAdminAccessToAllCollectionItems:
        collectionManagement.allowAdminAccessToAllCollectionItems,

      providerId: provider != null ? uuidAsString(provider.id) : null,
      providerName: provider?.name ?? null,
      providerType: provider != null ? (provider.type as number) : undefined,

      ssoEnabled: sso.enabled,
      identifier: sso.identifier ?? null,
      ssoMemberDecryptionType:
        sso.memberDecryptionType != null ? (sso.memberDecryptionType as number) : undefined,
      keyConnectorEnabled: sso.keyConnectorEnabled,
      keyConnectorUrl: sso.keyConnectorUrl ?? null,

      familySponsorshipAvailable: familySponsorship.available,
      familySponsorshipFriendlyName: familySponsorship.friendlyName ?? null,
      familySponsorshipValidUntil: familySponsorship.validUntil,
      familySponsorshipLastSyncDate: familySponsorship.lastSyncDate,
      familySponsorshipToDelete: familySponsorship.toDelete,
      isAdminInitiated: familySponsorship.isAdminInitiated,
    });
  }
}
