import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { getAvatarDefaultColor } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";

import { VaultNavItemType } from "../models/vault-nav-view-model";

import { DefaultVaultNavService } from "./default-vault-nav.service";

/** Build a minimal Organization with just the fields the service reads. */
function makeOrg(name: string, productTierType: ProductTierType): Organization {
  const org = new Organization();
  org.id = newGuid() as OrganizationId;
  org.name = name;
  org.productTierType = productTierType;
  return org;
}

describe("DefaultVaultNavService", () => {
  const userId = newGuid() as UserId;

  let service: DefaultVaultNavService;
  let organizationService: MockProxy<OrganizationService>;
  let policyService: MockProxy<PolicyService>;
  let avatarService: MockProxy<AvatarService>;
  let collectionService: MockProxy<CollectionService>;
  let i18nService: MockProxy<I18nService>;

  let memberOrgs$: BehaviorSubject<Organization[]>;
  let dataOwnership$: BehaviorSubject<boolean>;
  let avatarColor$: BehaviorSubject<string | null>;
  let defaultCollection$: BehaviorSubject<CollectionView | undefined>;

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    policyService = mock<PolicyService>();
    avatarService = mock<AvatarService>();
    collectionService = mock<CollectionService>();
    i18nService = mock<I18nService>();

    memberOrgs$ = new BehaviorSubject<Organization[]>([]);
    dataOwnership$ = new BehaviorSubject<boolean>(false);
    avatarColor$ = new BehaviorSubject<string | null>(null);
    defaultCollection$ = new BehaviorSubject<CollectionView | undefined>(undefined);

    organizationService.memberOrganizations$.mockReturnValue(memberOrgs$);
    policyService.policyAppliesToUser$
      .calledWith(PolicyType.OrganizationDataOwnership, userId)
      .mockReturnValue(dataOwnership$);
    avatarService.getUserAvatarColor$.mockReturnValue(avatarColor$);
    collectionService.defaultUserCollection$.mockReturnValue(defaultCollection$);
    i18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        DefaultVaultNavService,
        { provide: OrganizationService, useValue: organizationService },
        { provide: PolicyService, useValue: policyService },
        { provide: AvatarService, useValue: avatarService },
        { provide: CollectionService, useValue: collectionService },
        { provide: I18nService, useValue: i18nService },
      ],
    });

    service = TestBed.inject(DefaultVaultNavService);
  });

  describe("viewModel$", () => {
    it("orders the personal item first, then organizations alphabetically", async () => {
      const orgZ = makeOrg("Zeta Corp", ProductTierType.Teams);
      const orgA = makeOrg("Alpha LLC", ProductTierType.Enterprise);
      const orgM = makeOrg("Mid Org", ProductTierType.TeamsStarter);
      memberOrgs$.next([orgZ, orgA, orgM]);

      const vm = await firstValueFrom(service.viewModel$(userId));

      expect(vm.vaults.map((v) => v.label)).toEqual([
        "myVault",
        "Alpha LLC",
        "Mid Org",
        "Zeta Corp",
      ]);
    });

    it("colors Teams and Enterprise organizations purple", async () => {
      const teamsOrg = makeOrg("Teams Org", ProductTierType.Teams);
      const enterpriseOrg = makeOrg("Enterprise Org", ProductTierType.Enterprise);
      memberOrgs$.next([teamsOrg, enterpriseOrg]);

      const vm = await firstValueFrom(service.viewModel$(userId));

      const orgItems = vm.vaults.filter((v) => v.type === VaultNavItemType.Organization);
      expect(orgItems).toHaveLength(2);
      expect(orgItems.every((v) => v.color === "purple")).toBe(true);
    });

    it("colors Families and Free organizations teal", async () => {
      const familiesOrg = makeOrg("Families Org", ProductTierType.Families);
      const freeOrg = makeOrg("Free Org", ProductTierType.Free);
      memberOrgs$.next([familiesOrg, freeOrg]);

      const vm = await firstValueFrom(service.viewModel$(userId));

      const familyItems = vm.vaults.filter((v) => v.type === VaultNavItemType.Family);
      expect(familyItems).toHaveLength(2);
      expect(familyItems.every((v) => v.color === "teal")).toBe(true);
    });

    it("omits the personal item when OrganizationDataOwnership applies", async () => {
      const org = makeOrg("Policy Org", ProductTierType.Enterprise);
      memberOrgs$.next([org]);
      dataOwnership$.next(true);

      const vm = await firstValueFrom(service.viewModel$(userId));

      expect(vm.organizationDataOwnership).toBe(true);
      expect(vm.vaults).toHaveLength(1);
      expect(vm.vaults[0].id).toBe(org.id);
    });

    it("sets the org's default user collection as its My items under data ownership", async () => {
      const org = makeOrg("Policy Org", ProductTierType.Enterprise);
      memberOrgs$.next([org]);
      dataOwnership$.next(true);
      const collection = new CollectionView({
        id: "col-1" as CollectionId,
        organizationId: org.id,
        name: "My items",
      });
      defaultCollection$.next(collection);

      const vm = await firstValueFrom(service.viewModel$(userId));

      expect(collectionService.defaultUserCollection$).toHaveBeenCalledWith(userId, org.id);
      expect(vm.vaults[0].defaultUserCollectionId).toBe("col-1");
    });

    it("keeps the personal item when OrganizationDataOwnership applies with no member organizations", async () => {
      memberOrgs$.next([]);
      dataOwnership$.next(true);

      const vm = await firstValueFrom(service.viewModel$(userId));

      expect(vm.vaults).toHaveLength(1);
      expect(vm.vaults[0].type).toBe(VaultNavItemType.Personal);
      expect(vm.organizationDataOwnership).toBe(false);
    });

    it("colors the personal item with the shared default avatar color", async () => {
      memberOrgs$.next([]);

      const vm = await firstValueFrom(service.viewModel$(userId));

      expect(vm.vaults[0].color).toBe(getAvatarDefaultColor(userId));
    });

    it("colors the personal item with the user's custom avatar color when one is set", async () => {
      memberOrgs$.next([]);
      avatarColor$.next("#ff0000");

      const vm = await firstValueFrom(service.viewModel$(userId));

      expect(vm.vaults[0].color).toBe("#ff0000");
    });

    // The nav, the vault page, and the route guard all read this for the same user.
    it("shares one stream per user rather than rebuilding it per caller", () => {
      const otherUserId = newGuid() as UserId;

      expect(service.viewModel$(userId)).toBe(service.viewModel$(userId));
      expect(service.viewModel$(otherUserId)).not.toBe(service.viewModel$(userId));
    });
  });
});
