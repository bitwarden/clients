import { MemberDecryptionType } from "../../../auth/enums/sso";
import { ProductTierType } from "../../../billing/enums";
import { OrganizationUserStatusType, OrganizationUserType } from "../../enums";
import { PermissionsApi } from "../api/permissions.api";
import { OrganizationData } from "../data/organization.data";

import { Organization } from "./organization";

describe("Organization", () => {
  let data: OrganizationData;

  beforeEach(() => {
    data = {
      id: "test-org-id",
      name: "Test Organization",
      status: OrganizationUserStatusType.Confirmed,
      type: OrganizationUserType.Admin,
      enabled: true,
      usePolicies: true,
      useGroups: true,
      useDirectory: true,
      useEvents: true,
      useTotp: true,
      use2fa: true,
      useApi: true,
      useSso: true,
      useOrganizationDomains: true,
      useKeyConnector: false,
      useScim: true,
      useCustomPermissions: false,
      useResetPassword: true,
      useSecretsManager: true,
      usePasswordManager: true,
      useActivateAutofillPolicy: false,
      selfHost: false,
      usersGetPremium: false,
      seats: 10,
      maxCollections: 100,
      maxStorageGb: 1,
      ssoBound: false,
      identifier: "test-identifier",
      permissions: new PermissionsApi({
        accessEventLogs: false,
        accessImportExport: false,
        accessReports: false,
        createNewCollections: false,
        editAnyCollection: false,
        deleteAnyCollection: false,
        editAssignedCollections: false,
        deleteAssignedCollections: false,
        manageCiphers: false,
        manageGroups: false,
        managePolicies: false,
        manageSso: false,
        manageUsers: false,
        manageResetPassword: false,
        manageScim: false,
      }),
      resetPasswordEnrolled: false,
      userId: "user-id",
      organizationUserId: "org-user-id",
      hasPublicAndPrivateKeys: false,
      providerId: null,
      providerName: null,
      providerType: null,
      isProviderUser: false,
      isMember: true,
      familySponsorshipFriendlyName: null,
      familySponsorshipAvailable: false,
      productTierType: ProductTierType.Enterprise,
      keyConnectorEnabled: false,
      keyConnectorUrl: null,
      familySponsorshipLastSyncDate: null,
      familySponsorshipValidUntil: null,
      familySponsorshipToDelete: null,
      accessSecretsManager: false,
      limitCollectionCreation: false,
      limitCollectionDeletion: false,
      limitItemDeletion: false,
      allowAdminAccessToAllCollectionItems: true,
      userIsManagedByOrganization: false,
      useRiskInsights: false,
      useAdminSponsoredFamilies: false,
      isAdminInitiated: false,
      ssoEnabled: false,
      ssoMemberDecryptionType: MemberDecryptionType.MasterPassword,
    } as OrganizationData;
  });

  describe("canManageDeviceApprovals", () => {
    it("should return false when user is not admin and has no manageResetPassword permission", () => {
      data.type = OrganizationUserType.User;
      data.useSso = true;
      data.ssoEnabled = true;
      data.ssoMemberDecryptionType = MemberDecryptionType.TrustedDeviceEncryption;
      data.permissions.manageResetPassword = false;

      const organization = new Organization(data);

      expect(organization.canManageDeviceApprovals).toBe(false);
    });

    it("should return false when useSso is false", () => {
      data.type = OrganizationUserType.Admin;
      data.useSso = false;
      data.ssoEnabled = true;
      data.ssoMemberDecryptionType = MemberDecryptionType.TrustedDeviceEncryption;

      const organization = new Organization(data);

      expect(organization.canManageDeviceApprovals).toBe(false);
    });

    it("should return true when admin has all required SSO settings enabled", () => {
      data.type = OrganizationUserType.Admin;
      data.useSso = true;
      data.ssoEnabled = true;
      data.ssoMemberDecryptionType = MemberDecryptionType.TrustedDeviceEncryption;

      const organization = new Organization(data);

      expect(organization.canManageDeviceApprovals).toBe(true);
    });

    it("should return true when owner has all required SSO settings enabled", () => {
      data.type = OrganizationUserType.Owner;
      data.useSso = true;
      data.ssoEnabled = true;
      data.ssoMemberDecryptionType = MemberDecryptionType.TrustedDeviceEncryption;

      const organization = new Organization(data);

      expect(organization.canManageDeviceApprovals).toBe(true);
    });

    it("should return true when user has manageResetPassword permission and all SSO settings enabled", () => {
      data.type = OrganizationUserType.User;
      data.useSso = true;
      data.ssoEnabled = true;
      data.ssoMemberDecryptionType = MemberDecryptionType.TrustedDeviceEncryption;
      data.permissions.manageResetPassword = true;

      const organization = new Organization(data);

      expect(organization.canManageDeviceApprovals).toBe(true);
    });

    it("should return true when provider user has all required SSO settings enabled", () => {
      data.type = OrganizationUserType.User;
      data.isProviderUser = true;
      data.useSso = true;
      data.ssoEnabled = true;
      data.ssoMemberDecryptionType = MemberDecryptionType.TrustedDeviceEncryption;

      const organization = new Organization(data);

      expect(organization.canManageDeviceApprovals).toBe(true);
    });
  });
});
