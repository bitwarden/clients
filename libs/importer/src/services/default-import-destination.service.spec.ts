import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  CollectionType,
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
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

import { DefaultImportDestinationService } from "./default-import-destination.service";
import { ImportDestinationCollections } from "./import-destination.service.abstraction";

const userId = "user-1" as UserId;

function org(id: string, name: string, productTierType = ProductTierType.Teams): Organization {
  return Object.assign(new Organization(), { id, name, productTierType });
}

function collection(
  id: string,
  orgId: string,
  name: string,
  options: { manage?: boolean; type?: CollectionType } = {},
): CollectionView {
  const view = new CollectionView({
    id: id as CollectionId,
    organizationId: orgId as OrganizationId,
    name,
  });
  view.manage = options.manage ?? true;
  view.type = options.type ?? CollectionTypes.SharedCollection;
  return view;
}

function ownershipPolicy(orgId: string): Policy {
  return { organizationId: orgId, type: PolicyType.OrganizationDataOwnership } as Policy;
}

function cipher(type: CipherType): CipherView {
  const view = new CipherView();
  view.type = type;
  return view;
}

describe("DefaultImportDestinationService", () => {
  let organizationService: MockProxy<OrganizationService>;
  let collectionService: MockProxy<ImportDestinationCollections>;
  let policyService: MockProxy<PolicyService>;
  let restrictedItemTypesService: MockProxy<RestrictedItemTypesService>;
  let i18nService: MockProxy<I18nService>;

  let orgs: Organization[];
  let collections: CollectionView[];
  let ownershipPolicies: Policy[];
  let restricted: RestrictedCipherType[];

  const build = () => {
    organizationService.memberOrganizations$.mockReturnValue(of(orgs));
    collectionService.decryptedCollections$.mockReturnValue(of(collections));
    policyService.policiesByType$.mockReturnValue(of(ownershipPolicies));
    (restrictedItemTypesService as { restricted$: unknown }).restricted$ = of(restricted);

    return new DefaultImportDestinationService(
      organizationService,
      collectionService,
      policyService,
      mockAccountServiceWith(userId),
      restrictedItemTypesService,
      i18nService,
    );
  };

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    collectionService = mock<ImportDestinationCollections>();
    policyService = mock<PolicyService>();
    restrictedItemTypesService = mock<RestrictedItemTypesService>();
    // A null collator makes the sort helper fall back to localeCompare.
    i18nService = mock<I18nService>({ collator: null });

    orgs = [];
    collections = [];
    ownershipPolicies = [];
    restricted = [];
  });

  describe("destinations$", () => {
    it("has no location selection and only My vault when the user belongs to no org", async () => {
      const result = await firstValueFrom(build().destinations$);

      expect(result.hasStep).toBe(false);
      expect(result.options.map((o) => o.id)).toEqual(["myVault"]);
    });

    it("lists My vault first, then importable orgs alphabetically", async () => {
      orgs = [org("b", "Beta"), org("a", "Acme")];
      collections = [collection("c1", "a", "Eng"), collection("c2", "b", "Ops")];

      const result = await firstValueFrom(build().destinations$);

      expect(result.hasStep).toBe(true);
      expect(result.options.map((o) => o.id)).toEqual([
        "myVault",
        "organization:a",
        "organization:b",
      ]);
      expect(result.options[1].kind).toBe(ImportDestinationKind.Organization);
      expect(result.options[1].organizationName).toBe("Acme");
    });

    it("leaves out an org where the user manages no collection", async () => {
      orgs = [org("a", "Acme")];
      collections = [collection("c1", "a", "Eng", { manage: false })];

      const result = await firstValueFrom(build().destinations$);

      expect(result.hasStep).toBe(false);
      expect(result.options.map((o) => o.id)).toEqual(["myVault"]);
    });

    // Every default collection is managed by its owner, so it alone must not make a card or add
    // location selection.
    it("gives an org whose only managed collection is My items no card and no location selection without the policy", async () => {
      orgs = [org("a", "Acme")];
      collections = [
        collection("d1", "a", "me@example.com", { type: CollectionTypes.DefaultUserCollection }),
      ];

      const result = await firstValueFrom(build().destinations$);

      expect(result.hasStep).toBe(false);
      expect(result.options.map((o) => o.id)).toEqual(["myVault"]);
    });

    it("lists only managed shared folders and never the My items collection", async () => {
      orgs = [org("a", "Acme")];
      collections = [
        collection("c2", "a", "Zeta"),
        collection("c1", "a", "Alpha"),
        collection("c3", "a", "Read only", { manage: false }),
        collection("c4", "a", "Mine", { type: CollectionTypes.DefaultUserCollection }),
        collection("c5", "other", "Elsewhere"),
      ];

      const result = await firstValueFrom(build().destinations$);

      expect(result.options[1].sharedFolders.map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
    });

    it("carries the org's product tier for the card icon", async () => {
      orgs = [org("a", "Acme", ProductTierType.Families)];
      collections = [collection("c1", "a", "Eng")];

      const result = await firstValueFrom(build().destinations$);

      expect(result.options[1].productTierType).toBe(ProductTierType.Families);
    });

    describe("organization data ownership policy", () => {
      it("replaces My vault with My items before its org", async () => {
        orgs = [org("a", "Acme")];
        const myItems = collection("d1", "a", "me@example.com", {
          type: CollectionTypes.DefaultUserCollection,
        });
        collections = [myItems, collection("c1", "a", "Eng")];
        ownershipPolicies = [ownershipPolicy("a")];

        const result = await firstValueFrom(build().destinations$);

        expect(result.options.map((o) => o.id)).toEqual(["myItems:a", "organization:a"]);
        expect(result.options[0].kind).toBe(ImportDestinationKind.MyItems);
        expect(result.options[0].defaultCollection).toBe(myItems);
        expect(result.options[0].organizationName).toBe("Acme");
        expect(result.hasStep).toBe(true);
      });

      it("shows a My items card directly before each enforcing org", async () => {
        orgs = [org("b", "Org B"), org("a", "Acme Co")];
        collections = [
          collection("d1", "a", "x", { type: CollectionTypes.DefaultUserCollection }),
          collection("d2", "b", "y", { type: CollectionTypes.DefaultUserCollection }),
          collection("c1", "a", "Eng"),
          collection("c2", "b", "Ops"),
        ];
        ownershipPolicies = [ownershipPolicy("a"), ownershipPolicy("b")];

        const result = await firstValueFrom(build().destinations$);

        expect(result.options.map((o) => o.id)).toEqual([
          "myItems:a",
          "organization:a",
          "myItems:b",
          "organization:b",
        ]);
      });

      it("keeps My items first when only some orgs enforce the policy", async () => {
        orgs = [org("a", "Acme Co"), org("b", "Org B")];
        collections = [
          collection("c1", "a", "Eng"),
          collection("d2", "b", "y", { type: CollectionTypes.DefaultUserCollection }),
          collection("c2", "b", "Ops"),
        ];
        ownershipPolicies = [ownershipPolicy("b")];

        const result = await firstValueFrom(build().destinations$);

        expect(result.options.map((o) => o.id)).toEqual([
          "myItems:b",
          "organization:b",
          "organization:a",
        ]);
      });

      it("offers only My items for an org whose only managed collection is My items", async () => {
        orgs = [org("a", "Acme")];
        collections = [
          collection("d1", "a", "me@example.com", { type: CollectionTypes.DefaultUserCollection }),
        ];
        ownershipPolicies = [ownershipPolicy("a")];

        const result = await firstValueFrom(build().destinations$);

        expect(result.options.map((o) => o.id)).toEqual(["myItems:a"]);
        expect(result.hasStep).toBe(true);
      });

      it("offers nothing, and no location selection, when the policy applies and no org is importable", async () => {
        orgs = [org("a", "Acme")];
        collections = [];
        ownershipPolicies = [ownershipPolicy("a")];

        const result = await firstValueFrom(build().destinations$);

        expect(result.options).toEqual([]);
        expect(result.hasStep).toBe(false);
      });
    });

    describe("item type restrictions", () => {
      beforeEach(() => {
        orgs = [org("a", "Acme"), org("b", "Beta")];
        collections = [collection("c1", "a", "Eng"), collection("c2", "b", "Ops")];
        // Acme removes cards and passports; Beta allows both.
        restricted = [
          { cipherType: CipherType.Passport, allowViewOrgIds: ["b"] },
          { cipherType: CipherType.Card, allowViewOrgIds: ["b"] },
        ];
      });

      // The import drops a restricted type whichever destination is picked, so a card for an org
      // that allows the type must still warn.
      it("names the types each restricting org removes, in cipher type order, on every card", async () => {
        const result = await firstValueFrom(build().destinations$);

        const acme = result.options.find((o) => o.id === "organization:a")!;
        const beta = result.options.find((o) => o.id === "organization:b")!;
        const expected = [
          { organizationName: "Acme", types: [CipherType.Card, CipherType.Passport] },
        ];
        expect(acme.restrictions).toEqual(expected);
        expect(beta.restrictions).toEqual(expected);
      });

      it("warns on a My items card too", async () => {
        collections = [
          ...collections,
          collection("my-a", "a", "me@example.com", {
            type: CollectionTypes.DefaultUserCollection,
          }),
        ];
        ownershipPolicies = [ownershipPolicy("a")];

        const result = await firstValueFrom(build().destinations$);

        const card = result.options.find((o) => o.id === "myItems:a")!;
        expect(card.restrictions).toEqual([
          { organizationName: "Acme", types: [CipherType.Card, CipherType.Passport] },
        ]);
      });

      it("lists every restricting org on My vault", async () => {
        const result = await firstValueFrom(build().destinations$);

        expect(result.options[0].id).toBe("myVault");
        expect(result.options[0].restrictions).toEqual([
          { organizationName: "Acme", types: [CipherType.Card, CipherType.Passport] },
        ]);
      });
    });
  });

  describe("importableCount", () => {
    it("excludes the types a policy removes", async () => {
      restricted = [{ cipherType: CipherType.Card, allowViewOrgIds: [] }];
      const result = new ImportResult();
      result.ciphers = [
        cipher(CipherType.Login),
        cipher(CipherType.Card),
        cipher(CipherType.SecureNote),
      ];

      expect(await build().importableCount(result)).toBe(2);
    });
  });

  describe("hasUnassignedItems", () => {
    it("is true when fewer items have a collection than will import", async () => {
      const result = new ImportResult();
      result.ciphers = [cipher(CipherType.Login), cipher(CipherType.Login)];
      result.collectionRelationships = [[0, 0]];

      expect(await build().hasUnassignedItems(result)).toBe(true);
    });

    it("is false when every item has a collection", async () => {
      const result = new ImportResult();
      result.ciphers = [cipher(CipherType.Login), cipher(CipherType.Login)];
      result.collectionRelationships = [
        [0, 0],
        [1, 0],
      ];

      expect(await build().hasUnassignedItems(result)).toBe(false);
    });

    it("compares against the count left after policy-removed types", async () => {
      restricted = [{ cipherType: CipherType.Card, allowViewOrgIds: [] }];
      const result = new ImportResult();
      result.ciphers = [cipher(CipherType.Login), cipher(CipherType.Card)];
      result.collectionRelationships = [[0, 0]];

      expect(await build().hasUnassignedItems(result)).toBe(false);
    });
  });
});
