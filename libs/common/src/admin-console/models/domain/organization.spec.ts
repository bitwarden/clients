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
      useAutomaticUserConfirmation: false,
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
      useAccessIntelligence: false,
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

    it("should return false when ssoEnabled is false", () => {
      data.type = OrganizationUserType.Admin;
      data.useSso = true;
      data.ssoEnabled = false;
      data.ssoMemberDecryptionType = MemberDecryptionType.TrustedDeviceEncryption;

      const organization = new Organization(data);

      expect(organization.canManageDeviceApprovals).toBe(false);
    });

    it("should return false when ssoMemberDecryptionType is not TrustedDeviceEncryption", () => {
      data.type = OrganizationUserType.Admin;
      data.useSso = true;
      data.ssoEnabled = true;
      data.ssoMemberDecryptionType = MemberDecryptionType.MasterPassword;

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

  describe("canEnableAutoConfirmPolicy", () => {
    it("should return false when user cannot manage users or policies", () => {
      data.type = OrganizationUserType.User;
      data.permissions.manageUsers = false;
      data.permissions.managePolicies = false;
      data.useAutomaticUserConfirmation = true;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(false);
    });

    it("should return false when user can manage users but useAutomaticUserConfirmation is false", () => {
      data.type = OrganizationUserType.Admin;
      data.useAutomaticUserConfirmation = false;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(false);
    });

    it("should return false when user has manageUsers permission but useAutomaticUserConfirmation is false", () => {
      data.type = OrganizationUserType.User;
      data.permissions.manageUsers = true;
      data.useAutomaticUserConfirmation = false;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(false);
    });

    it("should return false when user can manage policies but useAutomaticUserConfirmation is false", () => {
      data.type = OrganizationUserType.Admin;
      data.usePolicies = true;
      data.useAutomaticUserConfirmation = false;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(false);
    });

    it("should return false when user has managePolicies permission but usePolicies is false", () => {
      data.type = OrganizationUserType.User;
      data.permissions.managePolicies = true;
      data.usePolicies = false;
      data.useAutomaticUserConfirmation = true;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(false);
    });

    it("should return true when admin has useAutomaticUserConfirmation enabled", () => {
      data.type = OrganizationUserType.Admin;
      data.useAutomaticUserConfirmation = true;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(true);
    });

    it("should return true when owner has useAutomaticUserConfirmation enabled", () => {
      data.type = OrganizationUserType.Owner;
      data.useAutomaticUserConfirmation = true;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(true);
    });

    it("should return true when user has manageUsers permission and useAutomaticUserConfirmation is enabled", () => {
      data.type = OrganizationUserType.User;
      data.permissions.manageUsers = true;
      data.useAutomaticUserConfirmation = true;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(true);
    });

    it("should return true when user has managePolicies permission, usePolicies is true, and useAutomaticUserConfirmation is enabled", () => {
      data.type = OrganizationUserType.User;
      data.permissions.managePolicies = true;
      data.usePolicies = true;
      data.useAutomaticUserConfirmation = true;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(true);
    });

    it("should return true when user has both manageUsers and managePolicies permissions with useAutomaticUserConfirmation enabled", () => {
      data.type = OrganizationUserType.User;
      data.permissions.manageUsers = true;
      data.permissions.managePolicies = true;
      data.usePolicies = true;
      data.useAutomaticUserConfirmation = true;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(true);
    });

    it("should return false when provider user has useAutomaticUserConfirmation enabled", () => {
      data.type = OrganizationUserType.Owner;
      data.isProviderUser = true;
      data.useAutomaticUserConfirmation = true;

      const organization = new Organization(data);

      expect(organization.canEnableAutoConfirmPolicy).toBe(false);
    });
  });
});
