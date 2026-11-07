import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserType, PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  CollectionType,
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";

import { ImportDestinationKind } from "../models/import-destination";
import { ImportResult } from "../models/import-result";

import { ImportCollectionServiceAbstraction } from "./import-collection.service.abstraction";
import { ImportDestinationCollections } from "./import-destination.service.abstraction";
import { OrganizationImportDestinationService } from "./organization-import-destination.service";

const userId = "user-1" as UserId;
const orgId = "org-1" as OrganizationId;

function org(
  id: string,
  name: string,
  options: {
    type?: OrganizationUserType;
    accessImportExport?: boolean;
    providerOnly?: boolean;
  } = {},
): Organization {
  return Object.assign(new Organization(), {
    id,
    name,
    productTierType: ProductTierType.Enterprise,
    type: options.type ?? OrganizationUserType.Admin,
    permissions: { accessImportExport: options.accessImportExport ?? false },
    isProviderUser: options.providerOnly ?? false,
    isMember: !(options.providerOnly ?? false),
  });
}

function collection(id: string, name: string, type: CollectionType = 0): CollectionView {
  const view = new CollectionView({
    id: id as CollectionId,
    organizationId: orgId,
    name,
  });
  view.manage = false;
  view.type = type;
  return view;
}

describe("OrganizationImportDestinationService", () => {
  let organizationService: MockProxy<OrganizationService>;
  let collectionService: MockProxy<ImportCollectionServiceAbstraction>;
  let restrictedItemTypesService: MockProxy<RestrictedItemTypesService>;
  let i18nService: MockProxy<I18nService>;
  let policyService: MockProxy<PolicyService>;
  let userCollections: MockProxy<ImportDestinationCollections>;

  let orgs: Organization[];
  let collections: CollectionView[];
  let ownCollections: CollectionView[];
  let ownershipPolicyApplies: boolean;
  let restricted: RestrictedCipherType[];

  const build = () => {
    organizationService.organizations$.mockReturnValue(of(orgs));
    collectionService.getAllAdminCollections.mockResolvedValue(collections);
    policyService.policyAppliesToUser$.mockReturnValue(of(ownershipPolicyApplies));
    userCollections.decryptedCollections$.mockReturnValue(of(ownCollections));
    (restrictedItemTypesService as { restricted$: unknown }).restricted$ = of(restricted);

    return new OrganizationImportDestinationService(
      orgId,
      organizationService,
      collectionService,
      mockAccountServiceWith(userId),
      restrictedItemTypesService,
      i18nService,
      policyService,
      userCollections,
    );
  };

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    collectionService = mock<ImportCollectionServiceAbstraction>();
    restrictedItemTypesService = mock<RestrictedItemTypesService>();
    i18nService = mock<I18nService>({ collator: null });
    policyService = mock<PolicyService>();
    userCollections = mock<ImportDestinationCollections>();

    orgs = [org(orgId, "Acme")];
    collections = [];
    ownCollections = [];
    ownershipPolicyApplies = false;
    restricted = [];
  });

  describe("under the data ownership policy", () => {
    const myItems = () =>
      collection("mine", "me@example.com", CollectionTypes.DefaultUserCollection);

    it("starts with the user's own My items collection picked, from the admin list", async () => {
      ownershipPolicyApplies = true;
      const own = myItems();
      const adminCopy = myItems();
      collections = [collection("c1", "Alpha"), adminCopy];
      ownCollections = [own];

      const result = await firstValueFrom(build().destinations$);

      expect(result.options[0].defaultSharedFolder).toBe(adminCopy);
      expect(result.options[0].sharedFolders).toContain(adminCopy);
    });

    it("asks the policy for the signed-in user", async () => {
      await firstValueFrom(build().destinations$);

      expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.OrganizationDataOwnership,
        userId,
      );
    });

    it("picks nothing when the policy does not apply", async () => {
      collections = [myItems()];
      ownCollections = [myItems()];

      const result = await firstValueFrom(build().destinations$);

      expect(result.options[0].defaultSharedFolder).toBeUndefined();
    });

    it("picks nothing when the user's My items collection is not in the admin list", async () => {
      ownershipPolicyApplies = true;
      collections = [collection("c1", "Alpha")];
      ownCollections = [myItems()];

      const result = await firstValueFrom(build().destinations$);

      expect(result.options[0].defaultSharedFolder).toBeUndefined();
    });

    it("never picks another member's My items collection", async () => {
      ownershipPolicyApplies = true;
      collections = [
        collection("theirs", "them@example.com", CollectionTypes.DefaultUserCollection),
      ];
      ownCollections = [];

      const result = await firstValueFrom(build().destinations$);

      expect(result.options[0].defaultSharedFolder).toBeUndefined();
    });

    it("ignores the user's My items collection in another organization", async () => {
      ownershipPolicyApplies = true;
      const elsewhere = myItems();
      elsewhere.organizationId = "other-org" as OrganizationId;
      collections = [myItems()];
      ownCollections = [elsewhere];

      const result = await firstValueFrom(build().destinations$);

      expect(result.options[0].defaultSharedFolder).toBeUndefined();
    });
  });

  it("offers only the route's organization, and always a location step", async () => {
    orgs = [org("other", "Other"), org(orgId, "Acme")];

    const result = await firstValueFrom(build().destinations$);

    expect(result.hasStep).toBe(true);
    expect(result.options.map((o) => o.id)).toEqual([`organization:${orgId}`]);
    expect(result.options[0].kind).toBe(ImportDestinationKind.Organization);
    expect(result.options[0].organizationName).toBe("Acme");
  });

  it("offers the organization to a provider user who is not a member, who may import with no folder", async () => {
    orgs = [
      org(orgId, "Acme", {
        type: OrganizationUserType.User,
        providerOnly: true,
      }),
    ];

    const result = await firstValueFrom(build().destinations$);

    expect(result.options.map((o) => o.id)).toEqual([`organization:${orgId}`]);
    expect(result.options[0].allowsUnassignedItems).toBe(true);
    expect(organizationService.memberOrganizations$).not.toHaveBeenCalled();
  });

  it("keeps the location step, with nothing to import into, when the organization is not found", async () => {
    orgs = [org("other", "Other")];

    const result = await firstValueFrom(build().destinations$);

    expect(result).toEqual({ options: [], hasStep: true });
  });

  it("asks the admin collections of the route's organization for the signed-in user", async () => {
    await firstValueFrom(build().destinations$);

    expect(collectionService.getAllAdminCollections).toHaveBeenCalledWith(orgId, userId);
  });

  it("lists every admin collection by name, default ones included, whether or not the user manages it", async () => {
    collections = [
      collection("c2", "Zeta"),
      collection("c1", "Alpha"),
      collection("c3", "Mine", CollectionTypes.DefaultUserCollection),
    ];

    const result = await firstValueFrom(build().destinations$);

    expect(result.options[0].sharedFolders.map((c) => c.name)).toEqual(["Alpha", "Mine", "Zeta"]);
  });

  it("marks the organization as the only location, as the admin console shows it", async () => {
    const result = await firstValueFrom(build().destinations$);

    expect(result.options[0].lockedToOrganization).toBe(true);
  });

  it("allows importing with no folder for an owner or admin", async () => {
    for (const type of [OrganizationUserType.Owner, OrganizationUserType.Admin]) {
      orgs = [org(orgId, "Acme", { type })];

      const result = await firstValueFrom(build().destinations$);

      expect(result.options[0].allowsUnassignedItems).toBe(true);
    }
  });

  it("allows it for a custom user with import/export access, and not for one without", async () => {
    orgs = [org(orgId, "Acme", { type: OrganizationUserType.Custom, accessImportExport: true })];
    expect((await firstValueFrom(build().destinations$)).options[0].allowsUnassignedItems).toBe(
      true,
    );

    orgs = [org(orgId, "Acme", { type: OrganizationUserType.Custom })];
    expect((await firstValueFrom(build().destinations$)).options[0].allowsUnassignedItems).toBe(
      false,
    );
  });

  it("names the types this org removes, and drops only those", async () => {
    restricted = [{ cipherType: CipherType.Card, allowViewOrgIds: [] }];

    const result = await firstValueFrom(build().destinations$);

    expect(result.options[0].restrictions).toEqual([
      { organizationName: "Acme", types: [CipherType.Card] },
    ]);
    expect(result.options[0].removedTypes).toEqual([CipherType.Card]);
  });

  describe("hasUnassignedItems", () => {
    const resultWith = (items: number, assigned: number) => {
      const result = new ImportResult();
      result.ciphers = Array.from({ length: items }, () =>
        Object.assign(new CipherView(), { type: CipherType.Login }),
      );
      result.collectionRelationships = Array.from({ length: assigned }, (_, i) => [i, 0]);
      return result;
    };

    it("is true when fewer items have a collection than will import", async () => {
      expect(await build().hasUnassignedItems(resultWith(3, 2), orgId)).toBe(true);
    });

    it("is false when every item has a collection", async () => {
      expect(await build().hasUnassignedItems(resultWith(3, 3), orgId)).toBe(false);
    });
  });
});
