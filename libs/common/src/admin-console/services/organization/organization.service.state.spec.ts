import { ProductType } from "../../../enums";
import { OrganizationUserStatusType, OrganizationUserType } from "../../enums";
import { OrganizationData } from "../../models/data/organization.data";

import { ORGANIZATIONS } from "./organization.service.state";

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
        hasPublicAndPrivateKeys: false,
        providerId: "providerId",
        providerName: "providerName",
        isProviderUser: false,
        isMember: false,
        familySponsorshipFriendlyName: "fsfn",
        familySponsorshipAvailable: false,
        planProductType: ProductType.Free,
        keyConnectorEnabled: false,
        keyConnectorUrl: "kcu",
        accessSecretsManager: false,
        limitCollectionCreationDeletion: false,
        allowAdminAccessToAllCollectionItems: false,
        flexibleCollections: false,
      },
    };
    const result = sut.deserializer(JSON.parse(JSON.stringify(expectedResult)));
    expect(result).toEqual(expectedResult);
  });
});
