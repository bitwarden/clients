import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { getAvatarDefaultColor } from "@bitwarden/components";

import { VaultNavItemType } from "../models/vault-nav-view-model";

import { DefaultVaultNavService } from "./default-vault-nav.service";

/** Build a minimal Organization with just the fields the service reads. */
function makeOrg(
  name: string,
  productTierType: ProductTierType,
  id?: OrganizationId,
): Organization {
  const org = new Organization();
  org.id = (id ?? Utils.newGuid()) as OrganizationId;
  org.name = name;
  org.productTierType = productTierType;
  return org;
}

describe("DefaultVaultNavService", () => {
  const userId = Utils.newGuid() as UserId;
  const mockAccount: Account = {
    id: userId,
    email: "user@example.com",
    emailVerified: true,
    name: "Test User",
    creationDate: new Date(),
  };

  let service: DefaultVaultNavService;
  let accountService: MockProxy<AccountService>;
  let organizationService: MockProxy<OrganizationService>;
  let policyService: MockProxy<PolicyService>;
  let billingService: MockProxy<BillingAccountProfileStateService>;
  let avatarService: MockProxy<AvatarService>;
  let i18nService: MockProxy<I18nService>;

  let activeAccount$: BehaviorSubject<Account | null>;
  let memberOrgs$: BehaviorSubject<Organization[]>;
  let hasPremium$: BehaviorSubject<boolean>;
  let dataOwnership$: BehaviorSubject<boolean>;
  let avatarColor$: BehaviorSubject<string | null>;

  beforeEach(() => {
    accountService = mock<AccountService>();
    organizationService = mock<OrganizationService>();
    policyService = mock<PolicyService>();
    billingService = mock<BillingAccountProfileStateService>();
    avatarService = mock<AvatarService>();
    i18nService = mock<I18nService>();

    activeAccount$ = new BehaviorSubject<Account | null>(mockAccount);
    memberOrgs$ = new BehaviorSubject<Organization[]>([]);
    hasPremium$ = new BehaviorSubject<boolean>(false);
    dataOwnership$ = new BehaviorSubject<boolean>(false);
    avatarColor$ = new BehaviorSubject<string | null>(null);

    accountService.activeAccount$ = activeAccount$;
    organizationService.memberOrganizations$.mockReturnValue(memberOrgs$);
    billingService.hasPremiumFromAnySource$.mockReturnValue(hasPremium$);
    policyService.policyAppliesToUser$
      .calledWith(PolicyType.OrganizationDataOwnership, userId)
      .mockReturnValue(dataOwnership$);
    avatarService.getUserAvatarColor$.mockReturnValue(avatarColor$);
    i18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        DefaultVaultNavService,
        { provide: AccountService, useValue: accountService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: PolicyService, useValue: policyService },
        { provide: BillingAccountProfileStateService, useValue: billingService },
        { provide: AvatarService, useValue: avatarService },
        { provide: I18nService, useValue: i18nService },
      ],
    });

    service = TestBed.inject(DefaultVaultNavService);
  });

  describe("Scenario: Personal vault only on a free plan", () => {
    it("hides the Vaults header, shows 'My vault' as a plain item, no 'All items'", async () => {
      memberOrgs$.next([]);
      hasPremium$.next(false);
      dataOwnership$.next(false);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.showVaultsHeader).toBe(false);
      expect(vm.vaults).toHaveLength(0);
      expect(vm.myVaultItem).not.toBeNull();
      expect(vm.myVaultItem?.label).toBe("myVault");
      expect(vm.myVaultItem?.type).toBe(VaultNavItemType.Personal);
      expect(vm.allItemsItem).toBeNull();
    });
  });

  describe("Scenario: Personal vault only on premium", () => {
    it("hides the Vaults header, shows 'All items' (brand color), no 'My vault'", async () => {
      memberOrgs$.next([]);
      hasPremium$.next(true);
      dataOwnership$.next(false);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.showVaultsHeader).toBe(false);
      expect(vm.vaults).toHaveLength(0);
      expect(vm.allItemsItem).not.toBeNull();
      expect(vm.allItemsItem?.label).toBe("allItems");
      expect(vm.allItemsItem?.color).toBe("brand");
      expect(vm.allItemsItem?.type).toBe(VaultNavItemType.AllItems);
      expect(vm.myVaultItem).toBeNull();
    });
  });

  describe("Scenario: Organization vault plus personal vault", () => {
    it("shows the Vaults header with 'My vault' first and org following", async () => {
      const org = makeOrg("Acme Corp", ProductTierType.Teams);
      memberOrgs$.next([org]);
      hasPremium$.next(false);
      dataOwnership$.next(false);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.showVaultsHeader).toBe(true);
      expect(vm.myVaultItem).toBeNull();
      expect(vm.allItemsItem).toBeNull();
      expect(vm.vaults).toHaveLength(2);
      expect(vm.vaults[0].type).toBe(VaultNavItemType.Personal);
      expect(vm.vaults[0].label).toBe("myVault");
      expect(vm.vaults[1].id).toBe(org.id);
      expect(vm.vaults[1].type).toBe(VaultNavItemType.Organization);
    });

    it("assigns purple to a Teams/Enterprise org and teal to a Families org", async () => {
      const teamsOrg = makeOrg("Teams Org", ProductTierType.Teams);
      const familyOrg = makeOrg("Family Org", ProductTierType.Families);
      memberOrgs$.next([teamsOrg, familyOrg]);
      hasPremium$.next(false);
      dataOwnership$.next(false);

      const vm = await firstValueFrom(service.viewModel$);

      const teamsItem = vm.vaults.find((v) => v.id === teamsOrg.id);
      const familyItem = vm.vaults.find((v) => v.id === familyOrg.id);
      expect(teamsItem?.color).toBe("purple");
      expect(familyItem?.color).toBe("teal");
      expect(familyItem?.type).toBe(VaultNavItemType.Family);
    });
  });

  describe("Scenario: Centralize-organization-ownership policy enabled", () => {
    it("hides the Vaults header, enables orgDefaultExpanded and showMyItemsGroup", async () => {
      const org = makeOrg("Policy Org", ProductTierType.Enterprise);
      memberOrgs$.next([org]);
      hasPremium$.next(false);
      dataOwnership$.next(true);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.showVaultsHeader).toBe(false);
      expect(vm.orgDefaultExpanded).toBe(true);
      expect(vm.showMyItemsGroup).toBe(true);
      expect(vm.vaults).toHaveLength(2);
    });
  });

  describe("Scenario: Multiple organization vaults", () => {
    it("lists 'My vault' first then orgs alphabetically", async () => {
      const orgZ = makeOrg("Zeta Corp", ProductTierType.Teams);
      const orgA = makeOrg("Alpha LLC", ProductTierType.Enterprise);
      const orgM = makeOrg("Mid Org", ProductTierType.TeamsStarter);
      memberOrgs$.next([orgZ, orgA, orgM]);
      hasPremium$.next(false);
      dataOwnership$.next(false);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.vaults[0].type).toBe(VaultNavItemType.Personal);
      expect(vm.vaults[1].label).toBe("Alpha LLC");
      expect(vm.vaults[2].label).toBe("Mid Org");
      expect(vm.vaults[3].label).toBe("Zeta Corp");
    });
  });

  describe("Scenario: Visibility is presentation-only", () => {
    it("emits only display flags — no access-control or cipher data", async () => {
      const org = makeOrg("Restricted Org", ProductTierType.Enterprise);
      memberOrgs$.next([org]);
      dataOwnership$.next(false);

      const vm = await firstValueFrom(service.viewModel$);

      const vmKeys = Object.keys(vm);
      const accessControlKeys = ["canCreateCipher", "canManageUsers", "permissions", "policies"];
      for (const key of accessControlKeys) {
        expect(vmKeys).not.toContain(key);
      }
    });

    it("emits an empty/hidden view model when no user is signed in", async () => {
      activeAccount$.next(null);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.showVaultsHeader).toBe(false);
      expect(vm.vaults).toHaveLength(0);
      expect(vm.myVaultItem).toBeNull();
      expect(vm.allItemsItem).toBeNull();
      expect(vm.orgDefaultExpanded).toBe(false);
      expect(vm.showMyItemsGroup).toBe(false);
    });
  });

  describe("color mapping", () => {
    it("assigns the same color to 'My vault' as getAvatarDefaultColor produces for the same id", async () => {
      memberOrgs$.next([]);
      hasPremium$.next(false);

      const vm = await firstValueFrom(service.viewModel$);

      // Assert exact parity with the shared algorithm — a different color for the same id fails.
      expect(vm.myVaultItem?.color).toBe(getAvatarDefaultColor(userId, mockAccount.name));
    });

    it("uses the user's custom avatar color for 'My vault' when one is set", async () => {
      memberOrgs$.next([]);
      hasPremium$.next(false);
      avatarColor$.next("#ff0000");

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.myVaultItem?.color).toBe("#ff0000");
    });

    it("assigns brand color to the 'All items' item", async () => {
      memberOrgs$.next([]);
      hasPremium$.next(true);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.allItemsItem?.color).toBe("brand");
    });
  });
});
