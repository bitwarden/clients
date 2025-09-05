import { ProductTierType } from "../../../billing/enums/product-tier-type.enum";
import { OrganizationUserStatusType, OrganizationUserType } from "../../enums";
import { ORGANIZATIONS } from "../../services/organization/organization.state";

import { OrganizationData } from "./organization.data";

describe("ORGANIZATIONS state", () => {
  const sut = ORGANIZATIONS;

  it("should deserialize JSON string to proper object", async () => {
    const expectedResult: Record<string, OrganizationData> = {
      "1": {
        id: "id",
        name: "name",
        status: OrganizationUserStatusType.Invited,
        type: OrganizationUserType.Owner,
        enabled: false,
        usePolicies: false,
        useGroups: false,
        useDirectory: false,
        useEvents: false,
        useTotp: false,
        use2fa: false,
        useApi: false,
        useSso: false,
        useKeyConnector: false,
        useScim: false,
        useCustomPermissions: false,
        useResetPassword: false,
        useSecretsManager: false,
        usePasswordManager: false,
        useActivateAutofillPolicy: false,
        selfHost: false,
        usersGetPremium: false,
        seats: 0,
        maxCollections: 0,
        ssoBound: false,
        identifier: "identifier",
        permissions: undefined,
        resetPasswordEnrolled: false,
        userId: "userId",
        organizationUserId: "organizationUserId",
        hasPublicAndPrivateKeys: false,
        providerId: "providerId",
        providerName: "providerName",
        isProviderUser: false,
        isMember: false,
        familySponsorshipFriendlyName: "fsfn",
        familySponsorshipAvailable: false,
        productTierType: ProductTierType.Free,
        keyConnectorEnabled: false,
        keyConnectorUrl: "kcu",
        accessSecretsManager: false,
        limitCollectionCreation: false,
        limitCollectionDeletion: false,
        limitItemDeletion: false,
        allowAdminAccessToAllCollectionItems: false,
        familySponsorshipLastSyncDate: new Date(),
        userIsManagedByOrganization: false,
        useRiskInsights: false,
        useOrganizationDomains: false,
        useAdminSponsoredFamilies: false,
        isAdminInitiated: false,
        ssoEnabled: false,
        ssoMemberDecryptionType: undefined,
      },
    };
    const result = sut.deserializer(JSON.parse(JSON.stringify(expectedResult)));
    expect(result).toEqual(expectedResult);
  });
});
