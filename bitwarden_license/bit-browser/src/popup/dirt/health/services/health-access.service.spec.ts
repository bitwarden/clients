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
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeStateProvider,
  mockAccountServiceWith,
  ObservableTracker,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";

import { canAccessHealthDetail, HealthAccessService } from "./health-access.service";

describe("HealthAccessService", () => {
  const userId = Utils.newGuid() as UserId;

  const freeOrganization = { productTierType: ProductTierType.Free } as Organization;
  const familiesOrganization = { productTierType: ProductTierType.Families } as Organization;
  const teamsOrganization = { productTierType: ProductTierType.Teams } as Organization;
  const teamsStarterOrganization = {
    productTierType: ProductTierType.TeamsStarter,
  } as Organization;
  const enterpriseOrganization = { productTierType: ProductTierType.Enterprise } as Organization;

  let configService: MockProxy<ConfigService>;
  let organizationService: MockProxy<OrganizationService>;
  let stateProvider: FakeStateProvider;
  let service: HealthAccessService;
  let router: MockProxy<Router>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let activeAccount$: BehaviorSubject<Account | null>;

  function setFeatureFlag(enabled: boolean) {
    configService.getFeatureFlag$
      .calledWith(FeatureFlag.BrowserExtensionHealthReport)
      .mockReturnValue(of(enabled));
  }

  function setOrganizations(organizations: Organization[]) {
    organizationService.organizations$.calledWith(userId).mockReturnValue(of(organizations));
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    organizationService = mock<OrganizationService>();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));

    router = mock<Router>();
    router.createUrlTree.mockReturnValue({} as UrlTree);
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    activeAccount$ = new BehaviorSubject<Account | null>({ id: userId } as Account);

    TestBed.configureTestingModule({
      providers: [
        HealthAccessService,
        { provide: ConfigService, useValue: configService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: StateProvider, useValue: stateProvider },
        { provide: Router, useValue: router },
        { provide: AccountService, useValue: { activeAccount$ } },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
      ],
    });

    service = TestBed.inject(HealthAccessService);
  });

  describe("healthEnabled$", () => {
    describe("when the feature flag is off", () => {
      it("is disabled for a personal account", async () => {
        setFeatureFlag(false);
        setOrganizations([]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(false);
      });

      it("is disabled for a free organization member", async () => {
        setFeatureFlag(false);
        setOrganizations([freeOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(false);
      });

      it("is disabled for a families organization member", async () => {
        setFeatureFlag(false);
        setOrganizations([familiesOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(false);
      });
    });

    describe("when the feature flag is on", () => {
      beforeEach(() => {
        setFeatureFlag(true);
      });

      it("is enabled for a personal account", async () => {
        setOrganizations([]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(true);
      });

      it("is enabled for a free organization member", async () => {
        setOrganizations([freeOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(true);
      });

      it("is enabled for a families organization member", async () => {
        setOrganizations([familiesOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(true);
      });

      it("is enabled for a member of both a free and a families organization", async () => {
        setOrganizations([freeOrganization, familiesOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(true);
      });

      it("is disabled for a teams organization member", async () => {
        setOrganizations([teamsOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(false);
      });

      it("is disabled for a teams starter organization member", async () => {
        setOrganizations([teamsStarterOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(false);
      });

      it("is disabled for an enterprise organization member", async () => {
        setOrganizations([enterpriseOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(false);
      });

      it("is disabled for a member of both a free and an enterprise organization", async () => {
        setOrganizations([freeOrganization, enterpriseOrganization]);

        const healthEnabled = await firstValueFrom(service.healthEnabled$(userId));

        expect(healthEnabled).toBe(false);
      });
    });
  });

  describe("healthHasBeenOpened$", () => {
    it("emits false when the User has never opened the Health report", async () => {
      const hasBeenOpened = await firstValueFrom(service.healthHasBeenOpened$(userId));

      expect(hasBeenOpened).toBe(false);
    });

    it("emits true once the User has opened the Health report", async () => {
      await service.setHealthHasBeenOpened(userId);

      const hasBeenOpened = await firstValueFrom(service.healthHasBeenOpened$(userId));

      expect(hasBeenOpened).toBe(true);
    });

    it("emits when the User opens the Health report", async () => {
      const tracker = new ObservableTracker(service.healthHasBeenOpened$(userId));

      await service.setHealthHasBeenOpened(userId);

      expect(tracker.emissions).toEqual([false, true]);
    });

    it("reads the state scoped to the provided User", async () => {
      await firstValueFrom(service.healthHasBeenOpened$(userId));

      expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(
        expect.objectContaining({ key: "healthTabOpened" }),
        userId,
      );
    });
  });

  describe("setHealthHasBeenOpened", () => {
    it("persists the flag for the provided User", async () => {
      await service.setHealthHasBeenOpened(userId);

      expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "healthTabOpened" }),
        true,
        userId,
      );
    });
  });

  describe("hasRunHealthScan$", () => {
    it("emits false when the User has never run a Health scan", async () => {
      const hasRunScan = await firstValueFrom(service.hasRunHealthScan$(userId));

      expect(hasRunScan).toBe(false);
    });

    it("emits true once the User has run a Health scan", async () => {
      await service.setHasRunHealthScan(userId);

      const hasRunScan = await firstValueFrom(service.hasRunHealthScan$(userId));

      expect(hasRunScan).toBe(true);
    });

    it("reads the state scoped to the provided User", async () => {
      await firstValueFrom(service.hasRunHealthScan$(userId));

      expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(
        expect.objectContaining({ key: "hasRunHealthScan" }),
        userId,
      );
    });
  });

  describe("setHasRunHealthScan", () => {
    it("persists the flag for the provided User", async () => {
      await service.setHasRunHealthScan(userId);

      expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
        expect.objectContaining({ key: "hasRunHealthScan" }),
        true,
        userId,
      );
    });
  });

  describe("canAccessHealthDetail", () => {
    /** Runs the guard the way the router does, ignoring the snapshots it does not read. */
    function runGuard() {
      return TestBed.runInInjectionContext(() =>
        firstValueFrom(
          canAccessHealthDetail(null as never, null as never) as Observable<boolean | UrlTree>,
        ),
      );
    }

    function setPremium(hasPremium: boolean) {
      billingAccountProfileStateService.hasPremiumFromAnySource$
        .calledWith(userId)
        .mockReturnValue(of(hasPremium));
    }

    it("lets a Premium User through", async () => {
      setPremium(true);

      await expect(runGuard()).resolves.toBe(true);
      expect(router.createUrlTree).not.toHaveBeenCalled();
    });

    it("sends a User without Premium to the Health Overview", async () => {
      // The Overview is the coherent landing place: they still see the gauge, with
      // the categories locked.
      setPremium(false);

      const result = await runGuard();

      expect(result).not.toBe(true);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/tabs/health"]);
    });

    it("redirects when there is no active account", async () => {
      activeAccount$.next(null);

      const result = await runGuard();

      expect(result).not.toBe(true);
      expect(billingAccountProfileStateService.hasPremiumFromAnySource$).not.toHaveBeenCalled();
    });

    it("checks Premium for the active account", async () => {
      setPremium(true);

      await runGuard();

      expect(billingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenCalledWith(
        userId,
      );
    });
  });
});
