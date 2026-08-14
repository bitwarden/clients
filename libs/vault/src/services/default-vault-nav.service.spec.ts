import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
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
  let avatarService: MockProxy<AvatarService>;
  let i18nService: MockProxy<I18nService>;

  let activeAccount$: BehaviorSubject<Account | null>;
  let memberOrgs$: BehaviorSubject<Organization[]>;
  let dataOwnership$: BehaviorSubject<boolean>;
  let avatarColor$: BehaviorSubject<string | null>;

  beforeEach(() => {
    accountService = mock<AccountService>();
    organizationService = mock<OrganizationService>();
    policyService = mock<PolicyService>();
    avatarService = mock<AvatarService>();
    i18nService = mock<I18nService>();

    activeAccount$ = new BehaviorSubject<Account | null>(mockAccount);
    memberOrgs$ = new BehaviorSubject<Organization[]>([]);
    dataOwnership$ = new BehaviorSubject<boolean>(false);
    avatarColor$ = new BehaviorSubject<string | null>(null);

    accountService.activeAccount$ = activeAccount$;
    organizationService.memberOrganizations$.mockReturnValue(memberOrgs$);
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
        { provide: AvatarService, useValue: avatarService },
        { provide: I18nService, useValue: i18nService },
      ],
    });

    service = TestBed.inject(DefaultVaultNavService);
  });

  describe("Scenario: No organization memberships", () => {
    it("emits a single 'My vault' item regardless of plan", async () => {
      memberOrgs$.next([]);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.vaults).toHaveLength(1);
      expect(vm.vaults[0].type).toBe(VaultNavItemType.Personal);
      expect(vm.vaults[0].label).toBe("myVault");
    });
  });

  describe("Scenario: Organization memberships", () => {
    it("lists the personal vault first, then orgs alphabetically", async () => {
      const orgZ = makeOrg("Zeta Corp", ProductTierType.Teams);
      const orgA = makeOrg("Alpha LLC", ProductTierType.Enterprise);
      const orgM = makeOrg("Mid Org", ProductTierType.TeamsStarter);
      memberOrgs$.next([orgZ, orgA, orgM]);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.vaults).toHaveLength(4);
      expect(vm.vaults[0].type).toBe(VaultNavItemType.Personal);
      expect(vm.vaults[0].label).toBe("myVault");
      expect(vm.vaults[1].label).toBe("Alpha LLC");
      expect(vm.vaults[2].label).toBe("Mid Org");
      expect(vm.vaults[3].label).toBe("Zeta Corp");
    });

    it("assigns purple to a Teams/Enterprise org and teal to a Families org", async () => {
      const teamsOrg = makeOrg("Teams Org", ProductTierType.Teams);
      const familyOrg = makeOrg("Family Org", ProductTierType.Families);
      memberOrgs$.next([teamsOrg, familyOrg]);

      const vm = await firstValueFrom(service.viewModel$);

      const teamsItem = vm.vaults.find((v) => v.id === teamsOrg.id);
      const familyItem = vm.vaults.find((v) => v.id === familyOrg.id);
      expect(teamsItem?.color).toBe("purple");
      expect(teamsItem?.type).toBe(VaultNavItemType.Organization);
      expect(familyItem?.color).toBe("teal");
      expect(familyItem?.type).toBe(VaultNavItemType.Family);
    });
  });

  describe("Scenario: OrganizationDataOwnership policy enabled", () => {
    it("omits the personal vault — vaults contains only org vaults", async () => {
      const org = makeOrg("Policy Org", ProductTierType.Enterprise);
      memberOrgs$.next([org]);
      dataOwnership$.next(true);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.organizationDataOwnership).toBe(true);
      expect(vm.vaults).toHaveLength(1);
      expect(vm.vaults[0].id).toBe(org.id);
      expect(vm.vaults.some((v) => v.type === VaultNavItemType.Personal)).toBe(false);
    });
  });

  describe("Scenario: Signed out", () => {
    it("emits an empty view model when no user is signed in", async () => {
      activeAccount$.next(null);

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.vaults).toHaveLength(0);
      expect(vm.organizationDataOwnership).toBe(false);
    });
  });

  describe("Scenario: Visibility is presentation-only", () => {
    it("emits only display data — no access-control or cipher state", async () => {
      const org = makeOrg("Restricted Org", ProductTierType.Enterprise);
      memberOrgs$.next([org]);

      const vm = await firstValueFrom(service.viewModel$);

      const vmKeys = Object.keys(vm);
      const accessControlKeys = ["canCreateCipher", "canManageUsers", "permissions", "policies"];
      for (const key of accessControlKeys) {
        expect(vmKeys).not.toContain(key);
      }
    });
  });

  describe("color mapping", () => {
    it("assigns the personal vault the same color getAvatarDefaultColor produces for the id", async () => {
      memberOrgs$.next([]);

      const vm = await firstValueFrom(service.viewModel$);

      // Assert exact parity with the shared algorithm — a different color for the same id fails.
      expect(vm.vaults[0].color).toBe(getAvatarDefaultColor(userId, mockAccount.name));
    });

    it("uses the user's custom avatar color for the personal vault when one is set", async () => {
      memberOrgs$.next([]);
      avatarColor$.next("#ff0000");

      const vm = await firstValueFrom(service.viewModel$);

      expect(vm.vaults[0].color).toBe("#ff0000");
    });
  });
});
