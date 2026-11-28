import { TestBed } from "@angular/core/testing";
import { Router, UrlTree } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Observable, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeStateProvider,
  mockAccountServiceWith,
  ObservableTracker,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";

import {
  canAccessHealthDesktop,
  canAccessHealthDetailDesktop,
  DesktopHealthAccessService,
} from "./desktop-health-access.service";

describe("DesktopHealthAccessService", () => {
  const userId = Utils.newGuid() as UserId;

  const organization = (productTierType: ProductTierType) => ({ productTierType }) as Organization;

  let configService: MockProxy<ConfigService>;
  let organizationService: MockProxy<OrganizationService>;
  let stateProvider: FakeStateProvider;
  let service: DesktopHealthAccessService;
  let router: MockProxy<Router>;
  let toastService: MockProxy<ToastService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let activeAccount$: BehaviorSubject<Account | null>;

  function setFeatureFlag(enabled: boolean) {
    configService.getFeatureFlag$
      .calledWith(FeatureFlag.DesktopVaultHealth)
      .mockReturnValue(of(enabled));
  }

  function setOrganizations(organizations: Organization[]) {
    organizationService.organizations$.calledWith(userId).mockReturnValue(of(organizations));
  }

  function runGuard(guard: typeof canAccessHealthDesktop) {
    return TestBed.runInInjectionContext(() =>
      firstValueFrom(guard(null as never, null as never) as Observable<boolean | UrlTree>),
    );
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    organizationService = mock<OrganizationService>();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    router = mock<Router>();
    router.createUrlTree.mockReturnValue({} as UrlTree);
    toastService = mock<ToastService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        DesktopHealthAccessService,
        { provide: ConfigService, useValue: configService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: StateProvider, useValue: stateProvider },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: { activeAccount$ } },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
      ],
    });

    service = TestBed.inject(DesktopHealthAccessService);
  });

  describe("healthEnabled$", () => {
    const organizationSets: [string, ProductTierType[], boolean][] = [
      ["a personal account", [], true],
      ["a free organization member", [ProductTierType.Free], true],
      ["a families organization member", [ProductTierType.Families], true],
      [
        "a member of free and families organizations",
        [ProductTierType.Free, ProductTierType.Families],
        true,
      ],
      ["a teams organization member", [ProductTierType.Teams], false],
      ["a teams starter organization member", [ProductTierType.TeamsStarter], false],
      ["an enterprise organization member", [ProductTierType.Enterprise], false],
      [
        "a member of free and enterprise organizations",
        [ProductTierType.Free, ProductTierType.Enterprise],
        false,
      ],
    ];

    it.each(organizationSets)(
      "is disabled for %s when the feature flag is off",
      async (_description, tiers) => {
        setFeatureFlag(false);
        setOrganizations(tiers.map(organization));

        await expect(firstValueFrom(service.healthEnabled$(userId))).resolves.toBe(false);
      },
    );

    it.each(organizationSets)(
      "for %s when the feature flag is on, is enabled: %s",
      async (_description, tiers, expected) => {
        setFeatureFlag(true);
        setOrganizations(tiers.map(organization));

        await expect(firstValueFrom(service.healthEnabled$(userId))).resolves.toBe(expected);
      },
    );

    it("treats a user with no organization list as a personal account", async () => {
      setFeatureFlag(true);
      organizationService.organizations$
        .calledWith(userId)
        .mockReturnValue(of(undefined as unknown as Organization[]));

      await expect(firstValueFrom(service.healthEnabled$(userId))).resolves.toBe(true);
    });
  });

  describe("hasRunHealthScan$", () => {
    it("emits false when the user has never run a Health scan", async () => {
      await expect(firstValueFrom(service.hasRunHealthScan$(userId))).resolves.toBe(false);
    });

    it("emits true once the user has run a Health scan", async () => {
      await service.setHasRunHealthScan(userId);

      await expect(firstValueFrom(service.hasRunHealthScan$(userId))).resolves.toBe(true);
    });

    it("emits when the user runs a Health scan", async () => {
      const tracker = new ObservableTracker(service.hasRunHealthScan$(userId));

      await service.setHasRunHealthScan(userId);

      expect(tracker.emissions).toEqual([false, true]);
    });

    it("reads the state scoped to the provided user", async () => {
      await firstValueFrom(service.hasRunHealthScan$(userId));

      expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(
        expect.objectContaining({ key: "hasRunHealthScan" }),
        userId,
      );
    });
  });

  describe("setHasRunHealthScan", () => {
    it("persists the flag for the provided user", async () => {
      await service.setHasRunHealthScan(userId);

      expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "hasRunHealthScan" }),
        true,
        userId,
      );
    });
  });

  describe("canAccessHealthDesktop", () => {
    it("lets a user with Health access through", async () => {
      setFeatureFlag(true);
      setOrganizations([]);

      await expect(runGuard(canAccessHealthDesktop)).resolves.toBe(true);
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("redirects to the vault with a toast when the feature flag is off", async () => {
      setFeatureFlag(false);
      setOrganizations([]);

      const result = await runGuard(canAccessHealthDesktop);

      expect(result).not.toBe(true);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "",
        message: "noPermissionsViewPage",
      });
    });

    it("redirects to the vault when the user belongs to a paid organization", async () => {
      setFeatureFlag(true);
      setOrganizations([organization(ProductTierType.Enterprise)]);

      const result = await runGuard(canAccessHealthDesktop);

      expect(result).not.toBe(true);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
    });

    it("redirects when there is no active account", async () => {
      activeAccount$.next(null);

      const result = await runGuard(canAccessHealthDesktop);

      expect(result).not.toBe(true);
      expect(configService.getFeatureFlag$).not.toHaveBeenCalled();
    });
  });

  describe("canAccessHealthDetailDesktop", () => {
    function setPremium(hasPremium: boolean) {
      billingAccountProfileStateService.hasPremiumFromAnySource$
        .calledWith(userId)
        .mockReturnValue(of(hasPremium));
    }

    it("lets a Premium user through", async () => {
      setPremium(true);

      await expect(runGuard(canAccessHealthDetailDesktop)).resolves.toBe(true);
      expect(router.createUrlTree).not.toHaveBeenCalled();
    });

    it("sends a user without Premium to the Health overview without a toast", async () => {
      setPremium(false);

      const result = await runGuard(canAccessHealthDetailDesktop);

      expect(result).not.toBe(true);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/health"]);
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("redirects when there is no active account", async () => {
      activeAccount$.next(null);

      const result = await runGuard(canAccessHealthDetailDesktop);

      expect(result).not.toBe(true);
      expect(billingAccountProfileStateService.hasPremiumFromAnySource$).not.toHaveBeenCalled();
    });
  });
});
