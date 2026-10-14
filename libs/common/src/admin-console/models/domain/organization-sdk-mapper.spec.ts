import { MemberDecryptionType } from "../../../auth/enums/sso";
import { ProductTierType } from "../../../billing/enums";
import { OrganizationUserStatusType, OrganizationUserType, ProviderType } from "../../enums";
import { PermissionsApi } from "../api/permissions.api";
import { OrganizationData } from "../data/organization.data";

import { OrganizationRecordMapper } from "./organization-sdk-mapper";

describe("OrganizationRecordMapper", () => {
  const mapper = new OrganizationRecordMapper();

  let data: OrganizationData;

  beforeEach(() => {
    data = OrganizationData.fromJSON({
      id: "1f0b6b4a-8c1d-4c5e-9f3a-2d7e8b9c0a12",
      name: "Test Organization",
      status: OrganizationUserStatusType.Confirmed,
      type: OrganizationUserType.Custom,
      enabled: true,
      usePolicies: true,
      useGroups: true,
      useDirectory: false,
      useEvents: true,
      useTotp: true,
      use2fa: true,
      useApi: false,
      useSso: true,
      useOrganizationDomains: true,
      useKeyConnector: true,
      useScim: false,
      useCustomPermissions: true,
      useResetPassword: true,
      useSecretsManager: false,
      usePasswordManager: true,
      usePam: false,
      useActivateAutofillPolicy: true,
      useAutomaticUserConfirmation: false,
      selfHost: false,
      usersGetPremium: true,
      seats: 10,
      maxCollections: 100,
      maxStorageGb: 1,
      ssoBound: true,
      identifier: "test-identifier",
      permissions: {
        accessEventLogs: true,
        accessImportExport: false,
        accessReports: true,
        createNewCollections: false,
        editAnyCollection: true,
        deleteAnyCollection: false,
        manageCiphers: false,
        manageGroups: true,
        manageSso: false,
        managePolicies: true,
        manageUsers: false,
        manageResetPassword: true,
        manageScim: false,
      } as PermissionsApi,
      resetPasswordEnrolled: true,
      userId: "6e6c3bb7-2c38-4e4b-8d3e-5a6f3b0b9a11",
      organizationUserId: "9a2c4e6f-1b3d-4f5a-8c7e-0d2f4a6b8c13",
      hasPublicAndPrivateKeys: true,
      providerId: "3c5e7a9b-2d4f-4a6c-9e8b-1f3a5c7e9d14",
      providerName: "Test Provider",
      providerType: ProviderType.Msp,
      isProviderUser: false,
      isMember: true,
      familySponsorshipFriendlyName: "sponsored@example.com",
      familySponsorshipAvailable: true,
      productTierType: ProductTierType.Enterprise,
      keyConnectorEnabled: true,
      keyConnectorUrl: "https://key-connector.example.com",
      familySponsorshipLastSyncDate: "2026-01-01T00:00:00.000Z",
      familySponsorshipValidUntil: "2027-01-01T00:00:00.000Z",
      familySponsorshipToDelete: false,
      accessSecretsManager: false,
      limitCollectionCreation: true,
      limitCollectionDeletion: true,
      limitItemDeletion: false,
      allowAdminAccessToAllCollectionItems: true,
      userIsClaimedByOrganization: true,
      useAccessIntelligence: false,
      useAdminSponsoredFamilies: true,
      useDisableSMAdsForUsers: false,
      isAdminInitiated: false,
      ssoEnabled: true,
      ssoMemberDecryptionType: MemberDecryptionType.KeyConnector,
      usePhishingBlocker: true,
      useMyItems: false,
      useInviteLinks: true,
    });
  });

  it("maps OrganizationData to an SDK organization", () => {
    const result = mapper.toSdk(data);

    expect(result.details).toEqual({
      id: data.id,
      name: data.name,
      enabled: true,
      hasPublicAndPrivateKeys: true,
    });
    expect(result.membership.organizationUserId).toEqual(data.organizationUserId);
    expect(result.provider).toEqual({
      id: data.providerId,
      type: ProviderType.Msp,
      name: "Test Provider",
    });
    expect(result.sso).toEqual({
      enabled: true,
      identifier: "test-identifier",
      memberDecryptionType: MemberDecryptionType.KeyConnector,
      keyConnectorEnabled: true,
      keyConnectorUrl: "https://key-connector.example.com",
    });
    expect(result.familySponsorship.validUntil).toEqual("2027-01-01T00:00:00.000Z");
    expect(result.familySponsorship.lastSyncDate).toEqual("2026-01-01T00:00:00.000Z");
  });

  it("round-trips through the SDK representation", () => {
    expect(mapper.fromSdk(mapper.toSdk(data))).toEqual(data);
  });

  it("round-trips an organization with no provider, SSO config or sponsorship", () => {
    data.providerId = null;
    data.providerName = null;
    data.providerType = undefined;
    data.organizationUserId = null;
    data.identifier = null;
    data.ssoMemberDecryptionType = undefined;
    data.keyConnectorUrl = null;
    data.familySponsorshipFriendlyName = null;
    data.familySponsorshipLastSyncDate = undefined;
    data.familySponsorshipValidUntil = undefined;
    data.familySponsorshipToDelete = undefined;
    data.seats = null;
    data.maxCollections = null;
    data.maxStorageGb = undefined;

    const sdk = mapper.toSdk(data);

    expect(sdk.provider).toBeUndefined();
    expect(sdk.membership.organizationUserId).toBeUndefined();
    expect(sdk.sso.memberDecryptionType).toBeUndefined();
    expect(mapper.fromSdk(sdk)).toEqual(data);
  });
});
